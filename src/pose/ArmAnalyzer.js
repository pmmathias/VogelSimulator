import { angleBetween, clamp, remap } from '../utils/math.js';

// MediaPipe landmark indices
const LEFT_SHOULDER = 11;
const LEFT_ELBOW = 13;
const LEFT_WRIST = 15;
const RIGHT_SHOULDER = 12;
const RIGHT_ELBOW = 14;
const RIGHT_WRIST = 16;

/**
 * Analyzes arm positions from pose landmarks to produce flight control inputs.
 * Uses direction-change detection for robust flap recognition.
 */
export class ArmAnalyzer {
  constructor() {
    this.calibrated = false;
    this.restShoulderY = 0.5;

    // Flap detection — direction change based
    this._prevElevation = 0;
    this._movingUp = false;
    this._directionChanges = 0;
    this._dirChangeWindow = [];   // timestamps of direction changes
    this._lastFlapTime = 0;
    this._flapCooldown = 150;     // ms — fast response

    // Smoothed outputs
    this.flapStrength = 0;
    this.roll = 0;
    this.pitch = 0;
    this.wingSpread = 1;

    // Gesture label for overlay
    this.gesture = 'GLIDE';

    // Missing landmarks handling
    this._missingFrames = 0;

    // Dive intent counter — must be consistently low wingSpread to trigger dive
    this._diveIntentFrames = 0;
    this._diveActive = false;

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
    this.calibrated = true;
  }

  _isVisible(lm) {
    if (!lm) return false;
    const vis = lm.visibility ?? 1;
    return vis > 0.3 && lm.x > 0.02 && lm.x < 0.98 && lm.y > 0.02 && lm.y < 0.98;
  }

