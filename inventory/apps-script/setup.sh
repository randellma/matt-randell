#!/usr/bin/env bash
# inventory/apps-script/setup.sh
#
# Run this once to wire up the Apps Script project end-to-end.
# Prerequisites: Node installed, npm install already run in this directory.
#
# Usage:
#   cd inventory/apps-script
#   bash setup.sh
#
# At the end it prints the IDs and deployment URL you need to record.

set -euo pipefail
CLASP="npx clasp"

echo ""
echo "=== Step 1: Log in to Google (opens browser) ==="
$CLASP login

echo ""
echo "=== Step 2: Create the Apps Script project ==="
# Creates a new standalone (not container-bound) project and writes the
# scriptId into .clasp.json automatically.
$CLASP create --type standalone --title "Inventory"
echo "Script ID written to .clasp.json"

echo ""
echo "=== Step 3: Push TypeScript sources ==="
$CLASP push --force
echo "Sources pushed."

echo ""
echo "=== Step 4: Set Script Properties ==="
echo ""
echo "  Open the Apps Script editor and set these Script Properties manually:"
echo "  (Project Settings → Script Properties → Add script property)"
echo ""
echo "    SECRET          = <choose a strong random string, e.g. openssl rand -hex 20>"
echo "    SHEET_ID        = 1qRucz2hpcnxl0gpUkQ8f6VIdtazRbTsUK8RlnWwDsdA"
echo "    DRIVE_FOLDER_ID = 1XWlPRUp8ETrED2CWGE46CF46Kpoy4nyS"
echo ""
read -p "Press Enter once you've set the Script Properties..."

echo ""
echo "=== Step 5: Run one-time Sheet setup ==="
echo ""
echo "  In the Apps Script editor, select the function 'ensureDispositionDropdown'"
echo "  from the function dropdown and click Run. This sets up the Sell/Give away/Donate"
echo "  dropdown on column D of the Inventory Sheet."
echo ""
read -p "Press Enter once ensureDispositionDropdown has run successfully..."

echo ""
echo "=== Step 6: Deploy as web app ==="
$CLASP deploy --description "Capture endpoint v1"
echo ""
echo "Copy the deployment URL from the output above."
echo "It looks like: https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec"
echo ""
echo "=== Done! ==="
echo ""
echo "IDs to record in docs/issues/0007:"
echo "  Sheet ID:        1qRucz2hpcnxl0gpUkQ8f6VIdtazRbTsUK8RlnWwDsdA"
echo "  Drive folder ID: 1XWlPRUp8ETrED2CWGE46CF46Kpoy4nyS"
echo "  Script ID:       (see .clasp.json)"
echo "  Deployment URL:  (see clasp deploy output above)"
echo ""
echo "Smoke test (replace placeholders):"
echo ""
echo '  PHOTO_B64=$(base64 -i /path/to/test.jpg | tr -d "\n")'
echo '  curl -X POST "<DEPLOYMENT_URL>" \'
echo '    -H "Content-Type: application/json" \'
echo '    -d "{\"secret\":\"<SECRET>\",\"name\":\"Test item\",\"capturedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"photo\":\"$PHOTO_B64\"}"'
