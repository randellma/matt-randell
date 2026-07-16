/// <reference path="../pb_data/types.d.ts" />

// Optional accounts + scan credits (docs/adr/0004-scan-credits-optional-accounts.md).
//
// Groups never require an account (ADR-0001); accounts exist only so scan
// credits have somewhere to live. Sign-in is PocketBase-native: a 6-digit
// emailed code (requestOTP/authWithOTP) or, when configured, Google OAuth2 —
// never a password (ADR-0005). The hooks below bend the native flows to the
// old posture: auto-create on first contact, delivery via Resend, a resend
// cooldown, a per-code attempt cap, and the one-time welcome grant.
//
// Env (all shared with the existing hooks):
//   RESEND_API_KEY             — required for sign-in code emails
//   DIVVY_EMAIL_FROM           — sender, default "Slate <hello@heyslate.app>"
//   DIVVY_RESEND_API_BASE      — default "https://api.resend.com" (test override)
//   DIVVY_GOOGLE_CLIENT_ID     — Google OAuth client; sign-in shows Google
//   DIVVY_GOOGLE_CLIENT_SECRET — only when both are set

// ── Sign-in: emailed code (native OTP) ────────────────────────────────────

// Auto-create on first contact. Native requestOTP silently no-ops for
// unknown emails (enumeration protection); Slate has no separate sign-up, so
// an unverified user record is just a mailbox for the code — create it and
// let the flow continue.
onRecordRequestOTPRequest((e) => {
  const utils = require(`${__hooks}/accounts_utils.js`);

  if (!e.record) {
    // The endpoint already rejected malformed emails; mirror the old routes'
    // normalization so Foo@Bar.com and foo@bar.com stay one account.
    const email = String((e.requestInfo().body || {}).email || '').trim().toLowerCase();
    const user = new Record(e.app.findCollectionByNameOrId('users'));
    user.set('email', email);
    // Password auth is disabled; this is just PocketBase's required minimum.
    user.set('password', $security.randomString(30));
    e.app.save(user);
    e.record = user;
  }

  // Same resend posture as before: one code a minute, and a new code burns
  // every earlier one — exactly one live code per account.
  const now = Math.floor(Date.now() / 1000);
  for (const otp of e.app.findAllOTPsByRecord(e.record)) {
    if (now - otp.getDateTime('created').unix() < utils.OTP_COOLDOWN_S) {
      throw new ApiError(429, 'A code was just sent — check your inbox.', {});
    }
  }
  e.app.deleteAllOTPsByRecord(e.record);

  e.next();
}, 'users');

// Deliver the code through Resend, keeping the current email look. Not
// calling e.next() skips PocketBase's SMTP mailer entirely — but the default
// send is also what stamps the OTP's sentTo (which native auth-with-otp
// checks before flipping `verified`), so stamp it here ourselves. Native
// sends run fire-and-forget, so a Resend failure logs instead of surfacing.
onMailerRecordOTPSend((e) => {
  const utils = require(`${__hooks}/accounts_utils.js`);
  const email = e.record.email();
  utils.sendEmail(email, 'Your Slate sign-in code', utils.otpEmailHtml(e.meta.password));
  const otp = e.app.findOTPById(e.meta.otpId);
  otp.setSentTo(email);
  e.app.save(otp);
}, 'users');

// Cap wrong guesses per code. Natively the cap is per IP (5 per 3 minutes);
// the old flow burned the code after 5 wrong tries total, so keep that:
// count failures per otpId and delete the OTP at the limit. Counters live in
// the in-memory app store — a restart forgives, the 10-minute expiry doesn't.
routerUse((e) => {
  // Match by id too — /api/collections/{name-or-ID}/auth-with-otp both work,
  // and a guesser must not sidestep the cap by switching to the id form.
  if (e.request.method !== 'POST' || !/^\/api\/collections\/[^/]+\/auth-with-otp$/.test(e.request.url.path)) {
    return e.next();
  }
  const utils = require(`${__hooks}/accounts_utils.js`);

  const otpId = String((e.requestInfo().body || {}).otpId || '');
  const key = 'otp_fails_' + otpId;
  if (otpId && (e.app.store().get(key) || 0) >= utils.OTP_MAX_ATTEMPTS) {
    try {
      e.app.delete(e.app.findOTPById(otpId));
    } catch {
      /* already gone */
    }
    e.app.store().remove(key);
    throw new BadRequestError('Wrong or expired code — request a new one.');
  }
  try {
    e.next();
    e.app.store().remove(key); // success consumed the code
  } catch (err) {
    if (otpId) e.app.store().set(key, (e.app.store().get(key) || 0) + 1);
    throw err;
  }
});

// First verified sign-in comes with the welcome credits — exactly once, on
// any method (emailed code or Google; both flip `verified` before this event
// fires). Also fires on token refreshes, hence the `welcomed` latch. Granting
// before e.next() puts the fresh balance in the sign-in response itself.
onRecordAuthRequest((e) => {
  const utils = require(`${__hooks}/accounts_utils.js`);
  const user = e.record;
  if (user && user.getBool('verified') && !user.getBool('welcomed')) {
    user.set('welcomed', true);
    utils.addCredits(e.app, user, utils.WELCOME_CREDITS, 'welcome');
  }
  e.next();
}, 'users');

// ── Sign-in: Google (native OAuth2, ADR-0005) ─────────────────────────────

