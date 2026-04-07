import { clamp } from '../utils/math.js';

/**
 * Mobile gyroscope input for flight control.
 *
 * Landscape mode (phone horizontal, screen facing up/toward you):
 * - Tilt phone toward you → climb
 * - Tilt phone away from you → dive
 * - Tilt phone left → turn left
 * - Tilt phone right → turn right
 * - Shake → flap burst
 */
export class MobileInput {
  constructor() {
    this.available = false;
    this.active = false;

    // Outputs
    this.pitch = 0;
    this.roll = 0;
    this.lift = 0;
    this.wingSpread = 1;

    // Calibration — ONLY triggered by PLAY tap or double-tap
    this._calibrated = false;
    this._pendingCalibration = false;
    this._restBeta = 0;
    this._restGamma = 0;

    // Shake
    this._lastAccel = { x: 0, y: 0, z: 0 };
    this._shakeThreshold = 12; // lowered from 20 — easier to trigger
    this._lastShakeTime = 0;
    this._flapBurst = 0;
    this._flapBurstTotal = 90;

    // Smoothing
    this._smoothPitch = 0;
    this._smoothRoll = 0;

    // Debug overlay
    this._debugEl = null;

    this._setup();
  }

  async _setup() {
    if (!window.DeviceOrientationEvent) return;
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      this._needsPermission = true;
    } else {
      this._startListening();
    }
  }

  async requestPermission() {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const response = await DeviceOrientationEvent.requestPermission();
        if (response === 'granted') {
          this._startListening();
          return true;
        }
      } catch (e) {
        console.warn('DeviceOrientation permission denied:', e);
      }
      return false;
    }
    this._startListening();
    return true;
  }

  _startListening() {
    window.addEventListener('deviceorientation', (e) => this._onOrientation(e), true);
    window.addEventListener('devicemotion', (e) => this._onMotion(e), true);
    this.available = true;
    console.log('Mobile gyroscope input active');
  }

  _onOrientation(e) {
    if (!this.active) return;

    const beta = e.beta;   // -180..180 (front/back tilt, 0=flat on table)
    const gamma = e.gamma; // -90..90 (left/right tilt)

    if (beta === null || gamma === null) return;

    // Only calibrate when explicitly triggered (PLAY button or double-tap)
    if (this._pendingCalibration) {
      this._restBeta = beta;
      this._restGamma = gamma;
      this._calibrated = true;
      this._pendingCalibration = false;
      console.log(`Calibrated: beta=${beta.toFixed(1)}°, gamma=${gamma.toFixed(1)}°`);
    }

    // If not yet calibrated, don't move (wait for PLAY or double-tap)
    if (!this._calibrated) return;

    // Delta from calibrated rest position
    const dBeta = beta - this._restBeta;
    const dGamma = gamma - this._restGamma;

    // In landscape on iPhone (home button right = angle 90):
    // - Tilting phone toward you increases gamma → should be CLIMB (positive pitch)
    // - Tilting phone away decreases gamma → DIVE (negative pitch)
    // - Tilting phone right increases beta → TURN RIGHT (negative roll for banking)
    // - Tilting phone left decreases beta → TURN LEFT (positive roll)
    //
    // In landscape (home button left = angle -90): axes are inverted

    const angle = screen.orientation?.angle ?? window.orientation ?? 0;

    let pitchDeg, rollDeg;
    if (angle === 90 || angle === -270) {
      pitchDeg = dGamma;   // toward you = positive gamma delta = climb
      rollDeg = dBeta;
    } else if (angle === -90 || angle === 270) {
      pitchDeg = -dGamma;
      rollDeg = -dBeta;
    } else {
      // Portrait fallback
      pitchDeg = -dBeta;
      rollDeg = dGamma;
    }

    // Very forgiving tilt mapping:
    // 60° = full deflection, quintic curve (x⁵) = ultra gentle near center
    const normPitch = clamp(pitchDeg / 60, -1, 1);
    const normRoll = clamp(rollDeg / 60, -1, 1);

    // Quintic curve: x⁵ = extremely gentle near center, only strong at extremes
    const rawPitch = Math.pow(Math.abs(normPitch), 3) * Math.sign(normPitch) * 0.6;
    const rawRoll = Math.pow(Math.abs(normRoll), 3) * Math.sign(normRoll) * 0.6;

    // Very slow smoothing = no sudden movements
    this._smoothPitch += (rawPitch - this._smoothPitch) * 0.04;
    this._smoothRoll += (rawRoll - this._smoothRoll) * 0.04;

    this.pitch = this._smoothPitch;
    this.roll = this._smoothRoll;

    // Wing spread
    if (this.pitch < -0.15) {
      this.wingSpread = clamp(1 + this.pitch * 2.5, 0, 1);
    } else {
      this.wingSpread = 1;
    }

    // Debug overlay
    this._updateDebug(beta, gamma, dBeta, dGamma, pitchDeg, rollDeg);
  }

  _onMotion(e) {
    if (!this.active) return;
    const accel = e.accelerationIncludingGravity;
    if (!accel) return;

    const dx = accel.x - this._lastAccel.x;
    const dy = accel.y - this._lastAccel.y;
    const dz = accel.z - this._lastAccel.z;
    const delta = Math.sqrt(dx * dx + dy * dy + dz * dz);

    this._lastAccel = { x: accel.x, y: accel.y, z: accel.z };

    const now = performance.now();
    if (delta > this._shakeThreshold && now - this._lastShakeTime > 400) {
      this._flapBurst = this._flapBurstTotal;
      this._lastShakeTime = now;
    }
  }

  update(dt) {
    if (this._flapBurst > 0) {
      this.lift = 1;
      this._flapBurst--;
    } else {
      this.lift = 0;
    }
  }

  /**
   * Schedule calibration on next orientation event.
   * Called by: PLAY button tap + double-tap. Nothing else.
   */
  calibrate() {
    this._pendingCalibration = true;
    this._smoothPitch = 0;
    this._smoothRoll = 0;
  }

  _updateDebug(beta, gamma, dBeta, dGamma, pitchDeg, rollDeg) {
    if (!this._debugEl) {
      this._debugEl = document.createElement('div');
      this._debugEl.style.cssText = `
        position:fixed; top:4px; left:4px; color:rgba(255,255,255,0.6);
        font:10px monospace; pointer-events:none; z-index:999;
        background:rgba(0,0,0,0.3); padding:4px 6px; border-radius:4px;
      `;
      document.body.appendChild(this._debugEl);
    }
    this._debugEl.textContent =
      `β:${beta.toFixed(0)}° γ:${gamma.toFixed(0)}° | ` +
      `P:${this.pitch.toFixed(2)} R:${this.roll.toFixed(2)} | ` +
      `${this._flapBurst > 0 ? 'FLAP!' : 'ws:' + this.wingSpread.toFixed(1)}`;
  }
}

export function requestFullscreenLandscape() {
  const el = document.documentElement;
  const rfs = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
  if (rfs) {
    rfs.call(el).catch(() => {});
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }
  }
}

export function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1)
    || ('ontouchstart' in window)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 0);
}
