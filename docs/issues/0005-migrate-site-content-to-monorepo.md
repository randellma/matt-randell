# Migrate site content to monorepo

**Type**: AFK
**Blocked by**: None — can run in parallel with #0001–#0004

## What to build

Move the Site content from `randellma.github.io` into the `/site` folder of this monorepo. Set up a GitHub Actions workflow that builds and deploys from `/site` to GitHub Pages on every push to `main`. Enable GitHub Pages on the `matt-randell` repo.

If the static site generator hasn't been decided yet (plain HTML/CSS vs Hugo), migrate the existing Jekyll content as-is or stub `/site` with a placeholder — the workflow and Pages configuration should be in place regardless.

## Acceptance criteria

- [ ] `/site` folder exists with either migrated content or a working placeholder
- [ ] `.github/workflows/deploy-site.yml` builds and deploys the site to GitHub Pages
- [ ] GitHub Pages enabled on the `matt-randell` repo, serving from the Actions workflow output
- [ ] Pushing to `main` triggers a deployment and the site is reachable at `randellma.github.io` (temporary, before custom domain is set in #0006)
- [ ] `randellma.github.io` repo is NOT yet archived (that happens in #0006)
