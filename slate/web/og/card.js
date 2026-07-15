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

/** A pill-shaped label with a rule border — the "You're invited" badge. Sized
    to ~60% of the wordmark, matching the design's 9px-badge / 15px-wordmark ratio. */
function badge(label, size = 28, ls = 5) {
  const padX = 24;
  const h = 56;
  const w = runWidth(label, size, ls) + padX * 2;
  const x = CW - PAD - w;
  const y = PAD - 4;
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="none" stroke="${EMERALD_LINE}" stroke-width="4"/>
    <text x="${x + w / 2 + ls / 2}" y="${y + h / 2 + size * 0.34}" text-anchor="middle" font-family="Space Mono" font-weight="700" font-size="${size}" letter-spacing="${ls}" fill="${EMERALD}">${escapeXml(label)}</text>
  </g>`;
}

/** Overlapping row of member avatar tiles, capped with a +N overflow tile. */
function memberStack(members, x, cy) {
  const tile = 76;
  const step = 54; // overlap
  const rx = 18;
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
    const fs = c.label.length > 1 ? 26 : 36;
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
  // Anchored high, right under the wordmark row — the hero of the card.
  const HEAD_MAX = 98;
  let headline = invite ? name.trim() : 'Split expenses\nwithout the fuss';
  let headSize = invite ? HEAD_MAX : 76;
  if (invite) {
    const maxW = CW - PAD * 2;
    headSize = Math.min(HEAD_MAX, Math.floor(maxW / (headline.length * ADV)));
    if (headSize < 46) {
      const fit = Math.max(1, Math.floor(maxW / (46 * ADV)) - 1);
      headline = [...headline].slice(0, fit).join('').trimEnd() + '…';
      headSize = 46;
    }
  }
  const headLines = headline.split('\n');
  const headLineH = headSize * 1.08;
  const headBaseline = invite ? 236 : 208;
  const headSvg = headLines
    .map(
      (ln, i) =>
        `<text x="${PAD}" y="${headBaseline + i * headLineH}" font-family="Space Mono" font-weight="700" font-size="${headSize}" fill="${CHALK}">${escapeXml(ln)}</text>`,
    )
    .join('');

  // Sub-line: member stack + count for a rostered invite, tagline otherwise.
  const stackCy = 356;
  const count = memberCount ?? members.length;
  let stackSvg = '';
  let subText;
  let subX = PAD;
  if (invite && members.length > 0) {
    const stack = memberStack(members, PAD, stackCy);
    stackSvg = stack.svg;
    subX = stack.endX + 26;
    subText = `${count} ${count === 1 ? 'person' : 'people'} in · split fair, settle easy`;
  } else if (invite) {
    subText = 'Split fair · settle easy · no sign-up';
  } else {
    subText = 'No accounts · no sign-ups · split it fair';
  }
  const subSvg = `<text x="${subX}" y="${stackCy + 10}" font-family="Space Mono" font-size="30" fill="${CHALKMUT}">${escapeXml(subText)}</text>`;

  // CTA button + footnote along the bottom — the button is the loud element.
  const cta = invite ? 'TAP TO JOIN ›' : 'OPEN SLATE ›';
  const ctaSize = 38;
  const ctaPadX = 42;
  const ctaH = 96;
  const ctaW = runWidth(cta, ctaSize) + ctaPadX * 2;
  const ctaY = 452;
  const footnote = invite ? 'No account · no sign-up' : 'heyslate.app';
  const ctaSvg = `<g>
    <rect x="${PAD}" y="${ctaY}" width="${ctaW}" height="${ctaH}" rx="18" fill="${CHALK}"/>
    <text x="${PAD + ctaW / 2}" y="${ctaY + ctaH / 2 + ctaSize * 0.34}" text-anchor="middle" font-family="Space Mono" font-weight="700" font-size="${ctaSize}" fill="${INK}">${escapeXml(cta)}</text>
    <text x="${PAD + ctaW + 32}" y="${ctaY + ctaH / 2 + 11}" font-family="Space Mono" font-size="32" fill="${FAINT}">${escapeXml(footnote)}</text>
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
