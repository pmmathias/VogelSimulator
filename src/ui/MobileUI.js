import { requestFullscreenLandscape } from '../core/MobileInput.js';
import { CalibrationWizard } from './CalibrationWizard.js';

/**
 * Mobile UI: start screen with PWA fullscreen guide, controls overlay, orientation warning.
 */
export class MobileUI {
  constructor(mobileInput) {
    this._mobileInput = mobileInput;
    this._onStart = null;

    this._createStartScreen();
    this._createFullscreenGuide();
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
      <div style="font-size:60px; margin-bottom:16px;">🦅</div>
      <h1 style="font-size:28px; font-weight:bold; margin-bottom:8px;
        background:linear-gradient(to right,#60c0ff,#40a0ff,#ffaa44);
        -webkit-background-clip:text; -webkit-text-fill-color:transparent;">
        VogelSimulator
      </h1>
      <p style="color:#88aacc; margin-bottom:24px; font-size:14px; max-width:300px; line-height:1.5;">
        Neige dein Gerät zum Steuern.<br>
        Schütteln = Flügelschlag!
      </p>
      <button id="mobile-start-btn" style="
        background:linear-gradient(135deg, #2080cc, #40a0ff);
        color:white; border:none; padding:16px 40px; border-radius:12px;
        font-size:18px; font-weight:bold; cursor:pointer;
        box-shadow: 0 4px 20px rgba(32,128,204,0.4);
        margin-bottom:16px;
      ">
        ▶ PLAY
      </button>
      <p style="color:#88aacc; font-size:12px; margin-bottom:8px;">
        Tilt to steer &nbsp;·&nbsp; Shake to flap
      </p>
      <button id="mobile-fs-guide-btn" style="
        background:none; border:1px solid rgba(255,255,255,0.2);
        color:rgba(255,255,255,0.5); padding:8px 16px; border-radius:8px;
        font-size:11px; cursor:pointer; margin-top:12px;
      ">
        📱 Fullscreen Setup (empfohlen)
      </button>
      <p style="color:#445566; margin-top:16px; font-size:10px;">
        Drehe dein Gerät ins Querformat
      </p>
    `;
    document.body.appendChild(this._startScreen);

    // PLAY button
    document.getElementById('mobile-start-btn').addEventListener('click', async () => {
      requestFullscreenLandscape();
      const permOk = await this._mobileInput.requestPermission();
      if (!permOk) {
        alert('Gyroscope permission denied — cannot play without it.');
        return;
      }

      this._startScreen.style.display = 'none';

      try {
        // Check for saved calibration profile
        const saved = CalibrationWizard.loadProfile();
        let profile;

        if (saved) {
          // Offer choice: use saved or recalibrate
          profile = await this._showProfileChoice(saved);
        } else {
          // First time: always run wizard
          const wizard = new CalibrationWizard();
          profile = await wizard.run();
        }

        this._mobileInput.setProfile(profile);
      } catch (err) {
        console.error('Calibration wizard error:', err);
        // Fallback: set a default profile so the game still works
        this._mobileInput.setProfile({
          restBeta: 0, restGamma: 0,
          rollAxis: 'beta', rollSign: 1, rollRange: 30,
          pitchAxis: 'gamma', pitchSign: 1, pitchRange: 30,
          shakeThreshold: 12, timestamp: Date.now(),
        });
      }

      this._mobileInput.active = true;
      this._controlsOverlay.style.display = 'flex';
      if (this._onStart) this._onStart();
    });

    // Fullscreen guide button
    document.getElementById('mobile-fs-guide-btn').addEventListener('click', () => {
      this._fsGuide.style.display = 'flex';
    });
  }

  /**
   * Show choice dialog: use saved profile or recalibrate.
   * @returns {Promise<object>} chosen profile
   */
  _showProfileChoice(savedProfile) {
    return new Promise((resolve) => {
      const dialog = document.createElement('div');
      dialog.style.cssText = `
        position:fixed; inset:0; z-index:700;
        background:linear-gradient(135deg, #0a1628 0%, #1a2a4a 50%, #0a1628 100%);
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        color:white; font-family:sans-serif; text-align:center; padding:20px;
      `;
      dialog.innerHTML = `
        <div style="font-size:48px; margin-bottom:16px;">🎮</div>
        <h2 style="font-size:20px; font-weight:bold; color:#60c0ff; margin-bottom:8px;">
          Kalibrierung vorhanden
        </h2>
        <p style="color:#88aacc; font-size:13px; margin-bottom:24px;">
          Letzte Kalibrierung verwenden<br>oder neu kalibrieren?
        </p>
        <button id="calib-use-saved" style="
          background:linear-gradient(135deg, #2080cc, #40a0ff);
          color:white; border:none; padding:14px 36px; border-radius:12px;
          font-size:16px; font-weight:bold; cursor:pointer; margin-bottom:12px;
          box-shadow:0 4px 20px rgba(32,128,204,0.4); width:240px;
        ">▶ Sofort spielen</button>
        <button id="calib-redo" style="
          background:none; border:1px solid rgba(255,255,255,0.25);
          color:rgba(255,255,255,0.6); padding:10px 28px; border-radius:10px;
          font-size:14px; cursor:pointer; width:240px;
        ">🔄 Neu kalibrieren</button>
      `;
      document.body.appendChild(dialog);

      document.getElementById('calib-use-saved').addEventListener('click', () => {
        dialog.remove();
        resolve(savedProfile);
      });
      document.getElementById('calib-redo').addEventListener('click', async () => {
        dialog.remove();
        const wizard = new CalibrationWizard();
        resolve(await wizard.run());
      });
    });
  }

  _createFullscreenGuide() {
    this._fsGuide = document.createElement('div');
    this._fsGuide.style.cssText = `
      position:fixed; inset:0; z-index:550;
      background:rgba(8,16,32,0.97);
      display:none; flex-direction:column; align-items:center; justify-content:center;
      color:white; font-family:sans-serif; text-align:center; padding:24px;
    `;
    this._fsGuide.innerHTML = `
      <h2 style="font-size:20px; font-weight:bold; margin-bottom:20px; color:#60c0ff;">
        📱 Fullscreen Setup
      </h2>
      <p style="color:#88aacc; font-size:13px; margin-bottom:20px; max-width:320px;">
        Für das beste Erlebnis: App zum Homescreen hinzufügen — dann läuft sie im echten Vollbildmodus!
      </p>
      <div style="text-align:left; max-width:320px; width:100%;">
        <div style="display:flex; align-items:center; gap:12px; padding:12px 0; border-bottom:1px solid rgba(255,255,255,0.1);">
          <span style="font-size:28px; width:40px; text-align:center;">📤</span>
          <div>
            <div style="font-weight:bold; font-size:14px;">Schritt 1</div>
            <div style="color:#88aacc; font-size:12px;">Tippe auf den <b>Teilen</b>-Button unten in Safari</div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:12px; padding:12px 0; border-bottom:1px solid rgba(255,255,255,0.1);">
          <span style="font-size:28px; width:40px; text-align:center;">➕</span>
          <div>
            <div style="font-weight:bold; font-size:14px;">Schritt 2</div>
            <div style="color:#88aacc; font-size:12px;">Scrolle runter und tippe <b>„Zum Home-Bildschirm"</b></div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:12px; padding:12px 0; border-bottom:1px solid rgba(255,255,255,0.1);">
          <span style="font-size:28px; width:40px; text-align:center;">🏠</span>
          <div>
            <div style="font-weight:bold; font-size:14px;">Schritt 3</div>
            <div style="color:#88aacc; font-size:12px;">Tippe <b>„Hinzufügen"</b> — ein Icon erscheint auf dem Homescreen</div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:12px; padding:12px 0;">
          <span style="font-size:28px; width:40px; text-align:center;">🚀</span>
          <div>
            <div style="font-weight:bold; font-size:14px;">Schritt 4</div>
            <div style="color:#88aacc; font-size:12px;">Öffne vom Homescreen — läuft im <b>echten Vollbild!</b></div>
          </div>
        </div>
      </div>
      <p style="color:#556677; font-size:11px; margin-top:16px;">
        Das muss nur einmal gemacht werden.
      </p>
      <button id="mobile-fs-guide-close" style="
        background:linear-gradient(135deg, #2080cc, #40a0ff);
        color:white; border:none; padding:12px 32px; border-radius:10px;
        font-size:15px; font-weight:bold; cursor:pointer; margin-top:20px;
      ">
        Verstanden!
      </button>
    `;
    document.body.appendChild(this._fsGuide);

    // Use event delegation since element isn't in DOM yet when button created via innerHTML
    this._fsGuide.addEventListener('click', (e) => {
      if (e.target.id === 'mobile-fs-guide-close') {
        this._fsGuide.style.display = 'none';
      }
    });
  }

  _createControlsOverlay() {
    this._controlsOverlay = document.createElement('div');
    this._controlsOverlay.style.cssText = `
      position:fixed; bottom:8px; left:0; right:0;
      display:none; align-items:center; justify-content:center; gap:12px;
      z-index:300; font-family:sans-serif;
    `;
    this._controlsOverlay.innerHTML = `
      <span style="color:rgba(255,255,255,0.35); font-size:10px; pointer-events:none;">
        Neigen: Steuern &nbsp;|&nbsp; Schütteln: Flattern &nbsp;|&nbsp; 2× Tippen: Nullpunkt
      </span>
      <button id="mobile-recalib-btn" style="
        background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.15);
        color:rgba(255,255,255,0.5); padding:4px 10px; border-radius:6px;
        font-size:10px; cursor:pointer;
      ">🔄 Kalibrieren</button>
    `;
    document.body.appendChild(this._controlsOverlay);

    // Full recalibration button
    this._controlsOverlay.addEventListener('click', async (e) => {
      if (e.target.id !== 'mobile-recalib-btn') return;
      this._mobileInput.active = false;
      const wizard = new CalibrationWizard();
      const profile = await wizard.run();
      this._mobileInput.setProfile(profile);
      this._mobileInput.active = true;
    });
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

    const checkOrientation = () => {
      const isPortrait = window.innerHeight > window.innerWidth;
      this._orientWarn.style.display = isPortrait ? 'flex' : 'none';
    };
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    checkOrientation();
  }

  onStart(fn) { this._onStart = fn; }

  showShake() {
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
