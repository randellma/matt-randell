import { useState } from 'preact/hooks';
import { api } from '../app';
import type { SecurityInfo } from '../api';
import { collectiveInitials } from '../lib/avatar';
import { Avatar } from '../components/Avatar';

/**
 * The door of a PIN-gated group: shown when a device holds no (working) token
 * for it — a fresh invite, or a token rotated away when the PIN went on.
 * A correct PIN buys the group token; too many wrong ones lock joining, and
 * the recovery button emails the access link to the group's recovery address.
 */
export function PinGate({
  groupId,
  info,
  onJoined,
}: {
  groupId: string;
  info: SecurityInfo;
  onJoined: (t: string) => void;
}) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(info.locked ?? false);
  const [error, setError] = useState('');
  const [recovery, setRecovery] = useState('');

  async function join() {
    if (!/^\d{4,6}$/.test(pin)) return setError('The PIN is 4 to 6 digits.');
    setBusy(true);
    setError('');
    try {
      const res = await api.joinWithPin(groupId, pin);
      onJoined(res.t);
    } catch (e) {
      const r = (e as { response?: { code?: string; attempts_left?: number } }).response;
      if (r?.code === 'locked') setLocked(true);
      else if (r?.code === 'wrong_pin') {
        setError(
          r.attempts_left !== undefined && r.attempts_left <= 3
            ? `Wrong PIN — ${r.attempts_left} ${r.attempts_left === 1 ? 'try' : 'tries'} left before joining locks.`
            : 'Wrong PIN — check with the group.',
        );
      } else setError('Something went wrong — try again.');
      setPin('');
      setBusy(false);
    }
  }

  async function recover() {
    setBusy(true);
    setError('');
    try {
      const res = await api.requestRecovery(groupId);
      setRecovery(`Access link sent to ${res.to} — check that inbox.`);
    } catch (e) {
      const r = (e as { response?: { code?: string } }).response;
      setRecovery(
        r?.code === 'cooldown'
          ? 'A recovery email was sent moments ago — give it a few minutes.'
          : 'The recovery email could not be sent — try again later.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="page">
      <header class="app-header">
        {info.photo && (
          <div style="display:flex;justify-content:center;margin-bottom:10px;">
            <Avatar
              initials={collectiveInitials(info.name ?? '')}
              color="#0B7A4E"
              size={64}
              src={api.groupPhotoUrlById(groupId, info.photo)}
            />
          </div>
        )}
        <h1>{info.name}</h1>
        <p class="tagline">This group is PIN-protected</p>
      </header>

      <section class="ticket-box">
        {locked ? (
          <>
            <span class="stamp red">Joining locked</span>
            <p class="hint sans left">
              Too many wrong PINs, so joining is paused for everyone new.
              Someone already in the group can unlock it from Group settings
              {info.has_recovery ? ' — or use the recovery email below.' : '.'}
            </p>
          </>
        ) : (
          <>
            <label class="field">
              <span>Group PIN</span>
              <input
                class="pin-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autocomplete="one-time-code"
                placeholder="····"
                value={pin}
                onInput={e => setPin((e.target as HTMLInputElement).value.replace(/\D/g, ''))}
                onKeyDown={e => {
                  if (e.key === 'Enter' && pin.length >= 4) join();
                }}
              />
            </label>
            {error && <p class="error">{error}</p>}
            <button class="btn primary big" onClick={join} disabled={busy || pin.length < 4}>
              {busy ? 'Checking…' : 'Join group'}
            </button>
          </>
        )}

        <div class="divider">forgot the pin?</div>
        {recovery ? (
          <p class="hint sans">{recovery}</p>
        ) : info.has_recovery ? (
          <button class="btn" onClick={recover} disabled={busy}>
            Email the group's access link
          </button>
        ) : (
          <p class="hint sans">
            No recovery email is set for this group — ask someone who's already
            in to share access.
          </p>
        )}
      </section>

      <p class="hint sans">
        Ask anyone in the group for the PIN. Once you're in, this device stays in.
      </p>
    </div>
  );
}
