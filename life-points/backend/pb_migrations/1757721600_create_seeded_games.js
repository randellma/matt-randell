const ownerName = $os.getenv('LIFE_POINTS_OWNER_NAME') || 'Ysabel';

const SEEDED_GAMES = [
  {
    accountId: 'acctysabel00001',
    email: $os.getenv('LIFE_POINTS_OWNER_EMAIL') || 'ysabel@example.test',
    gameId: 'gameysabel00001',
    playerName: ownerName,
    title: $os.getenv('LIFE_POINTS_GAME_TITLE') || `${ownerName}'s Life Points`,
  },
  {
    accountId: 'acctfriend00001',
    email: 'friend@example.test',
    gameId: 'gamefriend00001',
    playerName: 'Rowan',
    title: "Rowan's Life Points",
  },
];

migrate(
  (app) => {
    const games = new Collection({
      type: 'base',
      name: 'games',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          type: 'text',
          name: 'title',
          required: true,
          max: 120,
        },
        {
          type: 'file',
          name: 'cover',
          maxSelect: 1,
          maxSize: 2 * 1024 * 1024,
          mimeTypes: ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'],
          protected: true,
        },
      ],
    });
    app.save(games);

    const accounts = new Collection({
      type: 'auth',
      name: 'accounts',
      listRule: 'id = @request.auth.id',
      viewRule: 'id = @request.auth.id',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      authRule: '',
      fields: [
        {
          type: 'text',
          name: 'playerName',
          required: true,
          max: 80,
        },
        {
          type: 'relation',
          name: 'game',
          required: true,
          maxSelect: 1,
          collectionId: games.id,
          cascadeDelete: true,
        },
        {
          type: 'select',
          name: 'role',
          required: true,
          maxSelect: 1,
          values: ['owner', 'participant'],
        },
      ],
      passwordAuth: { enabled: false },
      otp: {
        enabled: true,
        duration: 180,
        length: 8,
        emailTemplate: {
          subject: 'Your Life Points code',
          body:
            '<p>Your Life Points code is <strong>{OTP}</strong>.</p>' +
            '<p>It expires in 3 minutes.</p>' +
            '<p><a href="' +
            ($os.getenv('LIFE_POINTS_WEB_URL') || 'http://127.0.0.1:4173') +
            '/?otpId={OTP_ID}&otp={OTP}">Enter Life Points</a></p>',
        },
      },
      authToken: { duration: 30 * 24 * 60 * 60 },
    });
    app.save(accounts);

    games.listRule = '@request.auth.game = id';
    games.viewRule = '@request.auth.game = id';
    games.updateRule = '@request.auth.game = id';
    app.save(games);

    for (const seed of SEEDED_GAMES) {
      const game = new Record(games);
      game.id = seed.gameId;
      game.set('title', seed.title);
      app.save(game);

      const account = new Record(accounts);
      account.id = seed.accountId;
      account.setEmail(seed.email);
      account.setVerified(true);
      account.setRandomPassword();
      account.set('playerName', seed.playerName);
      account.set('game', seed.gameId);
      account.set('role', 'owner');
      app.save(account);
    }
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('accounts'));
    app.delete(app.findCollectionByNameOrId('games'));
  },
);
