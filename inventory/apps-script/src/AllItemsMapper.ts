import { deriveLifecycle, type Lifecycle } from "./LifecycleDeriver.js";
import type { InventoryRow } from "./PendingDraftSelector.js";

export interface AllItem {
  name: string;
  lifecycle: Lifecycle;
  disposition: string;
  notes: string;
  capturedAt: string;
  handledOn: string;
  driveImageUrl: string;
}

export function selectAllItems(rows: InventoryRow[]): AllItem[] {
  return rows.map(r => ({
    name: r.name,
    lifecycle: deriveLifecycle(r),
    disposition: r.disposition,
    notes: r.notes,
    capturedAt: r.capturedAt,
    handledOn: r.handledOn,
    driveImageUrl: r.driveImageUrl,
  }));
}
