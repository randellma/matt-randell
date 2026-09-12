migrate(
  (app) => {
    const account = app.findRecordById('accounts', 'acctysabel00001');
    account.setEmail('ysabel08@gmail.com');
    account.setVerified(true);
    account.set('playerName', 'Ysabel');
    app.save(account);

    const game = app.findRecordById('games', 'gameysabel00001');
    game.set('title', "Ysabel's Life Points");
    app.save(game);
  },
  (app) => {
    const account = app.findRecordById('accounts', 'acctysabel00001');
    account.setEmail('ysabel@example.test');
    account.set('playerName', 'Ysabel');
    app.save(account);

    const game = app.findRecordById('games', 'gameysabel00001');
    game.set('title', "Ysabel's Life Points");
    app.save(game);
  },
);
