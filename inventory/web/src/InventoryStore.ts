export type Disposition = 'Sell' | 'Give away' | 'Donate' | 'Junk';
export type Lifecycle = 'Captured' | 'Reviewed' | 'Handled';

export interface CaptureInput {
  name: string;
  photo: Blob;
  capturedAt: string;
  disposition?: Disposition;
}

export interface Item {
  name: string;
  lifecycle: Lifecycle;
  disposition: string;
  notes: string;
  capturedAt: string;
  handledOn: string;
  thumbnail: string;
}

export interface InventoryStore {
  capture(input: CaptureInput): Promise<void>;
  fetchAllItems(withThumbnails?: boolean): Promise<Item[]>;
}
