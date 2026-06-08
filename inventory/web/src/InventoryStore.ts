export type Disposition = 'Sell' | 'Give away' | 'Donate' | 'Junk';

export interface CaptureInput {
  name: string;
  photo: Blob;
  capturedAt: string;
  disposition?: Disposition;
}

export interface InventoryStore {
  capture(input: CaptureInput): Promise<void>;
}
