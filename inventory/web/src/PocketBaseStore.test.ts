import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PocketBaseStore } from './PocketBaseStore';
import type { SecretStore } from './SecretStore';
import type { CaptureInput, Item } from './InventoryStore';

const BASE_URL = 'https://inventory-api.mattrandell.com';
const COLLECTION = 'items';

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

function makePbRecord(overrides: Partial<{
  id: string;
  collectionId: string;
  collectionName: string;
  name: string;
  capturedAt: string;
  disposition: string;
  notes: string;
  handledOn: string;
  photo: string;
}> = {}) {
  return {
    id: 'rec001',
    collectionId: 'col001',
    collectionName: COLLECTION,
    name: 'Blender',
    capturedAt: '2026-06-01T10:00:00.000Z',
    disposition: 'Sell',
    notes: '',
    handledOn: '',
    photo: 'blender.jpg',
    ...overrides,
  };
}

function okResponse(body: unknown = { id: 'rec001' }) {
  return new Response(JSON.stringify(body), { status: 200 });
}

function errorResponse(message: string) {
  return new Response(JSON.stringify({ message }), { status: 400 });
}

function listResponse(records: ReturnType<typeof makePbRecord>[]) {
  return new Response(JSON.stringify({ items: records, totalItems: records.length }), { status: 200 });
}

// ── capture ───────────────────────────────────────────────────────────────────

describe('PocketBaseStore.capture', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs to the records endpoint', async () => {
    const store = new PocketBaseStore(BASE_URL, makeSecretStore('s'));
    await store.capture(makeInput());
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain(`/api/collections/${COLLECTION}/records`);
    expect(options?.method).toBe('POST');
  });

  it('includes the secret as a query param', async () => {
    const store = new PocketBaseStore(BASE_URL, makeSecretStore('my-secret'));
    await store.capture(makeInput());
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain('secret=my-secret');
  });

  it('sends name, capturedAt, and photo as multipart form fields', async () => {
    const store = new PocketBaseStore(BASE_URL, makeSecretStore('s'));
    const photo = new Blob([new Uint8Array([0x01, 0x02, 0x03])], { type: 'image/jpeg' });
    await store.capture(makeInput({ name: 'Blender', capturedAt: '2026-06-07T12:00:00.000Z', photo }));
    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = options?.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('name')).toBe('Blender');
    expect(body.get('capturedAt')).toBe('2026-06-07T12:00:00.000Z');
    expect(body.get('photo')).toBeInstanceOf(Blob);
  });

  it('includes disposition in the form when provided', async () => {
    const store = new PocketBaseStore(BASE_URL, makeSecretStore('s'));
    await store.capture(makeInput({ disposition: 'Donate' }));
    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = options?.body as FormData;
    expect(body.get('disposition')).toBe('Donate');
  });

  it('omits disposition from the form when not provided', async () => {
    const store = new PocketBaseStore(BASE_URL, makeSecretStore('s'));
    await store.capture(makeInput());
    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = options?.body as FormData;
    expect(body.get('disposition')).toBeNull();
  });

  it('resolves when the server returns 200', async () => {
    const store = new PocketBaseStore(BASE_URL, makeSecretStore('s'));
    await expect(store.capture(makeInput())).resolves.toBeUndefined();
  });

  it('rejects on server error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errorResponse('unauthorized')));
    const store = new PocketBaseStore(BASE_URL, makeSecretStore('wrong'));
    await expect(store.capture(makeInput())).rejects.toThrow();
  });
});

// ── fetchAllItems ─────────────────────────────────────────────────────────────

