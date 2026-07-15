# heyslate.app migration: manual steps

**Type**: HITL
**Status**: ready-for-human

## Context

The Slate migration to heyslate.app is coded and the Cloudflare infra is
applied: heyslate.app already serves the PWA, legacy redirects are live, and
`api.heyslate.app` DNS + tunnel ingress exist. What remains is the handful of
things only a human with dashboard access can do. Do them **in this order** —
the ordering matters.

## Steps

### 1. Coolify — route the new API host

- [ ] Open the Slate PocketBase app in Coolify → add `api.heyslate.app` as a
      domain (keep `divvy-api.mattrandell.com` — installed PWAs still use it).
- [ ] Check it works: `https://api.heyslate.app/api/health` should return 200.

### 2. Resend — verify heyslate.app as a sending domain

The code's new default sender is `Slate <hello@heyslate.app>`, so this must
be done **before** the backend is redeployed (step 3), or sign-in and
recovery emails start failing.

- [ ] In the Resend dashboard, add domain `heyslate.app`, region
      **us-east-1**, default `send` subdomain.
- [ ] MX, SPF, and DMARC records are already live via Terraform. Copy the
      **DKIM** value Resend shows (`p=…`), paste it into the commented
      `heyslate_resend_dkim` record in `terraform/heyslate.tf`, uncomment it,
      and run `terraform apply`.
- [ ] Click **Verify** in Resend and wait for the domain to show verified.

### 3. Coolify — env vars + redeploy backend

- [ ] If `DIVVY_APP_URL` or `DIVVY_EMAIL_FROM` are explicitly set, update
      them to `https://heyslate.app` / `Slate <hello@heyslate.app>` (or just
      unset them — those are now the code defaults).
- [ ] Redeploy/restart the backend so the new hook defaults take effect.

### 4. Google Cloud console — OAuth redirect

- [ ] On the Slate OAuth client, add
      `https://api.heyslate.app/api/oauth2-redirect` as an authorized
      redirect URI. Keep the old `divvy-api.mattrandell.com` one for now.

### 5. Push — deploy the new PWA build

- [ ] `git push` the migration commits (must be **after** step 1 — the new
      build calls `api.heyslate.app`). CI deploys the PWA automatically.

### 6. Smoke test

- [ ] Open https://heyslate.app — groups load, expenses save.
- [ ] Visit https://slate.mattrandell.com in a browser that had groups — it
      should bounce to heyslate.app with the group list intact.
- [ ] An old share link (`slate.mattrandell.com/g/…` or `divvy.…`) 301s to
      heyslate.app and opens the group.
- [ ] Sign in with an email code — the mail arrives from
      `hello@heyslate.app`, links point at heyslate.app.
- [ ] "Continue with Google" completes.
- [ ] An already-installed PWA (old origin) still opens and syncs.

## Later / optional

- After a few months of redirect traffic, consider a blanket edge 301 of
  `slate.mattrandell.com` (one-rule change in `terraform/cloudflare.tf`) and
  retiring `divvy-api.mattrandell.com` + the old OAuth redirect URI.
