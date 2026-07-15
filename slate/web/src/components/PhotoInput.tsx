import type { ComponentChildren } from 'preact';

/** A file picker dressed as whatever it wraps — a tappable avatar or a button. */
export function PhotoInput({
  class: cls,
  busy,
  onPick,
  children,
}: {
  class?: string;
  busy: boolean;
  onPick: (file: File) => void;
  children: ComponentChildren;
}) {
  return (
    <label class={cls ?? 'photo-tap'}>
      {children}
      <input
        type="file"
        accept="image/*"
        hidden
        disabled={busy}
        onChange={e => {
          const input = e.target as HTMLInputElement;
          const file = input.files?.[0];
          input.value = '';
          if (file) onPick(file);
        }}
      />
    </label>
  );
}
