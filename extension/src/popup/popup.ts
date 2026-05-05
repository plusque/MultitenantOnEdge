import { ChromeLocalStorage } from '../lib/storage';
import { listTenants, recentTenants, touchTenant } from '../lib/registry';
import { loadSettings } from '../lib/settings';
import { launchTenant, NativeHostError } from '../lib/native-host';
import type { Tenant } from '../lib/types';

const storage = new ChromeLocalStorage();

async function render(): Promise<void> {
  const all = await listTenants(storage);
  const empty = document.getElementById('empty-state')!;
  const recentSection = document.getElementById('recent-section')!;
  const allSection = document.getElementById('all-section')!;

  if (all.length === 0) {
    empty.hidden = false;
    recentSection.hidden = true;
    allSection.hidden = true;
    return;
  }
  empty.hidden = true;

  const recent = (await recentTenants(storage, 5)).filter((t) => t.lastUsedAt !== null);
  if (recent.length > 0) {
    recentSection.hidden = false;
    renderList(document.getElementById('recent-list')!, recent);
  } else {
    recentSection.hidden = true;
  }

  allSection.hidden = false;
  renderList(document.getElementById('all-list')!, all);
}

function renderList(ul: HTMLElement, tenants: Tenant[]): void {
  ul.replaceChildren();
  for (const t of tenants) {
    const li = document.createElement('li');
    li.dataset.tenantId = t.id;

    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = t.color;

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = t.name;

    li.append(dot, name);
    li.addEventListener('click', () => onLaunch(t));
    ul.append(li);
  }
}

async function onLaunch(tenant: Tenant): Promise<void> {
  hideError();
  try {
    const settings = await loadSettings(storage);
    await launchTenant({
      tenantId: tenant.id,
      userDataDir: tenant.userDataDir,
      storageBasePath: settings.storageBasePath,
      url: tenant.defaultUrl,
    });
    await touchTenant(storage, tenant.id);
    chrome.runtime.sendMessage({
      type: 'tenant-switcher:setBadge',
      tenantName: tenant.name,
      color: tenant.color,
    });
    window.close();
  } catch (e) {
    if (e instanceof NativeHostError) {
      showError(`Native Helper Problem: ${e.code} — ${e.message}`);
    } else {
      showError(`Unerwarteter Fehler: ${(e as Error).message}`);
    }
  }
}

function showError(msg: string): void {
  const el = document.getElementById('error-banner')!;
  el.textContent = msg;
  el.hidden = false;
}

function hideError(): void {
  document.getElementById('error-banner')!.hidden = true;
}

document.addEventListener('DOMContentLoaded', () => {
  void render();
  document.getElementById('open-options')!.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
  document.getElementById('open-options-empty')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
});
