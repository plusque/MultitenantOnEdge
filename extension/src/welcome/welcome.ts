import { ChromeLocalStorage } from '../lib/storage';
import { loadSettings, updateSettings } from '../lib/settings';
import { pingHost } from '../lib/native-host';

const storage = new ChromeLocalStorage();

function showStatus(id: string, message: string, kind: 'success' | 'error'): void {
  const el = document.getElementById(id)!;
  el.textContent = message;
  el.className = `status ${kind}`;
  el.hidden = false;
}

async function init(): Promise<void> {
  // Step 1: show extension ID for the install command
  const id = chrome.runtime.id;
  document.getElementById('extension-id-display')!.textContent = id;

  // Step 3: pre-fill the storage path
  const settings = await loadSettings(storage);
  (document.getElementById('storage-base-path') as HTMLInputElement).value = settings.storageBasePath;

  document.getElementById('copy-extension-id')!.addEventListener('click', async () => {
    await navigator.clipboard.writeText(id);
  });

  document.getElementById('check-connection')!.addEventListener('click', async () => {
    const ok = await pingHost();
    if (ok) {
      showStatus('connection-status', '✓ Verbunden — Native Helper antwortet.', 'success');
    } else {
      showStatus(
        'connection-status',
        '✗ Keine Verbindung. Wurde der Helper installiert? Extension neu laden mit Ctrl+R unter edge://extensions.',
        'error',
      );
    }
  });

  document.getElementById('save-storage-path')!.addEventListener('click', async () => {
    const value = (document.getElementById('storage-base-path') as HTMLInputElement).value.trim();
    if (!value) {
      showStatus('storage-status', 'Pfad darf nicht leer sein.', 'error');
      return;
    }
    await updateSettings(storage, { storageBasePath: value });
    showStatus('storage-status', '✓ Gespeichert.', 'success');
  });

  document.getElementById('open-options')!.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

document.addEventListener('DOMContentLoaded', () => void init());
