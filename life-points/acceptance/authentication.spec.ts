import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { PNG } from 'pngjs';

const apiUrl = process.env.LIFE_POINTS_API_URL ?? 'http://127.0.0.1:8090';
const mailUrl = process.env.LIFE_POINTS_MAIL_URL ?? 'http://127.0.0.1:8025';

type CapturedOtp = {
  code: string;
  link: string;
};

type AuthData = {
  token: string;
  record: {
    game: string;
    id: string;
    playerName: string;
    verified: boolean;
  };
};

async function expectViewportEdgesToMatchTheme(page: Page): Promise<void> {
  const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
  expect(themeColor).toMatch(/^#[0-9a-f]{6}$/i);

  const theme = [1, 3, 5].map((offset) =>
    Number.parseInt(themeColor!.slice(offset, offset + 2), 16),
  );
  const screenshot = PNG.sync.read(await page.screenshot());
  const edgeColor = (y: number): number[] => {
    const start = Math.floor(screenshot.width * 0.4);
    const end = Math.ceil(screenshot.width * 0.6);
    const totals = [0, 0, 0];
    for (let x = start; x < end; x += 1) {
      const pixel = (screenshot.width * y + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        totals[channel] += screenshot.data[pixel + channel];
      }
    }
    return totals.map((total) => Math.round(total / (end - start)));
  };
  const difference = (color: number[]): number =>
    Math.max(...color.map((channel, index) => Math.abs(channel - theme[index])));

  expect(
    difference(edgeColor(0)),
    'top viewport edge should blend into Safari chrome',
  ).toBeLessThanOrEqual(5);
  expect(
    difference(edgeColor(screenshot.height - 1)),
    'bottom viewport edge should blend into Safari chrome',
  ).toBeLessThanOrEqual(5);

  const footerStart = Math.floor(screenshot.height * 0.9);
  const footerBandDifference = Math.max(
    ...Array.from(
      { length: screenshot.height - footerStart },
      (_, offset) => difference(edgeColor(footerStart + offset)),
    ),
  );
  expect(
    footerBandDifference,
    'footer background should stay even behind Safari chrome',
  ).toBeLessThanOrEqual(5);
}

async function waitForOtp(email: string, expectedOtpId: string): Promise<CapturedOtp> {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    const search = await fetch(
      `${mailUrl}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    );
    const result = (await search.json()) as {
      messages?: Array<{ ID: string }>;
    };
    for (const { ID: messageId } of result.messages ?? []) {
      const response = await fetch(`${mailUrl}/api/v1/message/${messageId}`);
      const message = (await response.json()) as { HTML?: string; Text?: string };
      const body = `${message.Text ?? ''}\n${message.HTML ?? ''}`.replaceAll('&amp;', '&');
      const code = body.match(/\b\d{8}\b/)?.[0];
      const link = body
        .match(/https?:\/\/[^\s<"]+\?otpId=[^\s<"]+/)?.[0]
        .replace(/[).,]+$/, '');

      if (code && link && new URL(link).searchParams.get('otpId') === expectedOtpId) {
        return { code, link };
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`No OTP email was captured for ${email}.`);
}

async function requestOtp(
  request: APIRequestContext,
  email: string,
): Promise<{ otpId: string; captured: CapturedOtp }> {
  const response = await request.post(`${apiUrl}/api/collections/accounts/request-otp`, {
    data: { email },
  });
  expect(response.ok()).toBe(true);

  const otpId = ((await response.json()) as { otpId: string }).otpId;
  const captured = await waitForOtp(email, otpId);
  const magicLink = new URL(captured.link);
  expect(magicLink.searchParams.get('otpId')).toBe(otpId);
  expect(magicLink.searchParams.get('otp')).toBe(captured.code);

  return {
    otpId,
    captured,
  };
}

async function authenticateWithCode(
  request: APIRequestContext,
  email: string,
): Promise<AuthData> {
  const otp = await requestOtp(request, email);
  const response = await request.post(`${apiUrl}/api/collections/accounts/auth-with-otp`, {
    data: { otpId: otp.otpId, password: otp.captured.code },
  });
  expect(response.ok()).toBe(true);
  return response.json() as Promise<AuthData>;
}

test('Game Owner enters with either OTP credential and keeps control of local access', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await page.getByLabel('Email address').fill('ysabel08@gmail.com');
  const otpResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/collections/accounts/request-otp') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Email me a code' }).click();

  const firstOtpId = ((await (await otpResponse).json()) as { otpId: string }).otpId;
  const firstOtp = await waitForOtp('ysabel08@gmail.com', firstOtpId);
  await expect(page.getByText('The code expires in 3 minutes.')).toBeVisible();
  expect(firstOtp.code).toMatch(/^\d{8}$/);

  await page.getByLabel('Eight-digit code').fill(firstOtp.code);
  await page.getByRole('button', { name: 'Enter my Game' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, Ysabel' })).toBeVisible();
  await expect(page.getByText("Ysabel's Life Points")).toBeVisible();
  await expectViewportEdgesToMatchTheme(page);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Welcome, Ysabel' })).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByLabel('Email address')).toBeVisible();

  await page.goto(firstOtp.link);
  await expect(page.getByText('That code has already been used or has expired.')).toBeVisible();

  const secondOtp = await requestOtp(request, 'ysabel08@gmail.com');
  await page.goto(secondOtp.captured.link);
  await expect(page.getByRole('heading', { name: 'Welcome, Ysabel' })).toBeVisible();
  await expect(page.getByText("Ysabel's Life Points")).toBeVisible();

  const reusedCode = await request.post(
    `${apiUrl}/api/collections/accounts/auth-with-otp`,
    { data: { otpId: secondOtp.otpId, password: secondOtp.captured.code } },
  );
  expect(reusedCode.ok()).toBe(false);
});

test('two seeded Accounts cannot cross their Game tenant boundary', async ({ request }) => {
  const ysabel = await authenticateWithCode(request, 'ysabel08@gmail.com');
  const rowan = await authenticateWithCode(request, 'friend@example.test');

  const ownGame = await request.get(
    `${apiUrl}/api/collections/games/records/${ysabel.record.game}`,
    { headers: { Authorization: ysabel.token } },
  );
  expect(ownGame.ok()).toBe(true);

  const otherGame = await request.get(
    `${apiUrl}/api/collections/games/records/${rowan.record.game}`,
    { headers: { Authorization: ysabel.token } },
  );
  expect(otherGame.status()).toBe(404);

  const mutation = await request.patch(
    `${apiUrl}/api/collections/games/records/${rowan.record.game}`,
    {
      data: { title: 'Not your Game' },
      headers: { Authorization: ysabel.token },
    },
  );
  expect(mutation.status()).toBe(404);

  const form = new FormData();
  form.set(
    'cover',
    new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], {
      type: 'image/svg+xml',
    }),
    'garden.svg',
  );
  const upload = await fetch(
    `${apiUrl}/api/collections/games/records/${ysabel.record.game}`,
    {
      body: form,
      headers: { Authorization: ysabel.token },
      method: 'PATCH',
    },
  );
  expect(upload.ok).toBe(true);
  const game = (await upload.json()) as { collectionId: string; cover: string; id: string };

  const ownFileTokenResponse = await request.post(`${apiUrl}/api/files/token`, {
    headers: { Authorization: ysabel.token },
  });
  const otherFileTokenResponse = await request.post(`${apiUrl}/api/files/token`, {
    headers: { Authorization: rowan.token },
  });
  const ownFileToken = ((await ownFileTokenResponse.json()) as { token: string }).token;
  const otherFileToken = ((await otherFileTokenResponse.json()) as { token: string }).token;
  const filePath = `${apiUrl}/api/files/${game.collectionId}/${game.id}/${game.cover}`;

  expect((await request.get(`${filePath}?token=${ownFileToken}`)).ok()).toBe(true);
  expect((await request.get(`${filePath}?token=${otherFileToken}`)).status()).toBe(404);
});

test('visitor verifies their email and creates exactly one complete Game', async ({
  page,
  request,
}) => {
  const email = 'avery@example.test';

  await page.goto('/');
  await page.getByLabel('Email address').fill(email);
  const otpResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/collections/accounts/request-otp') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Email me a code' }).click();

  const otpId = ((await (await otpResponse).json()) as { otpId: string }).otpId;
  const otp = await waitForOtp(email, otpId);
  await expect(page.getByLabel('Player Name')).toHaveCount(0);

  await page.getByLabel('Eight-digit code').fill(otp.code);
  await page.getByRole('button', { name: 'Enter my Game' }).click();
  await expect(page.getByRole('heading', { name: 'Make it yours.' })).toBeVisible();
  const verifiedAccount = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('life-points-session') ?? 'null'),
  ) as AuthData;
  expect(verifiedAccount.record).toMatchObject({ game: '', playerName: '', verified: true });
  const retriedRegistration = await requestOtp(request, email);
  const rejectedProvision = await request.post(`${apiUrl}/api/life-points/v1/onboarding`, {
    data: { playerName: 'Avery', title: 'x'.repeat(121) },
    headers: { Authorization: verifiedAccount.token },
  });
  expect(rejectedProvision.status()).toBe(400);
  for (const collection of ['games', 'categories', 'activities', 'rewards', 'monthly_quests']) {
    const response = await request.get(
      `${apiUrl}/api/collections/${collection}/records?perPage=1`,
      { headers: { Authorization: verifiedAccount.token } },
    );
    expect(response.ok()).toBe(true);
    expect(((await response.json()) as { totalItems: number }).totalItems).toBe(0);
  }
  await page.getByLabel('Player Name').fill('Avery');
  await expect(page.getByLabel('Game title')).toHaveValue("Avery's Life Points");
  await page.getByLabel('Game title').fill("Avery's Wild Life");

  const provisionResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/life-points/v1/onboarding') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Start my Game' }).click();
  expect((await provisionResponse).ok()).toBe(true);
  await expect(page.getByRole('heading', { name: 'Welcome, Avery' })).toBeVisible();
  await expect(page.getByText("Avery's Wild Life")).toBeVisible();

  const session = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('life-points-session') ?? 'null'),
  ) as AuthData;
  expect(session.record.verified).toBe(true);
  expect(session.record.game).not.toBe('');

  const authorization = { Authorization: session.token };
  const list = async (collection: string, ordered = true) => {
    const query = ordered ? '&sort=sortOrder' : '';
    const response = await request.get(
      `${apiUrl}/api/collections/${collection}/records?perPage=200${query}`,
      { headers: authorization },
    );
    expect(response.ok()).toBe(true);
    return response.json() as Promise<{ items: Array<Record<string, unknown>>; totalItems: number }>;
  };

  const [accounts, games, categories, activities, rewards, quests] = await Promise.all([
    list('accounts', false),
    list('games', false),
    list('categories'),
    list('activities'),
    list('rewards'),
    list('monthly_quests'),
  ]);
  expect(accounts.totalItems).toBe(1);
  expect(accounts.items[0]).toMatchObject({
    game: session.record.game,
    id: session.record.id,
    playerName: 'Avery',
    role: 'owner',
  });
  expect(games.totalItems).toBe(1);
  expect(categories.items.map(({ name }) => name).sort()).toEqual(
    ['Move', 'Create', 'Explore', 'Connect', 'Nurture', 'Enjoy', 'Bonus'].sort(),
  );
  expect(activities.totalItems).toBe(63);
  expect(activities.items.map(({ name, points }) => `${name} — ${points}`).sort()).toEqual(
    [
      'Strength workout — 10', '30-min walk — 5', '60+ min walk/hike — 8',
      'Long hike/active outing — 12', 'New workout — 12', '20-min mobility/stretch — 4',
      'Walk instead of drive — 3', 'Workout + walk same day — 3', 'Write 20 min — 5',
      'Write 30 min — 8', 'Write 60 min — 12', '1,000+ words — 15', 'Finish a scene — 10',
      'Finish a chapter — 15', 'Plot/development work — 8', 'Read 30 min — 5',
      'Finish a book — 15', 'Creative project — 8', 'New café — 5', 'New restaurant — 8',
      'New neighborhood — 8', "Somewhere you've never been — 12", 'New hiking trail — 10',
      'Museum/gallery — 10', 'Live music — 12', 'Theatre/comedy — 12',
      'Winery/tasting — 12', 'Class/workshop — 15', "Something you've never done — 15",
      'Spontaneous adventure — 15', 'Day trip — 20', 'Weekend getaway — 30',
      'See a friend — 8', 'Make actual plans instead of texting — 5', 'Host friends — 15',
      'Dinner with friends — 10', "Girls' night — 10", 'Call someone you love — 3',
      'Coffee with someone — 5', 'Go to an event you almost skipped — 10',
      'Make a new social connection — 10', 'Healthy dinner — 5', 'New recipe — 8',
      'Garden — 5', 'Home project — 8', 'Declutter an area — 5',
      "Deep-clean something you've avoided — 8", 'Creative home project — 5',
      'Self-care ritual — 5', 'Afternoon outside — 8', 'Complete a procrastinated task — 8',
      'Read somewhere beautiful — 5', 'Coffee outside — 3', 'Cocktail somewhere fun — 5',
      'Dessert out — 5', 'Solo date — 10', 'Movie you genuinely want to watch — 3',
      'Buy yourself flowers — 3', 'Do something purely for fun — 8', 'Main Character Day — 10',
      "I almost didn't — 5", 'Main character moment — 10', 'Wild card — 10',
    ].sort(),
  );
  expect(rewards.items.map(({ name, cost }) => `${name} — ${cost}`).sort()).toEqual(
    [
      'Little Treat — 50', 'Nice Night — 100', 'Experience — 200',
      'Big Treat — 350', 'Adventure — 500', 'Dream Reward — 1000',
    ].sort(),
  );
  expect(quests.items.map(({ points, slot, title }) => ({ points, slot, title }))).toEqual([
    { points: 50, slot: 1, title: '' },
    { points: 50, slot: 2, title: '' },
    { points: 50, slot: 3, title: '' },
  ]);

  const otherGameOwner = await authenticateWithCode(request, 'friend@example.test');
  for (const records of [categories, activities, rewards, quests]) {
    const recordId = records.items[0].id as string;
    const collectionName = records.items[0].collectionName as string;
    const recordUrl = `${apiUrl}/api/collections/${collectionName}/records/${recordId}`;
    expect((await request.get(recordUrl, {
      headers: { Authorization: otherGameOwner.token },
    })).status()).toBe(404);
    expect((await request.patch(recordUrl, {
      data: { name: 'Not yours' },
      headers: { Authorization: otherGameOwner.token },
    })).status()).toBe(403);
  }

  const retry = await request.post(`${apiUrl}/api/life-points/v1/onboarding`, {
    data: { playerName: 'Changed', title: 'Duplicate Game' },
    headers: authorization,
  });
  expect(retry.ok()).toBe(true);
  expect(((await retry.json()) as { game: { id: string } }).game.id).toBe(session.record.game);
  await expect.poll(async () => Promise.all([
    (await list('accounts', false)).totalItems,
    (await list('games', false)).totalItems,
    (await list('categories')).totalItems,
    (await list('activities')).totalItems,
    (await list('rewards')).totalItems,
    (await list('monthly_quests')).totalItems,
  ])).toEqual([1, 1, 7, 63, 6, 3]);

  const returningResponse = await request.post(
    `${apiUrl}/api/collections/accounts/auth-with-otp`,
    { data: { otpId: retriedRegistration.otpId, password: retriedRegistration.captured.code } },
  );
  expect(returningResponse.ok()).toBe(true);
  const returningSession = await returningResponse.json() as AuthData;
  expect(returningSession.record.id).toBe(session.record.id);
  expect(returningSession.record.game).toBe(session.record.game);
});

test('new visitor can verify by magic link and accept the default Game title', async ({
  page,
  request,
}) => {
  const otp = await requestOtp(request, 'robin@example.test');

  await page.goto(otp.captured.link);
  await expect(page.getByRole('heading', { name: 'Make it yours.' })).toBeVisible();
  await page.getByLabel('Player Name').fill('Robin');
  await expect(page.getByLabel('Game title')).toHaveValue("Robin's Life Points");
  await page.getByRole('button', { name: 'Start my Game' }).click();

  await expect(page.getByRole('heading', { name: 'Welcome, Robin' })).toBeVisible();
  await expect(page.getByText("Robin's Life Points")).toBeVisible();
});
