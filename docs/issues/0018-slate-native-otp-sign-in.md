# Slate: migrate sign-in to PocketBase-native OTP

**Type**: AFK
**Status**: ready-for-agent
**Blocked by**: none

## What to build

Replace Slate's hand-rolled emailed-code sign-in with PocketBase's native OTP auth (available since v0.23; the server runs 0.39.5). Today custom routes (`request-code` / `verify`) manage their own `otp_hash`/`otp_salt`/`otp_attempts`/`otp_expires`/`otp_sent_at` fields on `users`; all of that duplicates what `requestOTP` / `authWithOTP` do natively (ADR-0005).

Two behaviors of the custom flow must survive the migration:

- **Auto-create on first contact**: native OTP does not create accounts for unknown emails — keep a thin server hook so requesting a code for a new address creates the (unverified) account first, preserving today's no-separate-signup flow.
- **Delivery via Resend**: native OTP mails through PocketBase's mailer. Either point SMTP at Resend or intercept the OTP mail event and send through the existing Resend HTTP path, keeping the current email look.

Keep the existing posture: password auth stays disabled, code length/expiry/attempt limits stay at least as strict as the current ones (6 digits, 10-minute expiry, 5 attempts, resend cooldown), codes are single-use, and the welcome grant of 5 Scan Credits still fires exactly once on first verified sign-in. The web client's sign-in steps (email → code → signed in) switch to the native SDK calls; drop the custom routes and the now-dead `otp_*` fields in a migration.

## Acceptance criteria

- [ ] Signing in with an emailed 6-digit code works end-to-end through PocketBase's native OTP endpoints; the custom auth routes are gone
- [ ] Requesting a code for a never-seen email creates the account and sends the code (no separate sign-up step)
- [ ] OTP emails are delivered via Resend and look like the current sign-in email
- [ ] First verified sign-in grants 5 welcome Scan Credits exactly once (a `credit_events` row, as today)
- [ ] Rate limits at least match the current posture: code expiry, attempt cap, resend cooldown, single-use codes
- [ ] Password auth remains disabled; the `otp_*` fields are removed in a migration with a working down-migration
- [ ] Existing accounts (and their credits/sponsorships) sign in unchanged after the migration

## Blocked by

None - can start immediately
