# Slate: Google sign-in via native OAuth2

**Type**: AFK
**Status**: ready-for-agent
**Blocked by**: 0018

## What to build

Add "Continue with Google" to Slate's sign-in flow using PocketBase's native OAuth2 provider (ADR-0005). Build it entirely behind configuration: the Google client id/secret come from env vars wired into the provider config, so the feature is complete and mergeable before real credentials exist — the button simply hides (or the provider list is empty) until the credentials are configured. Matt will create the Google Cloud OAuth client and paste the credentials in afterwards.

On first OAuth sign-in, import the Google profile name and photo into the Account's profile (name and avatar on the `users` record) — only filling blanks, never overwriting a name or photo the user already set. An OAuth sign-in for an email that already has an OTP-based Account must land on that same Account (PocketBase links by verified email), keeping its Scan Credits and history.

Facebook is explicitly out of scope (deferred in ADR-0005 until someone asks).

## Acceptance criteria

- [ ] With Google credentials configured, the sign-in flow shows a Google option alongside the emailed code; completing it signs the user in
- [ ] With no credentials configured, the sign-in flow is unchanged (no broken button) and the app builds/deploys cleanly
- [ ] First Google sign-in fills an empty profile name/photo from the Google account; existing values are never overwritten
- [ ] Google sign-in with an email that already signed in by code lands on the same Account (same credits, purchases, sponsorships)
- [ ] A brand-new Google sign-in gets the 5-credit welcome grant exactly once
- [ ] Setup for the manual step is documented (where the env vars go, the redirect URL to register with Google)

## Blocked by

- 0018 (native auth surface — the sign-in flow this button joins)
