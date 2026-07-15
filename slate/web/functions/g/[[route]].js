// Cloudflare Pages Function for path-form share links (/g/:id/:t — or the
// token-less /g/:id that PIN-gated groups share).
//
// Messaging-app link crawlers don't run JS and never see a URL's #fragment,
// so hash routes can't carry a preview. Share links therefore use this real
// path: crawlers get the app shell with the og:* block rewritten to name the
// group, and browsers get the same shell — app.tsx normalizes the path back
// to the hash route before mounting.

const DEFAULT_PB_URL = 'https://api.heyslate.app';

// Bump when the card template (og/card.js) changes — it's folded into the
// og:image ?v= so a redesign busts the edge cache even when a group's name
// and roster are unchanged. Without it, template changes never reach crawlers.
const CARD_VERSION = '3';

const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

/** "Matt, Sarah & 2 others are splitting expenses" — capped so it reads well. */
function memberBlurb(names) {
  if (names.length === 0) return '';
  if (names.length === 1) return `${names[0]} is splitting expenses here. `;
  const shown = names.slice(0, 2);
  const rest = names.length - shown.length;
  const who = rest > 0
    ? `${shown.join(', ')} & ${rest} other${rest === 1 ? '' : 's'}`
    : shown.join(' & ');
  return `${who} are splitting expenses here. `;
}

async function fetchGroupPreview(pbUrl, id, t) {
  const signal = AbortSignal.timeout(3000);

  // Token-less link: a PIN-gated group. The security route reveals just the
  // name and photo (never the member list — that stays behind the PIN).
  if (!t) {
    const res = await fetch(`${pbUrl}/api/divvy/groups/${encodeURIComponent(id)}/security`, { signal });
    if (!res.ok) return null;
    const info = await res.json();
    if (!info.pin) return null;
    return { name: info.name, photo: info.photo, memberNames: [], pin: true };
  }

  const query = `t=${encodeURIComponent(t)}`;
  const [groupRes, membersRes] = await Promise.all([
    fetch(`${pbUrl}/api/collections/groups/records/${encodeURIComponent(id)}?${query}`, { signal }),
    fetch(
      `${pbUrl}/api/collections/members/records?filter=${encodeURIComponent(`group='${id}'`)}&sort=created&perPage=50&${query}`,
      { signal },
    ),
  ]);
  if (!groupRes.ok) return null;
  const group = await groupRes.json();
  const members = membersRes.ok ? (await membersRes.json()).items ?? [] : [];
  return { name: group.name, photo: group.photo, memberNames: members.map((m) => m.name), pin: false };
}

/** Cache-buster for the dynamic card: changes when the template, name, or
    roster does. */
async function cardVersion(preview) {
  const bytes = new TextEncoder().encode(`${CARD_VERSION}|${preview.name}|${preview.memberNames.join(',')}`);
  const digest = await crypto.subtle.digest('SHA-1', bytes);
  return [...new Uint8Array(digest).slice(0, 6)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function onRequestGet({ request, env, params }) {
  const shell = await env.ASSETS.fetch(new URL('/', request.url));
  const [id, t] = params.route ?? [];
  if (!id) return shell;

  let preview = null;
  try {
    preview = await fetchGroupPreview(env.PB_URL || DEFAULT_PB_URL, id, t);
  } catch (e) {
    // PocketBase down or slow — fall back to the generic card.
    console.error('group preview fetch failed:', e);
  }
  if (!preview) return shell;

  const title = `Join “${preview.name}” on Slate`;
  const description = preview.pin
    ? 'Tap to open — you’ll need the group PIN to join. No app, no sign-up.'
    : memberBlurb(preview.memberNames) +
      'Tap to see the group and add your expenses — no app, no sign-up.';
  // Every group gets a hero card named for it (rendered by
  // functions/og/g/[[route]].js); the ?v= content hash lets a good render be
  // cached hard, and any render failure there falls back to the static card.
  const ogPath = t
    ? `/og/g/${encodeURIComponent(id)}/${encodeURIComponent(t)}/card.png`
    : `/og/g/${encodeURIComponent(id)}/card.png`;
  const image = new URL(`${ogPath}?v=${await cardVersion(preview)}`, request.url).href;
  const og = `
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Slate" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(new URL(request.url).origin + (t ? `/g/${id}/${t}` : `/g/${id}`))}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  `;

  const html = (await shell.text())
    .replace(/<!-- og:start[\s\S]*?<!-- og:end -->/, og.trim())
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`);

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Group name/members change; don't let crawlers pin a stale card forever.
      'cache-control': 'public, max-age=300',
    },
  });
}
