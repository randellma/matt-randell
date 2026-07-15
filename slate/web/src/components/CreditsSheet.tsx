import { useEffect } from 'preact/hooks';
import { api } from '../app';
import { useUser } from '../account';
import { SignInForm } from './SignInForm';
import { TopUp } from './TopUp';
import { useSwipeToClose } from '../hooks/useSwipeToClose';

interface Props {
  open: boolean;
  onClose: () => void;
  /** why the sheet opened — tunes the headline */
  reason?: 'out-of-scans' | 'signin' | 'account';
  /** fires after anything that changes scan allowance: sign-in, top-up */
  onChanged?: () => void;
}

/**
 * The Slate Plus sheet, for the paywall/top-up moments inside groups: sign in
 * (emailed code — no passwords) and top up scan credits. Profile and account
 * management live in the Account sheet off the Home footer (ADR-0005).
 * Beta: "buying" a pack grants it instantly, free.
 */
export function CreditsSheet({ open, onClose, reason = 'account', onChanged }: Props) {
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
          <div class="stack-sm">
            <div class="credits-balance">
              <span class="nm">Your scans</span>
              <span class="lead" />
              <b class="num">{user.credits}</b>
            </div>
            <TopUp onPurchased={onChanged} />
            <div class="credits-foot">
              <span class="muted">{user.email}</span>
            </div>
          </div>
        ) : (
          <SignInForm onSignedIn={onChanged} />
        )}
      </div>
    </div>
  );
}
