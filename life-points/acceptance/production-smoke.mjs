import { chromium, expect } from '@playwright/test';

const productionUrl = 'https://lifepoints.mattrandell.com';
const browser = await chromium.launch();

try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });

  await page.goto(productionUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });

  // Reaching this state proves that the public Pages site loaded and its
  // browser request to the public PocketBase health endpoint returned the
  // expected versioned response. A browser can also complete Cloudflare's
  // managed bot challenge, which intentionally rejects curl from hosted CI.
  await expect(page.getByRole('status')).toHaveText('Life Points is ready', {
    timeout: 60_000,
  });
} finally {
  await browser.close();
}
