/// <reference path="../pb_data/types.d.ts" />

// Thumb size for receipt images, so the attached-receipt preview in the
// expense form doesn't pull the full photo. PocketBase generates thumbs
// lazily and serves the original for any size not listed here.

migrate(
  (app) => {
    const receipts = app.findCollectionByNameOrId('receipts');
    receipts.fields.getByName('image').thumbs = ['0x200'];
    app.save(receipts);
  },
  (app) => {
    const receipts = app.findCollectionByNameOrId('receipts');
    receipts.fields.getByName('image').thumbs = [];
    app.save(receipts);
  },
);
