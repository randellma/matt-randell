# Inventory — Apps Script

The Google Apps Script web app that powers the Inventory Capture endpoint.

## Development

```sh
npm test          # run unit tests (pure modules only — no Google dependency)
npm run typecheck # type-check all sources
```

## Deploy

```sh
npm run push
```

This does everything in one step: build (Rollup bundles TypeScript → JS), push to Apps Script, and update the live deployment. No manual steps in the Apps Script editor needed.

## Project layout

```
src/
  WebApp.ts               # doPost / doGet entry point
  RequestAuthenticator.ts # validates the shared secret (pure, unit-tested)
  CapturePayloadMapper.ts # maps capture payload → sheet row values (pure, unit-tested)
  DrivePhotoStore.ts      # saves photo blob to private Drive folder
  SheetGateway.ts         # appends row + embeds CellImage thumbnail
  appsscript.json         # Apps Script manifest
dist/                     # built output pushed to Apps Script (git-ignored)
```

## Script Properties

Set these in the Apps Script editor under Project Settings → Script Properties:

| Property | Value |
|---|---|
| `SECRET` | shared secret (keep private — never commit) |
| `SHEET_ID` | `1qRucz2hpcnxl0gpUkQ8f6VIdtazRbTsUK8RlnWwDsdA` |
| `DRIVE_FOLDER_ID` | `1XWlPRUp8ETrED2CWGE46CF46Kpoy4nyS` |

## Smoke test

```sh
PHOTO_B64=$(base64 -i /path/to/photo.jpg | tr -d '\n')
echo "{\"secret\":\"<SECRET>\",\"name\":\"Test item\",\"capturedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"photo\":\"$PHOTO_B64\"}" > /tmp/capture.json
curl -L --max-redirs 1 -X POST \
  'https://script.google.com/macros/s/AKfycbyjJnL9Rv3qyyy_aV2-nrAtICndug41fE-ZCkZEU205fftVSaWIOW_VrOfpdWJFTwH-EQ/exec' \
  -H 'Content-Type: application/json' \
  -d @/tmp/capture.json
```

A new row should appear in the [Inventory Sheet](https://docs.google.com/spreadsheets/d/1qRucz2hpcnxl0gpUkQ8f6VIdtazRbTsUK8RlnWwDsdA/edit) with a thumbnail in the Photo column. The Drive original stays private.
