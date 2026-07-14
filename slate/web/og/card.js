// The Slate link-preview card (1200×630) as an SVG string, in the app's slate
// theme — the charcoal board hero that mirrors the in-app invite. Shared by
// scripts/build-og-assets.mjs (renders the static public/og-card.png with
// @resvg/resvg-js) and functions/og/g/[[route]].js (renders per-group cards
// with @resvg/resvg-wasm), so keep it runtime-neutral. Everything is set in
// Space Mono, the only face the og rasteriser bundles.

import { colorForId, personInitial } from './avatar.js';

const SLATE = '#26292B'; // board
const CHALK = '#F2EEE2'; // primary mark
const CHALKMUT = '#B4B7AB'; // muted chalk, for the sub-line
const FAINT = '#8B948B'; // faint mono, for the footnote
const EMERALD = '#7FBF9E'; // badge text
const EMERALD_LINE = '#3E7D5D'; // badge border
const INK = '#0B120D'; // text on the chalk CTA pill
const STROKE = '#26292B'; // avatar tile ring (matches the board)

const CW = 1200;
const CH = 630;
const PAD = 72;
const ADV = 0.6; // Space Mono glyph advance, in em

const escapeXml = (s) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

/** Rendered width of a Space Mono run at a given size and letter-spacing. */
const runWidth = (text, size, ls = 0) =>
  text.length * ADV * size + Math.max(0, text.length - 1) * ls;