// The provider is wired entirely from env so the feature ships before the
// Google client exists: with both vars set, Google appears in
// listAuthMethods and the PWA shows the button; without them, sign-in stays
// email-code only. Register <api-host>/api/oauth2-redirect as the OAuth
// client's redirect URI (see slate/README.md).
onBootstrap((e) => {
  e.next();
  const clientId = $os.getenv('DIVVY_GOOGLE_CLIENT_ID') || '';
  const clientSecret = $os.getenv('DIVVY_GOOGLE_CLIENT_SECRET') || '';
  const enabled = clientId !== '' && clientSecret !== '';
  const users = e.app.findCollectionByNameOrId('users');
  users.oauth2.enabled = enabled;
  users.oauth2.providers = enabled ? [{ name: 'google', clientId, clientSecret }] : [];
  // On sign-up PocketBase imports the Google profile into these itself; the
  // auth hook below covers accounts that predate their first Google sign-in.
  users.oauth2.mappedFields = { id: '', name: 'name', username: '', avatarURL: 'avatar' };
  e.app.save(users);
});

// Fill profile blanks from the Google profile — name and photo — never
// overwriting what the user already set. Matters for accounts that signed in
// by code first: OAuth2 lands on them by verified email, skipping the
// sign-up path where mappedFields would have imported the profile.
onRecordAuthWithOAuth2Request((e) => {
  e.next();
  const user = e.record;
  const oa = e.oAuth2User;
  if (!user || !oa) return;
  let changed = false;
  if (user.getString('name') === '' && oa.name !== '') {
    user.set('name', oa.name);
    changed = true;
  }
  if (user.getString('avatar') === '' && oa.avatarURL !== '') {
    try {
      user.set('avatar', $filesystem.fileFromURL(oa.avatarURL));
      changed = true;
    } catch (err) {
      e.app.logger().warn('Failed to import the Google avatar', 'error', String(err));
    }
  }
  if (changed) e.app.save(user);
}, 'users');

// What a scan in this group would cost and whose balance it would charge —
// the expense form renders its scan card straight from this. Token-gated
// like everything else in a group; auth is optional and changes the answer.
routerAdd('GET', '/api/divvy/groups/{id}/scan-allowance', (e) => {
  const utils = require(`${__hooks}/accounts_utils.js`);

  let group;
  try {
    group = e.app.findRecordById('groups', e.request.pathValue('id'));
  } catch {
    return e.json(404, { message: 'Group not found.' });
  }
  if ((e.requestInfo().query['t'] || '') !== group.getString('t')) {
    return e.json(403, { message: 'Invalid group token.' });
  }

  const me = e.auth && e.auth.collection().name === 'users' ? e.auth : null;
  const src = utils.resolveScanSource(e.app, me, group.id);
  return e.json(200, {
    signed_in: me !== null,
    self_credits: me ? me.getInt('credits') : 0,
    source: src.source,
    sponsor_name: src.source === 'sponsor' ? utils.displayName(src.user) : '',
    // Everyone covering this group, for the settings screen.
    sponsors: utils.listSponsors(e.app, group.id).map((u) => ({
      user: u.id,
      name: utils.displayName(u),
      credits: u.getInt('credits'),
    })),
  });
});

// Buy a pack. Beta: no payment provider yet, so the purchase is recorded and
// granted on the spot — the row's status/provider fields are where a real
// checkout (pending → paid webhook → granted) will slot in later.
routerAdd('POST', '/api/divvy/credits/purchase', (e) => {
  const utils = require(`${__hooks}/accounts_utils.js`);

  const me = e.auth && e.auth.collection().name === 'users' ? e.auth : null;
  if (!me) {
    return e.json(401, { code: 'signin_required', message: 'Sign in to get scans.' });
  }
  const packId = String((e.requestInfo().body || {}).pack || '');
  const pack = utils.PACKS[packId];
  if (!pack) {
    return e.json(400, { code: 'bad_pack', message: 'Unknown pack.' });
  }

  const purchase = new Record(e.app.findCollectionByNameOrId('purchases'));
  purchase.set('user', me.id);
  purchase.set('pack', packId);
  purchase.set('credits', pack.credits);
  purchase.set('price_cents', pack.price_cents);
  purchase.set('status', 'granted');
  purchase.set('provider', 'beta');
  e.app.save(purchase);

  utils.addCredits(e.app, me, pack.credits, 'purchase', { purchase: purchase.id });

  return e.json(200, { granted: pack.credits, credits: me.getInt('credits') });
});

// ── Your groups: derived from claims (ADR-0005) ───────────────────────────

// The groups that follow a signed-in account across devices — every group
// where it holds a claim (members.user). Derived, never stored: a released
// claim or a removed member drops out by construction, so the list can't
// drift. Revealing the token to a claimant is safe — they necessarily held
// it to claim, PIN-gated groups included.
routerAdd('GET', '/api/divvy/account/groups', (e) => {
  const me = e.auth && e.auth.collection().name === 'users' ? e.auth : null;
  if (!me) {
    return e.json(401, { code: 'signin_required', message: 'Sign in to see your groups.' });
  }

  const claims = e.app.findRecordsByFilter(
    'members',
    'user = {:me} && removed = false',
    '-created',
    0,
    0,
    { me: me.id },
  );
  const groups = [];
  for (const m of claims) {
    try {
      const g = e.app.findRecordById('groups', m.getString('group'));
      groups.push({ id: g.id, name: g.getString('name'), t: g.getString('t') });
    } catch {
      /* group gone under a dangling claim — nothing to follow */
    }
  }
  return e.json(200, { groups });
});