  analyze(landmarks) {
    // --- Handle missing/invalid landmarks → fade to GLIDE ---
    if (!landmarks || landmarks.length < 17) {
      this._missingFrames++;
      this.flapStrength = 0;

      // After 5 missing frames: immediately fade to neutral glide
      if (this._missingFrames > 5) {
        const fadeRate = 0.15; // fast fade to safety
        this.roll += (0 - this.roll) * fadeRate;
        this.pitch += (0 - this.pitch) * fadeRate;
        this.wingSpread += (1.0 - this.wingSpread) * fadeRate; // spread wings = glide
        this.gesture = 'NO TRACKING';
        this._diveIntentFrames = 0;
        this._diveActive = false;
      }

      return {
        flapStrength: 0, roll: this.roll, pitch: this.pitch,
        wingSpread: this.wingSpread,
      };
    }

    this._missingFrames = 0;

    const ls = landmarks[LEFT_SHOULDER];
    const le = landmarks[LEFT_ELBOW];
    const lw = landmarks[LEFT_WRIST];
    const rs = landmarks[RIGHT_SHOULDER];
    const re = landmarks[RIGHT_ELBOW];
    const rw = landmarks[RIGHT_WRIST];

    // Check arm visibility
    this.leftVisible = this._isVisible(lw) && this._isVisible(ls);
    this.rightVisible = this._isVisible(rw) && this._isVisible(rs);

    // If neither arm visible but landmarks exist (body only) → glide, don't dive
    if (!this.leftVisible && !this.rightVisible) {
      this._missingFrames++;
      this.flapStrength = 0;
      this.wingSpread += (1.0 - this.wingSpread) * 0.1; // fade to glide
      this._diveIntentFrames = 0;
      this.gesture = 'GLIDE';
      return {
        flapStrength: 0, roll: this.roll, pitch: this.pitch,
        wingSpread: this.wingSpread,
      };
    }

    // --- Arm elevation ---
    if (this.leftVisible) this.leftArmElevation = ls.y - lw.y;
    if (this.rightVisible) this.rightArmElevation = rs.y - rw.y;

    // Mirror if only one arm visible
    if (this.leftVisible && !this.rightVisible) {
      this.rightArmElevation = this.leftArmElevation;
    } else if (this.rightVisible && !this.leftVisible) {
      this.leftArmElevation = this.rightArmElevation;
    }

    const avgElevation = (this.leftArmElevation + this.rightArmElevation) / 2;

    // --- FLAP DETECTION: Amplitude + movement based ---
    const now = performance.now();

    // Track elevation history for amplitude
    if (!this._elevWindow) this._elevWindow = [];
    this._elevWindow.push(avgElevation);
    if (this._elevWindow.length > 20) this._elevWindow.shift();
    const elevMin = Math.min(...this._elevWindow);
    const elevMax = Math.max(...this._elevWindow);
    const amplitude = elevMax - elevMin;

    // Track movement speed (smoothed)
    const elevDelta = avgElevation - this._prevElevation;
    if (!this._moveSpeed) this._moveSpeed = 0;
    this._moveSpeed = this._moveSpeed * 0.7 + Math.abs(elevDelta) * 0.3; // smoothed
    this._prevElevation = avgElevation;

    // Flap detection: arms are moving with sufficient amplitude
    // STAYS ACTIVE as long as movement continues (not just 1 frame)
    if (amplitude > 0.02 && this._moveSpeed > 0.002) {
      // Active flapping detected!
      this.flapStrength = clamp(amplitude * 6, 0.5, 1.0);
      this._lastFlapTime = now;
    } else if (now - this._lastFlapTime < 300) {
      // Hysteresis: keep flapping for 300ms after last detection
      this.flapStrength = 0.5;
    } else {
      this.flapStrength = 0;
    }

    // --- Roll (lateral tilt) ---
    const elevationDiff = this.rightArmElevation - this.leftArmElevation;
    const targetRoll = clamp(elevationDiff * 2.5, -1, 1);
    this.roll += (targetRoll - this.roll) * 0.3;

    // --- Pitch from arm elevation (NOT shoulder lean) ---
    // Arms high = climb, arms horizontal = neutral, arms down = dive
    const isFlapping = this.flapStrength > 0;
    let targetPitch;
    if (isFlapping) {
      targetPitch = 0.1; // slight upward during flap
    } else if (avgElevation > 0.12) {
      targetPitch = clamp((avgElevation - 0.12) * 8, 0, 1); // climb
    } else if (avgElevation < -0.03) {
      targetPitch = clamp((avgElevation + 0.03) * 6, -1, 0); // dive
    } else {
      targetPitch = 0; // neutral glide
    }
    this.pitch += (targetPitch - this.pitch) * 0.3;

    // --- Wing spread ---
    const recentlyFlapped = (now - this._lastFlapTime < 600);
    const rawWingSpread = clamp(remap(avgElevation, -0.08, 0.10, 0, 1), 0, 1);
    const targetWingSpread = recentlyFlapped ? 1.0 : rawWingSpread;
    // wingSpread transitions — fast down for responsive dive, moderate up
    const spreadRate = targetWingSpread < this.wingSpread ? 0.3 : 0.15;
    this.wingSpread += (targetWingSpread - this.wingSpread) * spreadRate;

    // --- Dive intent with hysteresis ---
    // Need 10 frames to ENTER dive, but once in dive, stay until wingSpread > 0.6
    if (this.wingSpread < 0.4 && !recentlyFlapped) {
      this._diveIntentFrames++;
    } else if (this._diveActive && this.wingSpread < 0.55) {
      // Hysteresis — stay in dive until arms clearly spread
      this._diveIntentFrames = Math.max(5, this._diveIntentFrames);
    } else {
      this._diveIntentFrames = Math.max(0, this._diveIntentFrames - 1);
    }
    this._diveActive = this._diveIntentFrames > 5; // faster entry (5 frames ≈ 0.17s)

    // Apply deadzone
    if (Math.abs(this.roll) < 0.08) this.roll = 0;
    if (Math.abs(this.pitch) < 0.08) this.pitch = 0;

    // --- Gesture label ---
    if (this.flapStrength > 0) {
      this.gesture = 'FLAP!';
    } else if (this._diveActive) {
      this.gesture = 'DIVE';
    } else if (this.pitch > 0.2) {
      this.gesture = 'CLIMB';
    } else if (Math.abs(this.roll) > 0.3) {
      this.gesture = this.roll > 0 ? 'TURN LEFT' : 'TURN RIGHT';
    } else {
      this.gesture = 'GLIDE';
    }

    return {
      flapStrength: this.flapStrength,
      roll: this.roll,
      pitch: this.pitch,
      wingSpread: this.wingSpread,
      diveActive: this._diveActive,
    };
  }
}
