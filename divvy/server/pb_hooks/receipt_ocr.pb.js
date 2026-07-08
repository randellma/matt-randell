/// <reference path="../pb_data/types.d.ts" />

// Receipt OCR: when a receipt record is created, send its file (photo or
// PDF) to the Claude API (vision/PDF input + JSON-schema structured output)
// and write the parsed itemization back onto the record. The PWA polls the
// record until status flips from "pending".
//
// Env:
//   ANTHROPIC_API_KEY  — required; parsing fails with a clear error without it
//   DIVVY_OCR_MODEL    — default "claude-haiku-4-5"
//   DIVVY_OCR_API_BASE — default "https://api.anthropic.com" (overridable for tests)

onRecordAfterCreateSuccess((e) => {
  e.next();

  const receipt = e.record;
  if (receipt.getString("status") !== "pending") {
    return;
  }

  const utils = require(`${__hooks}/receipt_ocr_utils.js`);

  try {
    const apiKey = $os.getenv("ANTHROPIC_API_KEY");
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set on the server");
    }

    const filename = receipt.getString("image");
    const path = [e.app.dataDir(), "storage", receipt.baseFilesPath(), filename].join("/");
    const imageB64 = utils.base64Encode($os.readFile(path));
    const mediaType = utils.mediaTypeFor(filename);

    const base = $os.getenv("DIVVY_OCR_API_BASE") || "https://api.anthropic.com";
    const model = $os.getenv("DIVVY_OCR_MODEL") || "claude-haiku-4-5";

    const res = $http.send({
      url: `${base}/v1/messages`,
      method: "POST",
      timeout: 90,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(utils.buildRequest(model, mediaType, imageB64)),
    });

    if (res.statusCode !== 200) {
      throw new Error(`Claude API returned ${res.statusCode}: ${JSON.stringify(res.json && res.json.error)}`);
    }

    const parsed = utils.extractParsed(res.json);
    receipt.set("parsed", parsed);
    receipt.set("status", "done");
    receipt.set("error", "");
  } catch (err) {
    receipt.set("status", "failed");
    receipt.set("error", String(err && err.message ? err.message : err).slice(0, 490));
  }

  e.app.save(receipt);
}, "receipts");
