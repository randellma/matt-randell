# Seeds

`starter-pack.v1.json` is the versioned source of truth for the Starter Pack. The public onboarding
hook reads it inside the same transaction that creates a verified Account's Game, Categories,
Activities, Rewards, and three empty Monthly Quest slots. Bump `schemaVersion` when its shape
changes; changing the contents does not rewrite Games that have already been provisioned.
