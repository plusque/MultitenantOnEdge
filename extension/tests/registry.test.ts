import { describe, expect, it, beforeEach } from 'vitest';
import { InMemoryStorage } from '../src/lib/storage';
import {
  addTenant,
  deleteTenant,
  getTenant,
  listTenants,
  recentTenants,
  touchTenant,
  updateTenant,
} from '../src/lib/registry';

const baseInput = {
  name: 'Müller AG',
  color: '#E91E63',
  defaultUrl: 'https://portal.azure.com',
  storageBasePath: 'C:\\tenants',
};

describe('registry', () => {
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
  });

  it('addTenant assigns id, slug-based userDataDir, and createdAt', async () => {
    const t = await addTenant(storage, baseInput);
    expect(t.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(t.userDataDir).toBe('C:\\tenants\\mueller-ag');
    expect(t.name).toBe('Müller AG');
    expect(t.lastUsedAt).toBeNull();
    expect(t.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('addTenant deduplicates slug collisions with -2, -3 suffix', async () => {
    const a = await addTenant(storage, baseInput);
    const b = await addTenant(storage, baseInput);
    const c = await addTenant(storage, baseInput);
    expect(a.userDataDir).toBe('C:\\tenants\\mueller-ag');
    expect(b.userDataDir).toBe('C:\\tenants\\mueller-ag-2');
    expect(c.userDataDir).toBe('C:\\tenants\\mueller-ag-3');
  });

  it('listTenants returns empty array when none exist', async () => {
    expect(await listTenants(storage)).toEqual([]);
  });

  it('listTenants returns tenants sorted alphabetically by name', async () => {
    await addTenant(storage, { ...baseInput, name: 'Zeta AG' });
    await addTenant(storage, { ...baseInput, name: 'Alpha AG' });
    const list = await listTenants(storage);
    expect(list.map((t) => t.name)).toEqual(['Alpha AG', 'Zeta AG']);
  });

  it('updateTenant patches fields but preserves id, createdAt, userDataDir', async () => {
    const t = await addTenant(storage, baseInput);
    const updated = await updateTenant(storage, t.id, { color: '#000000', notes: 'VIP' });
    expect(updated.id).toBe(t.id);
    expect(updated.createdAt).toBe(t.createdAt);
    expect(updated.userDataDir).toBe(t.userDataDir);
    expect(updated.color).toBe('#000000');
    expect(updated.notes).toBe('VIP');
  });

  it('deleteTenant removes from registry', async () => {
    const t = await addTenant(storage, baseInput);
    await deleteTenant(storage, t.id);
    expect(await getTenant(storage, t.id)).toBeUndefined();
  });

  it('touchTenant updates lastUsedAt', async () => {
    const t = await addTenant(storage, baseInput);
    expect(t.lastUsedAt).toBeNull();
    const touched = await touchTenant(storage, t.id);
    expect(touched.lastUsedAt).not.toBeNull();
    expect(typeof touched.lastUsedAt).toBe('string');
  });

  it('recentTenants returns N most-recently-used, with never-used at the end', async () => {
    const a = await addTenant(storage, { ...baseInput, name: 'Alpha' });
    const b = await addTenant(storage, { ...baseInput, name: 'Beta' });
    const c = await addTenant(storage, { ...baseInput, name: 'Gamma' });
    await touchTenant(storage, a.id);
    await new Promise((r) => setTimeout(r, 5));
    await touchTenant(storage, c.id);
    const recent = await recentTenants(storage, 5);
    expect(recent.map((t) => t.name)).toEqual(['Gamma', 'Alpha', 'Beta']);
  });
});
