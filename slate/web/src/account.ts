/**
 * The optional account — exists only so scan credits have somewhere to live
 * (ADR-0004). Group membership stays link-only; this never gates a group.
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
