import { requestFullscreenLandscape } from '../core/MobileInput.js';

/**
 * Mobile-specific UI: fullscreen start screen, landscape prompt, controls overlay.
 */
export class MobileUI {
  constructor(mobileInput) {
    this._mobileInput = mobileInput;
    this._onStart = null;

    this._createStartScreen();
    this._createControlsOverlay();
    this._createOrientationWarning();
  }

  _createStartScreen() {
    this._startScreen = document.createElement('div');
    this._startScreen.id = 'mobile-start';
    this._startScreen.style.cssText = `
      position:fixed; inset:0; z-index:500;
      background: linear-gradient(135deg, #0a1628 0%, #1a2a4a 50%, #0a1628 100%);
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      color:white; font-family:sans-serif; text-align:center; padding:20px;
    `;
    this._startScreen.innerHTML = `
      <div style="font-size:60px; margin-bottom:20px;">🦅</div>
      <h1 style="font-size:28px; font-weight:bold; margin-bottom:10px;
        background:linear-gradient(to right,#60c0ff,#40a0ff,#ffaa44);
        -webkit-background-clip:text; -webkit-text-fill-color:transparent;">
        VogelSimulator
      </h1>
      <p style="color:#88aacc; margin-bottom:30px; font-size:14px; max-width:300px;">
        Neige dein Gerät zum Steuern.<br>
        Schütteln = Flügelschlag!
      </p>
      <button id="mobile-start-btn" style="
        background:linear-gradient(135deg, #2080cc, #40a0ff);
        color:white; border:none; padding:16px 40px; border-radius:12px;
        font-size:18px; font-weight:bold; cursor:pointer;
        box-shadow: 0 4px 20px rgba(32,128,204,0.4);
      ">
        ▶ Vollbild starten
      </button>
      <p style="color:#556677; margin-top:20px; font-size:11px;">
        Drehe dein Gerät ins Querformat
      </p>
    `;
    document.body.appendChild(this._startScreen);

    document.getElementById('mobile-start-btn').addEventListener('click', async () => {
      // Request fullscreen + landscape
      requestFullscreenLandscape();

      // Request gyroscope permission (iOS)
      if (this._mobileInput._needsPermission) {
        await this._mobileInput.requestPermission();
      } else {
        await this._mobileInput.requestPermission();
      }

      this._mobileInput.active = true;
      this._startScreen.style.display = 'none';
      this._controlsOverlay.style.display = 'block';

      if (this._onStart) this._onStart();
    });
  }

  _createControlsOverlay() {
    this._controlsOverlay = document.createElement('div');
    this._controlsOverlay.style.cssText = `
      position:fixed; bottom:10px; left:50%; transform:translateX(-50%);
      color:rgba(255,255,255,0.5); font-family:sans-serif; font-size:11px;
      text-align:center; pointer-events:none; z-index:300; display:none;
    `;
    this._controlsOverlay.innerHTML = `
      Neigen: Steuern &nbsp;|&nbsp; Schütteln: Flattern &nbsp;|&nbsp; 2× Tippen: Kalibrieren
    `;
    document.body.appendChild(this._controlsOverlay);
  }

  _createOrientationWarning() {
    this._orientWarn = document.createElement('div');
    this._orientWarn.style.cssText = `
      position:fixed; inset:0; z-index:600;
      background:rgba(10,20,40,0.95);
      display:none; flex-direction:column; align-items:center; justify-content:center;
      color:white; font-family:sans-serif; text-align:center;
    `;
    this._orientWarn.innerHTML = `
      <div style="font-size:50px; margin-bottom:15px;">📱↔️</div>
      <p style="font-size:18px;">Bitte drehe dein Gerät<br>ins <b>Querformat</b></p>
    `;
    document.body.appendChild(this._orientWarn);

    // Show warning if portrait
    const checkOrientation = () => {
      const isPortrait = window.innerHeight > window.innerWidth;
      this._orientWarn.style.display = isPortrait ? 'flex' : 'none';
    };
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    checkOrientation();
  }

  /**
   * Set callback for when user starts the game.
   */
  onStart(fn) {
    this._onStart = fn;
  }

  /**
   * Show shake feedback.
   */
  showShake() {
    // Brief flash
    const flash = document.createElement('div');
    flash.style.cssText = `
      position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
      color:#ffdd00; font-size:24px; font-weight:bold; font-family:sans-serif;
      pointer-events:none; z-index:400; transition:opacity 0.5s;
    `;
    flash.textContent = '🦅 FLAP!';
    document.body.appendChild(flash);
    setTimeout(() => { flash.style.opacity = '0'; }, 200);
    setTimeout(() => flash.remove(), 700);
  }
}
