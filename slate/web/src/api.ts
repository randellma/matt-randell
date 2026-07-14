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
  /** joining requires the group PIN; server-managed, read-only to clients */
  pin_on: boolean;
}

/**
 * What the custom security routes reveal about a group. Without a token only
 * PIN-gated groups return anything beyond `pin: false`; with a valid `?t=`
 * the recovery email and attempt count come along for the settings screen.
 */
export interface SecurityInfo {
  pin: boolean;
  locked?: boolean;
  name?: string;
  /** group avatar photo filename, for the join screen */
  photo?: string;
  has_recovery?: boolean;
  recovery_email?: string;
  attempts?: number;
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
  /** kept only to resolve their name on old expenses; hidden from every picker */
  removed: boolean;
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
  /** stored file — a photo, or a PDF for emailed receipts (rides, hotels, flights) */
  image: string;
  status: 'pending' | 'done' | 'failed';
  parsed: ParsedReceipt | null;
  error: string;
}

/** The signed-in account — exists only to hold scan credits (ADR-0004). */
export interface UserRecord {
  id: string;
  email: string;
  /** display name shown where this account's credits cover a group; '' = masked email */
  name: string;
  /** live scan-credit balance */
  credits: number;
}

/**
 * What a scan in a group would cost and whose balance it would charge —
 * the expense form's scan card renders straight from this.
 */
export interface ScanAllowance {
  signed_in: boolean;
  self_credits: number;
  /** who a scan would charge: you, a sponsor's balance, or nobody (blocked) */
  source: 'self' | 'sponsor' | null;
  sponsor_name: string;
  /** everyone covering this group, for the settings screen */
  sponsors: { user: string; name: string; credits: number }[];
}

/** "This group may draw from my credits" — one row per sponsor per group. */
export interface SponsorshipRecord {
  id: string;
  group: string;
  user: string;
}

/**
 * The purchasable packs, mirrored from the server (accounts_utils.js PACKS) —
 * the purchase route only honors ids it knows, so drift can't undercharge.
 */
export const CREDIT_PACKS = [
  { id: 'p10', credits: 10, priceCents: 299, label: '10 scans', best: false },
  { id: 'p30', credits: 30, priceCents: 699, label: '30 scans', best: true },
] as const;
export type CreditPackId = (typeof CREDIT_PACKS)[number]['id'];

