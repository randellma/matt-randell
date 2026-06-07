# Inventory runs on the Google stack, not GCP

Inventory is built entirely on Google Apps Script, a Google Sheet, and Google Drive — even though the rest of this repo runs on GCP (Cloud Domains, Cloud DNS) managed by Terraform. Capture is an iOS Shortcut POSTing to an Apps Script web app, which saves the photo to a **private** Drive folder, embeds an inline thumbnail in the Sheet via the Apps Script `CellImage` API, and appends a row. The Sheet itself is the review surface.

The GCP alternative (GCS bucket + Cloud Function + Firestore) was rejected: it's a server and auth layer to maintain for a near-trivial personal tool, and the goal was explicitly "barely an app." The Sheet doubles as the viewer, so no hosting is needed at all.

Thumbnails specifically use `CellImage` rather than the obvious `=IMAGE(driveUrl)` because Google has been actively breaking `=IMAGE()` with Drive URLs, and that path also requires the photos be **publicly fetchable** — i.e. publishing a photo inventory of the inside of the house to anyone who guesses a URL. `CellImage` embeds reliably while the Drive originals stay private.

Consequence: almost nothing lives in this repo except the Apps Script source (tracked via `clasp` under `inventory/apps-script/`) and these docs. The shared secret that guards the endpoint lives in Apps Script Script Properties, never in git.
