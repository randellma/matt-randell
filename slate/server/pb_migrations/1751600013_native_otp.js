/// <reference path="../pb_data/types.d.ts" />

// Native OTP sign-in (ADR-0005, amending ADR-0004): PocketBase's own
// requestOTP/authWithOTP replace the hand-rolled emailed-code routes, so the
// otp_* state fields on users go away — the `_otps` system collection holds
// codes now (hashed, single-use, auto-expiring). The rest of the posture
// (resend cooldown, attempt cap, auto-create, Resend delivery) lives in
// pb_hooks/accounts.pb.js. Password auth stays disabled: the emailed code —
// and, when configured, Google (1751600014) — remain the only ways in.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.otp.enabled = true;
    users.otp.duration = 600; // seconds — same 10-minute expiry as before
    users.otp.length = 6;
    for (const name of ['otp_hash', 'otp_salt', 'otp_attempts', 'otp_expires', 'otp_sent_at']) {
      users.fields.removeByName(name);
    }
    app.save(users);
  },
  (app) => {
    // Restores the custom-flow fields (1751600012); their values are
    // ephemeral per-code state, so coming back empty loses nothing.
    const users = app.findCollectionByNameOrId('users');
    users.otp.enabled = false;
    users.fields.add(
      new Field({ name: 'otp_hash', type: 'text', hidden: true, max: 64 }),
      new Field({ name: 'otp_salt', type: 'text', hidden: true, max: 64 }),
      new Field({ name: 'otp_attempts', type: 'number', hidden: true, onlyInt: true }),
      new Field({ name: 'otp_expires', type: 'number', hidden: true, onlyInt: true }),
      new Field({ name: 'otp_sent_at', type: 'number', hidden: true, onlyInt: true }),
    );
    app.save(users);
  },
);
