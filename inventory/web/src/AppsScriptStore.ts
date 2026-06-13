import type { SecretStore } from './SecretStore';
import type { CaptureInput, Disposition, InventoryStore, Item } from './InventoryStore';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.slice(dataUrl.indexOf(',') + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export class AppsScriptStore implements InventoryStore {
  constructor(
    private readonly endpointUrl: string,
    private readonly secretStore: SecretStore,
  ) {}

  async fetchAllItems(withThumbnails = false): Promise<Item[]> {
    const secret = encodeURIComponent(this.secretStore.get() ?? '');
    const thumbParam = withThumbnails ? '&thumbnails=1' : '';
    const url = `${this.endpointUrl}?secret=${secret}&all=1${thumbParam}`;
    const res = await fetch(url);
    const data = await res.json() as { ok?: boolean; error?: string; items?: Item[] };
    if (data.error) {
      throw new Error(data.error);
    }
    return data.items ?? [];
  }

  private async mutate(payload: Record<string, string>): Promise<void> {
    const body = { secret: this.secretStore.get() ?? '', ...payload };
    const res = await fetch(this.endpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body),
    });
    const data = await res.json() as { ok?: boolean; error?: string };
    if (!data.ok) throw new Error(data.error ?? 'request failed');
  }

  async setDisposition(capturedAt: string, disposition: Disposition | ''): Promise<void> {
    await this.mutate({ action: 'setDisposition', capturedAt, disposition });
  }

  async markHandled(capturedAt: string): Promise<void> {
    await this.mutate({ action: 'markHandled', capturedAt });
  }

  async deleteItem(capturedAt: string): Promise<void> {
    await this.mutate({ action: 'deleteItem', capturedAt });
  }

  async capture(input: CaptureInput): Promise<void> {
    const photo = await blobToBase64(input.photo);
    const payload: Record<string, string> = {
      secret: this.secretStore.get() ?? '',
      name: input.name,
      capturedAt: input.capturedAt,
      photo,
    };
    if (input.disposition !== undefined) {
      payload['disposition'] = input.disposition;
    }
    const res = await fetch(this.endpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
    });
    const data = await res.json() as { ok?: boolean; error?: string };
    if (!data.ok) {
      throw new Error(data.error ?? 'capture failed');
    }
  }
}
