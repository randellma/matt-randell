/// <reference path="../pb_data/types.d.ts" />

// Accept PDF receipts alongside photos. Emailed receipts (Uber, hotels,
// flights, Airbnb) arrive as PDFs; the Claude API reads them natively via a
// `document` content block, so the same OCR hook handles both.

migrate(
  (app) => {
    const receipts = app.findCollectionByNameOrId('receipts');
    receipts.fields.getByName('image').mimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
    ];
    app.save(receipts);
  },
  (app) => {
    const receipts = app.findCollectionByNameOrId('receipts');
    receipts.fields.getByName('image').mimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ];
    app.save(receipts);
  },
);
