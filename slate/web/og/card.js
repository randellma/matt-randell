// The Divvy link-preview card (1200×630) as an SVG string, in the app's
// receipt theme. Shared by scripts/build-og-assets.mjs (renders the static
// public/og-card.png with @resvg/resvg-js) and functions/og/g/[[route]].js
// (renders per-group cards with @resvg/resvg-wasm), so keep it runtime-neutral.

const INK = '#20261F';
const PAPER = '#FAF7EF';
const PAPER2 = '#F2EEE1';
const FAINT = '#9A9683';
const LINE = '#CDC8B4';
const ACCENT = '#0B7A4E';

// receipt slip geometry (local coords)
const SW = 470; // slip width
const SH = 588; // slip height
const ZIG = 10; // zigzag tooth height
const TOOTH = 23.5; // tooth width (SW / 20)

const escapeXml = (s) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

function zigzagTop() {
  let d = `M0 ${ZIG}`;
  for (let i = 0; i < SW / TOOTH; i++) {
    d += ` l${TOOTH / 2} ${-ZIG} l${TOOTH / 2} ${ZIG}`;
  }
  return d;
}
function zigzagBottom() {
  let d = `L${SW} ${SH - ZIG}`;
  for (let i = 0; i < SW / TOOTH; i++) {
    d += ` l${-TOOTH / 2} ${ZIG} l${-TOOTH / 2} ${-ZIG}`;
  }
  return d + ' Z';
}
const slipPath = `${zigzagTop()} L${SW} ${ZIG} ${zigzagBottom()}`;

function barcode() {
  const bars = [];
  let bx = 85;
  const seq = [3, 1, 2, 1, 4, 2, 1, 3, 1, 1, 2, 4, 1, 2, 3, 1, 1, 2, 1, 3, 2, 1, 4, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 4, 1, 2, 1, 1, 3, 2];
  for (const w of seq) {
    bars.push(`<rect x="${bx}" y="0" width="${w * 2}" height="42" fill="${INK}"/>`);
    bx += w * 2 + 4;
  }
  return bars.join('');
}

const dashed = (y) =>
  `<line x1="40" y1="${y}" x2="${SW - 40}" y2="${y}" stroke="${LINE}" stroke-width="2" stroke-dasharray="7 6"/>`;

const item = (y, text) =>
  `<text x="45" y="${y}" font-family="Space Mono" font-size="22" fill="${INK}" xml:space="preserve">${text}</text>`;

function slip(cx) {
  return `<g transform="translate(${cx} 316) rotate(-2) translate(${-SW / 2} ${-SH / 2})">
    <path d="${slipPath}" transform="translate(7 9)" fill="${INK}" opacity="0.13"/>
    <path d="${slipPath}" fill="${PAPER}"/>

    <text x="${SW / 2}" y="86" text-anchor="middle" font-family="Space Mono" font-weight="700" font-size="48" fill="${INK}" letter-spacing="14">DIVVY</text>
    <text x="${SW / 2}" y="121" text-anchor="middle" font-family="Space Mono" font-size="16" fill="${FAINT}" letter-spacing="2">* * * EXPENSE GROUP * * *</text>

    ${dashed(152)}

    ${item(199, 'SPLIT BILLS ....... FAIR')}
    ${item(243, 'SETTLE UP ......... EASY')}
    ${item(287, 'SIGN-UP ........... NONE')}
    ${item(331, 'PRICE ............ $0.00')}

    ${dashed(366)}

    <text x="45" y="415" font-family="Space Mono" font-weight="700" font-size="27" fill="${INK}">TOTAL</text>
    <text x="${SW - 45}" y="415" text-anchor="end" font-family="Space Mono" font-weight="700" font-size="27" fill="${ACCENT}">TAP TO JOIN</text>

    ${dashed(446)}

    <g transform="translate(0 472)">${barcode()}</g>
    <text x="${SW / 2}" y="551" text-anchor="middle" font-family="Space Mono" font-size="15" fill="${FAINT}" letter-spacing="3">DIVVY.MATTRANDELL.COM</text>
  </g>`;
}

const stamp = (transform) => `<g transform="${transform}" opacity="0.92">
    <rect x="-160" y="-40" width="320" height="80" rx="12" fill="none" stroke="${ACCENT}" stroke-width="4"/>
    <rect x="-152" y="-32" width="304" height="64" rx="8" fill="none" stroke="${ACCENT}" stroke-width="2"/>
    <text x="0" y="10" text-anchor="middle" font-family="Space Mono" font-weight="700" font-size="29" fill="${ACCENT}" letter-spacing="2">YOU'RE INVITED</text>
  </g>`;

/** Group photo as a tilted polaroid print next to the slip. */
function polaroid(dataUri, caption) {
  const shown = [...caption].length > 20 ? [...caption].slice(0, 19).join('') + '…' : caption;
  return `<g transform="translate(855 320) rotate(5)">
    <rect x="-163" y="-192" width="340" height="396" transform="translate(6 9)" fill="${INK}" opacity="0.13"/>
    <rect x="-170" y="-198" width="340" height="396" fill="#FFFEFA"/>
    <image href="${dataUri}" x="-150" y="-178" width="300" height="300" preserveAspectRatio="xMidYMid slice"/>
    <rect x="-150" y="-178" width="300" height="300" fill="none" stroke="${LINE}" stroke-width="1"/>
    <text x="0" y="170" text-anchor="middle" font-family="Space Mono" font-size="22" fill="${INK}">${escapeXml(shown)}</text>
  </g>`;
}

/**
 * @param {{ photo?: { dataUri: string, caption: string } }} [opts]
 *   photo — group avatar as a data URI plus the group name for the caption;
 *   omitted, the card is the generic branded one.
 */
export function buildCardSvg(opts = {}) {
  const { photo } = opts;
  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="${PAPER2}"/>

  <!-- faint oversized wordmark behind everything -->
  <text x="70" y="560" font-family="Space Mono" font-weight="700" font-size="230" fill="${LINE}" opacity="0.35" letter-spacing="6">DI</text>
  ${photo ? '' : `<text x="905" y="250" font-family="Space Mono" font-weight="700" font-size="230" fill="${LINE}" opacity="0.35" letter-spacing="6">VY</text>`}

  ${slip(photo ? 430 : 600)}
  ${photo ? polaroid(photo.dataUri, photo.caption) : ''}
  ${photo ? stamp('translate(742 96) rotate(-5)') : stamp('translate(878 130) rotate(7)')}
</svg>`;
}
