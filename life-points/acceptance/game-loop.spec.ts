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
  await page.getByRole('button', { name: 'Log an Activity Entry' }).click();

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
    `${apiUrl}/api/collections/activities/records?perPage=200`,
    { headers: authorization },
  );
  const activities = (await activitiesResponse.json()) as {
    items: Array<{ id: string; name: string }>;
  };
  const strengthWorkout = activities.items.find(({ name }) => name === 'Strength workout')!;
  const walk = activities.items.find(({ name }) => name === '30-min walk')!;
  const invalidDateEntry = await request.post(`${apiUrl}/api/life-points/v1/activity-entries`, {
    data: { activityIds: [strengthWorkout.id], occurredOn: '2026-99-99' },
    headers: authorization,
  });
  expect(invalidDateEntry.status()).toBe(400);

  const stackedEntry = await request.post(`${apiUrl}/api/life-points/v1/activity-entries`, {
    data: { activityIds: [strengthWorkout.id, walk.id], occurredOn: today },
    headers: authorization,
  });
  expect(stackedEntry.status()).toBe(201);
  expect((await stackedEntry.json()) as { entry: { points: number } }).toMatchObject({
    entry: { points: 15 },
  });

  const otherAccount = await authenticateWithCode(request, 'friend@example.test');
  const crossGameEntry = await request.post(`${apiUrl}/api/life-points/v1/activity-entries`, {
    data: { activityIds: [strengthWorkout.id], occurredOn: today },
    headers: { Authorization: otherAccount.token },
  });
  expect(crossGameEntry.status()).toBe(404);
});

test('Player stacks Activities and intentionally repeats one on the same day', async ({
  page,
}) => {
  await onboard(page, 'stacked-day@example.test');
  await page.getByRole('button', { name: 'Log an Activity Entry' }).click();

  const walk = page.getByRole('checkbox', { name: '30-min walk, 5 points' });
  const strength = page.getByRole('checkbox', { name: 'Strength workout, 10 points' });
  const newCafe = page.getByRole('checkbox', { name: 'New café, 5 points' });
  await walk.check();
  await strength.check();
  await newCafe.check();
  await newCafe.uncheck();
  await page.getByRole('button', { name: 'Save Activity Entry' }).click();

  await expect(page.getByRole('status')).toHaveText('15 points earned');
  const historyEntries = page.locator('.history-entry');
  await expect(historyEntries).toHaveCount(1);
  await expect(historyEntries.first()).toContainText('30-min walk');
  await expect(historyEntries.first()).toContainText('Strength workout');
  await expect(historyEntries.first()).toContainText('+15 points');

  await page.getByRole('button', { name: 'Log an Activity Entry' }).click();
  await expect(page.getByText('Already logged today', { exact: true })).toHaveCount(2);
  await expect(walk).toBeEnabled();
  await walk.check();
  await page.getByRole('button', { name: 'Save Activity Entry' }).click();

  await expect(page.getByRole('status')).toHaveText('5 points earned');
  await expect(page.getByText('Lifetime Points').locator('..')).toContainText('20');
  await expect(page.getByText('Available Points').locator('..')).toContainText('20');
  await expect(historyEntries).toHaveCount(2);
  const repeatedEntry = historyEntries.filter({ hasText: '+5 points' });
  await expect(repeatedEntry).toContainText('30-min walk');
  const stackedEntry = historyEntries.filter({ hasText: '+15 points' });
  await expect(stackedEntry).toContainText('30-min walk');
  await expect(stackedEntry).toContainText('Strength workout');
});

test('Player sees the logged-date hint only for the selected occurred-on date', async ({ page }) => {
  await onboard(page, 'selected-date-hint@example.test');
  await page.getByRole('button', { name: 'Log an Activity Entry' }).click();
  await page.getByRole('checkbox', { name: '30-min walk, 5 points' }).check();
  await page.getByRole('button', { name: 'Save Activity Entry' }).click();
  await expect(page.getByRole('status')).toHaveText('5 points earned');

  await page.getByRole('button', { name: 'Log an Activity Entry' }).click();
  await expect(page.getByText('Already logged today', { exact: true })).toHaveCount(1);
  const tomorrow = await page.evaluate(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  });
  await page.getByLabel('Occurred on').fill(tomorrow);
  await expect(page.getByText('Already logged today', { exact: true })).toHaveCount(0);
});

