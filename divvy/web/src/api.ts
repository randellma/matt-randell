import PocketBase from 'pocketbase';
import type { SplitEntry, SplitMode } from './lib/split';
import type { AssignedItem, ParsedReceipt } from './lib/receipt';

export interface GroupRecord {
  id: string;
  name: string;
  t: string;
  /** group currency: what Balances/settle-up report in. '' on old groups = USD */
  currency: string;
  /** default currency for new expenses; '' = same as `currency` */
  expense_currency: string;
  /** avatar photo filename; '' = initials avatar */
  photo: string;
}

export interface MemberRecord {
  id: string;
  group: string;
  name: string;
  /** members sharing a non-empty party key settle as one wallet; '' = solo */
  party: string;
  /** optional party display name, mirrored on every member of the party */
  party_name: string;
  /** avatar photo filename; '' = initials avatar */
  photo: string;
  /** party avatar photo filename, mirrored on every member of the party */
  party_photo: string;
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

/** One member's contribution to fronting an expense. */
export interface PayerEntry {
  member: string;
  cents: number;
}

export interface ExpenseRecord {
  id: string;
  group: string;
  description: string;
  amount_cents: number;
  /** the largest payer — kept for old records; `payers` is authoritative when present */
  paid_by: string;
  /** who fronted the money; entries sum to amount_cents. Absent on old records. */
  payers?: PayerEntry[];
  date: string;
  split_mode: SplitMode;
  split: SplitData;
  receipt: string;
  notes: string;
  /** the expense's own currency; '' / absent = the group currency */
  currency?: string;
  /** amount in group-currency minor units when `currency` is foreign; 0 otherwise */
  fx_cents?: number;
}

export interface PaymentRecord {
  id: string;
  group: string;
  from_member: string;
  to_member: string;
  amount_cents: number;
  date: string;
  note: string;
  /** the payment's own currency; '' / absent = the group currency */
  currency?: string;
  /** amount in group-currency minor units when `currency` is foreign; 0 otherwise */
  fx_cents?: number;
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
  private base: string;

  constructor(baseUrl: string) {
    this.pb = new PocketBase(baseUrl);
    this.pb.autoCancellation(false);
    this.base = baseUrl.replace(/\/$/, '');
  }

  /**
   * Direct URL for a stored file. PocketBase serves unprotected files to
   * anyone holding the URL — filenames are random, and the group is
   * link-access anyway (same stance as receipt images).
   */
  private fileUrl(collection: 'groups' | 'members', recordId: string, filename: string): string {
    return `${this.base}/api/files/${collection}/${recordId}/${encodeURIComponent(filename)}`;
  }

  groupPhotoUrl(g: GroupRecord): string | undefined {
    return g.photo ? this.fileUrl('groups', g.id, g.photo) : undefined;
  }

  memberPhotoUrl(m: MemberRecord): string | undefined {
    return m.photo ? this.fileUrl('members', m.id, m.photo) : undefined;
  }

  /** The party's photo lives (mirrored) on its members — first one wins. */
  partyPhotoUrl(partyMembers: MemberRecord[]): string | undefined {
    const holder = partyMembers.find(m => m.party_photo);
    return holder ? this.fileUrl('members', holder.id, holder.party_photo) : undefined;
  }

  async createGroup(
    name: string,
    token: string,
    currency: string,
    expenseCurrency: string,
  ): Promise<GroupRecord> {
    return this.pb
      .collection('groups')
      .create({ name, t: token, currency, expense_currency: expenseCurrency });
  }

  async getGroup(id: string, t: string): Promise<GroupRecord> {
    return this.pb.collection('groups').getOne(id, { query: { t } });
  }

  async updateGroup(
    id: string,
    data: Partial<Pick<GroupRecord, 'name' | 'currency' | 'expense_currency'>>,
    t: string,
  ): Promise<GroupRecord> {
    return this.pb.collection('groups').update(id, data, { query: { t } });
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

  async updateMember(
    memberId: string,
    // party_photo is a file field: null deletes it (on unlink); uploading goes
    // through setPartyPhoto.
    data: Partial<Pick<MemberRecord, 'name' | 'party' | 'party_name'>> & { party_photo?: null },
    t: string,
  ): Promise<MemberRecord> {
    return this.pb.collection('members').update(memberId, data, { query: { t } });
  }

  /** Set (or with null, remove) a group's avatar photo. */
  async setGroupPhoto(groupId: string, photo: Blob | null, t: string): Promise<GroupRecord> {
    return this.pb.collection('groups').update(groupId, this.photoPayload('photo', photo), { query: { t } });
  }

  /** Set (or with null, remove) a member's avatar photo. */
  async setMemberPhoto(memberId: string, photo: Blob | null, t: string): Promise<MemberRecord> {
    return this.pb.collection('members').update(memberId, this.photoPayload('photo', photo), { query: { t } });
  }

  /** Set (or with null, remove) a party's photo, mirrored on every member. */
  async setPartyPhoto(memberIds: string[], photo: Blob | null, t: string): Promise<MemberRecord[]> {
    const updated: MemberRecord[] = [];
    for (const id of memberIds) {
      updated.push(
        await this.pb.collection('members').update(id, this.photoPayload('party_photo', photo), { query: { t } }),
      );
    }
    return updated;
  }

  private photoPayload(field: string, photo: Blob | null): FormData | Record<string, null> {
    if (photo === null) return { [field]: null };
    const form = new FormData();
    form.set(field, photo, 'avatar.jpg');
    return form;
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

  /** Partial update — used by settings to rewrite currency/fx after a group currency change. */
  async patchExpense(
    id: string,
    data: Partial<Pick<ExpenseRecord, 'currency' | 'fx_cents'>>,
    t: string,
  ): Promise<ExpenseRecord> {
    return this.pb.collection('expenses').update(id, data, { query: { t } });
  }

  async patchPayment(
    id: string,
    data: Partial<Pick<PaymentRecord, 'currency' | 'fx_cents'>>,
    t: string,
  ): Promise<PaymentRecord> {
    return this.pb.collection('payments').update(id, data, { query: { t } });
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
