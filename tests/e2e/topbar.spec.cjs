const { test } = require('@playwright/test');

test.use({
  browserName: 'chromium',
  viewport: { width: 1280, height: 720 },
  launchOptions: { args: ['--ignore-gpu-blocklist'] },
  headless: false,
});

test('top bar appearance', async ({ page }) => {
  await page.goto('http://localhost:5173/VogelSimulator/?y=60');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'tests/e2e/screenshots/topbar.png' });

  // Click Credits
  await page.click('#credits-btn');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'tests/e2e/screenshots/credits.png' });

  // Check waterPath
  const info = await page.evaluate(() => ({
    waterPath: window.__waterPath,
    topbar: document.getElementById('topbar')?.innerText,
  }));
  console.log('Info:', JSON.stringify(info, null, 2));
});
