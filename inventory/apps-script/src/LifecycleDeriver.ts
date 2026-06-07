export type Lifecycle = "Captured" | "Reviewed" | "Handled";

export interface LifecycleRow {
  disposition: string;
  handledOn: string;
}

export function deriveLifecycle(row: LifecycleRow): Lifecycle {
  if (!row.disposition) return "Captured";
  if (row.handledOn) return "Handled";
  return "Reviewed";
}
