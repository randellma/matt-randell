# matt-randell

Personal site and infrastructure monorepo for `mattrandell.com`. See [CONTEXT-MAP.md](CONTEXT-MAP.md) for context and [docs/adr/](docs/adr/) for key decisions.

## Repositories

| Repo | Purpose |
|---|---|
| `matt-randell` (this repo, public) | Static site, Terraform for the `mattrandell.com` infrastructure |
| `heyslate` (private) | Slate expense-splitting app + Terraform for the `heyslate.app` zone |
| `wayfair-apps` (private) | Discount web app + Chrome extension |

## Infrastructure overview

- **DNS + CDN:** Cloudflare (zone `mattrandell.com`)
- **Domain registrar:** GCP Cloud Domains
- **Static hosting:** GitHub Pages (`mattrandell.com`, `inventory.mattrandell.com`)
- **Self-hosted services:** Home server running Coolify at `coolify.mattrandell.com`
- **Tunnel:** Single Cloudflare Tunnel → Coolify's Traefik → individual services
- **Secrets:** GCP Secret Manager (`coolify-env`)
- **Coolify backups:** GCS bucket `matt-randell-coolify-backups` (30-day retention)
- **Terraform state:** GCS backend (see `terraform/backend.tf`)

---

## Home server disaster recovery

Use this runbook when the home server needs to be rebuilt from scratch. Assumes a fresh Ubuntu 24.04 LTS install.

### What this recovers

- Coolify and all its service configurations (projects, env vars, GitHub connections)
- The Cloudflare tunnel and routing
- The discount app container

### What is NOT automatically recovered

- **Discount app Postgres data** — Coolify's backup covers Coolify's own config database only, not the app databases it manages. Before wiping a server, manually dump the app database:
  ```bash
  docker exec <db-container-name> pg_dump -U app wayfair_discount > ~/wayfair_discount_backup.sql
  ```
  Store the dump somewhere safe (GCS, email to yourself, etc.). See step 7 below for restore.

---

### Step 1 — Prerequisites on your Mac

Install Ansible and the community collection if not already installed:

```bash
brew install ansible
ansible-galaxy collection install community.general
```

Confirm you are authenticated with GCP (needed to fetch secrets):

```bash
gcloud auth login
gcloud config set project matt-randell
```

---

### Step 2 — Prepare the fresh server

SSH into the new server and install gcloud:

```bash
sudo snap install google-cloud-cli --classic
gcloud auth login
```

Note the server's local IP for the next step:

```bash
hostname -I | awk '{print $1}'
```

---

### Step 3 — Run the Ansible playbook

From your Mac, in the `matt-randell` repo root:

```bash
ansible-playbook homeserver/setup.yml -i <server-ip>, -u <ssh-user> --ask-become-pass
```

The playbook will:
1. Install gcloud on the server (idempotent if already installed)
2. Run the Coolify install script
3. Fetch the Coolify `.env` from GCP Secret Manager (`coolify-env`)
4. Write it to `/data/coolify/source/.env`
5. Restart Coolify with the restored configuration

---

### Step 4 — Access Coolify and restore the backup

Coolify is running but services aren't deployed yet. Access it via the local network (the tunnel isn't running yet):

```
http://<server-local-ip>:8000
```

Before you can restore the backup, you need to configure where the backup lives. The GCS credentials live in Terraform state — retrieve them from your Mac:

```bash
cd matt-randell/terraform
terraform output coolify_backup_access_key_id   # Access Key
terraform output -raw coolify_backup_secret      # Secret Key
```

Go to **Settings → Backup** and enter:

| Field | Value |
|---|---|
| S3 Endpoint | `https://storage.googleapis.com` |
| Access Key | from `terraform output` above |
| Secret Key | from `terraform output` above |
| Bucket | `matt-randell-coolify-backups` |
| Region | `us` |

Then restore the latest backup. This restores all project and service configurations.

---

### Step 5 — Redeploy services

After the backup restore, Coolify knows about all services but they aren't running. Redeploy in this order:

1. **cloudflared** — deploy first so the tunnel comes up and `coolify.mattrandell.com` becomes accessible
2. **discount app** — deploy the wayfair-apps service (db + app containers start)

---

### Step 6 — Reconnect GitHub source

The GitHub App token may need to be refreshed after a server rebuild. Go to **Settings → Sources → GitHub App** and verify the connection is active. If it shows as disconnected, delete it and re-register following the setup flow (use `https://coolify.mattrandell.com` as the webhook endpoint).

---

### Step 7 — Restore app database (if you have a dump)

If you saved a `pg_dump` before wiping the old server, restore it now. Find the new DB container name:

```bash
docker ps | grep db
```

Then restore:

```bash
docker exec <db-container> dropdb --force -U app wayfair_discount
docker exec <db-container> createdb -U app wayfair_discount
docker exec -i <db-container> psql -U app wayfair_discount < ~/wayfair_discount_backup.sql
```

---

### Step 8 — Update the Secret Manager backup

After Coolify is running and configured, update the `.env` backup in case anything changed:

```bash
# Run on the server
sudo cat /data/coolify/source/.env | gcloud secrets versions add coolify-env --project=matt-randell --data-file=-
```

---

### Step 9 — Verify

- `https://coolify.mattrandell.com` — Coolify dashboard loads
- `https://discount.mattrandell.com` — discount app loads and login works
- Push a commit to `wayfair-apps` main and confirm Coolify auto-deploys

