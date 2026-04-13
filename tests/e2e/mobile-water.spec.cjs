const { test } = require('@playwright/test');

const MOBILE = {
  viewport: { width: 1334, height: 750 }, // iPhone 6+ landscape (for more pixels)
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  hasTouch: true,
  isMobile: true,
};

test.use({
  browserName: 'chromium',
  launchOptions: { args: ['--ignore-gpu-blocklist'] },
  headless: false,
});

/**
 * Position bird directly above water, flying low.
 * URL params: ?skipcalib=1&x=3000&z=3000&y=18&yaw=2.35&speed=15
 * (x/z=3000 puts bird far offshore over water; y=18 is 3m above water level 15; yaw=2.35 ≈ 135° SW)
 */

test('mobile water rendering and reflection', async ({ browser }) => {
  const errors = [];

  // DESKTOP reference
  const desktopCtx = await browser.newContext();
  const desktop = await desktopCtx.newPage();
  desktop.on('pageerror', (e) => errors.push(`[desktop] ${e.message}`));
  desktop.on('console', (m) => { if (m.type() === 'error') errors.push(`[desktop-console] ${m.text()}`); });

  await desktop.goto('http://localhost:5173/VogelSimulator/?x=3000&z=3000&y=18&yaw=2.35&speed=15');
  await desktop.waitForTimeout(6000);
  await desktop.screenshot({ path: 'tests/e2e/screenshots/water-desktop-overwater.png' });

  // MOBILE emulation
  const mobileCtx = await browser.newContext(MOBILE);
  const mobile = await mobileCtx.newPage();
  mobile.on('pageerror', (e) => errors.push(`[mobile] ${e.message}`));
  mobile.on('console', (m) => { if (m.type() === 'error') errors.push(`[mobile-console] ${m.text()}`); });

  await mobile.goto('http://localhost:5173/VogelSimulator/?skipcalib=1&x=3000&z=3000&y=18&yaw=2.35&speed=15');
  await mobile.waitForTimeout(3000);

  // Click PLAY to go through the mobile flow
  const playBtn = mobile.locator('#mobile-start-btn');
  const isVisible = await playBtn.isVisible().catch(() => false);
  if (isVisible) await playBtn.tap();
  await mobile.waitForTimeout(3000);

  // Reposition bird after start (calibration may have triggered another reset)
  await mobile.evaluate(() => {
    const fs = window.__flightState;
    if (fs) {
      fs.position.set(3000, 18, 3000);
      fs.yaw = 2.35;
      fs.velocity.set(-Math.sin(2.35) * 15, 0, -Math.cos(2.35) * 15);
      fs.pitch = 0;
      fs.roll = 0;
    }
  });
  await mobile.waitForTimeout(2000);
  await mobile.screenshot({ path: 'tests/e2e/screenshots/water-mobile-overwater.png' });

  // Also test low pass over water for reflection
  await mobile.evaluate(() => {
    const fs = window.__flightState;
    if (fs) {
      fs.position.y = 16; // 1m above water
      fs.pitch = 0;
    }
  });
  await mobile.waitForTimeout(1500);
  await mobile.screenshot({ path: 'tests/e2e/screenshots/water-mobile-lowpass.png' });

  console.log('\n=== Errors ===');
  errors.forEach((e) => console.log(e));

  // Extract diagnostics — check Ocean3 Float-texture support
  const mobileDiag = await mobile.evaluate(() => {
    const scene = window.__scene;
    if (!scene) return null;
    let waterMesh = null;
    scene.traverse((o) => {
      if (o.material && o.material.uniforms && o.material.uniforms.oceanDisplacement) {
        waterMesh = o;
      }
    });
    if (!waterMesh) return { hasWater: false };

    const renderer = window.__camera?.constructor ? null : null;
    // Check WebGL2 float extensions
    const canvas = document.querySelector('canvas');
    const gl = canvas?.getContext('webgl2');
    const extInfo = gl ? {
      webgl2: true,
      float_blend: !!gl.getExtension('EXT_float_blend'),
      color_buffer_float: !!gl.getExtension('EXT_color_buffer_float'),
      texture_float_linear: !!gl.getExtension('OES_texture_float_linear'),
    } : { webgl2: false };

    const dispTex = waterMesh.material.uniforms.oceanDisplacement.value;
    const normTex = waterMesh.material.uniforms.normalSampler.value;
    return {
      hasWater: true,
      extensions: extInfo,
      displacementTexSize: dispTex ? [dispTex.image?.width, dispTex.image?.height] : null,
      normalTexSize: normTex ? [normTex.image?.width, normTex.image?.height] : null,
      displacementType: dispTex?.type,
      normalType: normTex?.type,
      waterPositionY: waterMesh.position.y,
      pixelRatio: window.devicePixelRatio,
      viewport: [window.innerWidth, window.innerHeight],
    };
  });
  console.log('\n=== Mobile water diagnostics ===');
  console.log(JSON.stringify(mobileDiag, null, 2));
});
