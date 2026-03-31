import { angleBetween, clamp, remap } from '../utils/math.js';

const LEFT_SHOULDER = 11;
const LEFT_ELBOW = 13;
const LEFT_WRIST = 15;
const RIGHT_SHOULDER = 12;
const RIGHT_ELBOW = 14;
const RIGHT_WRIST = 16;
const NOSE = 0;

/**
 * Gesture recognition from pose landmarks.
 *
 * Gestures (from arm position):
 * - FLAP: arms moving up & down (amplitude-based)
 * - GLIDE: arms spread horizontally
 * - DIVE: duck/crouch (nose drops in frame)
 * - CLIMB: arms raised high
 * - TURN: one arm higher than other
 */
export class ArmAnalyzer {
  constructor() {
    this.calibrated = false;
    this.restShoulderY = 0.5;
    this.restNoseY = 0.35; // will be set during calibration

    // Outputs (smoothed)
    this.flapStrength = 0;
    this.roll = 0;
    this.pitch = 0;
    this.wingSpread = 1;
    this.gesture = 'GLIDE';
    this._diveActive = false;

    // Flap state
    this._prevElevation = 0;
    this._moveSpeed = 0;
    this._elevWindow = [];
    this._lastFlapTime = 0;

    // Smoothed gesture state (prevents flickering)
    this._gestureHoldTime = 0;
    this._lastGesture = 'GLIDE';

    // Missing frames
    this._missingFrames = 0;

    // Raw values
    this.leftArmElevation = 0;
    this.rightArmElevation = 0;
    this.leftVisible = false;
    this.rightVisible = false;
  }

  calibrate(landmarks) {
    if (!landmarks) return;
    const ls = landmarks[LEFT_SHOULDER];
    const rs = landmarks[RIGHT_SHOULDER];
    this.restShoulderY = (ls.y + rs.y) / 2;
    const nose = landmarks[NOSE];
    if (nose) this.restNoseY = nose.y;
    this.calibrated = true;
    console.log(`Calibrated: shoulderY=${this.restShoulderY.toFixed(3)}, noseY=${this.restNoseY.toFixed(3)}`);
  }

  _isVisible(lm) {
    if (!lm) return false;
    return (lm.visibility ?? 1) > 0.3 && lm.x > 0.02 && lm.x < 0.98 && lm.y > 0.02 && lm.y < 0.98;
  }

