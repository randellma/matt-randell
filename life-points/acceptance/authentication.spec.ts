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
