import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import process from 'node:process';

const projectName = `life-points-acceptance-${process.pid}`;
const [apiPort, webPort] = await Promise.all([findAvailablePort(), findAvailablePort()]);
const environment = {
  ...process.env,
  COMPOSE_PROJECT_NAME: projectName,
  LIFE_POINTS_API_PORT: apiPort,
  LIFE_POINTS_API_URL: `http://127.0.0.1:${apiPort}`,
  LIFE_POINTS_WEB_PORT: webPort,
  LIFE_POINTS_WEB_URL: `http://127.0.0.1:${webPort}`,
};

function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (typeof address !== 'object' || address === null) {
        server.close();
        reject(new Error('Could not allocate an acceptance port.'));
        return;
      }

      server.close((error) => {
        if (error) reject(error);
        else resolve(String(address.port));
      });
    });
  });
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: new URL('..', import.meta.url),
    env: environment,
    stdio: 'inherit',
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 1;
}

let exitCode = 1;

try {
  const stackExitCode = run('docker', [
    'compose',
    'up',
    '--build',
    '--detach',
    '--wait',
  ]);

  if (stackExitCode !== 0) {
    throw new Error(`The acceptance stack exited with code ${stackExitCode}.`);
  }

  exitCode = run('npx', ['playwright', 'test']);
} finally {
  const cleanupExitCode = run('docker', [
    'compose',
    'down',
    '--volumes',
    '--remove-orphans',
  ]);

  if (cleanupExitCode !== 0) {
    exitCode = cleanupExitCode;
  }
}

process.exitCode = exitCode;
