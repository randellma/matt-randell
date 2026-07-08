// Helpers for the receipt OCR hook. Plain module (no .pb.js suffix) so it
// isn't registered as a hook file itself; loaded via require().

const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Base64-encode a Go []byte exposed by $os.readFile. Goja has no Buffer/btoa. */
function base64Encode(bytes) {
  const len = bytes.length;
  const out = [];
  let i = 0;
  for (; i + 2 < len; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out.push(
      B64_CHARS[(n >> 18) & 63],
      B64_CHARS[(n >> 12) & 63],
      B64_CHARS[(n >> 6) & 63],
      B64_CHARS[n & 63],
    );
  }
  const rest = len - i;
  if (rest === 1) {
    const n = bytes[i] << 16;
    out.push(B64_CHARS[(n >> 18) & 63], B64_CHARS[(n >> 12) & 63], "=", "=");
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out.push(B64_CHARS[(n >> 18) & 63], B64_CHARS[(n >> 12) & 63], B64_CHARS[(n >> 6) & 63], "=");
  }
  return out.join("");
}

/**
 * Media type from the file's magic bytes when they're conclusive (a PDF
 * mis-uploaded with an image name must still go to the API as a document),
 * falling back to the extension.
 */
function mediaTypeFor(filename, bytes) {
  // "%PDF-"
  if (
    bytes && bytes.length >= 5 &&
    bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 &&
    bytes[3] === 0x46 && bytes[4] === 0x2d
  ) {
    return "application/pdf";
  }
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

// Matches ParsedReceipt in web/src/lib/receipt.ts.
const RECEIPT_SCHEMA = {
  type: "object",
  properties: {
    merchant: { type: "string", description: "Merchant/restaurant name, or empty string if unreadable" },
    currency: {
      type: ["string", "null"],
      description: "ISO 4217 currency code of the receipt's prices (e.g. USD, EUR, JPY), inferred from a printed symbol/code, or null if not identifiable",
    },
    items: {
      type: "array",
      description: "Every purchasable line item. Exclude subtotal/tax/tip/total lines. Discounts and coupons are items with negative cents.",
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: "Short item name as printed" },
          cents: { type: "integer", description: "Line total in cents (price x quantity as printed). Negative for discounts." },
        },
        required: ["label", "cents"],
        additionalProperties: false,
      },
    },
    subtotal_cents: { type: ["integer", "null"], description: "Printed subtotal in cents, null if not shown" },
    tax_cents: { type: ["integer", "null"], description: "Total tax in cents, null if not shown" },
    tip_cents: { type: ["integer", "null"], description: "Tip/gratuity in cents, null if not shown" },
    total_cents: { type: ["integer", "null"], description: "Printed grand total in cents, null if not shown" },
  },
  required: ["merchant", "currency", "items", "subtotal_cents", "tax_cents", "tip_cents", "total_cents"],
  additionalProperties: false,
};

function buildRequest(model, mediaType, fileB64) {
  // Photos go as an `image` block; PDFs (emailed receipts — rides, hotels,
  // flights) go as a `document` block. Same schema either way.
  const fileBlock =
    mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: mediaType, data: fileB64 } }
      : { type: "image", source: { type: "base64", media_type: mediaType, data: fileB64 } };
  return {
    model: model,
    max_tokens: 4000,
    system:
      "You transcribe receipts and invoices into structured data. They may be " +
      "photos of retail/restaurant receipts or PDF receipts (ride shares, hotels, " +
      "flights, vacation rentals). Read carefully, including faint or skewed text. " +
      "All money values are integer cents (e.g. $12.34 -> 1234). " +
      "If a quantity line shows unit price and quantity, report the line total. " +
      "For trip/stay invoices, charges like fares, nightly rates, cleaning or " +
      "service fees are items; taxes go in tax_cents, not the items. " +
      "Never invent items; if a line is illegible, skip it. " +
      "Report the ISO 4217 currency code the prices are printed in if you can tell from a symbol, code, or other cues; if you can't confidently identify it, use null rather than guessing.",
    messages: [
      {
        role: "user",
        content: [
          fileBlock,
          { type: "text", text: "Extract this receipt." },
        ],
      },
    ],
    output_config: {
      format: { type: "json_schema", schema: RECEIPT_SCHEMA },
    },
  };
}

/** Pull the structured JSON out of a Messages API response. */
function extractParsed(resJson) {
  if (resJson.stop_reason === "refusal") {
    throw new Error("Model declined to process this file");
  }
  const textBlock = (resJson.content || []).find((b) => b.type === "text");
  if (!textBlock) {
    throw new Error(`No text block in response (stop_reason: ${resJson.stop_reason})`);
  }
  const parsed = JSON.parse(textBlock.text);
  if (!Array.isArray(parsed.items)) {
    throw new Error("Parsed receipt has no items array");
  }
  return parsed;
}

module.exports = { base64Encode, mediaTypeFor, buildRequest, extractParsed, RECEIPT_SCHEMA };
