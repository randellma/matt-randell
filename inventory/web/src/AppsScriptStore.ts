import type { SecretStore } from './SecretStore';
import type { CaptureInput, InventoryStore } from './InventoryStore';

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
