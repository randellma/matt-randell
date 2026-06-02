# Activate custom domain and archive old repo

**Type**: HITL
**Blocked by**: #0004 — domain transfer complete; #0005 — site deployed from monorepo

## What to build

Configure `mattrandell.com` as the custom domain in GitHub Pages settings for the `matt-randell` repo. Verify DNS resolves correctly and HTTPS certificate provisions. Once confirmed working, archive `randellma.github.io`.

## Acceptance criteria

- [ ] `mattrandell.com` set as the custom domain in GitHub Pages settings for `matt-randell`
- [ ] GitHub Pages shows no domain verification errors
- [ ] HTTPS certificate provisioned (Let's Encrypt via GitHub Pages)
- [ ] `https://mattrandell.com` loads the Site correctly
- [ ] `https://www.mattrandell.com` redirects to `https://mattrandell.com`
- [ ] `randellma.github.io` repo archived
