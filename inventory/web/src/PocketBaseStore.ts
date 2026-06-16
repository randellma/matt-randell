import type { SecretStore } from './SecretStore';
import type { CaptureInput, Disposition, InventoryStore, Item } from './InventoryStore';
import { deriveLifecycle } from './InventoryStore';

const COLLECTION = 'items';

interface PbRecord {
  id: string;
  collectionId: string;
  collectionName: string;
  name: string;
  capturedAt: string;
  disposition: string;
  notes: string;
  handledOn: string;
  photo: string;
}

export class PocketBaseStore implements InventoryStore {
  private readonly idCache = new Map<string, string>();

  constructor(
    private readonly baseUrl: string,
    private readonly secretStore: SecretStore,
  ) {}

  private url(path: string): string {
    const secret = encodeURIComponent(this.secretStore.get() ?? '');
    return `${this.baseUrl}${path}?secret=${secret}`;
  }

  private recordUrl(id: string): string {
    return this.url(`/api/collections/${COLLECTION}/records/${id}`);
  }

  async capture(input: CaptureInput): Promise<void> {
    const form = new FormData();
    form.append('name', input.name);
    form.append('capturedAt', input.capturedAt);
    form.append('photo', input.photo);
    if (input.disposition !== undefined) {
      form.append('disposition', input.disposition);
    }
    const res = await fetch(this.url(`/api/collections/${COLLECTION}/records`), {
      method: 'POST',
      body: form,
    });
    if (!res.ok) throw new Error(`capture failed: ${res.status}`);
  }

  async fetchAllItems(): Promise<Item[]> {
    const res = await fetch(this.url(`/api/collections/${COLLECTION}/records`));
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const data = await res.json() as { items: PbRecord[] };
    const records = data.items ?? [];
    this.idCache.clear();
    return records.map(r => {
      this.idCache.set(r.capturedAt, r.id);
      const thumbnail = r.photo
        ? `${this.baseUrl}/api/files/${r.collectionId}/${r.id}/${r.photo}?secret=${encodeURIComponent(this.secretStore.get() ?? '')}`
        : '';
      const partial = { disposition: r.disposition, handledOn: r.handledOn };
      return {
        name: r.name,
        capturedAt: r.capturedAt,
        disposition: r.disposition,
        notes: r.notes,
        handledOn: r.handledOn,
        thumbnail,
        lifecycle: deriveLifecycle(partial),
      };
    });
  }

  async setDisposition(capturedAt: string, disposition: Disposition | ''): Promise<void> {
    const id = this.idCache.get(capturedAt);
    if (!id) throw new Error(`record not found for capturedAt: ${capturedAt}`);
    const res = await fetch(this.recordUrl(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disposition }),
    });
    if (!res.ok) throw new Error(`setDisposition failed: ${res.status}`);
  }

  async setNotes(capturedAt: string, notes: string): Promise<void> {
    const id = this.idCache.get(capturedAt);
    if (!id) throw new Error(`record not found for capturedAt: ${capturedAt}`);
    const res = await fetch(this.recordUrl(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
    if (!res.ok) throw new Error(`setNotes failed: ${res.status}`);
  }

  async markHandled(capturedAt: string): Promise<void> {
    const id = this.idCache.get(capturedAt);
    if (!id) throw new Error(`record not found for capturedAt: ${capturedAt}`);
    const res = await fetch(this.recordUrl(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handledOn: new Date().toISOString() }),
    });
    if (!res.ok) throw new Error(`markHandled failed: ${res.status}`);
  }

  async deleteItem(capturedAt: string): Promise<void> {
    const id = this.idCache.get(capturedAt);
    if (!id) throw new Error(`record not found for capturedAt: ${capturedAt}`);
    const res = await fetch(this.recordUrl(id), { method: 'DELETE' });
    if (!res.ok) throw new Error(`deleteItem failed: ${res.status}`);
  }
}
