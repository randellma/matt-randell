// Regenerates the app's icon rasters from the inline SVGs below:
//   - public/icons/icon-192.png, -512.png  PWA / home-screen icons (maskable)
//   - public/favicon-32.png, -16.png       browser-tab favicons
// Both marks are chalk-on-slate: the "S" wordmark initial in Space Mono over
// the charcoal slate board. The home-screen icon adds the app's three-asterisk
// motif beneath the S; the favicon drops it (illegible at 16-32px) and just
// fills with the S.
// Run after changing the icon design: node scripts/build-icons.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fontDir = join(root, 'og', 'fonts');
const fontFiles = [join(fontDir, 'SpaceMono-Regular.ttf'), join(fontDir, 'SpaceMono-Bold.ttf')];

const SLATE = '#26292B'; // board
const SLATE2 = '#1D1F21'; // slightly darker, for depth
const CHALK = '#F2EEE2';
const CHALKMUT = '#B4B7AB';

// Full-bleed 512 canvas — declared "any maskable", so keep the mark inside the
// central safe zone and let the charcoal run to every edge.
const appIcon = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="board" cx="50%" cy="38%" r="75%">
      <stop offset="0%" stop-color="${SLATE}"/>
      <stop offset="100%" stop-color="${SLATE2}"/>
    </radialGradient>
    <!-- soft chalk halo behind the S (the design's text-shadow glow) -->
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%" color-interpolation-filters="sRGB">
      <feGaussianBlur stdDeviation="26"/>
    </filter>
  </defs>
  <rect width="512" height="512" fill="url(#board)"/>

  <!-- chalk "S" wordmark initial, the hero mark. Drawn twice: a blurred
       copy underneath for the glow, then the crisp letter on top. -->
  <text x="256" y="322" text-anchor="middle" font-family="Space Mono" font-weight="700"
        font-size="320" fill="${CHALK}" letter-spacing="0" opacity="0.4" filter="url(#glow)">S</text>
  <text x="256" y="322" text-anchor="middle" font-family="Space Mono" font-weight="700"
        font-size="320" fill="${CHALK}" letter-spacing="0">S</text>

  <!-- three-asterisk motif from the live app, in muted chalk. Spaced with
       space glyphs (not letter-spacing, whose trailing gap offsets the run)
       so the block stays centered on x=256, flush under the S. -->
  <text x="256" y="436" text-anchor="middle" font-family="Space Mono" font-weight="700"
        font-size="66" fill="${CHALKMUT}">* * *</text>
</svg>`;

// Favicon: same S-on-slate, but bigger and rule-less so it stays legible at
// tab size. A slight corner radius keeps the tiny tile from looking heavy.
const favicon = `<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <rect width="64" height="64" rx="12" fill="${SLATE}"/>
  <text x="32" y="47" text-anchor="middle" font-family="Space Mono" font-weight="700"
        font-size="52" fill="${CHALK}">S</text>
</svg>`;

function render(svg, size) {
  return new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Space Mono' },
  })
    .render()
    .asPng();
}

for (const size of [192, 512]) {
  writeFileSync(join(root, 'public', 'icons', `icon-${size}.png`), render(appIcon, size));
}
for (const size of [16, 32]) {
  writeFileSync(join(root, 'public', `favicon-${size}.png`), render(favicon, size));
}
console.log('wrote public/icons/icon-{192,512}.png and public/favicon-{16,32}.png');
