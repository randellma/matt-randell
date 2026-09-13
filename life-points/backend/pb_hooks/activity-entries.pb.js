/// <reference path="../pb_data/types.d.ts" />

routerAdd(
  'POST',
  '/api/life-points/v1/activity-entries',
  (event) => {
    const body = event.requestInfo().body;
    const activityId = typeof body.activityId === 'string' ? body.activityId : '';
    const occurredOn = typeof body.occurredOn === 'string' ? body.occurredOn : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) {
      throw new BadRequestError('Activity Entry date must be a calendar date.');
    }

    let result;
    event.app.runInTransaction((txApp) => {
      const account = txApp.findRecordById('accounts', event.auth.id);
      const gameId = account.getString('game');
      const activity = txApp.findRecordById('activities', activityId);
      if (gameId === '' || activity.getString('game') !== gameId || !activity.getBool('active')) {
        throw new NotFoundError('Activity not found.');
      }
      const category = txApp.findRecordById('categories', activity.getString('category'));
      if (category.getString('game') !== gameId) {
        throw new NotFoundError('Category not found.');
      }

      const entry = new Record(txApp.findCollectionByNameOrId('activity_entries'));
      entry.set('game', gameId);
      entry.set('account', account.id);
      entry.set('occurredOn', occurredOn);
      entry.set('points', activity.getInt('points'));
      txApp.save(entry);

      const item = new Record(txApp.findCollectionByNameOrId('activity_entry_items'));
      item.set('game', gameId);
      item.set('entry', entry.id);
      item.set('activity', activity.id);
      item.set('category', category.id);
      item.set('activityName', activity.getString('name'));
      item.set('categoryName', category.getString('name'));
      item.set('points', activity.getInt('points'));
      item.set('categoryColor', category.getString('color'));
      item.set('categoryPlantFamily', category.getString('plantFamily'));
      txApp.save(item);

      result = {
        entry: {
          id: entry.id,
          occurredOn: entry.getString('occurredOn'),
          points: entry.getInt('points'),
        },
        item: {
          activityName: item.getString('activityName'),
          categoryName: item.getString('categoryName'),
        },
      };
    });

    return event.json(201, result);
  },
  $apis.requireAuth('accounts'),
);
