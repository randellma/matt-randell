import './style.css';

const pocketBaseUrl = import.meta.env.VITE_POCKETBASE_URL ?? 'http://127.0.0.1:8090';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="welcome-shell">
    <div class="sun-glow" aria-hidden="true"></div>
    <div class="leaf leaf-one" aria-hidden="true"></div>
    <div class="leaf leaf-two" aria-hidden="true"></div>

    <section class="welcome-card" aria-labelledby="welcome-title">
      <div class="brand-mark" aria-hidden="true">
        <span class="petal petal-one"></span>
        <span class="petal petal-two"></span>
        <span class="petal petal-three"></span>
        <span class="petal petal-four"></span>
        <span class="flower-center"></span>
      </div>

      <p class="eyebrow">Life Points</p>
      <h1 id="welcome-title">Grow a life that feels rich.</h1>
      <p class="promise">
        Notice the movement, creativity, connection, and small adventures that make
        your days feel like yours.
      </p>

      <div class="gentle-note">
        <span class="sparkle" aria-hidden="true">✦</span>
        <div>
          <strong>No streaks. No falling behind.</strong>
          <span>Just a garden that grows with every good thing.</span>
        </div>
      </div>

      <div class="readiness">
        <span class="readiness-dot" aria-hidden="true"></span>
        <span id="api-status" role="status" aria-live="polite">Waking up the garden…</span>
      </div>
    </section>

    <p class="footer-note">Made for a life with room to breathe.</p>
  </main>
`;

const apiStatus = document.querySelector<HTMLSpanElement>('#api-status')!;
const readiness = document.querySelector<HTMLDivElement>('.readiness')!;

async function checkReadiness(): Promise<void> {
  try {
    const response = await fetch(`${pocketBaseUrl}/api/life-points/v1/health`, {
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      throw new Error(`Health request returned ${response.status}`);
    }

    const health: unknown = await response.json();
    if (
      typeof health !== 'object' ||
      health === null ||
      !('status' in health) ||
      health.status !== 'healthy'
    ) {
      throw new Error('Health response was not healthy');
    }

    apiStatus.textContent = 'Life Points is ready';
    readiness.dataset.state = 'ready';
  } catch {
    apiStatus.textContent = 'The garden is still waking up';
    readiness.dataset.state = 'waiting';
  }
}

void checkReadiness();
