import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: false,
  args: ['--use-gl=angle'],
});

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', msg => console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`));
page.on('pageerror', err => console.error(`[BROWSER ERROR] ${err.message}`));

await page.goto('http://localhost:5173');
await page.waitForSelector('canvas', { timeout: 30000 });
await page.waitForTimeout(8000);

// Screenshot 1: Starting view
await page.screenshot({ path: 'screenshot-start.png' });
console.log('Screenshot: start');

// Fly autopilot to see beach, mountains, and buildings
await page.evaluate(() => {
  window.__startAutopilot([
    { action: 'dive', duration: 3 },        // descend toward terrain
    { action: 'glide', duration: 2 },        // level off near ground
    { action: 'flapLeft', duration: 5 },     // circle to find beach/water
    { action: 'glide', duration: 2 },        // coast
    { action: 'flapClimb', duration: 3 },    // climb for overview
    { action: 'flapRight', duration: 4 },    // turn other way
    { action: 'dive', duration: 3 },         // dive toward buildings
  ]);
});

// Take screenshots at key moments
await page.waitForTimeout(3000);
await page.screenshot({ path: 'screenshot-descend.png' });
console.log('Screenshot: descend');

await page.waitForTimeout(5000);
await page.screenshot({ path: 'screenshot-beach.png' });
console.log('Screenshot: beach (looking for waterline/sand)');

await page.waitForTimeout(4000);
await page.screenshot({ path: 'screenshot-overview.png' });
console.log('Screenshot: overview');

await page.waitForTimeout(5000);
await page.screenshot({ path: 'screenshot-buildings.png' });
console.log('Screenshot: buildings');

await page.waitForTimeout(3000);
await page.screenshot({ path: 'screenshot-dive.png' });
console.log('Screenshot: dive');

await browser.close();
console.log('Done!');
