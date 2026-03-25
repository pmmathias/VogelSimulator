/**
 * Abstracts control input from keyboard and (later) pose detection.
 * Exposes normalized values: lift (0-1), roll (-1..1), pitch (-1..1).
 */
export class InputManager {
  constructor() {
    this.lift = 0;
    this.roll = 0;
    this.pitch = 0;

    this._keys = {};
    this._flapCooldown = 0;

    window.addEventListener('keydown', (e) => { this._keys[e.code] = true; });
    window.addEventListener('keyup', (e) => { this._keys[e.code] = false; });
  }

  update(dt) {
    // Flap with Space
    if (this._keys['Space'] && this._flapCooldown <= 0) {
      this.lift = 1;
      this._flapCooldown = 0.3; // seconds between flaps
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
    if (this._keys['KeyW'] || this._keys['ArrowUp']) this.pitch = 1;   // nose up
    if (this._keys['KeyS'] || this._keys['ArrowDown']) this.pitch = -1; // nose down
  }
}
