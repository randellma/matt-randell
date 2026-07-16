import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DivvyApi, type ClaimedGroup } from './api';
import { mergeGroups, type JoinedGroup } from './identity';

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

/**
 * Groups follow the account (issue 0023, ADR-0005): Home shows local ∪
 * claimed, locally-remembered groups first and untouched in order, derived
 * ones appended — and a group in both lists stays one row.
 */
describe('mergeGroups', () => {
  const local: JoinedGroup[] = [
    { id: 'g1', t: 'tok1', name: 'Beach trip', memberId: 'm1' },
    { id: 'g2', t: 'tok2-old', name: 'Old name', memberId: 'm2' },
  ];
  const claimed: ClaimedGroup[] = [
    { id: 'g2', t: 'tok2-new', name: 'New name' },
    { id: 'g3', t: 'tok3', name: 'Ski house' },
  ];

  it('appends claimed groups this device never opened after the local ones', () => {
    expect(mergeGroups(local, claimed).map(g => g.id)).toEqual(['g1', 'g2', 'g3']);
  });

  it('keeps one row for a group that is both, preserving the picked identity', () => {
    const merged = mergeGroups(local, claimed);
    expect(merged.filter(g => g.id === 'g2')).toHaveLength(1);
    expect(merged[1]!.memberId).toBe('m2');
  });

  it('adopts the server token and name on a duplicate — they are authoritative', () => {
    const merged = mergeGroups(local, claimed);
    expect(merged[1]!.t).toBe('tok2-new');
    expect(merged[1]!.name).toBe('New name');
  });

  it('leaves a derived group without a picked identity — the claim resolves it on open', () => {
    expect(mergeGroups(local, claimed)[2]!.memberId).toBeUndefined();
  });

  it('signed out (no claimed list) the local list passes through unchanged', () => {
    expect(mergeGroups(local, [])).toEqual(local);
  });
});

describe('listClaimedGroups', () => {
  let api: DivvyApi;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    api = new DivvyApi('http://test.local');
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls the auth-gated route with the session token attached', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          token: fakeJwt(),
          record: { id: 'u1', email: 'matt@example.com', name: 'Matt', avatar: '', credits: 5 },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ groups: [{ id: 'g3', t: 'tok3', name: 'Ski house' }] }));
    await api.verifyAuthCode('otp1', '123456');

    const groups = await api.listClaimedGroups();

    expect(groups).toEqual([{ id: 'g3', t: 'tok3', name: 'Ski house' }]);
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(String(url)).toContain('/api/divvy/account/groups');
    expect(new Headers(init.headers).get('Authorization')).toBeTruthy();
  });
});
