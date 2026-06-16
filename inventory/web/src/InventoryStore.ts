export type Disposition = 'Sell' | 'Give away' | 'Donate' | 'Junk' | 'Store';
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
  setDisposition(capturedAt: string, disposition: Disposition | ''): Promise<void>;
  setNotes(capturedAt: string, notes: string): Promise<void>;
  markHandled(capturedAt: string): Promise<void>;
  deleteItem(capturedAt: string): Promise<void>;
}

export function deriveLifecycle(item: Pick<Item, 'disposition' | 'handledOn'>): Lifecycle {
  if (!item.disposition) return 'Captured';
  if (item.handledOn) return 'Handled';
  return 'Reviewed';
}
