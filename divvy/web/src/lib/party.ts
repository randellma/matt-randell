import type { MemberRecord } from '../api';

/** Members grouped by non-empty party key, in member order. Solo members excluded. */
export function groupParties(members: MemberRecord[]): Map<string, MemberRecord[]> {
  const parties = new Map<string, MemberRecord[]>();
  for (const m of members) {
    if (m.party) parties.set(m.party, [...(parties.get(m.party) ?? []), m]);
  }
  return parties;
}

/** Custom party name if set, otherwise the members' names joined ("Matt & Sarah"). */
export function partyDisplayName(partyMembers: MemberRecord[]): string {
  return (
    partyMembers.map(m => m.party_name).find(Boolean) ||
    partyMembers.map(m => m.name).join(' & ')
  );
}
