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
const status = document.getElementById('status')!;
const viewerStatus = document.getElementById('viewer-status')!;
const itemList = document.getElementById('item-list')!;

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

async function loadItems() {
  viewerStatus.textContent = 'Loading…';
  itemList.innerHTML = '';
  try {
    const items = await inventoryStore.fetchAllItems();
    renderItems(items);
  } catch (err) {
    viewerStatus.textContent = err instanceof Error ? err.message : 'Failed to load items.';
  }
}

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
  const file = photoInput.files?.[0];
  if (!file) return;
  photoLabel.style.display = 'none';
  photoPreview.src = URL.createObjectURL(file);
  photoPreview.style.display = 'block';
});

function setStatus(message: string, type: 'error' | 'success' | '') {
  status.textContent = message;
  status.className = type;
}

function reset() {
  photoInput.value = '';
  photoLabel.style.display = 'flex';
  photoPreview.style.display = 'none';
  photoPreview.src = '';
  nameInput.value = '';
  dispositionSelect.value = '';
  setStatus('', '');
}

captureBtn.addEventListener('click', async () => {
  const photo = photoInput.files?.[0];
  const name = nameInput.value.trim();

  if (!photo) { setStatus('Please select a photo.', 'error'); return; }
  if (!name) { setStatus('Please enter a name.', 'error'); return; }

  const rawDisposition = dispositionSelect.value;
  const disposition = rawDisposition ? (rawDisposition as Disposition) : undefined;

  captureBtn.disabled = true;
  setStatus('Capturing…', '');

  try {
    await inventoryStore.capture({
      name,
      photo,
      capturedAt: new Date().toISOString(),
      disposition,
    });
    setStatus('Captured!', 'success');
    reset();
  } catch (err) {
    setStatus(err instanceof Error ? err.message : 'Something went wrong.', 'error');
  } finally {
    captureBtn.disabled = false;
  }
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
