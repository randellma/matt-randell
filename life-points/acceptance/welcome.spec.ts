import { expect, test } from '@playwright/test';

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
});
