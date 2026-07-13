import { useEffect, useRef, useState } from 'preact/hooks';
import { generate } from 'lean-qr';

/** ink #20251E on transparent — the paper grain shows through the code */
const INK: [number, number, number, number] = [0x20, 0x25, 0x1e, 255];
const OFF: [number, number, number, number] = [0, 0, 0, 0];

/**
 * Web Share exists on all mobile browsers, Safari/macOS, and Chrome/Edge on
 * Windows; where it doesn't (Firefox desktop, older browsers) we fall back to a
 * mailto: link — the one desktop scheme that reliably works. Feature-detected
 * once so the button and its hint always describe what will actually happen.
 */
const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

interface Props {
  open: boolean;
  onClose: () => void;
  groupName: string;
  url: string;
  pinOn?: boolean;
}

/**
 * The invite drawer — a bottom sheet with the two ways into a group: the QR
 * code to scan in person, and a link to send. Opened from the header's
 * add-people button and the one at the foot of the receipt.
 */
export function ShareDrawer({ open, onClose, groupName, url, pinOn }: Props) {
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (open && canvasRef.current) {
      // padX/padY trim the default 4-module quiet zone down to 2 so the code
      // fills more of the card — still enough margin to scan cleanly.
      generate(url).toCanvas(canvasRef.current, { on: INK, off: OFF, padX: 2, padY: 2 });
    }
  }, [open, url]);

  // Escape closes the drawer, like any modal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const shareText = pinOn
    ? `Join our expense group "${groupName}" — you'll need the group PIN`
    : `Join our expense group "${groupName}"`;
  // The link box reads cleaner without the scheme; copy/share still send the
  // full URL so it stays clickable wherever it lands.
  const display = url.replace(/^https?:\/\//, '');

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* older browser or permission denied — the visible link is still there */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function shareAction() {
    if (canShare) {
      try {
        await navigator.share({ title: `Slate: ${groupName}`, text: shareText, url });
      } catch {
        /* user cancelled the share sheet — no-op */
      }
    } else {
      const subject = encodeURIComponent(`Join "${groupName}" on Slate`);
      const body = encodeURIComponent(`${shareText}:\n${url}`);
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }
  }

  return (
    <div class="share-overlay" onClick={onClose}>
      <div
        class="share-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Add people to this slate"
        onClick={e => e.stopPropagation()}
      >
        <div class="share-handle" />

        <div class="share-head">
          <div class="share-head-text">
            <div class="share-title">Add people to this slate</div>
            <div class="share-sub">
              Two ways in — both drop people straight into the group. No accounts, no sign-ups.
            </div>
          </div>
          <button class="share-close" aria-label="Close" onClick={onClose}>×</button>
        </div>

        <div class="seclbl left">In person</div>
        <div class="share-qr">
          <div class="share-qr-card">
            <canvas ref={canvasRef} role="img" aria-label="Scan to join this slate" />
          </div>
          <p class="share-qr-hint">
            {pinOn
              ? 'Everyone scans the code — they’ll need the group PIN to open it.'
              : 'Drop your phone on the table — everyone scans the code and they’re in.'}
          </p>
        </div>

        <div class="seclbl left">Send a link</div>
        <div class="share-link-row">
          <span class="share-link-url num">{display}</span>
          <button class={`share-copy${copied ? ' done' : ''}`} onClick={copyLink}>
            {copied ? 'Copied ✓' : 'Copy link'}
          </button>
        </div>
        <button class="share-action" onClick={shareAction}>
          {canShare ? (
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
              <line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 7l9 6 9-6" />
            </svg>
          )}
          <span>{canShare ? 'Share…' : 'Email a link'}</span>
        </button>
        <p class="share-action-hint">
          {canShare
            ? 'Opens your share sheet — send it to the group chat, Messages, WhatsApp…'
            : 'Copy the link above to paste into any chat, or email it.'}
        </p>
      </div>
    </div>
  );
}
