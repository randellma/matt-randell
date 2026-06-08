export function getSecretFromUrl(search: string): string | null {
  return new URLSearchParams(search).get('secret');
}
