import PocketBase from 'pocketbase';
import type { SplitEntry, SplitMode } from './lib/split';
import type { AssignedItem, ParsedReceipt } from './lib/receipt';

export interface GroupRecord {
  id: string;
  name: string;
  t: string;
}

export interface MemberRecord {
  id: string;
  group: string;
  name: string;
  /** members sharing a non-empty party key settle as one wallet; '' = solo */
  party: string;
}

/** Everything needed to render and re-edit a split, stored as JSON on the expense. */
export interface SplitData {
  mode: SplitMode;
  entries: SplitEntry[];
  /** percent mode: member id -> percent */
  percents?: Record<string, number>;
  /** shares mode: member id -> share count */
  shares?: Record<string, number>;
  /** items mode: assigned receipt/manual items */
  items?: AssignedItem[];
}

export interface ExpenseRecord {
  id: string;
  group: string;
  description: string;
  amount_cents: number;
  paid_by: string;
  date: string;
  split_mode: SplitMode;
  split: SplitData;
  receipt: string;
  notes: string;
}

export interface PaymentRecord {
  id: string;
  group: string;
  from_member: string;
  to_member: string;
  amount_cents: number;
  date: string;
  note: string;
}

export interface ReceiptRecord {
  id: string;
  group: string;
  image: string;
  status: 'pending' | 'done' | 'failed';
  parsed: ParsedReceipt | null;
  error: string;
}

/** All calls attach the group token as ?t= — that's the whole auth model. */
export class DivvyApi {
  private pb: PocketBase;

  constructor(baseUrl: string) {
    this.pb = new PocketBase(baseUrl);
    this.pb.autoCancellation(false);
  }

  async createGroup(name: string, token: string): Promise<GroupRecord> {
    return this.pb.collection('groups').create({ name, t: token });
  }

  async getGroup(id: string, t: string): Promise<GroupRecord> {
    return this.pb.collection('groups').getOne(id, { query: { t } });
  }

  async listMembers(groupId: string, t: string): Promise<MemberRecord[]> {
    return this.pb.collection('members').getFullList({
      filter: this.pb.filter('group = {:g}', { g: groupId }),
      sort: 'created',
      query: { t },
    });
  }

  async addMember(groupId: string, name: string, t: string): Promise<MemberRecord> {
    return this.pb.collection('members').create({ group: groupId, name }, { query: { t } });
  }

  async setMemberParty(memberId: string, party: string, t: string): Promise<MemberRecord> {
    return this.pb.collection('members').update(memberId, { party }, { query: { t } });
  }

  async listExpenses(groupId: string, t: string): Promise<ExpenseRecord[]> {
    return this.pb.collection('expenses').getFullList({
      filter: this.pb.filter('group = {:g}', { g: groupId }),
      sort: '-date,-created',
      query: { t },
    });
  }

  async saveExpense(
    data: Omit<ExpenseRecord, 'id'>,
    t: string,
    id?: string,
  ): Promise<ExpenseRecord> {
    if (id) return this.pb.collection('expenses').update(id, data, { query: { t } });
    return this.pb.collection('expenses').create(data, { query: { t } });
  }

  async deleteExpense(id: string, t: string): Promise<void> {
    await this.pb.collection('expenses').delete(id, { query: { t } });
  }

  async listPayments(groupId: string, t: string): Promise<PaymentRecord[]> {
    return this.pb.collection('payments').getFullList({
      filter: this.pb.filter('group = {:g}', { g: groupId }),
      sort: '-date,-created',
      query: { t },
    });
  }

  async createPayment(data: Omit<PaymentRecord, 'id'>, t: string): Promise<PaymentRecord> {
    return this.pb.collection('payments').create(data, { query: { t } });
  }

  async deletePayment(id: string, t: string): Promise<void> {
    await this.pb.collection('payments').delete(id, { query: { t } });
  }

  /**
   * Upload a receipt image. The server-side OCR hook runs during this request,
   * so the returned record is usually already done/failed — but poll to be safe.
   */
  async uploadReceipt(groupId: string, image: Blob, t: string): Promise<ReceiptRecord> {
    const form = new FormData();
    form.set('group', groupId);
    form.set('status', 'pending');
    form.set('image', image, 'receipt.jpg');
    return this.pb.collection('receipts').create(form, { query: { t } });
  }

  async getReceipt(id: string, t: string): Promise<ReceiptRecord> {
    return this.pb.collection('receipts').getOne(id, { query: { t } });
  }

  async waitForReceipt(id: string, t: string, timeoutMs = 120000): Promise<ReceiptRecord> {
    const start = Date.now();
    while (true) {
      const rec = await this.getReceipt(id, t);
      if (rec.status !== 'pending') return rec;
      if (Date.now() - start > timeoutMs) throw new Error('Receipt parsing timed out');
      await new Promise(r => setTimeout(r, 1500));
    }
  }
}
