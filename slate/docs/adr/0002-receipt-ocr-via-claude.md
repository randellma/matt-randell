# Receipt OCR via the Claude API from a PocketBase hook

---
Status: accepted
---

Receipt parsing — the app's killer feature — is done by sending the photo to the **Claude API** (vision + JSON-schema structured output) from a **PocketBase JS hook** on the server. The PWA uploads the image as a `receipts` record; the hook fires on create, calls `/v1/messages` with the image and a strict receipt schema, and writes the parsed items/tax/tip/total back onto the record. The PWA polls until the status flips.

## Why an LLM and not classical OCR

Crumpled, skewed, thermal-printed receipts are exactly where Tesseract-style OCR falls apart, and even perfect character recognition still leaves fragile parsing logic to turn text lines into `{label, cents}` items. A vision model does transcription *and* structuring in one call, handles quantity lines and discounts, and the structured-output schema guarantees parseable JSON. Cost is well under a cent per receipt on `claude-haiku-4-5` — a rounding error against the Home Server's electricity.

## Why in a hook and not the client

The API key must not ship in the PWA. PocketBase's JSVM hooks give us a serverless-style backend without adding a service: the hook is ~100 lines, deploys with the container, and reuses the record's own lifecycle (status `pending → done | failed`) as the job queue.

## Decisions of record

- **Model**: `claude-haiku-4-5` by default, overridable via `DIVVY_OCR_MODEL`. Cheapest current model that supports both vision and structured outputs; a receipt transcription doesn't need Opus.
- **Structured output** (`output_config.format` with `json_schema`) rather than prompt-and-pray JSON. The schema is the contract shared with the PWA (`ParsedReceipt` in `web/src/lib/receipt.ts`).
- **Money as integer cents** end to end — the schema demands cents, so no float parsing ever happens.
- **Client downscales/re-encodes to JPEG** (max 1800px) before upload: faster on cell connections, keeps HEIC away from the API, and caps token cost.
- **PDF receipts** ride the same pipeline: emailed receipts (Uber, hotels, flights, Airbnb) upload as-is — no client-side rasterizing — and go to the API as a `document` content block instead of `image`. Same schema, same hook, same polling.
- **Draft-only** (same stance as inventory's [ADR-0002](../../../inventory/docs/adr/0002-ai-is-draft-only.md)): parsed items are never an expense until a human assigns every item and saves.
- **Synchronous-ish**: the hook runs during the upload request; the PWA still polls afterwards so a slow parse or timeout degrades gracefully.
- `DIVVY_OCR_API_BASE` env var lets local dev point at a mock Messages API instead of spending credits.

## Rejected alternatives

- **Self-hosted Tesseract/PaddleOCR**: free and fully local, but materially worse on photos of receipts, and the line-item parsing code would dwarf the rest of the backend.
- **Dedicated receipt APIs (Veryfi, Taggun)**: purpose-built but subscription-priced and another vendor account; overkill at family volume.
- **Client-side calls with the key in the PWA**: leaks a billable credential to anyone with a group link.
