/// <reference path="../pb_data/types.d.ts" />

// Keep deploy-specific email and seeded-Owner configuration outside the
// database snapshot. Coolify and local Compose supply different values, and a
// restart applies changes without requiring a new migration or Dashboard edit.
onBootstrap((event) => {
  event.next();

  const smtpHost = $os.getenv('LIFE_POINTS_SMTP_HOST') || '';
  const settings = event.app.settings();
  settings.meta.senderName = $os.getenv('LIFE_POINTS_EMAIL_FROM_NAME') || 'Life Points';
  settings.meta.senderAddress =
    $os.getenv('LIFE_POINTS_EMAIL_FROM') || 'hello@lifepoints.test';
  settings.smtp.enabled = smtpHost !== '';
  settings.smtp.host = smtpHost;
  settings.smtp.port = Number($os.getenv('LIFE_POINTS_SMTP_PORT') || '1025');
  settings.smtp.username = $os.getenv('LIFE_POINTS_SMTP_USERNAME') || '';
  settings.smtp.password = $os.getenv('LIFE_POINTS_SMTP_PASSWORD') || '';
  settings.smtp.tls = ($os.getenv('LIFE_POINTS_SMTP_TLS') || 'false') === 'true';
  event.app.save(settings);

  let accounts;
  try {
    accounts = event.app.findCollectionByNameOrId('accounts');
  } catch {
    // On a brand-new database app migrations run after bootstrap hooks. The
    // migration uses these same environment values; the hook takes ownership
    // of subsequent restarts and already-migrated production databases.
    return;
  }
  const webUrl = ($os.getenv('LIFE_POINTS_WEB_URL') || 'http://127.0.0.1:4173').replace(
    /\/+$/,
    '',
  );
  accounts.otp.emailTemplate.subject = 'Your Life Points code';
  accounts.otp.emailTemplate.body =
    '<p>Your Life Points code is <strong>{OTP}</strong>.</p>' +
    '<p>It expires in 3 minutes.</p>' +
    `<p><a href="${webUrl}/?otpId={OTP_ID}&otp={OTP}">Enter Life Points</a></p>`;
  event.app.save(accounts);

  const ownerEmail = ($os.getenv('LIFE_POINTS_OWNER_EMAIL') || '').trim().toLowerCase();
  if (ownerEmail !== '') {
    const owner = event.app.findRecordById('accounts', 'acctysabel00001');
    if (owner.email() !== ownerEmail) {
      owner.setEmail(ownerEmail);
      owner.setVerified(true);
      event.app.save(owner);
    }
  }
});
