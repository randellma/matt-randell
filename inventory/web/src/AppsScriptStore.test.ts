import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppsScriptStore } from './AppsScriptStore';
import type { SecretStore } from './SecretStore';
import type { CaptureInput, Item } from './InventoryStore';

const ENDPOINT = 'https://script.google.com/macros/s/test-id/exec';

function makeSecretStore(secret: string | null): SecretStore {
  return { get: () => secret, set: vi.fn() };
}

function makeInput(overrides?: Partial<CaptureInput>): CaptureInput {
  return {
    name: 'Old blender',
    photo: new Blob(['fake-jpeg'], { type: 'image/jpeg' }),
    capturedAt: '2026-06-07T12:00:00.000Z',
    ...overrides,
  };
}

function okResponse() {
  return new Response(JSON.stringify({ status: 200, ok: true }), { status: 200 });
}

function errorResponse(message: string) {
  return new Response(JSON.stringify({ status: 401, error: message }), { status: 200 });
}

describe('AppsScriptStore', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs to the endpoint URL', async () => {
    const store = new AppsScriptStore(ENDPOINT, makeSecretStore('s'));
    await store.capture(makeInput());
    expect(fetch).toHaveBeenCalledWith(ENDPOINT, expect.objectContaining({ method: 'POST' }));
  });

  it('sets Content-Type: text/plain', async () => {
    const store = new AppsScriptStore(ENDPOINT, makeSecretStore('s'));
    await store.capture(makeInput());
    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect((options!.headers as Record<string, string>)['Content-Type']).toBe('text/plain');
  });

  it('includes the secret in the request body', async () => {
    const store = new AppsScriptStore(ENDPOINT, makeSecretStore('super-secret'));
    await store.capture(makeInput());
    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options!.body as string);
    expect(body.secret).toBe('super-secret');
  });

  it('includes name, capturedAt, and base64-encoded photo in the body', async () => {
    const store = new AppsScriptStore(ENDPOINT, makeSecretStore('s'));
    const photo = new Blob([new Uint8Array([0x01, 0x02, 0x03])], { type: 'image/jpeg' });
    await store.capture(makeInput({ name: 'Blender', capturedAt: '2026-06-07T12:00:00.000Z', photo }));
    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options!.body as string);
    expect(body.name).toBe('Blender');
    expect(body.capturedAt).toBe('2026-06-07T12:00:00.000Z');
    expect(body.photo).toBe('AQID');
  });

  it('includes disposition in the body when provided', async () => {
    const store = new AppsScriptStore(ENDPOINT, makeSecretStore('s'));
    await store.capture(makeInput({ disposition: 'Donate' }));
    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options!.body as string);
    expect(body.disposition).toBe('Donate');
  });

  it('omits disposition from the body when not provided', async () => {
    const store = new AppsScriptStore(ENDPOINT, makeSecretStore('s'));
    await store.capture(makeInput());
    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options!.body as string);
    expect(body).not.toHaveProperty('disposition');
  });

  it('resolves when the server returns ok: true', async () => {
    const store = new AppsScriptStore(ENDPOINT, makeSecretStore('s'));
    await expect(store.capture(makeInput())).resolves.toBeUndefined();
  });

  it('rejects with the server error message on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errorResponse('unauthorized')));
    const store = new AppsScriptStore(ENDPOINT, makeSecretStore('wrong'));
    await expect(store.capture(makeInput())).rejects.toThrow('unauthorized');
  });
});

function itemsResponse(items: Item[]) {
  return new Response(JSON.stringify({ status: 200, items }), { status: 200 });
}

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    name: 'Blender',
    lifecycle: 'Reviewed',
    disposition: 'Sell',
    notes: '',
    capturedAt: '2026-06-01T10:00:00Z',
    handledOn: '',
    thumbnail: 'base64abc',
    ...overrides,
  };
}

describe('AppsScriptStore.fetchAllItems', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(itemsResponse([])));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('makes a GET request', async () => {
    const store = new AppsScriptStore(ENDPOINT, makeSecretStore('s'));
    await store.fetchAllItems();
    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect((options as RequestInit | undefined)?.method ?? 'GET').toBe('GET');
  });

  it('sends the request to the endpoint URL', async () => {
    const store = new AppsScriptStore(ENDPOINT, makeSecretStore('s'));
    await store.fetchAllItems();
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain(ENDPOINT);
  });

  it('includes the secret in the query string', async () => {
    const store = new AppsScriptStore(ENDPOINT, makeSecretStore('super-secret'));
    await store.fetchAllItems();
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain('secret=super-secret');
  });

  it('includes all=1 and thumbnails=1 in the query string', async () => {
    const store = new AppsScriptStore(ENDPOINT, makeSecretStore('s'));
    await store.fetchAllItems();
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain('all=1');
    expect(String(url)).toContain('thumbnails=1');
  });

  it('returns mapped items from the response', async () => {
    const item = makeItem();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(itemsResponse([item])));
    const store = new AppsScriptStore(ENDPOINT, makeSecretStore('s'));
    const result = await store.fetchAllItems();
    expect(result).toEqual([item]);
  });

  it('rejects with the server error message on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errorResponse('unauthorized')));
    const store = new AppsScriptStore(ENDPOINT, makeSecretStore('wrong'));
    await expect(store.fetchAllItems()).rejects.toThrow('unauthorized');
  });
});
