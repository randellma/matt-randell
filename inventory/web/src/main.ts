import { LocalStorageSecretStore } from './SecretStore';
import { AppsScriptStore } from './AppsScriptStore';
import { getSecretFromUrl } from './getSecretFromUrl';
import type { Disposition, Item } from './InventoryStore';

const ENDPOINT_URL =
  'https://script.google.com/macros/s/AKfycbyjJnL9Rv3qyyy_aV2-nrAtICndug41fE-ZCkZEU205fftVSaWIOW_VrOfpdWJFTwH-EQ/exec';

const secretStore = new LocalStorageSecretStore();
const inventoryStore = new AppsScriptStore(ENDPOINT_URL, secretStore);

const gate = document.getElementById('gate')!;
const tabNav = document.getElementById('tab-nav')!;
const capture = document.getElementById('capture')!;
const viewer = document.getElementById('viewer')!;
const tabCapture = document.getElementById('tab-capture') as HTMLButtonElement;
const tabViewer = document.getElementById('tab-viewer') as HTMLButtonElement;
const secretInput = document.getElementById('secret-input') as HTMLInputElement;
const secretSave = document.getElementById('secret-save') as HTMLButtonElement;
const photoInput = document.getElementById('photo-input') as HTMLInputElement;
const photoLabel = document.getElementById('photo-label') as HTMLLabelElement;
const photoPreview = document.getElementById('photo-preview') as HTMLImageElement;
const nameInput = document.getElementById('name-input') as HTMLInputElement;
const dispositionSelect = document.getElementById('disposition-select') as HTMLSelectElement;
const captureBtn = document.getElementById('capture-btn') as HTMLButtonElement;
const captureError = document.getElementById('capture-error') as HTMLDivElement;
const queueList = document.getElementById('queue-list')!;
const viewerStatus = document.getElementById('viewer-status')!;
const refreshBtn = document.getElementById('refresh-btn') as HTMLButtonElement;
const itemList = document.getElementById('item-list')!;

let cachedItems: Item[] | null = null;

// ── Upload queue ──────────────────────────────────────────────────────────────

interface QueueEntry {
  id: string;
  name: string;
  disposition?: Disposition;
  capturedAt: string;
  photo: Blob;
  objectUrl: string;
  status: 'pending' | 'uploading' | 'done' | 'failed';
  error?: string;
}

let queue: QueueEntry[] = [];
let isProcessing = false;
let retryBlob: Blob | null = null;

function renderQueue() {
  queueList.innerHTML = queue.map(entry => {
    const thumb = `<img class="chip-thumb" src="${entry.objectUrl}" alt="" />`;
    const name = `<span class="chip-name">${entry.name}</span>`;
    let indicator: string;
    let extra = '';
    switch (entry.status) {
      case 'pending':   indicator = `<span class="chip-indicator">···</span>`; break;
      case 'uploading': indicator = `<span class="chip-indicator"><span class="spinner"></span></span>`; break;
      case 'done':      indicator = `<span class="chip-indicator">✓</span>`; break;
      case 'failed':
        indicator = `<span class="chip-indicator">✗</span>`;
        extra = `<span class="chip-retry">Tap to retry</span>`;
        break;
    }
    return `<div class="queue-chip ${entry.status}" data-id="${entry.id}">${thumb}${name}${extra}${indicator}</div>`;
  }).join('');
}

async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;
  while (true) {
    const next = queue.find(e => e.status === 'pending');
    if (!next) break;
    next.status = 'uploading';
    renderQueue();
    try {
      await inventoryStore.capture({
        name: next.name,
        photo: next.photo,
        capturedAt: next.capturedAt,
        disposition: next.disposition,
      });
      next.status = 'done';
      cachedItems = null;
      renderQueue();
      setTimeout(() => {
        URL.revokeObjectURL(next.objectUrl);
        queue = queue.filter(e => e.id !== next.id);
        renderQueue();
      }, 3000);
    } catch (err) {
      next.status = 'failed';
      next.error = err instanceof Error ? err.message : 'Upload failed';
      renderQueue();
    }
  }
  isProcessing = false;
}

queueList.addEventListener('click', (e) => {
  const chip = (e.target as HTMLElement).closest('.queue-chip') as HTMLElement | null;
  if (!chip) return;
  const id = chip.dataset.id;
  if (!id) return;
  const entry = queue.find(e => e.id === id);
  if (!entry || entry.status !== 'failed') return;

  retryBlob = entry.photo;
  photoInput.value = '';
  photoLabel.style.display = 'none';
  photoPreview.src = entry.objectUrl;
  photoPreview.style.display = 'block';
  nameInput.value = entry.name;
  dispositionSelect.value = entry.disposition ?? '';
  setError('');

  queue = queue.filter(e => e.id !== id);
  renderQueue();
  capture.scrollIntoView({ behavior: 'smooth' });
});

// ── UI helpers ────────────────────────────────────────────────────────────────

