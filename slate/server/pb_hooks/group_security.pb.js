/// <reference path="../pb_data/types.d.ts" />

// Optional group PIN + recovery email (docs/adr/0003-optional-group-pin.md).
//
// With a PIN on, the share link carries only the group id; these routes trade
// a correct PIN for the group token, lock joining after too many wrong tries,
// and email a recovery link when the PIN is forgotten or joining is locked.
// The PIN fields themselves are hidden and rule-guarded (see migration
// 1751600008), so this file is the only writer.
//
// Env:
//   RESEND_API_KEY   — required for recovery emails (https://resend.com)
//   DIVVY_EMAIL_FROM — sender, default "Slate <slate@mattrandell.com>";
//                      the domain must be verified in Resend. (Env var keeps
//                      the DIVVY_ prefix from the old brand — see README.)
//   DIVVY_APP_URL    — PWA origin used in emailed links,
//                      default "https://slate.mattrandell.com"
//   DIVVY_RESEND_API_BASE — default "https://api.resend.com" (overridable
//                      for tests, same pattern as DIVVY_OCR_API_BASE)

// What the join screen needs before it holds any credential: whether the
// group takes a PIN, what it's called, and whether recovery is possible.
// Name/photo are only revealed for PIN groups (or with a valid token) — for
// token-only groups the link itself stays the sole way to learn anything.
routerAdd('GET', '/api/divvy/groups/{id}/security', (e) => {
  const utils = require(`${__hooks}/group_security_utils.js`);

  let group;
  try {
    group = e.app.findRecordById('groups', e.request.pathValue('id'));
  } catch {
    return e.json(404, { message: 'Group not found.' });
  }

  const pinOn = group.getString('pin_hash') !== '';
  const t = e.requestInfo().query['t'] || '';
  const authed = t !== '' && t === group.getString('t');
  if (!pinOn && !authed) return e.json(200, { pin: false });

  const info = {
    pin: pinOn,
    locked: pinOn && utils.isLocked(group),
    name: group.getString('name'),
    photo: group.getString('photo'),
    has_recovery: group.getString('recovery_email') !== '',
  };
  if (authed) {
    info.recovery_email = group.getString('recovery_email');
    info.attempts = group.getInt('pin_attempts');
  }
  return e.json(200, info);
});

// Trade a PIN for the group token. Consecutive wrong tries are counted on the
// group; at MAX_ATTEMPTS joining locks until someone inside unlocks or changes
// the PIN (or a recovery link gets them in to do so).
routerAdd('POST', '/api/divvy/groups/{id}/join', (e) => {
  const utils = require(`${__hooks}/group_security_utils.js`);

  let group;
  try {
    group = e.app.findRecordById('groups', e.request.pathValue('id'));
  } catch {
    return e.json(404, { message: 'Group not found.' });
  }
  if (group.getString('pin_hash') === '') {
    return e.json(400, { code: 'no_pin', message: 'This group does not use a PIN — open its full share link instead.' });
  }
  if (utils.isLocked(group)) {
    return e.json(423, { code: 'locked', message: 'Joining is locked after too many wrong PINs.' });
  }

  const pin = e.requestInfo().body.pin;
  if (!utils.validPin(pin) || utils.hashPin(group.getString('pin_salt'), pin) !== group.getString('pin_hash')) {
    const attempts = group.getInt('pin_attempts') + 1;
    group.set('pin_attempts', attempts);
    e.app.save(group);
    if (attempts >= utils.MAX_ATTEMPTS) {
      return e.json(423, { code: 'locked', message: 'Joining is locked after too many wrong PINs.' });
    }
    return e.json(400, {
      code: 'wrong_pin',
      attempts_left: utils.MAX_ATTEMPTS - attempts,
      message: 'Wrong PIN.',
    });
  }

  group.set('pin_attempts', 0);
  e.app.save(group);
  return e.json(200, { t: group.getString('t'), name: group.getString('name') });
});

