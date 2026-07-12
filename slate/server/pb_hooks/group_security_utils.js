// Helpers for group_security.pb.js. Loaded with require() inside each route
// handler — PocketBase runs every handler in its own JSVM, so nothing can be
// shared through file scope.

const MAX_ATTEMPTS = 10;
const RECOVERY_COOLDOWN_S = 5 * 60;

/** The stored PIN digest. sha256 not bcrypt is deliberate: a 4–6 digit PIN is
 * brute-forcible offline whatever the hash, so the real defenses are the
 * attempt lock and the DB not leaking; the salt just keeps digests unique. */
function hashPin(salt, pin) {
  return $security.sha256(salt + ':' + pin);
}

function validPin(pin) {
  return typeof pin === 'string' && /^\d{4,6}$/.test(pin);
}

function validEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** "randellma@gmail.com" -> "r…@gmail.com" — enough to recognize, not to harvest. */
function maskEmail(email) {
  const at = email.indexOf('@');
  return email.slice(0, 1) + '…' + email.slice(at);
}

function isLocked(group) {
  return group.getInt('pin_attempts') >= MAX_ATTEMPTS;
}

function recoveryEmailHtml(groupName, link) {
  const esc = (s) =>
    s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  return (
    `<p>Someone on the join screen of the Divvy group <b>${esc(groupName)}</b> asked for a recovery link (usually a forgotten PIN, or joining got locked by too many wrong tries).</p>` +
    `<p><a href="${esc(link)}">Open “${esc(groupName)}” on Divvy</a></p>` +
    `<p>Anyone with this link has full access to the group, so only forward it to people who belong there. Once in, you can change the PIN or unlock joining under Group settings.</p>` +
    `<p>If this wasn't you or your group, you can ignore this email.</p>`
  );
}

module.exports = {
  MAX_ATTEMPTS,
  RECOVERY_COOLDOWN_S,
  hashPin,
  validPin,
  validEmail,
  maskEmail,
  isLocked,
  recoveryEmailHtml,
};
