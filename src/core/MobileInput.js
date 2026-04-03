import { clamp } from '../utils/math.js';

/**
 * Mobile device input: gyroscope tilt for flight control + shake for flap.
 *
 * - Tilt forward → dive
 * - Tilt backward → climb
 * - Tilt left/right → bank turn
 * - Shake device → 5 flaps burst
 * - Landscape fullscreen only
 */
export class MobileInput {
  constructor() {
    this.available = false;
    this.active = false;

    // Output values (same interface as InputManager expects)
    this.pitch = 0;    // -1..1
    this.roll = 0;     // -1..1
    this.lift = 0;     // 0..1
    this.wingSpread = 1;

    // Calibration
    this._calibrated = false;
    this._restBeta = 0;   // forward/back tilt at rest
    this._restGamma = 0;  // left/right tilt at rest

    // Shake detection
    this._lastAccel = { x: 0, y: 0, z: 0 };
    this._shakeThreshold = 20;
    this._lastShakeTime = 0;
    this._flapBurst = 0;       // remaining flap frames
    this._flapBurstTotal = 90; // ~1.5s at 60fps = 5 flap cycles

    // Smoothing
    this._smoothPitch = 0;
    this._smoothRoll = 0;

    // Try to request permission and setup listeners
    this._setup();
  }

  async _setup() {
    // Check if DeviceOrientation is available
    if (!window.DeviceOrientationEvent) return;

    // iOS 13+ requires explicit permission
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      // We'll request on first user interaction (tap)
      this._needsPermission = true;
    } else {
      this._startListening();
    }
  }

  /**
   * Must be called from a user gesture (tap/click) on iOS.
   */
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
    // Android — no permission needed
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

    const beta = e.beta;   // front/back tilt (-180..180), 0 = flat
    const gamma = e.gamma; // left/right tilt (-90..90)

    if (beta === null || gamma === null) return;

    // Calibrate on first reading (assumes device starts roughly level in landscape)
    if (!this._calibrated) {
      this._restBeta = beta;
      this._restGamma = gamma;
      this._calibrated = true;
      console.log(`Mobile calibrated: beta=${beta.toFixed(1)}, gamma=${gamma.toFixed(1)}`);
    }

    // In landscape mode:
    // gamma (left/right) → pitch (dive/climb)
    // beta (forward/back) → roll (turn)
    // (axes are swapped in landscape orientation)
    const rawPitch = -(gamma - this._restGamma) / 30; // 30° = full pitch
    const rawRoll = (beta - this._restBeta) / 25;     // 25° = full roll

    // Smooth
    this._smoothPitch += (clamp(rawPitch, -1, 1) - this._smoothPitch) * 0.08;
    this._smoothRoll += (clamp(rawRoll, -1, 1) - this._smoothRoll) * 0.08;

    this.pitch = this._smoothPitch;
    this.roll = this._smoothRoll;

    // Wing spread from pitch (dive = tuck wings)
    if (this.pitch < -0.2) {
      this.wingSpread = clamp(1 + this.pitch * 2, 0, 1); // pitch -0.5 → wingSpread 0
    } else {
      this.wingSpread = 1;
    }
  }

  _onMotion(e) {
    if (!this.active) return;

    const accel = e.accelerationIncludingGravity;
    if (!accel) return;

    // Detect shake: sudden acceleration change
    const dx = accel.x - this._lastAccel.x;
    const dy = accel.y - this._lastAccel.y;
    const dz = accel.z - this._lastAccel.z;
    const delta = Math.sqrt(dx * dx + dy * dy + dz * dz);

    this._lastAccel = { x: accel.x, y: accel.y, z: accel.z };

    const now = performance.now();
    if (delta > this._shakeThreshold && now - this._lastShakeTime > 500) {
      // SHAKE detected → trigger flap burst (5 flaps)
      this._flapBurst = this._flapBurstTotal;
      this._lastShakeTime = now;
      console.log('Shake! Flap burst triggered');
    }
  }

  /**
   * Call each frame to update lift from flap burst.
   */
  update(dt) {
    if (this._flapBurst > 0) {
      this.lift = 1;
      this._flapBurst--;
    } else {
      this.lift = 0;
    }
  }

  /**
   * Recalibrate (use current tilt as neutral).
   */
  calibrate() {
    this._calibrated = false;
  }
}

/**
 * Request fullscreen in landscape mode.
 */
export function requestFullscreenLandscape() {
  const el = document.documentElement;
  const rfs = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
  if (rfs) {
    rfs.call(el);
    // Lock to landscape if supported
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }
  }
}

/**
 * Detect if we're on a mobile/tablet device.
 */
export function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1);
}
