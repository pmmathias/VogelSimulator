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
 * Robust handling of missing landmarks and out-of-frame hands.
 */
export class ArmAnalyzer {
  constructor() {
    this.calibrated = false;
    this.restShoulderY = 0.5;
    this.restElbowAngle = Math.PI;

    // Flap detection
    this._elevHistory = [];       // avg elevation history
    this._historyMaxLen = 10;     // shorter = faster response
    this._lastFlapTime = 0;
    this._flapCooldown = 200;     // ms

    // Smoothed outputs
    this.flapStrength = 0;
    this.roll = 0;
    this.pitch = 0;
    this.wingSpread = 1;

    // Gesture label for overlay
    this.gesture = 'GLIDE';

    // Missing landmarks counter
    this._missingFrames = 0;

    // Raw values
    this.leftArmElevation = 0;
    this.rightArmElevation = 0;
    this.leftElbowAngle = 0;
    this.rightElbowAngle = 0;
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

  /**
   * Check if a landmark is visible (confidence > 0.5 and within frame).
   */
  _isVisible(lm) {
    if (!lm) return false;
    const vis = lm.visibility ?? 1;
    return vis > 0.4 && lm.x > 0.01 && lm.x < 0.99 && lm.y > 0.01 && lm.y < 0.99;
  }

  analyze(landmarks) {
    // --- Handle missing/invalid landmarks gracefully ---
    if (!landmarks || landmarks.length < 17) {
      this._missingFrames++;
      this.flapStrength = 0;

      // Graceful degradation: fade to neutral glide
      if (this._missingFrames > 5) {
        const fadeRate = 0.05;
        this.roll += (0 - this.roll) * fadeRate;
        this.pitch += (0 - this.pitch) * fadeRate;
        this.wingSpread += (0.85 - this.wingSpread) * fadeRate; // glide, not tuck
        this.gesture = 'NO TRACKING';
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

    // Check which arms are visible
    this.leftVisible = this._isVisible(lw) && this._isVisible(ls);
    this.rightVisible = this._isVisible(rw) && this._isVisible(rs);

    // --- Arm elevation ---
    if (this.leftVisible) {
      this.leftArmElevation = ls.y - lw.y;
    }
    if (this.rightVisible) {
      this.rightArmElevation = rs.y - rw.y;
    }

    // If only one arm visible, mirror the other
    if (this.leftVisible && !this.rightVisible) {
      this.rightArmElevation = this.leftArmElevation;
    } else if (this.rightVisible && !this.leftVisible) {
      this.leftArmElevation = this.rightArmElevation;
    }

    // --- Flap detection (more sensitive, detects both up and down strokes) ---
    const avgElevation = (this.leftArmElevation + this.rightArmElevation) / 2;
    this._elevHistory.push(avgElevation);
    if (this._elevHistory.length > this._historyMaxLen) this._elevHistory.shift();

    this.flapStrength = 0;
    if (this._elevHistory.length >= 4) {
      const recent = avg(this._elevHistory.slice(-3));
      const older = avg(this._elevHistory.slice(0, 3));
      const delta = Math.abs(recent - older); // absolute = up AND down strokes

      const now = performance.now();
      if (delta > 0.025 && now - this._lastFlapTime > this._flapCooldown) {
        this.flapStrength = clamp(delta * 8, 0.5, 1);
        this._lastFlapTime = now;
      }
    }

    // --- Roll (lateral tilt) ---
    const elevationDiff = this.rightArmElevation - this.leftArmElevation;
    const targetRoll = clamp(elevationDiff * 2.5, -1, 1);
    this.roll += (targetRoll - this.roll) * 0.3;

    // --- Pitch (forward lean) ---
    let shoulderY;
    if (this.leftVisible && this.rightVisible) {
      shoulderY = (ls.y + rs.y) / 2;
    } else if (this.leftVisible) {
      shoulderY = ls.y;
    } else if (this.rightVisible) {
      shoulderY = rs.y;
    } else {
      shoulderY = this.restShoulderY;
    }
    const pitchDelta = this.restShoulderY - shoulderY;
    const targetPitch = clamp(-pitchDelta * 5, -1, 1);
    this.pitch += (targetPitch - this.pitch) * 0.2;

    // --- Wing spread ---
    const isFlapping = this.flapStrength > 0 || (performance.now() - this._lastFlapTime < 500);
    const targetWingSpread = isFlapping
      ? 1.0
      : clamp(remap(avgElevation, -0.05, 0.15, 0, 1), 0, 1);
    const spreadRate = targetWingSpread < this.wingSpread ? 0.5 : 0.3;
    this.wingSpread += (targetWingSpread - this.wingSpread) * spreadRate;

    // Apply deadzone
    if (Math.abs(this.roll) < 0.08) this.roll = 0;
    if (Math.abs(this.pitch) < 0.08) this.pitch = 0;

    // --- Determine gesture label ---
    if (this.flapStrength > 0) {
      this.gesture = 'FLAP!';
    } else if (this.wingSpread < 0.3) {
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
    };
  }
}

function avg(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
