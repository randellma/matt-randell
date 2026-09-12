routerAdd('GET', '/api/life-points/v1/health', (event) => {
  return event.json(200, {
    apiVersion: 'v1',
    service: 'life-points',
    status: 'healthy',
  });
});
