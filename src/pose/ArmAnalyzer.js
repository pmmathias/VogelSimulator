import { angleBetween, clamp } from '../utils/math.js';

// MediaPipe landmark indices
const LEFT_SHOULDER = 11;
const LEFT_ELBOW = 13;
const LEFT_WRIST = 15;
const RIGHT_SHOULDER = 12;
const RIGHT_ELBOW = 14;
const RIGHT_WRIST = 16;

/**
 * Analyzes arm positions from pose landmarks to produce flight control inputs.
 */
export class ArmAnalyzer {
  constructor() {
    // Calibration values (set during calibration)
    this.calibrated = false;
    this.restShoulderY = 0.5;  // normalized Y when arms are at rest
    this.restElbowAngle = Math.PI; // straight arms

    // Flap detection state
    this._leftHistory = [];
    this._rightHistory = [];
    this._historyMaxLen = 15;  // frames of history
    this._lastFlapTime = 0;
    this._flapCooldown = 250; // ms

    // Smoothed outputs
    this.flapStrength = 0;
    this.roll = 0;    // -1..1
    this.pitch = 0;   // -1..1

    // Raw values for debugging
    this.leftArmElevation = 0;
    this.rightArmElevation = 0;
    this.leftElbowAngle = 0;
    this.rightElbowAngle = 0;
  }

  /**
   * Calibrate using current pose (arms at sides).
   * @param {Array} landmarks - 33 MediaPipe landmarks
   */
  calibrate(landmarks) {
    if (!landmarks) return;

    const ls = landmarks[LEFT_SHOULDER];
    const rs = landmarks[RIGHT_SHOULDER];
    this.restShoulderY = (ls.y + rs.y) / 2;

    const le = landmarks[LEFT_ELBOW];
    const re = landmarks[RIGHT_ELBOW];
    const lw = landmarks[LEFT_WRIST];
    const rw = landmarks[RIGHT_WRIST];

    this.restElbowAngle = (
      angleBetween(ls, le, lw) + angleBetween(rs, re, rw)
    ) / 2;

    this.calibrated = true;
  }

  /**
   * Analyze landmarks and update control outputs.
   * @param {Array} landmarks - 33 MediaPipe landmarks
   * @returns {{ flapStrength: number, roll: number, pitch: number }}
   */
  analyze(landmarks) {
    if (!landmarks || landmarks.length < 17) {
      this.flapStrength = 0;
      return { flapStrength: 0, roll: this.roll, pitch: this.pitch };
    }

    const ls = landmarks[LEFT_SHOULDER];
    const le = landmarks[LEFT_ELBOW];
    const lw = landmarks[LEFT_WRIST];
    const rs = landmarks[RIGHT_SHOULDER];
    const re = landmarks[RIGHT_ELBOW];
    const rw = landmarks[RIGHT_WRIST];

    // --- Arm elevation (how high wrists are relative to shoulders) ---
    // MediaPipe Y is inverted (0=top, 1=bottom), so lower Y = higher position
    this.leftArmElevation = ls.y - lw.y;   // positive = arm raised
    this.rightArmElevation = rs.y - rw.y;

    // --- Elbow angles ---
    this.leftElbowAngle = angleBetween(ls, le, lw);
    this.rightElbowAngle = angleBetween(rs, re, rw);

    // --- Flap detection ---
    const avgElevation = (this.leftArmElevation + this.rightArmElevation) / 2;
    this._leftHistory.push(this.leftArmElevation);
    this._rightHistory.push(this.rightArmElevation);
    if (this._leftHistory.length > this._historyMaxLen) this._leftHistory.shift();
    if (this._rightHistory.length > this._historyMaxLen) this._rightHistory.shift();

    // Detect flap: significant upward movement in recent frames
    this.flapStrength = 0;
    if (this._leftHistory.length >= 4) {
      const recentAvg = avg(this._leftHistory.slice(-3));
      const olderAvg = avg(this._leftHistory.slice(0, 3));
      const delta = recentAvg - olderAvg;

      const now = performance.now();
      if (delta > 0.06 && now - this._lastFlapTime > this._flapCooldown) {
        this.flapStrength = clamp(delta * 5, 0, 1);
        this._lastFlapTime = now;
      }
    }

    // --- Roll (lateral tilt) ---
    // Difference in arm elevation: left higher than right = roll left
    const elevationDiff = this.leftArmElevation - this.rightArmElevation;
    const targetRoll = clamp(elevationDiff * 4, -1, 1);
    // Smooth
    this.roll += (targetRoll - this.roll) * 0.3;

    // --- Pitch (forward lean) ---
    // Use shoulder Y position relative to calibration
    const shoulderY = (ls.y + rs.y) / 2;
    const pitchDelta = this.restShoulderY - shoulderY; // leaning forward = shoulders higher in frame = lower Y
    const targetPitch = clamp(pitchDelta * 5, -1, 1);
    this.pitch += (targetPitch - this.pitch) * 0.2;

    // Apply deadzone
    if (Math.abs(this.roll) < 0.08) this.roll = 0;
    if (Math.abs(this.pitch) < 0.08) this.pitch = 0;

    return {
      flapStrength: this.flapStrength,
      roll: this.roll,
      pitch: this.pitch,
    };
  }
}

function avg(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
