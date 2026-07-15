/// <reference path="../pb_data/types.d.ts" />

// Google sign-in via native OAuth2 (ADR-0005). The provider itself is wired
// from env at boot (pb_hooks/accounts.pb.js onBootstrap) so the feature is
// complete before real credentials exist; this migration only opens the door
// OAuth2 sign-up walks through: PocketBase creates the auth record via the
// regular create endpoint as the guest requester, tagged
// @request.context = "oauth2" — so the createRule must allow exactly that
// context. Ordinary API creates keep failing (no self-service sign-up with
// passwords), same posture as the old `null` rule.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.createRule = '@request.context = "oauth2"';
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.createRule = null;
    app.save(users);
  },
);
