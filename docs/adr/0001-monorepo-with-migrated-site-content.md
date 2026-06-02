# Monorepo combining site content and infrastructure config

The website content (migrated from `randellma.github.io`) and GCP infrastructure Terraform config live together in the `matt-randell` repo. GitHub Pages is configured to serve from `matt-randell` instead; `randellma.github.io` is archived after migration.

Keeping them as separate repos was rejected because the owner prefers a single place for all personal site concerns. A git submodule was considered but rejected — submodule pointer updates add friction without benefit when site content and infrastructure evolve independently with no coordination requirement between them.
