// Renders the per-group link-preview image (/og/g/:id/:t/card.png — or
// /og/g/:id/card.png for PIN-gated groups, whose links carry no token): the
// slate hero card from og/card.js, named for the group with its member roster
// as an avatar stack, rasterized with resvg's wasm build. functions/g/[[route]].js
// points og:image here for every group; any failure falls back to the static
// branded card so a crawler always gets an image.

import { Resvg, initWasm } from '@resvg/resvg-wasm';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import { buildCardSvg } from '../../../og/card.js';
import { fontBuffers } from '../../../og/fonts.js';

const DEFAULT_PB_URL = 'https://divvy-api.mattrandell.com';

// initWasm rejects a second call, so kick it off once per isolate.
const wasmReady = initWasm(resvgWasm);

async function renderCard(pbUrl, id, t) {
  const signal = AbortSignal.timeout(4000);

  let name;
  let members = [];
  if (t) {
    // Token link: read the record and roster like the app does — the roster
    // drives the avatar stack (ids fix each tile's color, names its initial).
    const [groupRes, membersRes] = await Promise.all([
      fetch(`${pbUrl}/api/collections/groups/records/${encodeURIComponent(id)}?t=${encodeURIComponent(t)}`, { signal }),
      fetch(
        `${pbUrl}/api/collections/members/records?filter=${encodeURIComponent(`group='${id}'`)}&sort=created&perPage=50&t=${encodeURIComponent(t)}`,
        { signal },
      ),
    ]);
    if (!groupRes.ok) return null;
    name = (await groupRes.json()).name;
    const items = membersRes.ok ? ((await membersRes.json()).items ?? []) : [];
    members = items.map((m) => ({ id: m.id, name: m.name }));
  } else {
    // Token-less link: a PIN-gated group. The security route reveals just the
    // name (never the roster — that stays behind the PIN), so the card names
    // the group without an avatar stack.
    const secRes = await fetch(`${pbUrl}/api/divvy/groups/${encodeURIComponent(id)}/security`, { signal });
    if (!secRes.ok) return null;
    const info = await secRes.json();
    if (!info.pin) return null;
    name = info.name;
  }
  if (!name) return null;

  await wasmReady;
  const resvg = new Resvg(buildCardSvg({ name, members }), {
    fitTo: { mode: 'width', value: 1200 },
    font: { fontBuffers, loadSystemFonts: false, defaultFontFamily: 'Space Mono' },
  });
  return resvg.render().asPng();
}

export async function onRequestGet({ request, env, params, waitUntil }) {
  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) return cached;

  // Route tail is [id, t, 'card.png'] or, token-less, [id, 'card.png'].
  const parts = params.route ?? [];
  const id = parts[0];
  const t = parts.length >= 3 ? parts[1] : null;
  let png = null;
  if (id) {
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
