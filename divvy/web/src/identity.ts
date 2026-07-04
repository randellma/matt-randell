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
