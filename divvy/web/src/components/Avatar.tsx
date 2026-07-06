interface Props {
  initials: string;
  color: string;
  size?: number;
}

/** Squared "luggage-tag" avatar with initials — person, party, or group. */
export function Avatar({ initials, color, size = 30 }: Props) {
  return (
    <span
      class="avatar"
      style={{
        width: size,
        height: size,
        background: color,
        borderRadius: Math.max(4, Math.round(size * 0.14)),
        fontSize: Math.round(size * 0.38),
      }}
    >
      {initials}
    </span>
  );
}

/** A row of overlapping avatars, capped with a "+N" badge for the overflow. */
export function AvatarStack({
  people,
  max = 4,
  size = 26,
}: {
  people: { id: string; initials: string; color: string }[];
  max?: number;
  size?: number;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span class="avatar-stack">
      {shown.map(p => (
        <Avatar key={p.id} initials={p.initials} color={p.color} size={size} />
      ))}
      {extra > 0 && (
        <span class="avatar avatar-more" style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}>
          +{extra}
        </span>
      )}
    </span>
  );
}
