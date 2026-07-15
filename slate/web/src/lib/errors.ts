/** Server routes speak human already; fall back when the shape is unexpected. */
export function friendlyError(e: unknown, fallback: string): string {
  const msg = (e as { response?: { message?: string } })?.response?.message;
  return msg || (e instanceof Error && e.message ? e.message : fallback);
}
