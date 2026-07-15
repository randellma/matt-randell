import { useState } from 'preact/hooks';
import { api } from '../app';
import { CREDIT_PACKS, type CreditPackId } from '../api';
import { friendlyError } from '../lib/errors';

/**
 * The pack-purchase flow: pick a pack, get scans. Beta: "buying" grants it
 * instantly, free. Shared by the Account sheet and the credits sheet.
 */
export function TopUp({ onPurchased }: { onPurchased?: () => void }) {
  const [pack, setPack] = useState<CreditPackId>('p30');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [granted, setGranted] = useState(0);

  async function buy() {
    setBusy(true);
    setError('');
    try {
      const res = await api.purchasePack(pack);
      setGranted(res.granted);
      onPurchased?.();
    } catch (e) {
      setError(friendlyError(e, 'Could not add scans — try again.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="stack-sm">
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
    </div>
  );
}