/** Whether the receipt's stored file is a PDF (vs a photo). */
export function receiptIsPdf(r: ReceiptRecord): boolean {
  return r.image.toLowerCase().endsWith('.pdf');
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
  private fileUrl(
    collection: 'groups' | 'members' | 'receipts',
    recordId: string,
    filename: string,
    thumb?: string,
  ): string {
    const url = `${this.base}/api/files/${collection}/${recordId}/${encodeURIComponent(filename)}`;
    return thumb ? `${url}?thumb=${thumb}` : url;
  }

  groupPhotoUrl(g: GroupRecord): string | undefined {
    return g.photo ? this.fileUrl('groups', g.id, g.photo) : undefined;
  }

  /** Same, from the bare id+filename the security route returns pre-join. */
  groupPhotoUrlById(groupId: string, filename: string): string {
    return this.fileUrl('groups', groupId, filename);
  }

  memberPhotoUrl(m: MemberRecord): string | undefined {
    return m.photo ? this.fileUrl('members', m.id, m.photo) : undefined;
  }

  /** The party's photo lives (mirrored) on its members — first one wins. */
  partyPhotoUrl(partyMembers: MemberRecord[]): string | undefined {
    const holder = partyMembers.find(m => m.party_photo);
    return holder ? this.fileUrl('members', holder.id, holder.party_photo) : undefined;
  }

  /** URL for a receipt image; pass `thumb` (e.g. '0x200') for the small preview. */
  receiptImageUrl(r: ReceiptRecord, thumb?: string): string | undefined {
    return r.image ? this.fileUrl('receipts', r.id, r.image, thumb) : undefined;
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

  /** Delete a group; members, expenses, payments, and receipts cascade server-side. */
  async deleteGroup(id: string, t: string): Promise<void> {
    await this.pb.collection('groups').delete(id, { query: { t } });
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
    data: Partial<Pick<MemberRecord, 'name' | 'party' | 'party_name' | 'removed'>> & { party_photo?: null },
    t: string,
  ): Promise<MemberRecord> {
    return this.pb.collection('members').update(memberId, data, { query: { t } });
  }

  /**
   * Hard-delete a member. Only safe for a member nothing references: the
   * `paid_by`/`from_member`/`to_member` relations cascade-delete (migration
   * 1751600009), so deleting a referenced member would take their expenses and
   * payments with it. Referenced members are flagged `removed` via updateMember
   * instead — see GroupSettings.removeMember.
   */
  async deleteMember(memberId: string, t: string): Promise<void> {
    await this.pb.collection('members').delete(memberId, { query: { t } });
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
   * Upload a receipt file (photo or PDF) for parsing. The server-side OCR
   * hook runs during this request, so the returned record is usually already
   * done/failed — but poll to be safe.
   */
  async uploadReceipt(groupId: string, file: Blob, isPdf: boolean, t: string): Promise<ReceiptRecord> {
    return this.createReceipt(groupId, file, isPdf, 'pending', t);
  }

  /**
   * Upload a receipt file as a plain attachment, skipping OCR: the server
   * hook only parses records created with status 'pending', so starting at
   * 'done' stores the file and nothing else.
   */
  async uploadReceiptImage(groupId: string, file: Blob, isPdf: boolean, t: string): Promise<ReceiptRecord> {
    return this.createReceipt(groupId, file, isPdf, 'done', t);
  }

  private async createReceipt(
    groupId: string,
    file: Blob,
    // caller sniffs this (isPdfFile) — blob.type alone lies on iOS
    isPdf: boolean,
    status: 'pending' | 'done',
    t: string,
  ): Promise<ReceiptRecord> {
    const form = new FormData();
    form.set('group', groupId);
    form.set('status', status);
    // The extension is what receiptIsPdf and the OCR hook key off.
    form.set('image', file, isPdf ? 'receipt.pdf' : 'receipt.jpg');
    return this.pb.collection('receipts').create(form, { query: { t } });
  }

  async getReceipt(id: string, t: string): Promise<ReceiptRecord> {
    return this.pb.collection('receipts').getOne(id, { query: { t } });
  }

  /** PIN/recovery state; pass the token to also get the settings-only fields. */
  async securityInfo(groupId: string, t?: string): Promise<SecurityInfo> {
    return this.pb.send(`/api/divvy/groups/${groupId}/security`, {
      method: 'GET',
      query: t ? { t } : {},
    });
  }

  /** Trade a correct PIN for the group token. Throws with response codes
   * `wrong_pin` (+ attempts_left) or `locked` — see PinGate. */
  async joinWithPin(groupId: string, pin: string): Promise<{ t: string; name: string }> {
    return this.pb.send(`/api/divvy/groups/${groupId}/join`, {
      method: 'POST',
      body: { pin },
    });
  }

  /**
   * Set/change/disable the PIN, set the recovery email, or unlock joining.
   * Enabling the PIN rotates the token — the response's `t` is authoritative.
   */
  async updateSecurity(
    groupId: string,
    t: string,
    changes: { pin?: string; disable_pin?: boolean; recovery_email?: string; unlock?: boolean },
  ): Promise<{ t: string; pin: boolean; recovery_email: string; attempts: number }> {
    return this.pb.send(`/api/divvy/groups/${groupId}/security`, {
      method: 'POST',
      body: changes,
      query: { t },
    });
  }

  /** Ask the server to email the group's access link to its recovery address. */
  async requestRecovery(groupId: string): Promise<{ sent: boolean; to: string }> {
    return this.pb.send(`/api/divvy/groups/${groupId}/recover`, { method: 'POST', body: {} });
  }

  // ── accounts & scan credits ────────────────────────────────────────────
  // Group access never needs an account; these exist only for scan credits.
  // The PocketBase SDK persists the auth token in localStorage and attaches
  // it as an Authorization header alongside the usual ?t=.

  /** The signed-in account, if any. */
  get user(): UserRecord | null {
    const r = this.pb.authStore.record;
    if (!this.pb.authStore.isValid || !r) return null;
    return {
      id: r.id,
      email: (r as { email?: string }).email ?? '',
      name: (r as { name?: string }).name ?? '',
      credits: (r as { credits?: number }).credits ?? 0,
    };
  }

  /** Subscribe to sign-in/out and balance changes; returns an unsubscribe. */
  onAuthChange(cb: (user: UserRecord | null) => void): () => void {
    return this.pb.authStore.onChange(() => cb(this.user));
  }

  /** Email a 6-digit sign-in code; creates the account on first contact. */
  async requestAuthCode(email: string): Promise<void> {
    await this.pb.send('/api/divvy/auth/request-code', { method: 'POST', body: { email } });
  }

  /** Trade the emailed code for a session. First sign-in grants welcome credits. */
  async verifyAuthCode(email: string, code: string): Promise<UserRecord> {
    const res: { token: string } = await this.pb.send('/api/divvy/auth/verify', {
      method: 'POST',
      body: { email, code },
    });
    this.pb.authStore.save(res.token);
    // Pull the real record through the collection API so authStore holds a
    // refreshable model (credits and all), not just our route's summary.
    await this.pb.collection('users').authRefresh();
    return this.user!;
  }

  signOut(): void {
    this.pb.authStore.clear();
  }

  /** Re-fetch the signed-in record (fresh credits). Clears a dead session. */
  async refreshUser(): Promise<UserRecord | null> {
    if (!this.pb.authStore.isValid) return null;
    try {
      await this.pb.collection('users').authRefresh();
    } catch {
      this.pb.authStore.clear();
    }
    return this.user;
  }

  /** Set the display name shown where this account's credits cover a group. */
  async setUserName(name: string): Promise<void> {
    const id = this.pb.authStore.record?.id;
    if (!id) return;
    const rec = await this.pb.collection('users').update(id, { name });
    this.pb.authStore.save(this.pb.authStore.token, rec);
  }

  /** Buy a pack. Beta: granted instantly, no payment taken. */
  async purchasePack(pack: CreditPackId): Promise<{ granted: number; credits: number }> {
    const res: { granted: number; credits: number } = await this.pb.send('/api/divvy/credits/purchase', {
      method: 'POST',
      body: { pack },
    });
    await this.refreshUser();
    return res;
  }

  /** Whether (and on whose balance) a scan in this group can run right now. */
  async scanAllowance(groupId: string, t: string): Promise<ScanAllowance> {
    return this.pb.send(`/api/divvy/groups/${groupId}/scan-allowance`, {
      method: 'GET',
      query: { t },
    });
  }

  async listSponsorships(groupId: string, t: string): Promise<SponsorshipRecord[]> {
    return this.pb.collection('sponsorships').getFullList({
      filter: this.pb.filter('group = {:g}', { g: groupId }),
      query: { t },
    });
  }

  /** Start covering a group's scans from the signed-in account's credits. */
  async sponsorGroup(groupId: string, t: string): Promise<SponsorshipRecord> {
    return this.pb
      .collection('sponsorships')
      .create({ group: groupId, user: this.pb.authStore.record?.id }, { query: { t } });
  }

  async unsponsorGroup(sponsorshipId: string, t: string): Promise<void> {
    await this.pb.collection('sponsorships').delete(sponsorshipId, { query: { t } });
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
