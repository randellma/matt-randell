import { useEffect, useState } from 'preact/hooks';
import { api } from '../app';
import { CREDIT_PACKS, type CreditPackId } from '../api';
import { useUser } from '../account';

interface Props {
  open: boolean;
  onClose: () => void;
  /** why the sheet opened — tunes the headline */
  reason?: 'out-of-scans' | 'signin' | 'account';
  /** fires after anything that changes scan allowance: sign-in, top-up, sign-out */
  onChanged?: () => void;
}

/**
 * The Slate Plus sheet: sign in (emailed code — no passwords) and top up scan
 * credits. This is the one place accounts surface in the app; everything else
 * stays link-only. Beta: "buying" a pack grants it instantly, free.
 */
export function CreditsSheet({ open, onClose, reason = 'account', onChanged }: Props) {
  const user = useUser();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    // Balance may have moved on another device (or a sponsored group).
    api.refreshUser();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const title = user
    ? reason === 'out-of-scans' && user.credits <= 0
      ? 'Out of receipt scans'
      : 'Receipt scans'
    : reason === 'signin' || reason === 'out-of-scans'
      ? 'Sign in to scan receipts'
      : 'Receipt scans';
  const sub = user
    ? 'Scans auto-fill the total, date and every line item straight from a photo.'
    : 'Scans live on a free account so they follow you across groups — new accounts start with 5.';

  return (
    <div class="share-overlay" onClick={onClose}>
      <div
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
                <rect x="4" y="10" width="16" height="11" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              Slate Plus
            </div>
            <div class="share-title">{title}</div>
            <div class="share-sub">{sub}</div>
          </div>
          <button class="share-close" aria-label="Close" onClick={onClose}>×</button>
        </div>

        {user ? (
          <SignedIn onChanged={onChanged} onClose={onClose} />
        ) : (
          <SignIn onChanged={onChanged} />
        )}
      </div>
    </div>
  );
}

/** Email → code, two steps in place. */
function SignIn({ onChanged }: { onChanged?: () => void }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function sendCode() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return setError('That does not look like an email address.');
    }
    setBusy(true);
    setError('');
    try {
      await api.requestAuthCode(email.trim());
      setSent(true);
      setCode('');
    } catch (e) {
      setError(friendlyError(e, 'Could not send the code — try again.'));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError('');
    try {
      await api.verifyAuthCode(email.trim(), code.trim());
      onChanged?.();
    } catch (e) {
      setError(friendlyError(e, 'Wrong or expired code — request a new one.'));
      setBusy(false);
    }
  }

  return (
    <div class="stack-sm">
      <label class="field">
        <span>Email</span>
        <input
          type="email"
          inputMode="email"
          autocomplete="email"
          value={email}
          placeholder="you@example.com"
          disabled={sent}
          onInput={e => setEmail((e.target as HTMLInputElement).value)}
        />
      </label>
      {sent && (
        <label class="field">
          <span>Code — check your inbox</span>
          <input
            class="pin-input"
            inputMode="numeric"
            autocomplete="one-time-code"
            maxLength={6}
            value={code}
            placeholder="······"
            onInput={e => setCode((e.target as HTMLInputElement).value.replace(/\D/g, ''))}
          />
        </label>
      )}
      {error && <p class="error">{error}</p>}
      {sent ? (
        <>
          <button class="btn primary big" onClick={verify} disabled={busy || code.length !== 6}>
            {busy ? 'Checking…' : 'Sign in'}
          </button>
          <button class="btn small" onClick={sendCode} disabled={busy}>
            Resend code
          </button>
        </>
      ) : (
        <button class="btn primary big" onClick={sendCode} disabled={busy || !email.trim()}>
          {busy ? 'Sending…' : 'Email me a code'}
        </button>
      )}
      <p class="hint sans">No passwords — we email you a 6-digit code each time.</p>
    </div>
  );
}

function SignedIn({ onChanged, onClose }: { onChanged?: () => void; onClose: () => void }) {
  const user = useUser()!;
  const [pack, setPack] = useState<CreditPackId>('p30');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [granted, setGranted] = useState(0);
  // Offered once when the account is nameless — it's what sponsored groups see.
  const [name, setName] = useState('');

  async function buy() {
    setBusy(true);
    setError('');
    try {
      if (name.trim() && !user.name) await api.setUserName(name.trim());
      const res = await api.purchasePack(pack);
      setGranted(res.granted);
      onChanged?.();
    } catch (e) {
      setError(friendlyError(e, 'Could not add scans — try again.'));
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    api.signOut();
    onChanged?.();
    onClose();
  }

  return (
    <div class="stack-sm">
      <div class="credits-balance">
        <span class="nm">Your scans</span>
        <span class="lead" />
        <b class="num">{user.credits}</b>
      </div>

      {!user.name && (
        <label class="field">
          <span>Your name — shown when your scans cover a group</span>
          <input
            value={name}
            placeholder="Matt"
            maxLength={60}
            onInput={e => setName((e.target as HTMLInputElement).value)}
          />
        </label>
      )}

      <div class="pack-list" role="radiogroup" aria-label="Scan packs">
        {CREDIT_PACKS.map(p => (
          <button
            key={p.id}
            class={`pack-row ${pack === p.id ? 'on' : ''}`}
            role="radio"
            aria-checked={pack === p.id}
            onClick={() => setPack(p.id)}
          >
            <span class="pack-radio" />
            <span class="pack-label">{p.label}</span>
            {p.best && <span class="pack-badge">Best value</span>}
            <span class="pack-price num">${(p.priceCents / 100).toFixed(2)}</span>
          </button>
        ))}
      </div>

      <p class="hint sans beta-note">Slate is in beta — packs are on the house for now. No card, no charge.</p>
      {error && <p class="error">{error}</p>}
      {granted > 0 && <p class="hint ok">+{granted} scans added ✓</p>}

      <button class="btn primary big" onClick={buy} disabled={busy}>
        {busy ? 'Adding…' : 'Get scans'}
      </button>

      <div class="credits-foot">
        <span class="muted">{user.email}</span>
        <button class="linkish" onClick={signOut}>Sign out</button>
      </div>
    </div>
  );
}

/** Server routes speak human already; fall back when the shape is unexpected. */
function friendlyError(e: unknown, fallback: string): string {
  const msg = (e as { response?: { message?: string } })?.response?.message;
  return msg || (e instanceof Error && e.message ? e.message : fallback);
}
