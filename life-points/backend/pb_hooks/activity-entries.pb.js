/// <reference path="../pb_data/types.d.ts" />

routerAdd(
  'POST',
  '/api/life-points/v1/activity-entries',
  (event) => {
    const body = event.requestInfo().body;
    const submittedActivityIds = Array.isArray(body.activityIds) ? body.activityIds : [];
    const activityIds = submittedActivityIds.filter(
      (activityId, index) =>
        typeof activityId === 'string' && submittedActivityIds.indexOf(activityId) === index,
    );
    const occurredOn = typeof body.occurredOn === 'string' ? body.occurredOn : '';
    const date = new Date(`${occurredOn}T00:00:00.000Z`);
    const isCalendarDate =
      /^\d{4}-\d{2}-\d{2}$/.test(occurredOn) &&
      !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === occurredOn;
    if (!isCalendarDate) {
      throw new BadRequestError('Activity Entry date must be a calendar date.');
    }
    if (activityIds.length < 1) {
      throw new BadRequestError('Select at least one Activity.');
    }

    let result;
    event.app.runInTransaction((txApp) => {
      const account = txApp.findRecordById('accounts', event.auth.id);
      const gameId = account.getString('game');
      const selections = activityIds.map((activityId) => {
        const activity = txApp.findRecordById('activities', activityId);
        if (gameId === '' || activity.getString('game') !== gameId || !activity.getBool('active')) {
          throw new NotFoundError('Activity not found.');
        }
        const category = txApp.findRecordById('categories', activity.getString('category'));
        if (category.getString('game') !== gameId) {
          throw new NotFoundError('Category not found.');
        }
        return { activity, category };
      });
      const points = selections.reduce(
        (total, { activity }) => total + activity.getInt('points'),
        0,
      );

      const entry = new Record(txApp.findCollectionByNameOrId('activity_entries'));
      entry.set('game', gameId);
      entry.set('account', account.id);
      entry.set('occurredOn', occurredOn);
      entry.set('points', points);
      entry.set('recordedAt', new Date().toISOString());
      txApp.save(entry);

      const items = selections.map(({ activity, category }) => {
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
        return {
          activityName: item.getString('activityName'),
          categoryName: item.getString('categoryName'),
        };
      });

      result = {
        entry: {
          id: entry.id,
          occurredOn: entry.getString('occurredOn'),
          points: entry.getInt('points'),
        },
        items,
      };
    });

    return event.json(201, result);
  },
  $apis.requireAuth('accounts'),
);
