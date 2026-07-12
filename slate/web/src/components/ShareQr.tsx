import { useEffect, useRef, useState } from 'preact/hooks';
import { generate } from 'lean-qr';

/** ink #20251E on transparent — the paper grain shows through the code */
const INK: [number, number, number, number] = [0x20, 0x25, 0x1e, 255];
const OFF: [number, number, number, number] = [0, 0, 0, 0];

const hiddenKey = (groupId: string) => `slate-qr-hidden:${groupId}`;

/**
 * The group's share code, printed at the foot of the receipt. Always there so
 * anyone at the table can be waved in, with a hide toggle (remembered per
 * group) for screenshots and shoulder-surfing.
 */
export function ShareQr({ groupId, url, pinOn }: { groupId: string; url: string; pinOn?: boolean }) {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(hiddenKey(groupId)) === '1';
    } catch {
      return false;
    }
  });

  function toggle(hide: boolean) {
    setHidden(hide);
    try {
      localStorage.setItem(hiddenKey(groupId), hide ? '1' : '0');
    } catch {
      /* private mode — the toggle just won't stick */
    }
  }

  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!hidden && canvasRef.current) {
      generate(url).toCanvas(canvasRef.current, { on: INK, off: OFF });
    }
  }, [url, hidden]);

  if (hidden) {
    return (
      <div class="qr-hidden">
        <span>Share code hidden for privacy.</span>
        <button class="qr-toggle" onClick={() => toggle(false)}>Show</button>
      </div>
    );
  }
  return (
    <div class="qr-share">
      <canvas ref={canvasRef} role="img" aria-label="Group share code" />
      <div class="qr-share-text">
        <span class="qr-share-title">Share this group</span>
        <span class="qr-share-hint">
          {pinOn
            ? 'Scanning opens the group — they’ll need the group PIN.'
            : 'Anyone who scans it is in — no accounts, no sign-ups.'}
        </span>
        <button class="qr-toggle" onClick={() => toggle(true)}>Hide code</button>
      </div>
    </div>
  );
}
