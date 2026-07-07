/// <reference path="../pb_data/types.d.ts" />

// Avatar photos for groups, members, and parties. The PWA center-crops to a
// small square JPEG before upload, so these stay tiny. The party photo lives
// on every member of the party (same denormalized style as party_name) so it
// survives any single member being unlinked. Files are public-if-you-know-
// the-URL, same as receipt images — filenames are random, and the group is
// link-access anyway.

const photoField = (name) =>
  new Field({
    name,
    type: 'file',
    required: false,
    maxSelect: 1,
    maxSize: 2097152,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  });

migrate(
  (app) => {
    const groups = app.findCollectionByNameOrId('groups');
    groups.fields.add(photoField('photo'));
    app.save(groups);

    const members = app.findCollectionByNameOrId('members');
    members.fields.add(photoField('photo'));
    members.fields.add(photoField('party_photo'));
    app.save(members);
  },
  (app) => {
    const groups = app.findCollectionByNameOrId('groups');
    groups.fields.removeByName('photo');
    app.save(groups);

    const members = app.findCollectionByNameOrId('members');
    members.fields.removeByName('photo');
    members.fields.removeByName('party_photo');
    app.save(members);
  },
);
