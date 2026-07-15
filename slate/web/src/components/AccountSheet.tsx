import { useEffect, useState } from 'preact/hooks';
import { api } from '../app';
import type { CreditEventRecord, UserRecord } from '../api';
import { useUser } from '../account';
import { colorForId, personInitial } from '../lib/avatar';
import { friendlyError } from '../lib/errors';
import { prepareAvatarImage } from '../image';
import { Avatar } from './Avatar';
import { PhotoInput } from './PhotoInput';
import { SignInForm } from './SignInForm';
import { TopUp } from './TopUp';
import { useSwipeToClose } from '../hooks/useSwipeToClose';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * The Account's home (ADR-0005), off the Home footer row: profile (display
 * name + photo), scan balance with top-up, the credit ledger, and sign-out.
 * Signed out it *is* the sign-in flow. Group life never needs any of this —
 * an account still gates nothing but scans.
 */
export function AccountSheet({ open, onClose }: Props) {
  const user = useUser();
  const sheetRef = useSwipeToClose(open, onClose);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    // Balance may have moved on another device (or a sponsored group).
    api.refreshUser();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const title = user ? 'Your account' : 'Sign in';
  const sub = user
    ? 'Your profile and receipt scans — every group works without any of this.'
    : 'A free account holds your receipt scans and profile — groups never need one. New accounts start with 5 scans.';

  return (
    <div class="share-overlay" onClick={onClose}>
      <div
        ref={sheetRef}
        class="share-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={e => e.stopPropagation()}
      >
        <div class="share-handle" />

        <div class="share-head">
          <div class="share-head-text">
            <div class="plus-label">
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
              </svg>
              Account
            </div>
            <div class="share-title">{title}</div>
            <div class="share-sub">{sub}</div>
          </div>
          <button class="share-close" aria-label="Close" onClick={onClose}>×</button>
        </div>

        {user ? <SignedIn user={user} onClose={onClose} /> : <SignInForm />}
      </div>
    </div>
  );
}

function SignedIn({ user, onClose }: { user: UserRecord; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(friendlyError(e, 'That did not save — try again.'));
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    api.signOut();
    onClose();
  }

  return (
    <div class="stack-sm">
      <ProfileSection user={user} busy={busy} run={run} />
      {error && <p class="error">{error}</p>}
      <hr class="rule" />

      <ScansSection credits={user.credits} />
      <hr class="rule" />

      <HistorySection />

      <div class="credits-foot">
        <span class="muted">{user.email}</span>
        <button class="linkish" onClick={signOut}>Sign out</button>
      </div>
    </div>
  );
}

/** Editable display name + photo. The name saves on blur, the photo on pick. */
function ProfileSection({
  user,
  busy,
  run,
}: {
  user: UserRecord;
  busy: boolean;
  run: (fn: () => Promise<void>) => void;
}) {
  const [name, setName] = useState(user.name);

  function commitName(value: string) {
    const trimmed = value.trim();
    if (trimmed === user.name) return;
    run(() => api.setUserName(trimmed));
  }

  return (
    <div>
      <div class="settings-identity">
        <PhotoInput busy={busy} onPick={f => run(async () => api.setUserPhoto(await prepareAvatarImage(f)))}>
          <Avatar
            initials={personInitial(user.name || user.email)}
            color={colorForId(user.id)}
            size={64}
            src={api.userPhotoUrl(user)}
          />
        </PhotoInput>
        <label class="field grow">
          <span>Your name — shown wherever your account appears</span>
          <input
            value={name}
            placeholder="Matt"
            maxLength={60}
            onInput={e => setName((e.target as HTMLInputElement).value)}
            onBlur={e => commitName((e.target as HTMLInputElement).value)}
          />
        </label>
      </div>
      {user.avatar && (
        <button class="btn small" style="margin-top:8px;" disabled={busy} onClick={() => run(() => api.setUserPhoto(null))}>
          Remove photo
        </button>
      )}
    </div>
  );
}

/** Balance line with the pack-purchase flow folded away behind "Top up". */
function ScansSection({ credits }: { credits: number }) {
  const [topUpOpen, setTopUpOpen] = useState(false);

  return (
    <div class="stack-sm">
      <div class="credits-balance">
        <span class="nm">Your scans</span>
        <span class="lead" />
        <b class="num">{credits}</b>
      </div>
      {topUpOpen ? (
        <TopUp />
      ) : (
        <button class="btn" onClick={() => setTopUpOpen(true)}>
          Top up scans
        </button>
      )}
    </div>
  );
}

const EVENT_LABELS: Record<CreditEventRecord['reason'], string> = {
  welcome: 'Welcome scans',
  purchase: 'Scan pack',
  scan: 'Receipt scan',
  admin: 'Adjustment',
};

/** The credit ledger, newest first — every grant, purchase, and scan. */
function HistorySection() {
  const user = useUser();
  const [events, setEvents] = useState<CreditEventRecord[] | null>(null);

  // user.credits changing means the ledger grew (a purchase from this sheet,
  // a scan elsewhere caught by refreshUser) — refetch so they can't drift.
  useEffect(() => {
    let alive = true;
    api.listCreditEvents().then(
      evs => { if (alive) setEvents(evs); },
      () => { if (alive) setEvents([]); },
    );
    return () => { alive = false; };
  }, [user?.credits]);

  return (
    <div class="stack-sm">
      <div class="seclbl left">History</div>
      {events === null ? (
        <p class="hint sans left">···</p>
      ) : events.length === 0 ? (
        <p class="hint sans left">Nothing yet — scans and top-ups will show here.</p>
      ) : (
        <ul class="ledger">
          {events.map(ev => (
            <li key={ev.id} class="ledger-row">
              <span class="nm">{EVENT_LABELS[ev.reason]}</span>
              <span class="ledger-date num">{ev.created.slice(0, 10)}</span>
              <span class="lead" />
              <b class={`num ${ev.delta > 0 ? 'pos' : 'neg'}`}>
                {ev.delta > 0 ? '+' : ''}{ev.delta}
              </b>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
