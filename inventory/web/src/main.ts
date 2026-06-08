import { LocalStorageSecretStore } from './SecretStore';
import { AppsScriptStore } from './AppsScriptStore';
import type { Disposition } from './InventoryStore';

const ENDPOINT_URL =
  'https://script.google.com/macros/s/AKfycbyjJnL9Rv3qyyy_aV2-nrAtICndug41fE-ZCkZEU205fftVSaWIOW_VrOfpdWJFTwH-EQ/exec';

const secretStore = new LocalStorageSecretStore();
const inventoryStore = new AppsScriptStore(ENDPOINT_URL, secretStore);

const gate = document.getElementById('gate')!;
const capture = document.getElementById('capture')!;
const secretInput = document.getElementById('secret-input') as HTMLInputElement;
const secretSave = document.getElementById('secret-save') as HTMLButtonElement;
const photoInput = document.getElementById('photo-input') as HTMLInputElement;
const photoLabel = document.getElementById('photo-label') as HTMLLabelElement;
const photoPreview = document.getElementById('photo-preview') as HTMLImageElement;
const nameInput = document.getElementById('name-input') as HTMLInputElement;
const dispositionSelect = document.getElementById('disposition-select') as HTMLSelectElement;
const captureBtn = document.getElementById('capture-btn') as HTMLButtonElement;
const status = document.getElementById('status')!;

function showCapture() {
  gate.style.display = 'none';
  capture.style.display = 'flex';
}

function showGate() {
  gate.style.display = 'flex';
  capture.style.display = 'none';
}

if (secretStore.get()) {
  showCapture();
} else {
  showGate();
}

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
