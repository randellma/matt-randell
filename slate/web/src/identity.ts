/**
 * Local identity: which groups this device has joined and who the user "is"
 * in each. Deliberately just localStorage — there are no accounts.
 */

export interface JoinedGroup {
  id: string;
  t: string;
  name: string;
  /** member record id of "me" in this group, once picked */
  memberId?: string;
}

const KEY = 'divvy.groups';

export function listJoinedGroups(): JoinedGroup[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function getJoinedGroup(id: string): JoinedGroup | undefined {
  return listJoinedGroups().find(g => g.id === id);
}

export function rememberGroup(group: JoinedGroup): void {
  const groups = listJoinedGroups().filter(g => g.id !== group.id);
  groups.unshift(group);
  localStorage.setItem(KEY, JSON.stringify(groups));
}

export function forgetGroup(id: string): void {
  localStorage.setItem(KEY, JSON.stringify(listJoinedGroups().filter(g => g.id !== id)));
}

export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Pull a group id + token out of a pasted share link (or the bare `/g/id/token`
 * tail). Membership lives in the link, so this is how a fresh context — a newly
 * installed PWA, another browser — gets to a group it never joined here.
 * PIN-gated groups share token-less links (`/g/id`), so `t` may be absent:
 * opening one lands on the PIN screen instead.
 */
export function parseGroupLink(input: string): { id: string; t?: string } | undefined {
  const m = input.trim().match(/g\/([a-z0-9]+)(?:\/([a-f0-9]{20,}))?/i);
  return m ? { id: m[1]!, t: m[2] } : undefined;
}
