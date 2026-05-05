import { ChromeLocalStorage } from '../lib/storage';
import { loadSettings, updateSettings } from '../lib/settings';
import {
  addTenant,
  deleteTenant,
  listTenants,
  updateTenant,
} from '../lib/registry';
import type { Tenant } from '../lib/types';

const storage = new ChromeLocalStorage();

interface DialogState {
  mode: 'create' | 'edit';
  tenantId?: string;
}

let dialogState: DialogState = { mode: 'create' };

async function renderSettings(): Promise<void> {
  const s = await loadSettings(storage);
  (document.getElementById('storage-base-path') as HTMLInputElement).value = s.storageBasePath;
  (document.getElementById('edge-executable-path') as HTMLInputElement).value = s.edgeExecutablePath;
}

async function onSettingsSubmit(e: Event): Promise<void> {
  e.preventDefault();
  const storageBasePath = (document.getElementById('storage-base-path') as HTMLInputElement).value;
  const edgeExecutablePath = (document.getElementById('edge-executable-path') as HTMLInputElement)
    .value;
  await updateSettings(storage, { storageBasePath, edgeExecutablePath });
  flashStatus('settings-status', 'Gespeichert.');
}

async function renderTenants(): Promise<void> {
  const tenants = await listTenants(storage);
  const tbody = document.getElementById('tenants-body')!;
  const empty = document.getElementById('tenants-empty')!;
  const table = document.getElementById('tenants-table')!;
  tbody.replaceChildren();

  if (tenants.length === 0) {
    empty.hidden = false;
    table.hidden = true;
    return;
  }
  empty.hidden = true;
  table.hidden = false;

  for (const t of tenants) {
    tbody.append(renderTenantRow(t));
  }
}

function renderTenantRow(t: Tenant): HTMLElement {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><span class="dot" style="background:${escapeAttr(t.color)}"></span></td>
    <td>${escapeText(t.name)}</td>
    <td><code>${escapeText(t.tenantId ?? '—')}</code></td>
    <td><code>${escapeText(t.userDataDir)}</code></td>
    <td>
      <button data-action="edit">Bearbeiten</button>
      <button data-action="delete" class="danger">Löschen</button>
    </td>
  `;
  tr.querySelector('[data-action="edit"]')!.addEventListener('click', () => openDialogEdit(t));
  tr.querySelector('[data-action="delete"]')!.addEventListener('click', () => onDelete(t));
  return tr;
}

function openDialogCreate(): void {
  dialogState = { mode: 'create' };
  document.getElementById('tenant-dialog-title')!.textContent = 'Neuer Tenant';
  (document.getElementById('tenant-form') as HTMLFormElement).reset();
  (document.getElementById('t-default-url') as HTMLInputElement).value = 'https://portal.azure.com';
  (document.getElementById('tenant-dialog') as HTMLDialogElement).showModal();
}

function openDialogEdit(t: Tenant): void {
  dialogState = { mode: 'edit', tenantId: t.id };
  document.getElementById('tenant-dialog-title')!.textContent = `Tenant bearbeiten: ${t.name}`;
  (document.getElementById('t-name') as HTMLInputElement).value = t.name;
  (document.getElementById('t-color') as HTMLInputElement).value = t.color;
  (document.getElementById('t-tenant-id') as HTMLInputElement).value = t.tenantId ?? '';
  (document.getElementById('t-default-url') as HTMLInputElement).value = t.defaultUrl;
  (document.getElementById('t-notes') as HTMLTextAreaElement).value = t.notes;
  (document.getElementById('tenant-dialog') as HTMLDialogElement).showModal();
}

async function onDialogSubmit(e: Event): Promise<void> {
  e.preventDefault();
  const name = (document.getElementById('t-name') as HTMLInputElement).value.trim();
  const color = (document.getElementById('t-color') as HTMLInputElement).value;
  const tenantId = (document.getElementById('t-tenant-id') as HTMLInputElement).value.trim() || undefined;
  const defaultUrl = (document.getElementById('t-default-url') as HTMLInputElement).value;
  const notes = (document.getElementById('t-notes') as HTMLTextAreaElement).value;

  if (dialogState.mode === 'create') {
    const settings = await loadSettings(storage);
    await addTenant(storage, {
      name, color, defaultUrl, notes, tenantId,
      storageBasePath: settings.storageBasePath,
    });
  } else if (dialogState.tenantId) {
    await updateTenant(storage, dialogState.tenantId, {
      name, color, tenantId, defaultUrl, notes,
    });
  }
  (document.getElementById('tenant-dialog') as HTMLDialogElement).close();
  void renderTenants();
}

async function onDelete(t: Tenant): Promise<void> {
  const ok = confirm(
    `Tenant "${t.name}" löschen?\n\nDer Profil-Ordner unter\n${t.userDataDir}\nbleibt auf der Festplatte und muss manuell entfernt werden, falls nicht mehr gebraucht.`,
  );
  if (!ok) return;
  await deleteTenant(storage, t.id);
  void renderTenants();
}

function flashStatus(id: string, msg: string): void {
  const el = document.getElementById(id)!;
  el.textContent = msg;
  setTimeout(() => { el.textContent = ''; }, 1500);
}

function escapeText(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!),
  );
}

function escapeAttr(s: string): string {
  return escapeText(s);
}

document.addEventListener('DOMContentLoaded', () => {
  void renderSettings();
  void renderTenants();
  document.getElementById('settings-form')!.addEventListener('submit', (e) => void onSettingsSubmit(e));
  document.getElementById('add-tenant-btn')!.addEventListener('click', openDialogCreate);
  document.getElementById('tenant-form')!.addEventListener('submit', (e) => void onDialogSubmit(e));
  document.getElementById('t-cancel')!.addEventListener('click', () => {
    (document.getElementById('tenant-dialog') as HTMLDialogElement).close();
  });
});
