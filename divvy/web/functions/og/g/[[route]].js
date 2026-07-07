// Renders the per-group link-preview image (/og/g/:id/:t/card.png): the
// receipt card from og/card.js with the group's avatar composited in as a
// polaroid, rasterized with resvg's wasm build. functions/g/[[route]].js
// points og:image here when the group has a photo; any failure falls back to
// the static branded card so a crawler always gets an image.

import { Resvg, initWasm } from '@resvg/resvg-wasm';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import { buildCardSvg } from '../../../og/card.js';
import { fontBuffers } from '../../../og/fonts.js';

const DEFAULT_PB_URL = 'https://divvy-api.mattrandell.com';

// initWasm rejects a second call, so kick it off once per isolate.
const wasmReady = initWasm(resvgWasm);

function toBase64(bytes) {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

async function renderCard(pbUrl, id, t) {
  const signal = AbortSignal.timeout(4000);
  const groupRes = await fetch(
    `${pbUrl}/api/collections/groups/records/${encodeURIComponent(id)}?t=${encodeURIComponent(t)}`,
    { signal },
  );
  if (!groupRes.ok) return null;
  const group = await groupRes.json();
  if (!group.photo) return null;

  const photoRes = await fetch(
    `${pbUrl}/api/files/groups/${encodeURIComponent(id)}/${encodeURIComponent(group.photo)}`,
    { signal },
  );
  if (!photoRes.ok) return null;
  const mime = photoRes.headers.get('content-type') || 'image/jpeg';
  const dataUri = `data:${mime};base64,${toBase64(new Uint8Array(await photoRes.arrayBuffer()))}`;

  await wasmReady;
  const resvg = new Resvg(buildCardSvg({ photo: { dataUri, caption: group.name } }), {
    fitTo: { mode: 'width', value: 1200 },
    font: { fontBuffers, loadSystemFonts: false, defaultFontFamily: 'Space Mono' },
  });
  return resvg.render().asPng();
}

export async function onRequestGet({ request, env, params, waitUntil }) {
  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) return cached;

  const [id, t] = params.route ?? [];
  let png = null;
  if (id && t) {
    try {
      png = await renderCard(env.PB_URL || DEFAULT_PB_URL, id, t);
    } catch (e) {
      console.error('og card render failed:', e);
    }
  }

  // The URL carries a ?v= content hash, so successful renders can be cached
  // hard; failures serve the static card without caching, to retry next crawl.
  if (!png) return env.ASSETS.fetch(new URL('/og-card.png', request.url));

  const response = new Response(png, {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=86400',
    },
  });
  waitUntil(cache.put(request, response.clone()));
  return response;
}
