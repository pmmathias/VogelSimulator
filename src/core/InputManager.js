/**
 * Abstracts control input from keyboard and pose detection.
 * Pose input takes priority when available; keyboard serves as fallback.
 * Exposes normalized values: lift (0-1), roll (-1..1), pitch (-1..1).
 */
export class InputManager {
  constructor() {
    this.lift = 0;
    this.roll = 0;
    this.pitch = 0;

    // Source tracking
    this.source = 'keyboard'; // 'keyboard' or 'pose'

    this._keys = {};
    this._flapCooldown = 0;

    // Pose input (set externally by ArmAnalyzer)
    this._poseInput = null;

    window.addEventListener('keydown', (e) => { this._keys[e.code] = true; });
    window.addEventListener('keyup', (e) => { this._keys[e.code] = false; });
  }

  /**
   * Set pose input from ArmAnalyzer.
   * @param {{ flapStrength: number, roll: number, pitch: number }|null} poseData
   */
  setPoseInput(poseData) {
    this._poseInput = poseData;
  }

  update(dt) {
    // Check if pose input is available and active
    if (this._poseInput && (
      this._poseInput.flapStrength > 0 ||
      Math.abs(this._poseInput.roll) > 0.05 ||
      Math.abs(this._poseInput.pitch) > 0.05
    )) {
      this.source = 'pose';
      this.lift = this._poseInput.flapStrength;
      this.roll = this._poseInput.roll;
      this.pitch = this._poseInput.pitch;
      return;
    }

    // Keyboard fallback
    this.source = 'keyboard';

    // Flap with Space
    if (this._keys['Space'] && this._flapCooldown <= 0) {
      this.lift = 1;
      this._flapCooldown = 0.3;
    } else {
      this.lift = 0;
    }
    if (this._flapCooldown > 0) this._flapCooldown -= dt;

    // Roll with A/D
    this.roll = 0;
    if (this._keys['KeyA'] || this._keys['ArrowLeft']) this.roll = -1;
    if (this._keys['KeyD'] || this._keys['ArrowRight']) this.roll = 1;

    // Pitch with W/S
    this.pitch = 0;
    if (this._keys['KeyW'] || this._keys['ArrowUp']) this.pitch = 1;
    if (this._keys['KeyS'] || this._keys['ArrowDown']) this.pitch = -1;
  }
}
