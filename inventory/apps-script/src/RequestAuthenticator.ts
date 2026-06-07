/**
 * Validates the shared secret on every incoming request.
 *
 * The expected secret is read from Apps Script Script Properties at runtime
 * (PropertiesService.getScriptProperties().getProperty("SECRET")) and passed
 * in here so this module stays pure and testable without a Google dependency.
 */
export function authenticate(
  body: Record<string, unknown>,
  expectedSecret: string
): boolean {
  const provided = body["secret"];
  return (
    typeof provided === "string" &&
    provided.length > 0 &&
    provided === expectedSecret
  );
}
