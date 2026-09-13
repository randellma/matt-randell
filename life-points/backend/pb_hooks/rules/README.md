# Collection rules

Collection migrations are the source of truth for PocketBase rules. Every private domain
collection uses the authenticated Account's `game` relation, and pending Accounts with no Game
cannot read any Game-owned records. Creation and mutation remain server-only until their owning
features introduce authenticated routes or rules.