describe('PocketBaseStore.fetchAllItems', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(listResponse([])));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('makes a GET to the records endpoint', async () => {
    const store = new PocketBaseStore(BASE_URL, makeSecretStore('s'));
    await store.fetchAllItems();
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain(`/api/collections/${COLLECTION}/records`);
    expect((options?.method ?? 'GET')).toBe('GET');
  });

  it('includes the secret as a query param', async () => {
    const store = new PocketBaseStore(BASE_URL, makeSecretStore('my-secret'));
    await store.fetchAllItems();
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain('secret=my-secret');
  });

  it('returns an empty array when there are no records', async () => {
    const store = new PocketBaseStore(BASE_URL, makeSecretStore('s'));
    const result = await store.fetchAllItems();
    expect(result).toEqual([]);
  });

  it('maps a PocketBase record to an Item with derived lifecycle', async () => {
    const record = makePbRecord({ disposition: 'Sell', handledOn: '' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(listResponse([record])));
    const store = new PocketBaseStore(BASE_URL, makeSecretStore('s'));
    const [item] = await store.fetchAllItems();
    expect(item.name).toBe(record.name);
    expect(item.capturedAt).toBe(record.capturedAt);
    expect(item.disposition).toBe('Sell');
    expect(item.notes).toBe('');
    expect(item.handledOn).toBe('');
    expect(item.lifecycle).toBe('Reviewed');
  });

  it('derives Captured lifecycle when disposition is empty', async () => {
    const record = makePbRecord({ disposition: '', handledOn: '' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(listResponse([record])));
    const store = new PocketBaseStore(BASE_URL, makeSecretStore('s'));
    const [item] = await store.fetchAllItems();
    expect(item.lifecycle).toBe('Captured');
  });

  it('derives Handled lifecycle when handledOn is set', async () => {
    const record = makePbRecord({ disposition: 'Donate', handledOn: '2026-06-10T00:00:00.000Z' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(listResponse([record])));
    const store = new PocketBaseStore(BASE_URL, makeSecretStore('s'));
    const [item] = await store.fetchAllItems();
    expect(item.lifecycle).toBe('Handled');
  });

  it('constructs a thumbnail URL from the photo filename', async () => {
    const record = makePbRecord({ id: 'rec001', collectionId: 'col001', photo: 'blender.jpg' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(listResponse([record])));
    const store = new PocketBaseStore(BASE_URL, makeSecretStore('my-secret'));
    const [item] = await store.fetchAllItems();
    expect(item.thumbnail).toBe(
      `${BASE_URL}/api/files/col001/rec001/blender.jpg?secret=my-secret`,
    );
  });

  it('sets thumbnail to empty string when there is no photo', async () => {
    const record = makePbRecord({ photo: '' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(listResponse([record])));
    const store = new PocketBaseStore(BASE_URL, makeSecretStore('s'));
    const [item] = await store.fetchAllItems();
    expect(item.thumbnail).toBe('');
  });
});

// ── mutations ─────────────────────────────────────────────────────────────────

function makeStoreWithCachedItem(record: ReturnType<typeof makePbRecord>) {
  const store = new PocketBaseStore(BASE_URL, makeSecretStore('s'));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(listResponse([record])));
  return store.fetchAllItems().then(() => store);
}

describe('PocketBaseStore.setDisposition', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('PATCHes the record identified by capturedAt', async () => {
    const record = makePbRecord({ id: 'rec001', capturedAt: '2026-06-01T10:00:00.000Z' });
    const store = await makeStoreWithCachedItem(record);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse()));
    await store.setDisposition('2026-06-01T10:00:00.000Z', 'Give away');
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain(`/api/collections/${COLLECTION}/records/rec001`);
    expect(options?.method).toBe('PATCH');
  });

  it('sends the disposition in the request body', async () => {
    const record = makePbRecord({ id: 'rec001', capturedAt: '2026-06-01T10:00:00.000Z' });
    const store = await makeStoreWithCachedItem(record);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse()));
    await store.setDisposition('2026-06-01T10:00:00.000Z', 'Give away');
    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options?.body as string);
    expect(body.disposition).toBe('Give away');
  });

  it('includes the secret as a query param', async () => {
    const record = makePbRecord({ id: 'rec001', capturedAt: '2026-06-01T10:00:00.000Z' });
    const store = await makeStoreWithCachedItem(record);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse()));
    await store.setDisposition('2026-06-01T10:00:00.000Z', 'Sell');
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain('secret=s');
  });
});

describe('PocketBaseStore.setNotes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('PATCHes the record with the new notes value', async () => {
    const record = makePbRecord({ id: 'rec001', capturedAt: '2026-06-01T10:00:00.000Z' });
    const store = await makeStoreWithCachedItem(record);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse()));
    await store.setNotes('2026-06-01T10:00:00.000Z', 'Needs new power cord');
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain(`/api/collections/${COLLECTION}/records/rec001`);
    expect(options?.method).toBe('PATCH');
    const body = JSON.parse(options?.body as string);
    expect(body.notes).toBe('Needs new power cord');
  });

  it('includes the secret as a query param', async () => {
    const record = makePbRecord({ id: 'rec001', capturedAt: '2026-06-01T10:00:00.000Z' });
    const store = await makeStoreWithCachedItem(record);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse()));
    await store.setNotes('2026-06-01T10:00:00.000Z', 'some notes');
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain('secret=s');
  });
});

describe('PocketBaseStore.markHandled', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('PATCHes the record with a handledOn timestamp', async () => {
    const record = makePbRecord({ id: 'rec001', capturedAt: '2026-06-01T10:00:00.000Z' });
    const store = await makeStoreWithCachedItem(record);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse()));
    await store.markHandled('2026-06-01T10:00:00.000Z');
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain(`/api/collections/${COLLECTION}/records/rec001`);
    expect(options?.method).toBe('PATCH');
    const body = JSON.parse(options?.body as string);
    expect(body.handledOn).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('PocketBaseStore.deleteItem', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('DELETEs the record identified by capturedAt', async () => {
    const record = makePbRecord({ id: 'rec001', capturedAt: '2026-06-01T10:00:00.000Z' });
    const store = await makeStoreWithCachedItem(record);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await store.deleteItem('2026-06-01T10:00:00.000Z');
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain(`/api/collections/${COLLECTION}/records/rec001`);
    expect(options?.method).toBe('DELETE');
  });

  it('includes the secret as a query param', async () => {
    const record = makePbRecord({ id: 'rec001', capturedAt: '2026-06-01T10:00:00.000Z' });
    const store = await makeStoreWithCachedItem(record);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await store.deleteItem('2026-06-01T10:00:00.000Z');
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain('secret=s');
  });
});