function showCapture() {
  gate.style.display = 'none';
  tabNav.style.display = 'flex';
  capture.style.display = 'flex';
  viewer.style.display = 'none';
  tabCapture.classList.add('active');
  tabViewer.classList.remove('active');
}

function showViewer() {
  gate.style.display = 'none';
  tabNav.style.display = 'flex';
  capture.style.display = 'none';
  viewer.style.display = 'flex';
  tabViewer.classList.add('active');
  tabCapture.classList.remove('active');
  loadItems();
}

function showGate() {
  gate.style.display = 'flex';
  tabNav.style.display = 'none';
  capture.style.display = 'none';
  viewer.style.display = 'none';
}

function setError(message: string) {
  captureError.textContent = message;
  captureError.hidden = !message;
}

function reset() {
  retryBlob = null;
  photoInput.value = '';
  photoLabel.style.display = 'flex';
  photoPreview.style.display = 'none';
  photoPreview.src = '';
  nameInput.value = '';
  dispositionSelect.value = '';
  setError('');
}

// ── Viewer ────────────────────────────────────────────────────────────────────

function lifecycleBadge(lifecycle: Item['lifecycle']): string {
  const classes: Record<Item['lifecycle'], string> = {
    Captured: 'badge-captured',
    Reviewed: 'badge-reviewed',
    Handled: 'badge-handled',
  };
  return `<span class="badge ${classes[lifecycle]}">${lifecycle}</span>`;
}

function renderItems(items: Item[]) {
  if (items.length === 0) {
    viewerStatus.textContent = 'No items captured yet.';
    itemList.innerHTML = '';
    return;
  }
  viewerStatus.textContent = '';
  itemList.innerHTML = items.map(item => {
    const thumb = item.thumbnail
      ? `<img class="item-thumb" src="data:image/jpeg;base64,${item.thumbnail}" alt="${item.name}" />`
      : `<div class="item-thumb-placeholder">📦</div>`;
    const disposition = item.disposition
      ? `<span class="item-disposition">${item.disposition}</span>`
      : '';
    const notes = item.notes
      ? `<div class="item-notes">${item.notes}</div>`
      : '';
    return `
      <div class="item-card">
        ${thumb}
        <div class="item-body">
          <div class="item-name">${item.name}</div>
          <div class="item-meta">${lifecycleBadge(item.lifecycle)}${disposition}</div>
          ${notes}
        </div>
      </div>`;
  }).join('');
}

async function loadItems(forceRefresh = false) {
  if (forceRefresh) cachedItems = null;

  if (cachedItems !== null) {
    renderItems(cachedItems);
    return;
  }

  viewerStatus.textContent = 'Loading…';
  itemList.innerHTML = '';

  try {
    // Phase 1: list without thumbnails — renders immediately
    const items = await inventoryStore.fetchAllItems(false);
    renderItems(items);

    if (items.length === 0) {
      cachedItems = items;
      return;
    }

    // Phase 2: fetch thumbnails and re-render
    viewerStatus.textContent = 'Loading images…';
    const itemsWithThumbs = await inventoryStore.fetchAllItems(true);
    cachedItems = itemsWithThumbs;
    renderItems(itemsWithThumbs);
  } catch (err) {
    viewerStatus.textContent = err instanceof Error ? err.message : 'Failed to load items.';
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const urlSecret = getSecretFromUrl(window.location.search);
if (urlSecret) {
  secretStore.set(urlSecret);
  showCapture();
} else if (secretStore.get()) {
  showCapture();
} else {
  showGate();
}

tabCapture.addEventListener('click', showCapture);
tabViewer.addEventListener('click', showViewer);
refreshBtn.addEventListener('click', () => loadItems(true));

secretSave.addEventListener('click', () => {
  const value = secretInput.value.trim();
  if (!value) return;
  secretStore.set(value);
  secretInput.value = '';
  showCapture();
});

secretInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') secretSave.click();
});

photoInput.addEventListener('change', () => {
  retryBlob = null;
  const file = photoInput.files?.[0];
  if (!file) return;
  photoLabel.style.display = 'none';
  photoPreview.src = URL.createObjectURL(file);
  photoPreview.style.display = 'block';
});

captureBtn.addEventListener('click', () => {
  const photo = retryBlob ?? photoInput.files?.[0];
  const name = nameInput.value.trim();

  if (!photo) { setError('Please select a photo.'); return; }
  if (!name) { setError('Please enter a name.'); return; }

  const rawDisposition = dispositionSelect.value;
  const disposition = rawDisposition ? (rawDisposition as Disposition) : undefined;

  const objectUrl = retryBlob ? photoPreview.src : URL.createObjectURL(photo);

  const entry: QueueEntry = {
    id: crypto.randomUUID(),
    name,
    disposition,
    capturedAt: new Date().toISOString(),
    photo,
    objectUrl,
    status: 'pending',
  };

  retryBlob = null;
  queue.push(entry);
  renderQueue();
  reset();
  processQueue();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
