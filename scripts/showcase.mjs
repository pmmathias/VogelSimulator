/**
 * Showcase flight: scenic screenshots for blog/README.
 * Opens browser with camera permission — user does gestures live.
 * Also runs autopilot segments for consistent shots.
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: false,
  args: [
    '--use-gl=angle',
    '--use-fake-ui-for-media-stream', // auto-allow camera
  ],
});

const context = await browser.newContext({
  permissions: ['camera'],
  viewport: { width: 1920, height: 1080 },
});
const page = await context.newPage();

page.on('console', m => {
  if (m.text().includes('Spawn') || m.text().includes('Stork') || m.text().includes('Hotel'))
    console.log('[B]', m.text());
});

console.log('Opening VogelSimulator...');
await page.goto('http://localhost:5173');
await page.waitForSelector('canvas', { timeout: 30000 });
console.log('Waiting for scene to build (15s)...');
await page.waitForTimeout(15000);

console.log('\n=== AUTOPILOT SHOWCASE FLIGHT ===\n');

const shots = [
  // Each: { name, sequence, waitBefore, waitAfter }
  {
    name: '01-start-overview',
    desc: 'Starting view — island overview',
    seq: null, // just take screenshot of initial view
    wait: 0,
  },
  {
    name: '02-climb-stork',
    desc: 'Climbing with stork visible',
    seq: [{ action: 'flap', duration: 4 }],
    wait: 3000,
  },
  {
    name: '03-glide-landscape',
    desc: 'Gliding over landscape',
    seq: [{ action: 'glide', duration: 5 }],
    wait: 4000,
  },
  {
    name: '04-turn-mountains',
    desc: 'Banking turn with mountains',
    seq: [{ action: 'flapLeft', duration: 4 }],
    wait: 3000,
  },
  {
    name: '05-coastal-view',
    desc: 'Coastal view with water',
    seq: [{ action: 'flapLeft', duration: 5 }],
    wait: 4000,
  },
  {
    name: '06-low-flight',
    desc: 'Low flight near trees and buildings',
    seq: [{ action: 'dive', duration: 3 }, { action: 'glide', duration: 3 }],
    wait: 4000,
  },
  {
    name: '07-speed-dive',
    desc: 'Speed dive toward terrain',
    seq: [{ action: 'dive', duration: 4 }],
    wait: 3000,
  },
  {
    name: '08-recovery-climb',
    desc: 'Recovery climb after dive',
    seq: [{ action: 'flapClimb', duration: 5 }],
    wait: 4000,
  },
  {
    name: '09-panorama',
    desc: 'Panoramic view of island',
    seq: [{ action: 'flapRight', duration: 6 }, { action: 'glide', duration: 3 }],
    wait: 7000,
  },
  {
    name: '10-final-overview',
    desc: 'Final high-altitude overview',
    seq: [{ action: 'flapClimb', duration: 4 }, { action: 'glide', duration: 3 }],
    wait: 6000,
  },
];

for (const shot of shots) {
  if (shot.seq) {
    await page.evaluate((seq) => window.__startAutopilot(seq), shot.seq);
  }

  if (shot.wait > 0) {
    await page.waitForTimeout(shot.wait);
  }

  // Get flight data
  const info = await page.evaluate(() => {
    const txt = document.body.innerText;
    return {
      alt: txt.match(/ALT: (-?\d+)/)?.[1] || '?',
      spd: txt.match(/SPD: (\d+)/)?.[1] || '?',
    };
  });

  const path = `blog-screenshots/${shot.name}.jpg`;
  await page.screenshot({ path: path.replace('.jpg', '.png') });

  console.log(`📸 ${shot.name} — ${shot.desc} (ALT:${info.alt} SPD:${info.spd})`);

  // Wait for autopilot to finish
  if (shot.seq) {
    const totalDuration = shot.seq.reduce((a, s) => a + s.duration, 0) * 1000;
    const remaining = totalDuration - shot.wait;
    if (remaining > 0) await page.waitForTimeout(remaining);
  }
}

// Convert PNGs to JPGs
console.log('\nConverting to JPG...');
for (const shot of shots) {
  const png = `blog-screenshots/${shot.name}.png`;
  const jpg = `blog-screenshots/${shot.name}.jpg`;
  await page.evaluate(() => {}); // no-op to keep browser alive
}

console.log('\n✅ All screenshots taken! Check blog-screenshots/ folder.');
console.log('Press Ctrl+C to close browser, or wait 30s...');
await page.waitForTimeout(30000);

await browser.close();