  analyze(landmarks) {
    const now = performance.now();

    // --- Missing landmarks → fade to glide ---
    if (!landmarks || landmarks.length < 17) {
      this._missingFrames++;
      if (this._missingFrames > 5) {
        this.flapStrength *= 0.8;
        this.roll *= 0.9;
        this.pitch *= 0.9;
        this.wingSpread += (1.0 - this.wingSpread) * 0.1;
        this._diveActive = false;
        this.gesture = 'NO TRACKING';
      }
      return this._output();
    }
    this._missingFrames = 0;

    const ls = landmarks[LEFT_SHOULDER];
    const le = landmarks[LEFT_ELBOW];
    const lw = landmarks[LEFT_WRIST];
    const rs = landmarks[RIGHT_SHOULDER];
    const re = landmarks[RIGHT_ELBOW];
    const rw = landmarks[RIGHT_WRIST];
    const nose = landmarks[NOSE];

    this.leftVisible = this._isVisible(lw) && this._isVisible(ls);
    this.rightVisible = this._isVisible(rw) && this._isVisible(rs);

    if (!this.leftVisible && !this.rightVisible) {
      this.wingSpread += (1.0 - this.wingSpread) * 0.1;
      this._diveActive = false;
      this.gesture = 'GLIDE';
      return this._output();
    }

    // --- Arm elevation ---
    if (this.leftVisible) this.leftArmElevation = ls.y - lw.y;
    if (this.rightVisible) this.rightArmElevation = rs.y - rw.y;
    if (this.leftVisible && !this.rightVisible) this.rightArmElevation = this.leftArmElevation;
    if (this.rightVisible && !this.leftVisible) this.leftArmElevation = this.rightArmElevation;

    const avgElev = (this.leftArmElevation + this.rightArmElevation) / 2;

    // === 1. FLAP DETECTION (amplitude + movement speed) ===
    this._elevWindow.push(avgElev);
    if (this._elevWindow.length > 20) this._elevWindow.shift();
    const amplitude = Math.max(...this._elevWindow) - Math.min(...this._elevWindow);

    const elevDelta = avgElev - this._prevElevation;
    this._moveSpeed = this._moveSpeed * 0.7 + Math.abs(elevDelta) * 0.3;
    this._prevElevation = avgElev;

    // Flap: needs both amplitude AND active movement
    // Higher thresholds to reduce false positives
    let rawFlap = false;
    if (amplitude > 0.04 && this._moveSpeed > 0.004) {
      rawFlap = true;
      this._lastFlapTime = now;
    }

    // Hysteresis: hold flap for 400ms after last detection
    if (rawFlap) {
      this.flapStrength = clamp(amplitude * 5, 0.5, 1.0);
    } else if (now - this._lastFlapTime < 400) {
      this.flapStrength = Math.max(this.flapStrength * 0.95, 0.3);
    } else {
      this.flapStrength *= 0.85; // slow fade
      if (this.flapStrength < 0.05) this.flapStrength = 0;
    }

    // === 2. DIVE DETECTION ===
    // Method A: ducking (nose drops in frame)
    const noseY = nose ? nose.y : this.restNoseY;
    const duckAmount = noseY - this.restNoseY;
    const isDucking = duckAmount > 0.05;

    // Method B: arms clearly below shoulders (not just slightly)
    const armsDown = avgElev < -0.08; // needs significant arm drop

    // Either method triggers dive (when not flapping)
    const wantsDive = (isDucking || armsDown) && this.flapStrength < 0.1;

    // Hysteresis: need 8 frames of dive intent to enter, quick exit
    if (!this._diveCounter) this._diveCounter = 0;
    if (wantsDive) {
      this._diveCounter = Math.min(this._diveCounter + 1, 15);
    } else {
      this._diveCounter = Math.max(this._diveCounter - 2, 0);
    }

    if (this._diveCounter >= 8 && !this._diveActive) {
      this._diveActive = true;
    } else if (this._diveActive && this._diveCounter < 3) {
      this._diveActive = false;
    }

    // === 3. ROLL (one arm higher) ===
    const elevDiff = this.rightArmElevation - this.leftArmElevation;
    const targetRoll = clamp(elevDiff * 2.5, -1, 1);
    this.roll += (targetRoll - this.roll) * 0.15; // slower = less jittery

    // === 4. PITCH (from arm elevation, suppressed during flap) ===
    let targetPitch;
    if (this._diveActive) {
      targetPitch = -0.6;
    } else if (this.flapStrength > 0.1) {
      targetPitch = 0.1;
    } else if (avgElev > 0.12) {
      targetPitch = clamp((avgElev - 0.12) * 6, 0, 0.8);
    } else {
      targetPitch = 0;
    }
    this.pitch += (targetPitch - this.pitch) * 0.15; // slower = smoother

    // === 5. WING SPREAD ===
    const recentlyFlapped = (now - this._lastFlapTime < 600);
    const rawSpread = clamp(remap(avgElev, -0.08, 0.10, 0, 1), 0, 1);
    const targetSpread = this._diveActive ? 0 : (recentlyFlapped ? 1.0 : rawSpread);
    const spreadRate = targetSpread < this.wingSpread ? 0.2 : 0.1;
    this.wingSpread += (targetSpread - this.wingSpread) * spreadRate;

    // === 6. GESTURE LABEL (with hold time to prevent flickering) ===
    let newGesture;
    if (this._diveActive) {
      newGesture = 'DIVE';
    } else if (this.flapStrength > 0.1) {
      newGesture = 'FLAP!';
    } else if (this.pitch > 0.15) {
      newGesture = 'CLIMB';
    } else if (Math.abs(this.roll) > 0.25) {
      newGesture = this.roll > 0 ? 'TURN LEFT' : 'TURN RIGHT';
    } else {
      newGesture = 'GLIDE';
    }

    // Hold current gesture for at least 300ms to prevent flickering
    if (newGesture !== this._lastGesture) {
      if (now - this._gestureHoldTime > 300) {
        this.gesture = newGesture;
        this._lastGesture = newGesture;
        this._gestureHoldTime = now;
      }
    } else {
      this.gesture = newGesture;
      this._gestureHoldTime = now;
    }

    // Deadzone
    if (Math.abs(this.roll) < 0.06) this.roll = 0;
    if (Math.abs(this.pitch) < 0.06) this.pitch = 0;

    return this._output();
  }

  _output() {
    return {
      flapStrength: this.flapStrength,
      roll: this.roll,
      pitch: this.pitch,
      wingSpread: this.wingSpread,
      diveActive: this._diveActive,
    };
  }
}
