import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DivvyApi } from './api';

/** A syntactically valid JWT the SDK's isValid check accepts (exp far out). */
function fakeJwt(): string {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ id: 'u1', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
}

const AUTH_BODY = {
  token: fakeJwt(),
  record: { id: 'u1', email: 'matt@example.com', name: '', avatar: '', credits: 5 },
};

function jsonResponse(body: object): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Sign-out must win over an in-flight auth refresh. The SDK's authRefresh
 * saves its response into the auth store when it lands — without the epoch
 * guard in refreshUser, "open sheet (refresh fires) → tap sign out" left the
 * user silently signed back in once the response arrived.
 */
describe('sign-out vs in-flight refresh', () => {
  let api: DivvyApi;

  beforeEach(async () => {
    localStorage.clear();
    api = new DivvyApi('http://test.local');
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(AUTH_BODY))));
    await api.verifyAuthCode('otp1', '123456');
    expect(api.user?.id).toBe('u1');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stays signed out when the refresh lands after signOut', async () => {
    let release!: (r: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(new Promise<Response>(resolve => { release = resolve; })),
    );

    const refreshing = api.refreshUser();
    api.signOut();
    expect(api.user).toBeNull();

    release(jsonResponse(AUTH_BODY));
    await refreshing;
    expect(api.user).toBeNull();
  });

  it('keeps the session on a refresh with no sign-out', async () => {
    await api.refreshUser();
    expect(api.user?.id).toBe('u1');
  });

  it('keeps a fresh sign-in that raced past a stale refresh', async () => {
    // A real re-sign-in mints a different JWT than the session being refreshed.
    const resignBody = { ...AUTH_BODY, token: `${AUTH_BODY.token}2` };
    let release!: (r: Response) => void;
    const pending = new Promise<Response>(resolve => { release = resolve; });
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(resignBody))) // the new sign-in
      .mockReturnValueOnce(pending); // the stale refresh
    vi.stubGlobal('fetch', fetchMock);

    const refreshing = api.refreshUser();
    api.signOut();
    await api.verifyAuthCode('otp2', '654321');

    release(jsonResponse({ ...AUTH_BODY, token: `${AUTH_BODY.token}stale` }));
    await refreshing;
    expect(api.user?.id).toBe('u1');
  });
});
