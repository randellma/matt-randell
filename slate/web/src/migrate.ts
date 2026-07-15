/**
 * One-time origin migration: slate.mattrandell.com → heyslate.app.
 *
 * The joined-groups list (localStorage, see identity.ts) is origin-bound, so
 * an edge 301 of the whole old host would silently empty everyone's Home
 * screen. Instead the old origin keeps serving this same build, and on boot
 * we carry the list across in the URL *fragment* — fragments are never sent
 * to any server, so the group tokens stay client-side. Path-form share links
 * (/g/*) are edge-redirected at Cloudflare instead: they carry their
 * credential in the URL and store nothing locally.
 *
 * The account auth token (PocketBase SDK storage) is deliberately NOT
 * carried over: it's a bearer credential, sign-in is a cheap emailed code,
 * and claims re-sync the account's groups anyway.
 */

import { listJoinedGroups, getJoinedGroup, rememberGroup, type JoinedGroup } from './identity';

const LEGACY_HOST = 'slate.mattrandell.com';
const NEW_ORIGIN = 'https://heyslate.app';
const MIGRATE_PREFIX = '#migrate=';

interface Handoff {
  /** joined groups from the old origin */
  g: JoinedGroup[];
  /** hash route the user was heading to, e.g. "#/g/abc123/…" */
  h: string;
}

// base64url of UTF-8 text — group names aren't always ASCII, so plain btoa
// would throw.
const enc = (s: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const dec = (s: string) =>
  new TextDecoder().decode(
    Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
  );

/**
 * On the legacy origin: bounce to heyslate.app with the joined groups in the
 * fragment. Returns true when navigation was started — the caller must not
 * mount the app.
 */
export function redirectLegacyOrigin(): boolean {
  if (location.hostname !== LEGACY_HOST) return false;
  // Installed PWAs are pinned to this origin by their service worker; keep
  // them working in place (the old API host stays up too) instead of
  // bouncing them out of their standalone window.
  if (matchMedia('(display-mode: standalone)').matches) return false;
  const handoff: Handoff = { g: listJoinedGroups(), h: location.hash };
  location.replace(`${NEW_ORIGIN}/${MIGRATE_PREFIX}${enc(JSON.stringify(handoff))}`);
  return true;
}

/**
 * On the new origin: merge a hand-off payload into localStorage, then restore
 * the route the user was actually heading to. Groups already joined here win
 * — they may carry a fresher "who am I" pick.
 */
export function adoptMigratedGroups(): void {
  if (!location.hash.startsWith(MIGRATE_PREFIX)) return;
  let route = '/';
  try {
    const handoff: Handoff = JSON.parse(dec(location.hash.slice(MIGRATE_PREFIX.length)));
    if (typeof handoff.h === 'string' && handoff.h.startsWith('#')) route = '/' + handoff.h;
    // reverse + unshift keeps the old origin's ordering at the top.
    for (const g of (handoff.g ?? []).reverse()) {
      if (g && typeof g.id === 'string' && typeof g.t === 'string' && !getJoinedGroup(g.id)) {
        rememberGroup(g);
      }
    }
  } catch {
    // Malformed payload — land on Home rather than a broken route.
  }
  history.replaceState(null, '', route);
}
