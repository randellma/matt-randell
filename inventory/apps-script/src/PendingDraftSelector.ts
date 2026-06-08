import { deriveLifecycle } from "./LifecycleDeriver.js";

export interface InventoryRow {
  capturedAt: string;
  name: string;
  disposition: string;
  handledOn: string;
  notes: string;
  driveImageUrl: string;
  hasDraft: boolean;
}

export interface PendingItem {
  name: string;
  driveImageUrl: string;
}

export function selectPendingDrafts(rows: InventoryRow[]): PendingItem[] {
  return rows
    .filter(r => r.disposition === "Sell" && !r.hasDraft && deriveLifecycle(r) !== "Handled")
    .map(r => ({ name: r.name, driveImageUrl: r.driveImageUrl }));
}
