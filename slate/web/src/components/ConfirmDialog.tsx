import { createContext } from 'preact';
import type { ComponentChildren } from 'preact';
import { useCallback, useContext, useEffect, useRef, useState } from 'preact/hooks';

/**
 * In-app confirm/alert dialogs — a receipt-card modal that replaces the OS
 * native confirm()/alert(). Those felt janky on mobile (partial backdrop, no
 * theming); this reads like the rest of Slate and animates in cleanly.
 *
 * Promise-based so callsites stay close to what they were:
 *   if (!(await confirm({ title: '…' }))) return;
 */

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red outlined confirm button for destructive actions (delete, remove). */
  danger?: boolean;
}

export interface AlertOptions {
  title: string;
  message?: string;
  okLabel?: string;
}

interface DialogApi {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  alert: (opts: AlertOptions) => Promise<void>;
}

const DialogContext = createContext<DialogApi>({
  confirm: async () => false,
  alert: async () => {},
});

type Active =
  | { kind: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'alert'; opts: AlertOptions; resolve: () => void };

/** Wraps the app so any view can pop a dialog through useConfirm/useAlert. */
export function DialogProvider({ children }: { children: ComponentChildren }) {
  const [active, setActive] = useState<Active | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>(resolve => setActive({ kind: 'confirm', opts, resolve })),
    [],
  );
  const alert = useCallback(
    (opts: AlertOptions) =>
      new Promise<void>(resolve => setActive({ kind: 'alert', opts, resolve })),
    [],
  );

  function finish(result: boolean) {
    if (!active) return;
    if (active.kind === 'confirm') active.resolve(result);
    else active.resolve();
    setActive(null);
  }

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}
      {active && (
        <Dialog active={active} onCancel={() => finish(false)} onConfirm={() => finish(true)} />
      )}
    </DialogContext.Provider>
  );
}

function Dialog({
  active,
  onCancel,
  onConfirm,
}: {
  active: Active;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isAlert = active.kind === 'alert';
  const danger = active.kind === 'confirm' && !!active.opts.danger;
  // Focus the safe control first: cancel on a destructive confirm (so a stray
  // Enter doesn't delete), the confirm/OK button otherwise.
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    (danger ? cancelRef : confirmRef).current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [danger, onCancel]);

  const confirmLabel = isAlert
    ? active.opts.okLabel ?? 'OK'
    : active.opts.confirmLabel ?? 'Confirm';
  const cancelLabel = isAlert ? null : active.opts.cancelLabel ?? 'Cancel';

  return (
    <div class="dialog-overlay" onClick={onCancel}>
      <div
        class="dialog-card"
        role={isAlert ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-label={active.opts.title}
        onClick={e => e.stopPropagation()}
      >
        <div class="dialog-title">{active.opts.title}</div>
        {active.opts.message && <p class="dialog-message">{active.opts.message}</p>}
        <div class="dialog-actions">
          {cancelLabel && (
            <button ref={cancelRef} class="btn small" onClick={onCancel}>
              {cancelLabel}
            </button>
          )}
          <button
            ref={confirmRef}
            class={`btn small ${danger ? 'danger' : 'primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useConfirm(): DialogApi['confirm'] {
  return useContext(DialogContext).confirm;
}

export function useAlert(): DialogApi['alert'] {
  return useContext(DialogContext).alert;
}