// Manage PIN and recovery email — token holders only (same trust model as
// every other mutation: no roles, anyone in the group may change these).
// Body: any of { pin, disable_pin, recovery_email, unlock }.
// Turning the PIN on rotates the token so previously shared full links stop
// granting access; the response always carries the current token.
routerAdd('POST', '/api/divvy/groups/{id}/security', (e) => {
  const utils = require(`${__hooks}/group_security_utils.js`);

  let group;
  try {
    group = e.app.findRecordById('groups', e.request.pathValue('id'));
  } catch {
    return e.json(404, { message: 'Group not found.' });
  }
  const info = e.requestInfo();
  if ((info.query['t'] || '') !== group.getString('t')) {
    return e.json(403, { message: 'Invalid group token.' });
  }
  const body = info.body || {};

  if (body.pin !== undefined) {
    if (!utils.validPin(body.pin)) {
      return e.json(400, { code: 'bad_pin', message: 'The PIN must be 4 to 6 digits.' });
    }
    const enabling = group.getString('pin_hash') === '';
    const salt = $security.randomString(16);
    group.set('pin_salt', salt);
    group.set('pin_hash', utils.hashPin(salt, body.pin));
    group.set('pin_attempts', 0);
    group.set('pin_on', true);
    if (enabling) {
      group.set('t', $security.randomStringWithAlphabet(40, 'abcdef0123456789'));
    }
  }

  if (body.disable_pin === true) {
    group.set('pin_hash', '');
    group.set('pin_salt', '');
    group.set('pin_attempts', 0);
    group.set('pin_on', false);
  }

  if (body.recovery_email !== undefined) {
    const email = String(body.recovery_email).trim();
    if (email !== '' && !utils.validEmail(email)) {
      return e.json(400, { code: 'bad_email', message: 'That does not look like an email address.' });
    }
    group.set('recovery_email', email);
  }

  if (body.unlock === true) {
    group.set('pin_attempts', 0);
  }

  e.app.save(group);
  return e.json(200, {
    t: group.getString('t'),
    pin: group.getString('pin_hash') !== '',
    recovery_email: group.getString('recovery_email'),
    attempts: group.getInt('pin_attempts'),
  });
});

// "Forgot the PIN" / "joining is locked": email the group's access link to
// the stored recovery address. Unauthenticated by design — the person asking
// is exactly the one without a credential — so it never says where the email
// went beyond a masked hint, and a per-group cooldown keeps it from becoming
// a spam button.
routerAdd('POST', '/api/divvy/groups/{id}/recover', (e) => {
  const utils = require(`${__hooks}/group_security_utils.js`);

  let group;
  try {
    group = e.app.findRecordById('groups', e.request.pathValue('id'));
  } catch {
    return e.json(404, { message: 'Group not found.' });
  }
  const email = group.getString('recovery_email');
  if (email === '') {
    return e.json(400, { code: 'no_recovery', message: 'No recovery email is set for this group.' });
  }

  const now = Math.floor(Date.now() / 1000);
  const wait = utils.RECOVERY_COOLDOWN_S - (now - group.getInt('recovery_sent_at'));
  if (wait > 0) {
    return e.json(429, { code: 'cooldown', retry_in: wait, message: 'A recovery email was just sent — try again in a few minutes.' });
  }

  const apiKey = $os.getenv('RESEND_API_KEY');
  if (!apiKey) {
    return e.json(503, { code: 'email_unconfigured', message: 'Recovery email is not configured on this server (RESEND_API_KEY).' });
  }

  const appUrl = ($os.getenv('DIVVY_APP_URL') || 'https://slate.mattrandell.com').replace(/\/$/, '');
  const name = group.getString('name');
  // Hash form so the token stays out of server/CDN request logs, same
  // reasoning as ADR-0001.
  const link = `${appUrl}/#/g/${group.id}/${group.getString('t')}`;

  const base = $os.getenv('DIVVY_RESEND_API_BASE') || 'https://api.resend.com';
  const res = $http.send({
    url: `${base}/emails`,
    method: 'POST',
    timeout: 30,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: $os.getenv('DIVVY_EMAIL_FROM') || 'Slate <slate@mattrandell.com>',
      to: [email],
      subject: `Your access link for “${name}” on Slate`,
      html: utils.recoveryEmailHtml(name, link),
    }),
  });
  if (res.statusCode >= 300) {
    console.error('slate recovery email failed:', res.statusCode, res.raw);
    return e.json(502, { code: 'send_failed', message: 'The recovery email could not be sent — try again later.' });
  }

  group.set('recovery_sent_at', now);
  e.app.save(group);
  return e.json(200, { sent: true, to: utils.maskEmail(email) });
});
