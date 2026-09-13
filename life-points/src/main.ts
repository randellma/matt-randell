import './style.css';

const pocketBaseUrl = import.meta.env.VITE_POCKETBASE_URL ?? 'http://127.0.0.1:8090';
const sessionKey = 'life-points-session';

type Account = { game: string; id: string; playerName: string; verified: true };
type PendingAuthRecord = { game: ''; id: string; playerName: ''; verified: true };
type AuthRecord = Account | PendingAuthRecord;
type AuthSession = { record: AuthRecord; token: string };
type Game = { id: string; title: string };
type OnboardingResult = { account: Account; game: Game };
type Category = {
  color: string;
  id: string;
  name: string;
  plantFamily: string;
  sortOrder: number;
};
type Activity = {
  active: boolean;
  category: string;
  id: string;
  name: string;
  points: number;
  sortOrder: number;
};
type ActivityEntry = { account: string; id: string; occurredOn: string; points: number };
type ActivityEntryItem = {
  activityName: string;
  categoryColor: string;
  categoryName: string;
  entry: string;
  points: number;
};
type RecordList<T> = { items: T[]; page: number; totalPages: number };

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

async function apiListAll<T>(collection: string, token: string): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const result = await apiRequest<RecordList<T>>(
      `/api/collections/${collection}/records?perPage=200&page=${page}`,
      { headers: { Authorization: token } },
    );
    items.push(...result.items);
    totalPages = result.totalPages;
    page += 1;
  } while (page <= totalPages);
  return items;
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

function localCalendarDate(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

async function renderHome(session: AuthSession, game: Game, message = ''): Promise<void> {
  const account = session.record as Account;
  const [categories, activities, gameEntries, entryItems] = await Promise.all([
    apiListAll<Category>('categories', session.token),
    apiListAll<Activity>('activities', session.token),
    apiListAll<ActivityEntry>('activity_entries', session.token),
    apiListAll<ActivityEntryItem>('activity_entry_items', session.token),
  ]);
  categories.sort((left, right) => left.sortOrder - right.sortOrder);
  const activeActivities = activities
    .filter((activity) => activity.active)
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const entries = gameEntries
    .filter((entry) => entry.account === account.id)
    .sort((left, right) => right.occurredOn.localeCompare(left.occurredOn));
  const lifetimePoints = entries.reduce((total, entry) => total + entry.points, 0);
  const activitiesByCategory = new Map<string, Activity[]>();
  for (const activity of activeActivities) {
    const categoryActivities = activitiesByCategory.get(activity.category) ?? [];
    categoryActivities.push(activity);
    activitiesByCategory.set(activity.category, categoryActivities);
  }
  const itemsByEntry = new Map<string, ActivityEntryItem[]>();
  for (const item of entryItems) {
    const entryItems = itemsByEntry.get(item.entry) ?? [];
    entryItems.push(item);
    itemsByEntry.set(item.entry, entryItems);
  }
  const categorySections = categories
    .filter((category) => activitiesByCategory.has(category.id))
    .map((category) => `
      <section class="activity-group" aria-labelledby="category-${category.id}">
        <h2 id="category-${category.id}"><span class="category-dot" style="--category-color: ${category.color}" aria-hidden="true"></span>${escapeHtml(category.name)}</h2>
        <div class="activity-options">
          ${(activitiesByCategory.get(category.id) ?? []).map((activity) => `
            <label class="activity-option">
              <input type="checkbox" name="activity" value="${activity.id}" aria-label="${escapeHtml(activity.name)}, ${activity.points} points" />
              <span>${escapeHtml(activity.name)}</span><strong>${activity.points}</strong>
            </label>`).join('')}
        </div>
      </section>`).join('');
  const historyItems = entries.map((entry) => {
    const entryItems = itemsByEntry.get(entry.id) ?? [];
    const dateLabel = entry.occurredOn === localCalendarDate() ? 'Today' : entry.occurredOn;
    return `<li class="history-entry">
      <div><time datetime="${entry.occurredOn}">${dateLabel}</time>${entryItems.map((item) => `<strong>${escapeHtml(item.activityName)}</strong><span>${escapeHtml(item.categoryName)}</span>`).join('')}</div>
      <b>+${entry.points} points</b>
    </li>`;
  }).join('');

  app.innerHTML = `
    <main class="home-shell">
      <header class="home-header"><p class="eyebrow">Life Points</p><button class="text-button" id="sign-out" type="button">Sign out</button></header>
      <section class="home-card" aria-labelledby="home-title">
        <span class="home-sprout" aria-hidden="true">🌱</span>
        <h1 id="home-title">Welcome, ${escapeHtml(account.playerName)}</h1>
        <p>${escapeHtml(game.title)}</p>
        <div class="point-totals">
          <div><span>Lifetime Points</span><strong>${lifetimePoints}</strong></div>
          <div><span>Available Points</span><strong>${lifetimePoints}</strong></div>
        </div>
        <button class="quick-add" id="quick-add" type="button">Log an Activity Entry</button>
        <p class="save-message" role="status" aria-live="polite">${escapeHtml(message)}</p>
      </section>
      <section class="history-card" aria-labelledby="history-title">
        <h2 id="history-title">History</h2>
        ${historyItems === '' ? '<p class="history-empty">Your first good thing will appear here.</p>' : `<ol class="history-list">${historyItems}</ol>`}
      </section>
      <dialog class="quick-add-sheet" id="quick-add-sheet" aria-labelledby="quick-add-title">
        <form id="quick-add-form">
          <header><div><p class="eyebrow">Quick-add</p><h1 id="quick-add-title">What felt good today?</h1></div><button class="close-sheet" id="close-sheet" type="button" aria-label="Close">×</button></header>
          <div class="activity-groups">${categorySections}</div>
          <button class="save-entry" type="submit" disabled>Save Activity Entry</button>
        </form>
      </dialog>
    </main>`;
  document.querySelector<HTMLButtonElement>('#sign-out')!.addEventListener('click', () => {
    localStorage.removeItem(sessionKey);
    renderWelcome();
  });
  const sheet = document.querySelector<HTMLDialogElement>('#quick-add-sheet')!;
  const form = document.querySelector<HTMLFormElement>('#quick-add-form')!;
  const saveButton = form.querySelector<HTMLButtonElement>('.save-entry')!;
  document.querySelector<HTMLButtonElement>('#quick-add')!.addEventListener('click', () => sheet.showModal());
  document.querySelector<HTMLButtonElement>('#close-sheet')!.addEventListener('click', () => sheet.close());
  form.addEventListener('change', () => {
    saveButton.disabled = form.querySelectorAll<HTMLInputElement>('input[name="activity"]:checked').length < 1;
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const activityIds = new FormData(form).getAll('activity').map((value) => value.toString());
    if (activityIds.length < 1) return;
    saveButton.disabled = true;
    void saveActivityEntry(session, game, activityIds);
  });
}

async function saveActivityEntry(session: AuthSession, game: Game, activityIds: string[]): Promise<void> {
  try {
    const result = await apiRequest<{ entry: { points: number } }>('/api/life-points/v1/activity-entries', {
      body: JSON.stringify({ activityIds, occurredOn: localCalendarDate() }),
      headers: { Authorization: session.token },
      method: 'POST',
    });
    await renderHome(session, game, `${result.entry.points} points earned`);
  } catch {
    await renderHome(session, game, 'We could not save that Activity Entry. Please try again.');
  }
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
    await renderHome(provisionedSession, result.game);
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
    await renderHome({ ...session, record: account }, game);
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