test('Player backdates an Activity Entry and History uses occurred-on date order', async ({
  page,
}) => {
  await onboard(page, 'backdated-entry@example.test');
  await page.getByRole('button', { name: 'Log an Activity Entry' }).click();

  const occurredOn = page.getByLabel('Occurred on');
  await expect(occurredOn).toHaveValue(await page.evaluate(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }));

  await occurredOn.fill('2025-12-31');
  await page.getByRole('checkbox', { name: '30-min walk, 5 points' }).check();
  await page.getByRole('button', { name: 'Save Activity Entry' }).click();
  await expect(page.locator('.history-entry').first()).toContainText('2025-12-31');

  await page.getByRole('button', { name: 'Log an Activity Entry' }).click();
  await occurredOn.fill('2025-12-31');
  await expect(occurredOn).toHaveValue('2025-12-31');
  await page.getByRole('checkbox', { name: 'Strength workout, 10 points' }).check();
  await expect(page.getByRole('button', { name: 'Save Activity Entry' })).toBeEnabled();
  expect(await page.locator('#quick-add-form').evaluate((form) => form.checkValidity())).toBe(true);
  const secondSave = page.waitForResponse((response) =>
    response.url().endsWith('/api/life-points/v1/activity-entries') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Save Activity Entry' }).click();
  const secondSaveResponse = await secondSave;
  expect(secondSaveResponse.status()).toBe(201);
  expect((await secondSaveResponse.json()) as { entry: { points: number } }).toMatchObject({
    entry: { points: 10 },
  });
  await expect(page.getByRole('status')).toHaveText('10 points earned');

  await page.getByRole('button', { name: 'Log an Activity Entry' }).click();
  await occurredOn.fill('2026-01-01');
  await page.getByRole('checkbox', { name: 'Strength workout, 10 points' }).check();
  await page.getByRole('button', { name: 'Save Activity Entry' }).click();

  const historyEntries = page.locator('.history-entry');
  await expect(historyEntries).toHaveCount(3);
  await expect(historyEntries.nth(0)).toContainText('2026-01-01');
  await expect(historyEntries.nth(1)).toContainText('2025-12-31');
  await expect(historyEntries.nth(1)).toContainText('Strength workout');
  await expect(historyEntries.nth(2)).toContainText('30-min walk');
});

test('Player totals Activity Entries from Monday through Sunday and the occurred-on month', async ({
  page,
  request,
}) => {
  const session = await onboard(page, 'calendar-boundaries@example.test');
  const authorization = { Authorization: session.token };
  const activitiesResponse = await request.get(
    `${apiUrl}/api/collections/activities/records?perPage=200`,
    { headers: authorization },
  );
  const activities = (await activitiesResponse.json()) as {
    items: Array<{ id: string; name: string }>;
  };
  const walk = activities.items.find(({ name }) => name === '30-min walk')!;

  for (const occurredOn of ['2025-12-29', '2025-12-31', '2026-01-01', '2026-01-04']) {
    const response = await request.post(`${apiUrl}/api/life-points/v1/activity-entries`, {
      data: { activityIds: [walk.id], occurredOn },
      headers: authorization,
    });
    expect(response.status()).toBe(201);
  }

  await page.addInitScript(() => {
    const RealDate = Date;
    const fixedNow = new RealDate('2026-01-01T12:00:00').valueOf();
    // @ts-expect-error Replace the browser clock for this boundary scenario.
    window.Date = class extends RealDate {
      constructor(...args: ConstructorParameters<typeof RealDate>) {
        super(...(args.length === 0 ? [fixedNow] : args));
      }

      static now() {
        return fixedNow;
      }
    };
  });
  await page.reload();

  await expect(page.getByText('This Week').locator('..')).toContainText('20');
  await expect(page.getByText('This Month').locator('..')).toContainText('10');
});
