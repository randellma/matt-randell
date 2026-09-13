/// <reference path="../pb_data/types.d.ts" />

onRecordRequestOTPRequest((event) => {
  if (event.record) {
    return event.next();
  }

  const submittedEmail = event.requestInfo().body.email;
  const email = (typeof submittedEmail === 'string' ? submittedEmail.trim() : '').toLowerCase();
  const account = new Record(event.collection);
  account.setEmail(email);
  account.setRandomPassword();
  account.set('role', 'owner');

  try {
    event.app.save(account);
    event.record = account;
  } catch (error) {
    // A concurrent registration may have created the same email after the
    // builtin lookup. Reuse it so retrying never creates a second Account.
    try {
      event.record = event.app.findAuthRecordByEmail('accounts', email);
    } catch {
      event.app.logger().error(
        'Pending Life Points Account could not be created',
        'error',
        String(error),
      );
      throw error;
    }
  }

  return event.next();
}, 'accounts');

routerAdd(
  'POST',
  '/api/life-points/v1/onboarding',
  (event) => {
    const cleanText = (value) => (typeof value === 'string' ? value.trim() : '');
    const createRecord = (app, collectionName, values) => {
      const record = new Record(app.findCollectionByNameOrId(collectionName));
      for (const [field, value] of Object.entries(values)) {
        record.set(field, value);
      }
      app.save(record);
      return record;
    };

    if (!event.auth.getBool('verified')) {
      throw new ForbiddenError('Verify your email before creating a Game.');
    }

    const body = event.requestInfo().body;
    const playerName = cleanText(body.playerName);
    const requestedTitle = cleanText(body.title);
    if (playerName.length < 1 || playerName.length > 80) {
      throw new BadRequestError('Player Name must be between 1 and 80 characters.');
    }
    const title = requestedTitle || `${playerName}'s Life Points`;
    if (title.length > 120) {
      throw new BadRequestError('Game title must be no more than 120 characters.');
    }

    let result;
    event.app.runInTransaction((txApp) => {
      const account = txApp.findRecordById('accounts', event.auth.id);
      const existingGameId = account.getString('game');
      if (existingGameId !== '') {
        result = {
          account,
          game: txApp.findRecordById('games', existingGameId),
        };
        return;
      }
      if (!account.getBool('verified')) {
        throw new ForbiddenError('Verify your email before creating a Game.');
      }

      const pack = JSON.parse(toString($os.readFile('/pb/pb_seeds/starter-pack.v1.json')));
      const game = createRecord(txApp, 'games', { title });
      let activityOrder = 1;

      pack.categories.forEach((categorySeed, categoryOrder) => {
        const category = createRecord(txApp, 'categories', {
          game: game.id,
          name: categorySeed.name,
          color: categorySeed.color,
          plantFamily: categorySeed.plantFamily,
          sortOrder: categoryOrder + 1,
        });
        categorySeed.activities.forEach((activitySeed) => {
          createRecord(txApp, 'activities', {
            game: game.id,
            category: category.id,
            name: activitySeed.name,
            points: activitySeed.points,
            sortOrder: activityOrder,
            active: true,
          });
          activityOrder += 1;
        });
      });

      pack.rewards.forEach((rewardSeed, sortOrder) => {
        createRecord(txApp, 'rewards', {
          game: game.id,
          name: rewardSeed.name,
          cost: rewardSeed.cost,
          sortOrder: sortOrder + 1,
          active: true,
        });
      });

      const month = new Date().toISOString().slice(0, 7);
      for (let slot = 1; slot <= pack.monthlyQuestSlots; slot += 1) {
        createRecord(txApp, 'monthly_quests', {
          game: game.id,
          account: account.id,
          month,
          slot,
          title: '',
          points: pack.monthlyQuestPoints,
          completed: false,
          sortOrder: slot,
        });
      }

      account.set('playerName', playerName);
      account.set('game', game.id);
      account.set('role', 'owner');
      txApp.save(account);
      result = { account, game };
    });

    return event.json(200, result);
  },
  $apis.requireAuth('accounts'),
);
