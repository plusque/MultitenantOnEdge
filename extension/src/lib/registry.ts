import type { KvStorage } from './storage';
import { toSlug } from './slug';
import type { Tenant } from './types';

const KEY = 'tenants';

interface AddTenantInput {
  name: string;
  color: string;
  defaultUrl: string;
  storageBasePath: string;
  tenantId?: string;
  domains?: string[];
  notes?: string;
  userDataDirOverride?: string;
}

async function loadAll(storage: KvStorage): Promise<Tenant[]> {
  return (await storage.get<Tenant[]>(KEY)) ?? [];
}

async function saveAll(storage: KvStorage, tenants: Tenant[]): Promise<void> {
  await storage.set(KEY, tenants);
}

function joinPath(base: string, child: string): string {
  const trimmed = base.replace(/[\\/]+$/, '');
  const sep = base.includes('\\') ? '\\' : '/';
  return `${trimmed}${sep}${child}`;
}

function uniqueSlug(name: string, existing: Set<string>): string {
  const base = toSlug(name);
  if (!existing.has(base)) return base;
  let n = 2;
  while (existing.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export async function addTenant(storage: KvStorage, input: AddTenantInput): Promise<Tenant> {
  const tenants = await loadAll(storage);
  const existingSlugs = new Set(
    tenants.map((t) => t.userDataDir.split(/[\\/]/).pop() ?? ''),
  );
  const slug = input.userDataDirOverride
    ? input.userDataDirOverride.split(/[\\/]/).pop() ?? toSlug(input.name)
    : uniqueSlug(input.name, existingSlugs);
  const userDataDir = input.userDataDirOverride ?? joinPath(input.storageBasePath, slug);
  const tenant: Tenant = {
    id: crypto.randomUUID(),
    name: input.name,
    color: input.color,
    tenantId: input.tenantId,
    domains: input.domains ?? [],
    userDataDir,
    defaultUrl: input.defaultUrl,
    customLinks: [],
    notes: input.notes ?? '',
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  };
  tenants.push(tenant);
  await saveAll(storage, tenants);
  return tenant;
}

export async function listTenants(storage: KvStorage): Promise<Tenant[]> {
  const tenants = await loadAll(storage);
  return [...tenants].sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

export async function getTenant(storage: KvStorage, id: string): Promise<Tenant | undefined> {
  const tenants = await loadAll(storage);
  return tenants.find((t) => t.id === id);
}

export async function updateTenant(
  storage: KvStorage,
  id: string,
  patch: Partial<Omit<Tenant, 'id' | 'createdAt' | 'userDataDir'>>,
): Promise<Tenant> {
  const tenants = await loadAll(storage);
  const idx = tenants.findIndex((t) => t.id === id);
  if (idx === -1) throw new Error(`Tenant not found: ${id}`);
  const existing = tenants[idx]!;
  const updated: Tenant = { ...existing, ...patch };
  tenants[idx] = updated;
  await saveAll(storage, tenants);
  return updated;
}

export async function deleteTenant(storage: KvStorage, id: string): Promise<void> {
  const tenants = await loadAll(storage);
  await saveAll(storage, tenants.filter((t) => t.id !== id));
}

export async function touchTenant(storage: KvStorage, id: string): Promise<Tenant> {
  return updateTenant(storage, id, { lastUsedAt: new Date().toISOString() });
}

export async function recentTenants(storage: KvStorage, limit: number): Promise<Tenant[]> {
  const tenants = await loadAll(storage);
  return [...tenants]
    .sort((a, b) => {
      if (a.lastUsedAt === null && b.lastUsedAt === null) return a.name.localeCompare(b.name, 'de');
      if (a.lastUsedAt === null) return 1;
      if (b.lastUsedAt === null) return -1;
      return b.lastUsedAt.localeCompare(a.lastUsedAt);
    })
    .slice(0, limit);
}
