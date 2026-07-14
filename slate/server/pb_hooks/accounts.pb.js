/// <reference path="../pb_data/types.d.ts" />

// Optional accounts + scan credits (docs/adr/0004-scan-credits-optional-accounts.md).
//
// Groups never require an account (ADR-0001); these routes exist only so scan
// credits have somewhere to live. Sign-in is a 6-digit emailed code — the
// only writer of users' auth state, same posture as the group PIN routes.
//
// Env (all shared with the existing hooks):
//   RESEND_API_KEY        — required for sign-in code emails
//   DIVVY_EMAIL_FROM      — sender, default "Slate <slate@mattrandell.com>"
//   DIVVY_RESEND_API_BASE — default "https://api.resend.com" (test override)

// Ask for a sign-in code. Creates the account on first contact — an
// unverified user record is just a mailbox for the code.
routerAdd('POST', '/api/divvy/auth/request-code', (e) => {
  const utils = require(`${__hooks}/accounts_utils.js`);
  const sec = require(`${__hooks}/group_security_utils.js`);

  const email = String((e.requestInfo().body || {}).email || '').trim().toLowerCase();
  if (!sec.validEmail(email)) {
    return e.json(400, { code: 'bad_email', message: 'That does not look like an email address.' });
  }

  let user;
  try {
    user = e.app.findAuthRecordByEmail('users', email);
  } catch {
    user = new Record(e.app.findCollectionByNameOrId('users'));
    user.set('email', email);
    // Password auth is disabled; this is just PocketBase's required minimum.
    user.set('password', $security.randomString(30));
  }

  const now = utils.now();
  const wait = utils.OTP_COOLDOWN_S - (now - user.getInt('otp_sent_at'));
  if (wait > 0) {
    return e.json(429, { code: 'cooldown', retry_in: wait, message: 'A code was just sent — check your inbox.' });
  }

  const code = utils.randomOtp();
  const salt = $security.randomString(16);
  user.set('otp_salt', salt);
  user.set('otp_hash', utils.hashOtp(salt, code));
  user.set('otp_attempts', 0);
  user.set('otp_expires', now + utils.OTP_TTL_S);
  user.set('otp_sent_at', now);
  e.app.save(user);

  // After saving, so a failed send still burns the old code but the cooldown
  // stays honest about when mail actually went out.
  utils.sendEmail(email, 'Your Slate sign-in code', utils.otpEmailHtml(code));
  return e.json(200, { sent: true });
});

// Trade a correct code for an auth token. First verified sign-in comes with
// the welcome credits.
routerAdd('POST', '/api/divvy/auth/verify', (e) => {
  const utils = require(`${__hooks}/accounts_utils.js`);
  const sec = require(`${__hooks}/group_security_utils.js`);

  const body = e.requestInfo().body || {};
  const email = String(body.email || '').trim().toLowerCase();
  const code = String(body.code || '').trim();

  let user;
  try {
    user = e.app.findAuthRecordByEmail('users', email);
  } catch {
    return e.json(400, { code: 'wrong_code', message: 'Wrong or expired code.' });
  }

  const now = utils.now();
  const stale =
    user.getString('otp_hash') === '' ||
    now > user.getInt('otp_expires') ||
    user.getInt('otp_attempts') >= utils.OTP_MAX_ATTEMPTS;
  if (stale || !/^\d{6}$/.test(code) || utils.hashOtp(user.getString('otp_salt'), code) !== user.getString('otp_hash')) {
    if (!stale) {
      user.set('otp_attempts', user.getInt('otp_attempts') + 1);
      e.app.save(user);
    }
    return e.json(400, { code: 'wrong_code', message: 'Wrong or expired code — request a new one.' });
  }

  user.set('otp_hash', '');
  user.set('otp_salt', '');
  user.set('verified', true);
  e.app.save(user);

  if (!user.getBool('welcomed')) {
    user.set('welcomed', true);
    utils.addCredits(e.app, user, utils.WELCOME_CREDITS, 'welcome');
  }

  return e.json(200, {
    token: user.newAuthToken(),
    user: {
      id: user.id,
      email: user.getString('email'),
      name: user.getString('name'),
      credits: user.getInt('credits'),
    },
  });
});

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
