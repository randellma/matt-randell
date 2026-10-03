# Document publishing identity

This Infrastructure root owns the service account and GitHub Workload Identity Federation resources in `publishing.tf`. The consuming private repository owns document sources, build/upload code, Drive file IDs and workflow triggers. Never copy its document contents, credentials or file IDs into this public repository.

## Inputs

Keep `publisher_github_repository_id` and `publisher_github_owner_id` in a local, gitignored `publisher.auto.tfvars`. These are immutable numeric GitHub IDs, not repository names. Obtain them with `gh api repos/<owner>/<repo>` and preserve the inputs securely for another Terraform checkout.

The trust requires the exact repository and owner IDs, `refs/heads/main`, and a `push` or `workflow_dispatch` event. Pull-request events and other branches are excluded. The `roles/iam.workloadIdentityUser` grant applies only to this service account; the account receives no project-wide resource roles and has no private key.

## Consumer setup

Read only these non-secret Terraform outputs:

```sh
terraform output -raw publisher_service_account
terraform output -raw publisher_workload_identity_provider
```

Configure the private repository's GitHub workflow with `id-token: write`, the provider output, and service-account impersonation. Request an OAuth access token with a Drive scope; a default Cloud Platform-only token is not sufficient. Do not use domain-wide delegation or upload a service-account key.

Upload each initial PDF as a human user, then share that specific file with the service account as Editor. Keep the human owner and file ID; the workflow must use `files.update`, never delete/recreate or silently fall back to creating a file. Service accounts cannot own new My Drive files. GCP IAM authentication does not grant Drive access: the file's sharing permission is a separate prerequisite.

Test on a disposable human-owned PDF first: confirm account identity, read the shared file, replace its contents, then verify the downloaded bytes, owner and file ID. Separately test GitHub OIDC impersonation from the approved workflow; a local impersonation test alone does not validate the GitHub trust. Do not print tokens or document content in logs.
