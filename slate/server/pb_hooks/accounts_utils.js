// Helpers for accounts.pb.js and credits.pb.js. Plain module (no .pb.js
// suffix) so it isn't registered as a hook file itself; loaded via require().

// Sign-in codes: short-lived, few tries — the account guards spent money at
// most, so this mirrors the group-PIN posture (lockable, not fancy). Length
// and expiry live in the users collection's OTP config (migration
// 1751600013); these two govern the hooks layered on the native flow.
const OTP_COOLDOWN_S = 60;
const OTP_MAX_ATTEMPTS = 5;

// First verified sign-in comes with a taste of the paid feature.
const WELCOME_CREDITS = 5;

// The purchasable packs. Server-authoritative — the client renders these but
// the purchase route only honors ids listed here. In beta every "purchase" is
// granted free of charge; price_cents is what the provider will charge later.
const PACKS = {
  p10: { credits: 10, price_cents: 299, label: '10 scans' },
  p30: { credits: 30, price_cents: 699, label: '30 scans' },
};

/** Balance change + matching ledger row, always together. `refs` may carry
 * group/receipt/purchase record ids for the audit trail. */
function addCredits(app, user, delta, reason, refs) {
  user.set('credits', user.getInt('credits') + delta);
  app.save(user);
  const rec = new Record(app.findCollectionByNameOrId('credit_events'));
  rec.set('user', user.id);
  rec.set('delta', delta);
  rec.set('reason', reason);
  for (const k of ['group', 'receipt', 'purchase', 'note']) {
    if (refs && refs[k]) rec.set(k, refs[k]);
  }
  app.save(rec);
}

/** What a sponsor is called where their credits show up. */
function displayName(user) {
  const sec = require(`${__hooks}/group_security_utils.js`);
  return user.getString('name') || sec.maskEmail(user.getString('email'));
}

/**
 * Whose balance a scan in this group would charge: the scanner's own credits
 * first (spending yours is never a surprise), then the sponsor with the most
 * credits (whoever topped up for the trip carries it, and the group keeps
 * scanning for the longest). Returns { source: 'self'|'sponsor'|null, user? }.
 */
function resolveScanSource(app, authUser, groupId) {
  if (authUser && authUser.getInt('credits') > 0) {
    return { source: 'self', user: authUser };
  }
  const sponsors = listSponsors(app, groupId).filter((u) => u.getInt('credits') > 0);
  if (sponsors.length > 0) {
    const best = sponsors.reduce((a, b) => (b.getInt('credits') > a.getInt('credits') ? b : a));
    return { source: 'sponsor', user: best };
  }
  return { source: null };
}

/** Users sponsoring a group, skipping dangling refs just in case. */
function listSponsors(app, groupId) {
  const rows = app.findRecordsByFilter('sponsorships', 'group = {:g}', '-created', 0, 0, { g: groupId });
  const users = [];
  for (const row of rows) {
    try {
      users.push(app.findRecordById('users', row.getString('user')));
    } catch {
      /* sponsor account gone — ignore */
    }
  }
  return users;
}

/** Send one email through Resend; throws on failure. Same infra as the
 * PIN-recovery mail (group_security.pb.js). */
function sendEmail(to, subject, html) {
  const apiKey = $os.getenv('RESEND_API_KEY');
  if (!apiKey) {
    throw new ApiError(503, 'Sign-in email is not configured on this server (RESEND_API_KEY).', {});
  }
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
      to: [to],
      subject: subject,
      html: html,
    }),
  });
  if (res.statusCode >= 300) {
    console.error('slate sign-in email failed:', res.statusCode, res.raw);
    throw new ApiError(502, 'The sign-in email could not be sent — try again later.', {});
  }
}

function otpEmailHtml(code) {
  return (
    `<p>Your Slate sign-in code:</p>` +
    `<p style="font-size:28px;font-weight:bold;letter-spacing:6px;font-family:monospace;">${code}</p>` +
    `<p>It expires in 10 minutes. If you didn't ask for it, you can ignore this email.</p>`
  );
}

module.exports = {
  OTP_COOLDOWN_S,
  OTP_MAX_ATTEMPTS,
  WELCOME_CREDITS,
  PACKS,
  addCredits,
  displayName,
  resolveScanSource,
  listSponsors,
  sendEmail,
  otpEmailHtml,
};
