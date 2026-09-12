# Version the PocketBase backend configuration

Life Points keeps its PocketBase migrations, collection rules, hooks, onboarding and seed logic, and container configuration in the repository. Although Coolify still deploys the backend on the Home Server, multi-tenant authorization must be reproducible and reviewable rather than existing only as manual PocketBase dashboard state; this deliberately avoids the reproducibility gap accepted by the earlier Inventory setup.
