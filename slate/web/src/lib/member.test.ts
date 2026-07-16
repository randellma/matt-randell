import { describe, expect, it } from 'vitest';
import type { ExpenseRecord, MemberRecord, PaymentRecord } from '../api';
import { activeMembers, memberReferenced } from './member';

const member = (id: string, removed = false): MemberRecord => ({
  id,
  group: 'g',
  name: id,
  party: '',
  party_name: '',
  photo: '',
  party_photo: '',
  removed,
  user: '',
});

const expense = (over: Partial<ExpenseRecord>): ExpenseRecord => ({
  id: 'e1',
  group: 'g',
  description: 'x',
  amount_cents: 1000,
  paid_by: 'alice',
  date: '2026-01-01',
  split_mode: 'even',
  split: { mode: 'even', entries: [] },
  receipt: '',
  notes: '',
  ...over,
});

const payment = (from: string, to: string): PaymentRecord => ({
  id: 'p1',
  group: 'g',
  from_member: from,
  to_member: to,
  amount_cents: 500,
  date: '2026-01-01',
  note: '',
});

describe('activeMembers', () => {
  it('drops removed members', () => {
    const ms = [member('a'), member('b', true), member('c')];
    expect(activeMembers(ms).map(m => m.id)).toEqual(['a', 'c']);
  });
});

describe('memberReferenced', () => {
  it('is false when nothing points at the member', () => {
    const e = expense({ paid_by: 'alice', split: { mode: 'even', entries: [{ member: 'alice', cents: 1000 }] } });
    expect(memberReferenced('ghost', [e], [])).toBe(false);
  });

  it('catches the paid_by relation', () => {
    expect(memberReferenced('alice', [expense({ paid_by: 'alice' })], [])).toBe(true);
  });

  it('catches a multi-payer entry that is not the largest payer', () => {
    const e = expense({ paid_by: 'alice', payers: [{ member: 'alice', cents: 600 }, { member: 'bob', cents: 400 }] });
    expect(memberReferenced('bob', [e], [])).toBe(true);
  });

  it('catches a split participant', () => {
    const e = expense({ paid_by: 'alice', split: { mode: 'even', entries: [{ member: 'bob', cents: 1000 }] } });
    expect(memberReferenced('bob', [e], [])).toBe(true);
  });

  it('catches percent-mode state even without a settled entry', () => {
    const e = expense({ split: { mode: 'percent', entries: [], percents: { bob: 50 } } });
    expect(memberReferenced('bob', [e], [])).toBe(true);
  });

  it('catches shares-mode state', () => {
    const e = expense({ split: { mode: 'shares', entries: [], shares: { bob: 2 } } });
    expect(memberReferenced('bob', [e], [])).toBe(true);
  });

  it('catches an item assignee', () => {
    const e = expense({
      split: { mode: 'items', entries: [], items: [{ label: 'fries', cents: 300, assignees: ['bob'] }] },
    });
    expect(memberReferenced('bob', [e], [])).toBe(true);
  });

  it('catches both sides of a payment', () => {
    expect(memberReferenced('alice', [], [payment('alice', 'bob')])).toBe(true);
    expect(memberReferenced('bob', [], [payment('alice', 'bob')])).toBe(true);
  });
});
