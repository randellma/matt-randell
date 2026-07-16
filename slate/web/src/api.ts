import PocketBase, { type AuthRecord } from 'pocketbase';
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
  /**
   * Claim (ADR-0005): id of the account this member is linked to; '' =
   * unclaimed. Soft — a claimed member leaves everyone else's identity picker
   * and nothing else. Server rules let only the signed-in account set or
   * release it, to itself, one claim per account per group.
   */
  user: string;
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

/** The signed-in account: scan credits plus a profile (ADR-0004, ADR-0005). */
export interface UserRecord {
  id: string;
  email: string;
  /** profile display name shown wherever the account surfaces; '' = email */
  name: string;
  /** profile photo filename; '' = initials avatar */
  avatar: string;
  /** live scan-credit balance */
  credits: number;
}

/**
 * One row of the append-only ledger behind the credit balance — a welcome
 * grant, a pack purchase, or a scan spend. The Account sheet's history.
 */
export interface CreditEventRecord {
  id: string;
  delta: number;
  reason: 'welcome' | 'purchase' | 'scan' | 'admin';
  note: string;
  created: string;
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
    collection: 'groups' | 'members' | 'receipts' | 'users',
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

  userPhotoUrl(u: UserRecord): string | undefined {
    return u.avatar ? this.fileUrl('users', u.id, u.avatar) : undefined;
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

  // ── claims (ADR-0005) ──────────────────────────────────────────────────
  // A claim is members.user pointing at the signed-in account. All three
  // writers funnel the one-time photo copy through claimPhotoFixup: claiming
  // a photo-less member stamps the profile photo onto it once — it's a plain
  // member photo (group-editable) from then on.

  /** Claim a member as the signed-in account. Fails if someone else holds it. */
  async claimMember(member: MemberRecord, t: string): Promise<MemberRecord> {
    const claimed: MemberRecord = await this.pb
      .collection('members')
      .update(member.id, { user: this.pb.authStore.record?.id }, { query: { t } });
    return this.claimPhotoFixup(claimed, t);
  }

  /** Add a member already claimed as the signed-in account ("add yourself"). */
  async addClaimedMember(groupId: string, name: string, t: string): Promise<MemberRecord> {
    const claimed: MemberRecord = await this.pb
      .collection('members')
      .create({ group: groupId, name, user: this.pb.authStore.record?.id }, { query: { t } });
    return this.claimPhotoFixup(claimed, t);
  }

  /** Release the signed-in account's claim on a member (claimant only). */
  async releaseClaim(memberId: string, t: string): Promise<MemberRecord> {
    return this.pb.collection('members').update(memberId, { user: '' }, { query: { t } });
  }

  /**
   * The one-time photo copy on claim: a photo-less member gets the account's
   * profile photo. Best-effort — a claim must not fail over a photo.
   */
  private async claimPhotoFixup(member: MemberRecord, t: string): Promise<MemberRecord> {
    const u = this.user;
    if (member.photo || !u?.avatar) return member;
    try {
      const res = await fetch(this.userPhotoUrl(u)!);
      if (!res.ok) return member;
      return await this.setMemberPhoto(member.id, await res.blob(), t);
    } catch {
      return member;
    }
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
      avatar: (r as { avatar?: string }).avatar ?? '',
      credits: (r as { credits?: number }).credits ?? 0,
    };
  }

  /** Subscribe to sign-in/out and balance changes; returns an unsubscribe. */
  onAuthChange(cb: (user: UserRecord | null) => void): () => void {
    return this.pb.authStore.onChange(() => cb(this.user));
  }

  /**
   * Email a 6-digit sign-in code; creates the account on first contact
   * (a server hook backs PocketBase's native OTP — ADR-0005). Returns the
   * otpId the code must be traded in with.
   */
  async requestAuthCode(email: string): Promise<string> {
    const res = await this.pb.collection('users').requestOTP(email);
    return res.otpId;
  }

  /** Trade the emailed code for a session. First sign-in grants welcome credits. */
  async verifyAuthCode(otpId: string, code: string): Promise<UserRecord> {
    await this.pb.collection('users').authWithOTP(otpId, code);
    return this.user!;
  }

  /**
   * Whether the server has Google sign-in configured (the provider only
   * appears once its credentials are set — the button hides otherwise).
   */
  async googleSignInAvailable(): Promise<boolean> {
    try {
      const methods = await this.pb.collection('users').listAuthMethods();
      return methods.oauth2.enabled && methods.oauth2.providers.some(p => p.name === 'google');
    } catch {
      return false;
    }
  }

  /**
   * Google sign-in via PocketBase's all-in-one OAuth2 flow (popup +
   * realtime). Lands on the existing account when the email already signed
   * in by code. First sign-in grants welcome credits, same as the code path.
   */
  async signInWithGoogle(): Promise<UserRecord> {
    await this.pb.collection('users').authWithOAuth2({ provider: 'google' });
    return this.user!;
  }

  signOut(): void {
    this.pb.authStore.clear();
  }

  /**
   * Re-fetch the signed-in record (fresh credits). Clears a dead session.
   * Not the SDK's authRefresh: that saves its response into the auth store
   * whenever it lands, so a sign-out (or a fresh sign-in) racing an
   * in-flight refresh would be silently overwritten. A raw send leaves the
   * store alone, and the result applies only if the session it refreshed is
   * still the current one.
   */
  async refreshUser(): Promise<UserRecord | null> {
    if (!this.pb.authStore.isValid) return null;
    const before = this.pb.authStore.token;
    const current = () => this.pb.authStore.token === before;
    try {
      const res: { token: string; record: AuthRecord } =
        await this.pb.send('/api/collections/users/auth-refresh', { method: 'POST' });
      if (current()) this.pb.authStore.save(res.token, res.record);
    } catch {
      if (current()) this.pb.authStore.clear();
    }
    return this.user;
  }

  /** Set the account's profile display name. */
  async setUserName(name: string): Promise<void> {
    const id = this.pb.authStore.record?.id;
    if (!id) return;
    const rec = await this.pb.collection('users').update(id, { name });
    this.pb.authStore.save(this.pb.authStore.token, rec);
  }

  /** Set (or with null, remove) the account's profile photo. */
  async setUserPhoto(photo: Blob | null): Promise<void> {
    const id = this.pb.authStore.record?.id;
    if (!id) return;
    const rec = await this.pb.collection('users').update(id, this.photoPayload('avatar', photo));
    this.pb.authStore.save(this.pb.authStore.token, rec);
  }

  /** The signed-in account's credit ledger, newest first (list rule scopes it to the owner). */
  async listCreditEvents(): Promise<CreditEventRecord[]> {
    return this.pb.collection('credit_events').getFullList({ sort: '-created' });
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
