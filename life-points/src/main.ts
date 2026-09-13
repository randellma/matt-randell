import './style.css';

const pocketBaseUrl = import.meta.env.VITE_POCKETBASE_URL ?? 'http://127.0.0.1:8090';
const sessionKey = 'life-points-session';

type Account = { game: string; id: string; playerName: string; verified: true };
type PendingAuthRecord = { game: ''; id: string; playerName: ''; verified: true };
type AuthRecord = Account | PendingAuthRecord;
type AuthSession = { record: AuthRecord; token: string };
type Game = { id: string; title: string };
type OnboardingResult = { account: Account; game: Game };

const app = document.querySelector<HTMLDivElement>('#app')!;

function escapeHtml(value: string): string {
  const element = document.createElement('span');
  element.textContent = value;
  return element.innerHTML;
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${pocketBaseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  if (!response.ok) throw new Error(`Life Points request returned ${response.status}`);
  return response.json() as Promise<T>;
}

function readSession(): AuthSession | null {
  try {
    const stored = localStorage.getItem(sessionKey);
    return stored ? (JSON.parse(stored) as AuthSession) : null;
  } catch {
    localStorage.removeItem(sessionKey);
    return null;
  }
}

function saveSession(session: AuthSession): void {
  localStorage.setItem(sessionKey, JSON.stringify(session));
}

function isPendingAuthRecord(record: AuthRecord): record is PendingAuthRecord {
  return record.game === '';
}

function defaultGameTitle(playerName: string): string {
  const trimmedName = playerName.trim();
  return trimmedName === '' ? '' : `${trimmedName}'s Life Points`;
}

function renderWelcome(message = ''): void {
  app.innerHTML = `
    <main class="welcome-shell">
      <div class="leaf leaf-two" aria-hidden="true"></div>
      <section class="welcome-card" aria-labelledby="welcome-title">
        <div class="brand-mark" aria-hidden="true">
          <span class="petal petal-one"></span><span class="petal petal-two"></span>
          <span class="petal petal-three"></span><span class="petal petal-four"></span>
          <span class="flower-center"></span>
        </div>
        <p class="eyebrow">Life Points</p>
        <h1 id="welcome-title">Grow a life that feels rich.</h1>
        <p class="promise">Notice the movement, creativity, connection, and small adventures that make your days feel like yours.</p>
        <form class="entry-form" id="email-form">
          <label for="email">Email address</label>
          <input id="email" name="email" type="email" autocomplete="email" required />
          <button type="submit">Email me a code</button>
        </form>
        <p class="form-message" role="alert">${escapeHtml(message)}</p>
        <div class="gentle-note">
          <span class="sparkle" aria-hidden="true">✦</span>
          <div><strong>No streaks. No falling behind.</strong><span>Just a garden that grows with every good thing.</span></div>
        </div>
        <div class="readiness">
          <span class="readiness-dot" aria-hidden="true"></span>
          <span id="api-status" role="status" aria-live="polite">Waking up the garden…</span>
        </div>
      </section>
      <p class="footer-note">Made for a life with room to breathe.</p>
    </main>`;

  document.querySelector<HTMLFormElement>('#email-form')!.addEventListener('submit', (event) => {
    event.preventDefault();
    void sendOtp(
      new FormData(event.currentTarget as HTMLFormElement).get('email')?.toString() ?? '',
    );
  });
  void checkReadiness();
}

function renderCodeEntry(email: string, otpId: string, message = ''): void {
  app.innerHTML = `
    <main class="entry-shell"><section class="entry-card" aria-labelledby="code-title">
      <p class="eyebrow">A little note is on its way</p>
      <h1 id="code-title">Check your email.</h1>
      <p>We sent an eight-digit code and magic link to <strong>${escapeHtml(email)}</strong>.</p>
      <p>The code expires in 3 minutes.</p>
      <form class="entry-form" id="code-form">
        <label for="code">Eight-digit code</label>
        <input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{8}" maxlength="8" required />
        <button type="submit">Enter my Game</button>
      </form>
      <p class="form-message" role="alert">${escapeHtml(message)}</p>
      <button class="text-button" id="start-over" type="button">Use another email</button>
    </section></main>`;

  document.querySelector<HTMLFormElement>('#code-form')!.addEventListener('submit', (event) => {
    event.preventDefault();
    const code =
      new FormData(event.currentTarget as HTMLFormElement).get('code')?.toString() ?? '';
    void authenticate(otpId, code, () => renderCodeEntry(email, otpId));
  });
  document.querySelector<HTMLButtonElement>('#start-over')!.addEventListener('click', () => {
    sessionStorage.removeItem('life-points-pending-otp');
    renderWelcome();
  });
}

function renderLoading(): void {
  app.innerHTML = '<main class="entry-shell"><p class="loading-message" role="status">Opening your garden…</p></main>';
}

function renderOnboarding(session: AuthSession, message = ''): void {
  app.innerHTML = `
    <main class="entry-shell"><section class="entry-card" aria-labelledby="onboarding-title">
      <p class="eyebrow">Your email is verified</p>
      <h1 id="onboarding-title">Make it yours.</h1>
      <p>Choose how Life Points greets you. Your complete Starter Pack will be waiting inside.</p>
      <form class="entry-form" id="onboarding-form">
        <label for="player-name">Player Name</label>
        <input id="player-name" name="playerName" autocomplete="name" maxlength="80" required />
        <label for="game-title">Game title</label>
        <input id="game-title" name="title" maxlength="120" required />
        <button type="submit">Start my Game</button>
      </form>
      <p class="form-message" role="alert">${escapeHtml(message)}</p>
    </section></main>`;

  const form = document.querySelector<HTMLFormElement>('#onboarding-form')!;
  const playerName = document.querySelector<HTMLInputElement>('#player-name')!;
  const title = document.querySelector<HTMLInputElement>('#game-title')!;
  let titleWasEdited = false;
  playerName.addEventListener('input', () => {
    if (!titleWasEdited) {
      title.value = defaultGameTitle(playerName.value);
    }
  });
  title.addEventListener('input', () => {
    titleWasEdited = title.value !== defaultGameTitle(playerName.value);
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = new FormData(form);
    void provisionGame(
      session,
      values.get('playerName')?.toString() ?? '',
      values.get('title')?.toString() ?? '',
    );
  });
}

function renderHome(account: Account, game: Game): void {
  app.innerHTML = `
    <main class="home-shell">
      <header class="home-header"><p class="eyebrow">Life Points</p><button class="text-button" id="sign-out" type="button">Sign out</button></header>
      <section class="home-card" aria-labelledby="home-title">
        <span class="home-sprout" aria-hidden="true">🌱</span>
        <h1 id="home-title">Welcome, ${escapeHtml(account.playerName)}</h1>
        <p>${escapeHtml(game.title)}</p>
        <div class="empty-garden"><strong>Your garden is ready to grow.</strong><span>Every good thing will have a place here.</span></div>
      </section>
    </main>`;
  document.querySelector<HTMLButtonElement>('#sign-out')!.addEventListener('click', () => {
    localStorage.removeItem(sessionKey);
    renderWelcome();
  });
}

async function sendOtp(email: string): Promise<void> {
  try {
    const result = await apiRequest<{ otpId: string }>('/api/collections/accounts/request-otp', {
      body: JSON.stringify({ email }),
      method: 'POST',
    });
    sessionStorage.setItem('life-points-pending-otp', JSON.stringify({ email, otpId: result.otpId }));
    renderCodeEntry(email, result.otpId);
  } catch {
    renderWelcome('We could not send a code just now. Please try again.');
  }
}

async function authenticate(
  otpId: string,
  code: string,
  retry: () => void = () => renderWelcome(),
): Promise<void> {
  renderLoading();
  try {
    const session = await apiRequest<AuthSession>('/api/collections/accounts/auth-with-otp', {
      body: JSON.stringify({ otpId, password: code }),
      method: 'POST',
    });
    saveSession(session);
    sessionStorage.removeItem('life-points-pending-otp');
    history.replaceState({}, '', location.pathname);
    if (isPendingAuthRecord(session.record)) {
      renderOnboarding(session);
    } else {
      await openHome(session);
    }
  } catch {
    history.replaceState({}, '', location.pathname);
    retry();
    document.querySelector<HTMLElement>('[role="alert"]')!.textContent = 'That code has already been used or has expired.';
  }
}

async function provisionGame(
  session: AuthSession,
  playerName: string,
  title: string,
): Promise<void> {
  renderLoading();
  try {
    const result = await apiRequest<OnboardingResult>('/api/life-points/v1/onboarding', {
      body: JSON.stringify({ playerName, title }),
      headers: { Authorization: session.token },
      method: 'POST',
    });
    const provisionedSession = { ...session, record: result.account };
    saveSession(provisionedSession);
    renderHome(result.account, result.game);
  } catch {
    renderOnboarding(session, 'We could not create your Game just now. Please try again.');
  }
}

async function openHome(session: AuthSession): Promise<void> {
  try {
    const account = await apiRequest<AuthRecord>(`/api/collections/accounts/records/${session.record.id}`, {
      headers: { Authorization: session.token },
    });
    if (isPendingAuthRecord(account)) {
      const pendingSession = { ...session, record: account };
      saveSession(pendingSession);
      renderOnboarding(pendingSession);
      return;
    }
    const game = await apiRequest<Game>(`/api/collections/games/records/${account.game}`, {
      headers: { Authorization: session.token },
    });
    renderHome(account, game);
  } catch {
    localStorage.removeItem(sessionKey);
    renderWelcome('Your session has ended. Ask for a new code to come back in.');
  }
}

async function checkReadiness(): Promise<void> {
  const apiStatus = document.querySelector<HTMLSpanElement>('#api-status');
  const readiness = document.querySelector<HTMLDivElement>('.readiness');
  if (!apiStatus || !readiness) return;
  try {
    const health = await apiRequest<{ status: string }>('/api/life-points/v1/health', { signal: AbortSignal.timeout(5_000) });
    if (health.status !== 'healthy') throw new Error('Health response was not healthy');
    apiStatus.textContent = 'Life Points is ready';
    readiness.dataset.state = 'ready';
  } catch {
    apiStatus.textContent = 'The garden is still waking up';
    readiness.dataset.state = 'waiting';
  }
}

async function start(): Promise<void> {
  const parameters = new URLSearchParams(location.search);
  const otpId = parameters.get('otpId');
  const otp = parameters.get('otp');
  if (otpId && otp) return authenticate(otpId, otp);

  const session = readSession();
  if (session) {
    renderLoading();
    await openHome(session);
    return;
  }

  const pending = sessionStorage.getItem('life-points-pending-otp');
  if (pending) {
    const parsed = JSON.parse(pending) as { email: string; otpId: string };
    renderCodeEntry(parsed.email, parsed.otpId);
    return;
  }
  renderWelcome();
}

void start();
