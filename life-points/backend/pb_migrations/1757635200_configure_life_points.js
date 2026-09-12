migrate(
  (app) => {
    const settings = app.settings();
    settings.meta.appName = 'Life Points';
    settings.meta.appURL = $os.getenv('LIFE_POINTS_PUBLIC_URL') || 'http://127.0.0.1:8090';
    settings.logs.maxDays = 7;
    settings.logs.logAuthId = false;
    settings.logs.logIP = false;
    app.save(settings);
  },
  (app) => {
    const settings = app.settings();
    settings.meta.appName = 'PocketBase';
    settings.meta.appURL = '';
    app.save(settings);
  },
);
