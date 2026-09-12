/// <reference path="../pb_data/types.d.ts" />

// Local development uses PocketBase's native mailer with Mailpit. Production
// OTP delivery is intercepted below and sent through Resend's HTTP API.
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
  settings.smtp.username = '';
  settings.smtp.password = '';
  settings.smtp.tls = false;
  event.app.save(settings);

  let accounts;
  try {
    accounts = event.app.findCollectionByNameOrId('accounts');
  } catch {
    // On a brand-new database app migrations run after bootstrap hooks. The
    // next restart updates the newly migrated collection's email template.
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
});

onMailerRecordOTPSend((event) => {
  const apiKey = $os.getenv('RESEND_API_KEY') || '';
  if (apiKey === '') {
    return event.next();
  }

  const webUrl = ($os.getenv('LIFE_POINTS_WEB_URL') || 'https://lifepoints.mattrandell.com').replace(
    /\/+$/,
    '',
  );
  const magicLink =
    `${webUrl}/?otpId=${encodeURIComponent(event.meta.otpId)}` +
    `&otp=${encodeURIComponent(event.meta.password)}`;
  try {
    const response = $http.send({
      url: ($os.getenv('LIFE_POINTS_RESEND_API_BASE') || 'https://api.resend.com') + '/emails',
      method: 'POST',
      timeout: 30,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'Life Points <hello@heyslate.app>',
        to: [event.record.email()],
        subject: 'Your Life Points code',
        html:
          `<p>Your Life Points code is <strong>${event.meta.password}</strong>.</p>` +
          '<p>It expires in 3 minutes.</p>' +
          `<p><a href="${magicLink}">Enter Life Points</a></p>`,
      }),
    });
    if (response.statusCode >= 300) {
      throw new Error(`Resend returned HTTP ${response.statusCode}`);
    }
  } catch (error) {
    event.app.logger().error(
      'Life Points OTP email failed to send',
      'error',
      String(error),
    );
    try {
      event.app.delete(event.app.findOTPById(event.meta.otpId));
    } catch (error) {
      event.app.logger().error(
        'Undelivered Life Points OTP could not be deleted',
        'error',
        String(error),
      );
    }
    return;
  }

  const otp = event.app.findOTPById(event.meta.otpId);
  otp.setSentTo(event.record.email());
  event.app.save(otp);
}, 'accounts');
