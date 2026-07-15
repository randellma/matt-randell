/**
 * The optional account — scan credits plus a profile (ADR-0004, ADR-0005).
 * Group membership stays link-only; this never gates a group.
 */

import { useEffect, useState } from 'preact/hooks';
import { api } from './app';
import type { UserRecord } from './api';

/** The signed-in account, live across sign-in/out and balance changes. */
export function useUser(): UserRecord | null {
  const [user, setUser] = useState<UserRecord | null>(api.user);
  useEffect(() => api.onAuthChange(setUser), []);
  return user;
}
