import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';

test('visitor sees the Life Points promise and a healthy versioned API', async ({ page }) => {
  const healthResponse = page.waitForResponse((response) =>
    response.url().endsWith('/api/life-points/v1/health'),
  );

  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Grow a life that feels rich.' }),
  ).toBeVisible();
  await expect(page.getByText('No streaks. No falling behind.')).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Life Points is ready');

  await expect((await healthResponse).json()).resolves.toEqual({
    apiVersion: 'v1',
    service: 'life-points',
    status: 'healthy',
  });

  const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
  const theme = [1, 3, 5].map((offset) =>
    Number.parseInt(themeColor!.slice(offset, offset + 2), 16),
  );
  const screenshot = PNG.sync.read(await page.screenshot({ fullPage: true }));
  const footerStart = Math.floor(screenshot.height * 0.9);
  const sideWidth = Math.ceil(screenshot.width * 0.015);
  let largestDifference = 0;
  for (let y = footerStart; y < screenshot.height; y += 1) {
    for (const x of Array(sideWidth).keys()) {
      const pixel = (screenshot.width * y + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        largestDifference = Math.max(
          largestDifference,
          Math.abs(screenshot.data[pixel + channel] - theme[channel]),
        );
      }
    }
  }
  expect(
    largestDifference,
    'footer edge should remain clear of decorative shapes and browser-chrome bands',
  ).toBeLessThanOrEqual(5);
});
