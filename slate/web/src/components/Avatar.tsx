interface Props {
  initials: string;
  color: string;
  size?: number;
  /** photo URL — shown instead of the initials when set */
  src?: string;
  /** corner radius override — defaults to a fifth of the size */
  radius?: number;
}

/** Squared "luggage-tag" avatar — person, party, or group. Photo when one is set, initials otherwise. */
export function Avatar({ initials, color, size = 30, src, radius }: Props) {
  return (
    <span
      class="avatar"
      style={{
        width: size,
        height: size,
        background: color,
        borderRadius: radius ?? Math.max(4, Math.round(size * 0.2)),
        fontSize: Math.round(size * 0.38),
      }}
    >
      {src ? <img src={src} alt="" /> : initials}
    </span>
  );
}

/** A row of overlapping avatars, capped with a "+N" badge for the overflow. */
export function AvatarStack({
  people,
  max = 4,
  size = 26,
}: {
  people: { id: string; initials: string; color: string; src?: string }[];
  max?: number;
  size?: number;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span class="avatar-stack">
      {shown.map(p => (
        <Avatar key={p.id} initials={p.initials} color={p.color} size={size} src={p.src} />
      ))}
      {extra > 0 && (
        <span class="avatar avatar-more" style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}>
          +{extra}
        </span>
      )}
    </span>
  );
}
