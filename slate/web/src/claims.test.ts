import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DivvyApi } from './api';
import type { MemberRecord } from './api';

/** A syntactically valid JWT the SDK's isValid check accepts (exp far out). */
function fakeJwt(): string {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ id: 'u1', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
}

function jsonResponse(body: object): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function member(over: Partial<MemberRecord>): MemberRecord {
  return {
    id: 'm1',
    group: 'g1',
    name: 'Sarah',
    party: '',
    party_name: '',
    photo: '',
    party_photo: '',
    removed: false,
    user: '',
    ...over,
  };
}

/**
 * Claiming (ADR-0005): the update sets members.user to the signed-in account
 * and never touches the name; the one-time photo copy stamps the profile
 * photo onto a photo-less member and leaves an existing photo alone.
 */
describe('claimMember', () => {
  let api: DivvyApi;
  let fetchMock: ReturnType<typeof vi.fn>;
  /** requests the mock served, oldest first: [url, init] */
  const calls = () => fetchMock.mock.calls as [string, RequestInit | undefined][];

  async function signIn(avatar: string) {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        token: fakeJwt(),
        record: { id: 'u1', email: 'matt@example.com', name: 'Matt', avatar, credits: 5 },
      }),
    );
    await api.verifyAuthCode('otp1', '123456');
  }

  beforeEach(() => {
    localStorage.clear();
    api = new DivvyApi('http://test.local');
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets user to the signed-in account and leaves the name alone', async () => {
    await signIn('');
    fetchMock.mockResolvedValueOnce(jsonResponse(member({ user: 'u1' })));

    const claimed = await api.claimMember(member({}), 't0k');

    expect(claimed.user).toBe('u1');
    const [url, init] = calls()[1]!;
    expect(String(url)).toContain('/api/collections/members/records/m1');
    expect(String(url)).toContain('t=t0k');
    expect(JSON.parse(init!.body as string)).toEqual({ user: 'u1' });
    // one sign-in, one update — no photo traffic for a photo-less profile
    expect(calls()).toHaveLength(2);
  });

  it('copies the profile photo onto a photo-less member', async () => {
    await signIn('me.jpg');
    fetchMock
      .mockResolvedValueOnce(jsonResponse(member({ user: 'u1' }))) // the claim
      // avatar download — hand back a jsdom Blob: undici's Response.blob()
      // yields Node's Blob class, which jsdom's FormData refuses
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['jpeg-bytes']) } as unknown as Response)
      .mockResolvedValueOnce(jsonResponse(member({ user: 'u1', photo: 'copied.jpg' }))); // photo upload

    const claimed = await api.claimMember(member({}), 't0k');

    expect(claimed.photo).toBe('copied.jpg');
    expect(String(calls()[2]![0])).toContain('/api/files/users/u1/me.jpg');
    expect(calls()[3]![1]!.body).toBeInstanceOf(FormData);
  });

  it('leaves an existing member photo alone', async () => {
    await signIn('me.jpg');
    fetchMock.mockResolvedValueOnce(jsonResponse(member({ user: 'u1', photo: 'theirs.jpg' })));

    const claimed = await api.claimMember(member({ photo: 'theirs.jpg' }), 't0k');

    expect(claimed.photo).toBe('theirs.jpg');
    expect(calls()).toHaveLength(2); // no photo traffic
  });

  it('still claims when the photo copy fails', async () => {
    await signIn('me.jpg');
    fetchMock
      .mockResolvedValueOnce(jsonResponse(member({ user: 'u1' })))
      .mockRejectedValueOnce(new Error('network down'));

    const claimed = await api.claimMember(member({}), 't0k');
    expect(claimed.user).toBe('u1');
  });

  it('creates an already-claimed member on "add yourself"', async () => {
    await signIn('');
    fetchMock.mockResolvedValueOnce(jsonResponse(member({ user: 'u1', name: 'Matt' })));

    const m = await api.addClaimedMember('g1', 'Matt', 't0k');

    expect(m.user).toBe('u1');
    expect(JSON.parse(calls()[1]![1]!.body as string)).toEqual({ group: 'g1', name: 'Matt', user: 'u1' });
  });

  it('releases by clearing user', async () => {
    await signIn('');
    fetchMock.mockResolvedValueOnce(jsonResponse(member({})));

    await api.releaseClaim('m1', 't0k');

    expect(JSON.parse(calls()[1]![1]!.body as string)).toEqual({ user: '' });
  });
});