/** A pill-shaped label with a rule border — the "You're invited" badge. */
function badge(label, size = 21, ls = 3) {
  const padX = 18;
  const h = 46;
  const w = runWidth(label, size, ls) + padX * 2;
  const x = CW - PAD - w;
  const y = PAD;
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="none" stroke="${EMERALD_LINE}" stroke-width="3"/>
    <text x="${x + w / 2}" y="${y + h / 2 + size * 0.35}" text-anchor="middle" font-family="Space Mono" font-weight="700" font-size="${size}" letter-spacing="${ls}" fill="${EMERALD}">${escapeXml(label)}</text>
  </g>`;
}

/** Overlapping row of member avatar tiles, capped with a +N overflow tile. */
function memberStack(members, x, cy) {
  const tile = 64;
  const step = 46; // overlap
  const rx = 15;
  const max = 5;
  const shown = members.slice(0, max);
  const overflow = members.length - shown.length;
  const cells = shown.map((m) => ({
    fill: colorForId(m.id),
    label: personInitial(m.name),
  }));
  if (overflow > 0) cells.push({ fill: '#3A4139', label: `+${overflow}` });

  const y = cy - tile / 2;
  const tiles = cells.map((c, i) => {
    const tx = x + i * step;
    const fs = c.label.length > 1 ? 22 : 30;
    return `<g>
      <rect x="${tx}" y="${y}" width="${tile}" height="${tile}" rx="${rx}" fill="${c.fill}" stroke="${STROKE}" stroke-width="4"/>
      <text x="${tx + tile / 2}" y="${cy + fs * 0.34}" text-anchor="middle" font-family="Space Mono" font-weight="700" font-size="${fs}" fill="#FFFFFF">${escapeXml(c.label)}</text>
    </g>`;
  });
  const endX = x + (cells.length - 1) * step + tile;
  return { svg: tiles.join(''), endX };
}

/**
 * @param {{ name?: string, members?: {id:string,name:string}[], memberCount?: number }} [opts]
 *   name — the group name for a per-group invite card; omitted, the card is the
 *   generic branded one. members — member records for the avatar stack (empty
 *   for a PIN-gated group, whose roster stays private). memberCount — total
 *   member count when known (may exceed members.length).
 */
export function buildCardSvg(opts = {}) {
  const { name, members = [], memberCount } = opts;
  const invite = Boolean(name);

  // Headline: the group name (fitted + truncated to one line) or the tagline.
  let headline = invite ? name.trim() : 'Split expenses\nwithout the fuss';
  let headSize = 84;
  if (invite) {
    const maxW = CW - PAD * 2;
    headSize = Math.min(84, Math.floor(maxW / (headline.length * ADV)));
    if (headSize < 40) {
      const fit = Math.max(1, Math.floor(maxW / (40 * ADV)) - 1);
      headline = [...headline].slice(0, fit).join('').trimEnd() + '…';
      headSize = 40;
    }
  }
  const headLines = headline.split('\n');
  const headLineH = (invite ? headSize : 68) * 1.06;
  const headTop = 300 - ((headLines.length - 1) * headLineH) / 2;
  const headSvg = headLines
    .map(
      (ln, i) =>
        `<text x="${PAD}" y="${headTop + i * headLineH + (invite ? headSize : 68) * 0.75}" font-family="Space Mono" font-weight="700" font-size="${invite ? headSize : 68}" letter-spacing="1" fill="${CHALK}">${escapeXml(ln)}</text>`,
    )
    .join('');

  // Sub-line: member stack + count for a rostered invite, tagline otherwise.
  const stackCy = 430;
  const count = memberCount ?? members.length;
  let stackSvg = '';
  let subText;
  let subX = PAD;
  if (invite && members.length > 0) {
    const stack = memberStack(members, PAD, stackCy);
    stackSvg = stack.svg;
    subX = stack.endX + 22;
    subText = `${count} ${count === 1 ? 'person' : 'people'} in · split fair, settle easy`;
  } else if (invite) {
    subText = 'Split fair · settle easy · no sign-up';
  } else {
    subText = 'No accounts · no sign-ups · split it fair';
  }
  const subSvg = `<text x="${subX}" y="${stackCy + 8}" font-family="Space Mono" font-size="24" fill="${CHALKMUT}">${escapeXml(subText)}</text>`;

  // CTA pill + footnote along the bottom.
  const cta = invite ? 'Tap to join ›' : 'Open Slate ›';
  const ctaSize = 26;
  const ctaPadX = 26;
  const ctaH = 58;
  const ctaW = runWidth(cta, ctaSize) + ctaPadX * 2;
  const ctaY = CH - PAD - ctaH;
  const footnote = invite ? 'No account · no sign-up' : 'slate.mattrandell.com';
  const ctaSvg = `<g>
    <rect x="${PAD}" y="${ctaY}" width="${ctaW}" height="${ctaH}" rx="12" fill="${CHALK}"/>
    <text x="${PAD + ctaW / 2}" y="${ctaY + ctaH / 2 + ctaSize * 0.34}" text-anchor="middle" font-family="Space Mono" font-weight="700" font-size="${ctaSize}" fill="${INK}">${escapeXml(cta)}</text>
    <text x="${PAD + ctaW + 26}" y="${ctaY + ctaH / 2 + 8}" font-family="Space Mono" font-size="22" fill="${FAINT}">${escapeXml(footnote)}</text>
  </g>`;

  return `<svg width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="hi1" cx="84%" cy="-8%" r="62%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="hi2" cx="6%" cy="112%" r="58%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${CW}" height="${CH}" fill="${SLATE}"/>
  <rect width="${CW}" height="${CH}" fill="url(#hi1)"/>
  <rect width="${CW}" height="${CH}" fill="url(#hi2)"/>

  <!-- giant ghost wordmark initial, clipped to the bottom-right corner -->
  <text x="1216" y="812" text-anchor="end" font-family="Space Mono" font-weight="700" font-size="820" fill="${CHALK}" opacity="0.05">S</text>

  <!-- wordmark + invite badge -->
  <text x="${PAD}" y="${PAD + 34}" font-family="Space Mono" font-weight="700" font-size="46" letter-spacing="16" fill="${CHALK}">SLATE</text>
  ${badge(invite ? "YOU'RE INVITED" : 'SPLIT & SETTLE')}

  ${headSvg}
  ${stackSvg}
  ${subSvg}
  ${ctaSvg}
</svg>`;
}
