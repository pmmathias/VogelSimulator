/**
 * Performance benchmark: fly a long scripted route and measure FPS, frame times.
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: false,
  args: ['--use-gl=angle', '--enable-gpu-rasterization'],
});

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

// Inject FPS counter
await page.addInitScript(() => {
  window.__perfData = { frames: 0, times: [], lastTime: 0 };
  const origRAF = window.requestAnimationFrame;
  window.requestAnimationFrame = (cb) => {
    return origRAF((t) => {
      const pd = window.__perfData;
      if (pd.lastTime > 0) {
        const dt = t - pd.lastTime;
        pd.times.push(dt);
        if (pd.times.length > 300) pd.times.shift(); // keep last 300 frames
      }
      pd.lastTime = t;
      pd.frames++;
      cb(t);
    });
  };
});

console.log('Loading VogelSimulator...');
await page.goto('http://localhost:5173');
await page.waitForSelector('canvas', { timeout: 30000 });
await page.waitForTimeout(12000); // let scene build

console.log('Scene loaded. Starting performance test...\n');

// Helper to read perf stats
async function getStats() {
  return page.evaluate(() => {
    const pd = window.__perfData;
    if (pd.times.length < 10) return null;
    const sorted = [...pd.times].sort((a, b) => a - b);
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const p1 = sorted[Math.floor(sorted.length * 0.01)];  // 1st percentile (best)
    const p50 = sorted[Math.floor(sorted.length * 0.5)];  // median
    const p95 = sorted[Math.floor(sorted.length * 0.95)]; // 95th percentile
    const p99 = sorted[Math.floor(sorted.length * 0.99)]; // 99th percentile (worst)
    const fps = 1000 / avg;
    const jank = sorted.filter(t => t > 33).length; // frames > 33ms (below 30fps)
    const stutter = sorted.filter(t => t > 50).length; // frames > 50ms (noticeable stutter)
    const alt = document.body.innerText.match(/ALT: (-?\d+)/)?.[1] || '?';
    const spd = document.body.innerText.match(/SPD: (\d+)/)?.[1] || '?';
    return { fps: fps.toFixed(1), avg: avg.toFixed(1), p1: p1.toFixed(1), p50: p50.toFixed(1), p95: p95.toFixed(1), p99: p99.toFixed(1), jank, stutter, frames: pd.times.length, alt, spd };
  });
}

// Flight segments with descriptions
const segments = [
  { name: 'CLIMB (flap)', action: 'flap', duration: 5 },
  { name: 'GLIDE (cruise)', action: 'glide', duration: 5 },
  { name: 'LEFT TURN (bank)', action: 'flapLeft', duration: 6 },
  { name: 'HIGH SPEED GLIDE', action: 'glide', duration: 4 },
  { name: 'RIGHT TURN (bank)', action: 'flapRight', duration: 6 },
  { name: 'DIVE (nosedive)', action: 'dive', duration: 5 },
  { name: 'RECOVERY (flap climb)', action: 'flapClimb', duration: 5 },
  { name: 'LOW FLY (near terrain)', action: 'glide', duration: 5 },
  { name: 'FLAP + TURN', action: 'flapLeft', duration: 5 },
  { name: 'EXTENDED CRUISE', action: 'glide', duration: 8 },
];

console.log('═══════════════════════════════════════════════════════════════');
console.log('  SEGMENT               FPS    AVG    P50    P95    P99   JANK  STUTTER  ALT    SPD');
console.log('═══════════════════════════════════════════════════════════════');

const allResults = [];

for (const seg of segments) {
  // Reset perf counter
  await page.evaluate(() => { window.__perfData.times = []; });

  // Start segment
  await page.evaluate((s) => {
    window.__startAutopilot([{ action: s.action, duration: s.duration }]);
  }, seg);

  // Wait for segment to complete
  await page.waitForTimeout(seg.duration * 1000);

  // Collect stats
  const stats = await getStats();
  if (stats) {
    const line = `  ${seg.name.padEnd(22)} ${stats.fps.padStart(5)}  ${stats.avg.padStart(5)}ms ${stats.p50.padStart(5)}ms ${stats.p95.padStart(5)}ms ${stats.p99.padStart(5)}ms  ${String(stats.jank).padStart(4)}    ${String(stats.stutter).padStart(4)}   ${stats.alt.padStart(5)}  ${stats.spd.padStart(4)}`;
    console.log(line);
    allResults.push({ ...stats, name: seg.name });
  }

  // Screenshot at end of each segment
  await page.screenshot({ path: `perf-${seg.name.replace(/[^a-zA-Z]/g, '_').toLowerCase()}.png` });
}

console.log('═══════════════════════════════════════════════════════════════');

// Overall summary
const allFps = allResults.map(r => parseFloat(r.fps));
const allP95 = allResults.map(r => parseFloat(r.p95));
const allP99 = allResults.map(r => parseFloat(r.p99));
const totalJank = allResults.reduce((a, r) => a + r.jank, 0);
const totalStutter = allResults.reduce((a, r) => a + r.stutter, 0);

console.log(`\n  OVERALL SUMMARY:`);
console.log(`  Average FPS:     ${(allFps.reduce((a, b) => a + b, 0) / allFps.length).toFixed(1)}`);
console.log(`  Min FPS:         ${Math.min(...allFps).toFixed(1)}`);
console.log(`  Max FPS:         ${Math.max(...allFps).toFixed(1)}`);
console.log(`  Worst P95:       ${Math.max(...allP95).toFixed(1)}ms`);
console.log(`  Worst P99:       ${Math.max(...allP99).toFixed(1)}ms`);
console.log(`  Total jank (>33ms):    ${totalJank} frames`);
console.log(`  Total stutter (>50ms): ${totalStutter} frames`);
console.log(`\n  Verdict: ${totalStutter === 0 ? '✅ SMOOTH' : totalStutter < 10 ? '⚠️ MINOR STUTTER' : '❌ NEEDS OPTIMIZATION'}`);

await browser.close();
console.log('\nDone!');
