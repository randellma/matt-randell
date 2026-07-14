/// <reference path="../pb_data/types.d.ts" />

// Scan credit gate. A receipt created with status "pending" is a scan request
// (status "done" is a plain photo attachment — always free, no account
// needed). Before the record exists, work out whose balance the scan will
// charge and stamp it on the record; the OCR hook deducts only if parsing
// succeeds, so failed scans cost nothing.

onRecordCreateRequest((e) => {
  if (e.record.getString('status') !== 'pending') {
    return e.next();
  }

  const utils = require(`${__hooks}/accounts_utils.js`);
  const me = e.auth && e.auth.collection().name === 'users' ? e.auth : null;
  const src = utils.resolveScanSource(e.app, me, e.record.getString('group'));
  if (!src.user) {
    // The 402 status is the machine-readable part — the client keys off it.
    throw new ApiError(402, 'No scans available — sign in or top up to scan receipts.', {});
  }
  e.record.set('credit_user', src.user.id);
  return e.next();
}, 'receipts');
