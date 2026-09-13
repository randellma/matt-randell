import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const apiUrl = process.env.LIFE_POINTS_API_URL ?? 'http://127.0.0.1:8090';
const mailUrl = process.env.LIFE_POINTS_MAIL_URL ?? 'http://127.0.0.1:8025';

type AuthData = {
  token: string;
  record: { game: string; id: string; playerName: string; verified: boolean };
};

async function waitForCode(email: string, expectedOtpId: string): Promise<string> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const search = await fetch(
      `${mailUrl}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    );
    const result = (await search.json()) as { messages?: Array<{ ID: string }> };
    for (const { ID } of result.messages ?? []) {
      const response = await fetch(`${mailUrl}/api/v1/message/${ID}`);
      const message = (await response.json()) as { HTML?: string; Text?: string };
      const body = `${message.Text ?? ''}\n${message.HTML ?? ''}`.replaceAll('&amp;', '&');
      const code = body.match(/\b\d{8}\b/)?.[0];
      const link = body.match(/https?:\/\/[^\s<"]+\?otpId=[^\s<"]+/)?.[0];
      if (code && link && new URL(link).searchParams.get('otpId') === expectedOtpId) {
        return code;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`No OTP email was captured for ${email}.`);
}

async function authenticateWithCode(
  request: APIRequestContext,
  email: string,
): Promise<AuthData> {
  const otpResponse = await request.post(
    `${apiUrl}/api/collections/accounts/request-otp`,
    { data: { email } },
  );
  expect(otpResponse.ok()).toBe(true);
  const otpId = ((await otpResponse.json()) as { otpId: string }).otpId;
  const code = await waitForCode(email, otpId);
  const response = await request.post(
    `${apiUrl}/api/collections/accounts/auth-with-otp`,
    { data: { otpId, password: code } },
  );
  expect(response.ok()).toBe(true);
  return response.json() as Promise<AuthData>;
}

async function onboard(page: Page, email: string): Promise<AuthData> {
  await page.goto('/');
  await page.getByLabel('Email address').fill(email);
  const otpResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith('/api/collections/accounts/request-otp'),
  );
  await page.getByRole('button', { name: 'Email me a code' }).click();
  const otpResponse = await otpResponsePromise;
  const otpId = ((await otpResponse.json()) as { otpId: string }).otpId;
  await page.getByLabel('Eight-digit code').fill(await waitForCode(email, otpId));
  await page.getByRole('button', { name: 'Enter my Game' }).click();
  await page.getByLabel('Player Name').fill('Casey');
  await page.getByRole('button', { name: 'Start my Game' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, Casey' })).toBeVisible();
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem('life-points-session') ?? 'null'),
  ) as Promise<AuthData>;
}

test('Player logs one Activity and immediately earns points in their Game', async ({
  page,
  request,
}) => {
  const session = await onboard(page, 'casey@example.test');
  const today = await page.evaluate(() => {
    const date = new Date();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  });

  await expect(page.getByText('Lifetime Points').locator('..')).toContainText('0');
  await expect(page.getByText('Available Points').locator('..')).toContainText('0');
  await page.getByRole('button', { name: 'Add an Activity' }).click();

  await expect(page.getByRole('heading', { name: 'Move' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Create' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Explore' })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Strength workout, 10 points' }).check();
  await page.getByRole('button', { name: 'Save Activity Entry' }).click();

  await expect(page.getByRole('status')).toHaveText('10 points earned');
  await expect(page.getByText('Lifetime Points').locator('..')).toContainText('10');
  await expect(page.getByText('Available Points').locator('..')).toContainText('10');
  const history = page.getByRole('region', { name: 'History' });
  await expect(history).toBeVisible();
  await expect(history.getByText('Strength workout')).toBeVisible();
  await expect(history.getByText('+10 points')).toBeVisible();

  const authorization = { Authorization: session.token };
  const entriesResponse = await request.get(
    `${apiUrl}/api/collections/activity_entries/records`,
    { headers: authorization },
  );
  expect(entriesResponse.ok()).toBe(true);
  const entries = (await entriesResponse.json()) as {
    items: Array<{ game: string; occurredOn: string; points: number }>;
  };
  expect(entries.items).toHaveLength(1);
  expect(entries.items[0]).toMatchObject({
    game: session.record.game,
    occurredOn: today,
    points: 10,
  });

  const itemsResponse = await request.get(
    `${apiUrl}/api/collections/activity_entry_items/records`,
    { headers: authorization },
  );
  expect(itemsResponse.ok()).toBe(true);
  const items = (await itemsResponse.json()) as { items: Array<Record<string, unknown>> };
  expect(items.items).toHaveLength(1);
  expect(items.items[0]).toMatchObject({
    activityName: 'Strength workout',
    categoryColor: '#3F7D6C',
    categoryName: 'Move',
    categoryPlantFamily: 'fern',
    points: 10,
  });

  const activitiesResponse = await request.get(
    `${apiUrl}/api/collections/activities/records?filter=${encodeURIComponent("name = 'Strength workout'")}`,
    { headers: authorization },
  );
  const activities = (await activitiesResponse.json()) as { items: Array<{ id: string }> };
  const otherAccount = await authenticateWithCode(request, 'friend@example.test');
  const crossGameEntry = await request.post(`${apiUrl}/api/life-points/v1/activity-entries`, {
    data: { activityId: activities.items[0].id, occurredOn: today },
    headers: { Authorization: otherAccount.token },
  });
  expect(crossGameEntry.status()).toBe(404);
});
