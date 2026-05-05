# Edge Tenant Switcher — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Phase 1 MVP "Tenant Launcher" — an Edge extension plus a Go native messaging host that lets the user manage 15+ Microsoft customer tenants and launch each in an isolated Edge profile (`--user-data-dir`) with one click. Parallel-mode (multiple tenants in different windows) works out of the box because each tenant gets its own OS-level Edge profile directory.

**Architecture:** Three components. (1) Edge Extension (TypeScript, Manifest V3) — Tenant-Registry-CRUD UI, popup launcher, setup wizard, badge indicator. (2) Native Messaging Host (`tenant-helper.exe`, Go) — receives JSON commands via stdio, validates paths, launches `msedge.exe --user-data-dir=<path>`. (3) Tenant Registry — stored in `chrome.storage.local`. Extension and host communicate via the standard Chromium Native Messaging protocol (4-byte LE length prefix + UTF-8 JSON).

**Tech Stack:** TypeScript 5 + Vite 5 + `@crxjs/vite-plugin` (extension build), Vitest + happy-dom (extension tests), Go 1.22+ (native host), PowerShell 5.1+ (Windows installer), Manifest V3.

---

## File Structure

```
multitenant/
├── extension/                          ← Edge extension package
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── vitest.config.ts
│   ├── src/
│   │   ├── manifest.json               ← Manifest V3
│   │   ├── background/
│   │   │   └── service-worker.ts       ← Background events, badge update
│   │   ├── popup/
│   │   │   ├── index.html
│   │   │   ├── popup.ts                ← Tenant list, click → launch
│   │   │   └── popup.css
│   │   ├── options/
│   │   │   ├── index.html
│   │   │   ├── options.ts              ← Settings + Tenant CRUD
│   │   │   └── options.css
│   │   ├── welcome/
│   │   │   ├── index.html
│   │   │   ├── welcome.ts              ← First-run setup wizard
│   │   │   └── welcome.css
│   │   ├── lib/
│   │   │   ├── types.ts                ← Tenant, Settings, NativeMessage types
│   │   │   ├── slug.ts                 ← Name → kebab-case slug
│   │   │   ├── storage.ts              ← Thin chrome.storage abstraction (mockable)
│   │   │   ├── settings.ts             ← Global settings get/set
│   │   │   ├── registry.ts             ← Tenant CRUD
│   │   │   └── native-host.ts          ← Native messaging client
│   │   └── icons/
│   │       ├── icon-16.png
│   │       ├── icon-48.png
│   │       └── icon-128.png
│   └── tests/
│       ├── slug.test.ts
│       ├── settings.test.ts
│       ├── registry.test.ts
│       └── native-host.test.ts
│
├── native-host/                        ← Go binary
│   ├── go.mod
│   ├── main.go                         ← Entrypoint, dispatch loop
│   ├── protocol.go                     ← stdio framing (length-prefix)
│   ├── protocol_test.go
│   ├── messages.go                     ← Request/Response JSON types
│   ├── messages_test.go
│   ├── paths.go                        ← Path validation
│   ├── paths_test.go
│   ├── edge.go                         ← Edge discovery + launch
│   ├── edge_test.go
│   └── installer/
│       ├── install.ps1                 ← Registers Native Messaging manifest
│       ├── uninstall.ps1
│       └── tenant-helper.json.tmpl     ← Manifest template
│
├── docs/superpowers/
│   ├── specs/2026-05-04-edge-tenant-switcher-design.md
│   └── plans/2026-05-05-edge-tenant-switcher-phase-1.md   ← this file
│
├── .gitignore
└── README.md
```

**Decomposition rationale:** Extension and native-host are two independent build artifacts with separate toolchains. They share only the JSON protocol (defined in spec). Within the extension, the `lib/` directory holds pure logic (no DOM, no chrome APIs at function-call surface — chrome APIs are injected as parameters or behind the `storage.ts` shim) so it's all unit-testable. UI files (`popup.ts`, `options.ts`, `welcome.ts`) only do DOM wiring and call into `lib/`.

---

## Task 1: Repo skeleton and `.gitignore`

**Files:**
- Create: `/home/sysadmin/ClaudeCode/multitenant/.gitignore`
- Create: `/home/sysadmin/ClaudeCode/multitenant/README.md`

- [ ] **Step 1: Create `.gitignore`**

```
# Node
node_modules/
dist/
*.log
.DS_Store

# Vite
.vite/

# Vitest
coverage/

# Go
native-host/tenant-helper
native-host/tenant-helper.exe
native-host/*.test
native-host/*.out

# IDE
.idea/
.vscode/
*.swp

# OS
Thumbs.db
```

- [ ] **Step 2: Create `README.md`**

```markdown
# Edge Tenant Switcher

Microsoft Edge extension + Go native messaging host that lets MSP/Consultant users manage many Azure/M365 customer tenants with isolated Edge profiles per tenant.

See `docs/superpowers/specs/2026-05-04-edge-tenant-switcher-design.md` for the design.

## Components

- `extension/` — Edge extension (TypeScript + Vite + Manifest V3)
- `native-host/` — `tenant-helper.exe` (Go binary, Windows-only)

## Build

See per-component READMEs (`extension/README.md`, `native-host/README.md`).
```

- [ ] **Step 3: Verify and commit**

Run: `ls /home/sysadmin/ClaudeCode/multitenant`
Expected: shows `.gitignore`, `README.md`, `docs/`

```bash
git add .gitignore README.md
git commit -m "chore: add repo skeleton (.gitignore, README)"
```

---

## Task 2: Extension toolchain (package.json, TS, Vite, Vitest)

**Files:**
- Create: `extension/package.json`
- Create: `extension/tsconfig.json`
- Create: `extension/vite.config.ts`
- Create: `extension/vitest.config.ts`
- Create: `extension/README.md`
- Create: `extension/src/manifest.json` (placeholder, expanded in Task 15)

- [ ] **Step 1: Create `extension/package.json`**

```json
{
  "name": "edge-tenant-switcher",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@crxjs/vite-plugin": "^2.0.0",
    "@types/chrome": "^0.0.260",
    "@types/node": "^20.11.0",
    "happy-dom": "^13.0.0",
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "vitest": "^1.4.0"
  }
}
```

- [ ] **Step 2: Create `extension/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "types": ["chrome", "node"]
  },
  "include": ["src/**/*", "tests/**/*", "vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 3: Create `extension/vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './src/manifest.json';

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
```

- [ ] **Step 4: Create `extension/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Create minimal placeholder `extension/src/manifest.json`** (real one in Task 15)

```json
{
  "manifest_version": 3,
  "name": "Edge Tenant Switcher",
  "version": "0.1.0",
  "description": "Manage many Azure/M365 tenants with isolated Edge profiles."
}
```

- [ ] **Step 6: Create `extension/README.md`**

```markdown
# Extension

## Develop

```bash
cd extension
npm install
npm run dev          # Vite dev server with HMR
npm test             # Run unit tests once
npm run typecheck    # Type-check without emitting
```

## Build

```bash
npm run build        # Outputs to extension/dist/
```

Then load `extension/dist/` as unpacked extension in `edge://extensions/` (Developer mode).
```

- [ ] **Step 7: Install dependencies and verify**

Run:
```bash
cd /home/sysadmin/ClaudeCode/multitenant/extension && npm install
```
Expected: `node_modules/` populated, no install errors.

Run: `cd /home/sysadmin/ClaudeCode/multitenant/extension && npx tsc --noEmit`
Expected: No output (success).

- [ ] **Step 8: Commit**

```bash
git add extension/package.json extension/package-lock.json extension/tsconfig.json extension/vite.config.ts extension/vitest.config.ts extension/src/manifest.json extension/README.md
git commit -m "chore(extension): scaffold Vite + TS + Vitest toolchain"
```

---

## Task 3: Native Host toolchain (Go module)

**Files:**
- Create: `native-host/go.mod`
- Create: `native-host/README.md`

- [ ] **Step 1: Initialize Go module**

Run:
```bash
cd /home/sysadmin/ClaudeCode/multitenant/native-host && go mod init github.com/pluess/edge-tenant-switcher/native-host
```
Expected: creates `go.mod` with module path.

- [ ] **Step 2: Create `native-host/README.md`**

```markdown
# tenant-helper (Native Messaging Host)

Go binary that receives JSON commands from the Edge extension via stdio and launches `msedge.exe` with isolated `--user-data-dir` per tenant.

## Build

```bash
cd native-host
go build -o tenant-helper.exe       # Windows
GOOS=windows GOARCH=amd64 go build -o tenant-helper.exe   # cross-compile from Linux/macOS
```

## Test

```bash
go test ./...
```

## Install (Windows)

Run `installer/install.ps1` from an elevated PowerShell, or follow the manual steps in the design spec.
```

- [ ] **Step 3: Verify and commit**

Run: `cd /home/sysadmin/ClaudeCode/multitenant/native-host && go mod tidy && cat go.mod`
Expected: `module github.com/pluess/edge-tenant-switcher/native-host` plus a Go version line.

```bash
git add native-host/go.mod native-host/README.md
git commit -m "chore(native-host): initialize Go module"
```

---

## Task 4: Shared TypeScript types

**Files:**
- Create: `extension/src/lib/types.ts`

This holds the shape contracts shared between lib, UI, and the native-host wire protocol.

- [ ] **Step 1: Create `extension/src/lib/types.ts`**

```ts
export interface Tenant {
  id: string;                   // uuid v4
  name: string;
  color: string;                // CSS hex like "#E91E63"
  tenantId?: string;            // Azure Tenant ID (optional)
  domains: string[];            // Phase 2 (kept here so registry shape is stable)
  userDataDir: string;          // absolute path
  defaultUrl: string;           // e.g. "https://portal.azure.com"
  customLinks: { label: string; url: string }[];
  notes: string;
  createdAt: string;            // ISO 8601
  lastUsedAt: string | null;    // ISO 8601, null if never launched
}

export interface Settings {
  storageBasePath: string;      // e.g. "C:\\Users\\you\\AppData\\Local\\TenantSwitcher\\profiles"
  edgeExecutablePath: 'auto' | string;
  syncEnabled: boolean;
  routerMode: 'ask' | 'auto' | 'off';   // Phase 2 setting, default "ask"
}

// ---- Native Messaging wire types ----

export type NativeRequest =
  | { type: 'ping' }
  | {
      type: 'launch';
      tenantId: string;
      userDataDir: string;
      storageBasePath: string;   // sent every time so host can validate userDataDir
      url: string;
    }
  | { type: 'isRunning'; userDataDir: string };

export type NativeResponse =
  | { type: 'ok'; data?: unknown }
  | { type: 'error'; code: NativeErrorCode; message: string };

export type NativeErrorCode =
  | 'EDGE_NOT_FOUND'
  | 'PATH_NOT_WHITELISTED'
  | 'LAUNCH_FAILED'
  | 'INVALID_REQUEST';

export const DEFAULT_SETTINGS: Settings = {
  storageBasePath: '%LOCALAPPDATA%\\TenantSwitcher\\profiles',
  edgeExecutablePath: 'auto',
  syncEnabled: false,
  routerMode: 'ask',
};
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /home/sysadmin/ClaudeCode/multitenant/extension && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add extension/src/lib/types.ts
git commit -m "feat(extension): add shared TypeScript types for Tenant, Settings, native protocol"
```

---

## Task 5: Slug utility (TDD)

**Files:**
- Create: `extension/src/lib/slug.ts`
- Create: `extension/tests/slug.test.ts`

Slugs are used to derive `userDataDir` folder names from tenant names. Stable, filesystem-safe, human-readable.

- [ ] **Step 1: Write the failing tests**

Create `extension/tests/slug.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { toSlug } from '../src/lib/slug';

describe('toSlug', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(toSlug('Müller AG')).toBe('mueller-ag');
  });

  it('transliterates German umlauts and ß', () => {
    expect(toSlug('Größe Süß GmbH')).toBe('groesse-suess-gmbh');
  });

  it('strips disallowed characters', () => {
    expect(toSlug('Kunde & Co. (CH)')).toBe('kunde-co-ch');
  });

  it('collapses repeated separators and trims', () => {
    expect(toSlug('  Hello   World  ')).toBe('hello-world');
    expect(toSlug('---a---b---')).toBe('a-b');
  });

  it('returns "tenant" for inputs that slug to empty string', () => {
    expect(toSlug('')).toBe('tenant');
    expect(toSlug('!!!')).toBe('tenant');
  });

  it('caps slug length at 60 characters', () => {
    const long = 'a'.repeat(100);
    expect(toSlug(long)).toHaveLength(60);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /home/sysadmin/ClaudeCode/multitenant/extension && npm test -- slug`
Expected: FAIL with "Cannot find module '../src/lib/slug'" or similar.

- [ ] **Step 3: Implement `extension/src/lib/slug.ts`**

```ts
const TRANSLIT: Record<string, string> = {
  ä: 'ae', ö: 'oe', ü: 'ue',
  Ä: 'ae', Ö: 'oe', Ü: 'ue',
  ß: 'ss', à: 'a', á: 'a', â: 'a', ã: 'a',
  è: 'e', é: 'e', ê: 'e', ë: 'e',
  ì: 'i', í: 'i', î: 'i', ï: 'i',
  ò: 'o', ó: 'o', ô: 'o', õ: 'o',
  ù: 'u', ú: 'u', û: 'u',
  ç: 'c', ñ: 'n',
};

export function toSlug(input: string): string {
  const transliterated = Array.from(input)
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join('');
  const slug = transliterated
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return slug.length === 0 ? 'tenant' : slug;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/sysadmin/ClaudeCode/multitenant/extension && npm test -- slug`
Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add extension/src/lib/slug.ts extension/tests/slug.test.ts
git commit -m "feat(extension): add toSlug utility with German transliteration"
```

---

## Task 6: Storage abstraction + Settings library (TDD)

**Files:**
- Create: `extension/src/lib/storage.ts`
- Create: `extension/src/lib/settings.ts`
- Create: `extension/tests/settings.test.ts`

The `storage.ts` module is a thin shim over `chrome.storage.local` with one purpose: tests can inject a fake without hitting the chrome API.

- [ ] **Step 1: Create `extension/src/lib/storage.ts`** (no tests — it's just a typed wrapper)

```ts
export interface KvStorage {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

export class ChromeLocalStorage implements KvStorage {
  async get<T>(key: string): Promise<T | undefined> {
    const result = await chrome.storage.local.get(key);
    return result[key] as T | undefined;
  }
  async set<T>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  }
  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  }
}

export class InMemoryStorage implements KvStorage {
  private store = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | undefined> {
    return this.store.get(key) as T | undefined;
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }
  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }
}
```

- [ ] **Step 2: Write failing tests for settings**

Create `extension/tests/settings.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { InMemoryStorage } from '../src/lib/storage';
import { loadSettings, saveSettings, updateSettings } from '../src/lib/settings';
import { DEFAULT_SETTINGS } from '../src/lib/types';

describe('settings', () => {
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
  });

  it('loadSettings returns defaults when storage is empty', async () => {
    const s = await loadSettings(storage);
    expect(s).toEqual(DEFAULT_SETTINGS);
  });

  it('saveSettings then loadSettings round-trips', async () => {
    await saveSettings(storage, { ...DEFAULT_SETTINGS, storageBasePath: 'D:\\tenants' });
    const s = await loadSettings(storage);
    expect(s.storageBasePath).toBe('D:\\tenants');
  });

  it('updateSettings merges partial updates', async () => {
    await saveSettings(storage, DEFAULT_SETTINGS);
    await updateSettings(storage, { syncEnabled: true });
    const s = await loadSettings(storage);
    expect(s.syncEnabled).toBe(true);
    expect(s.storageBasePath).toBe(DEFAULT_SETTINGS.storageBasePath);
  });

  it('loadSettings backfills missing fields with defaults', async () => {
    await storage.set('settings', { storageBasePath: 'X:\\custom' });
    const s = await loadSettings(storage);
    expect(s.storageBasePath).toBe('X:\\custom');
    expect(s.routerMode).toBe(DEFAULT_SETTINGS.routerMode);
    expect(s.edgeExecutablePath).toBe(DEFAULT_SETTINGS.edgeExecutablePath);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /home/sysadmin/ClaudeCode/multitenant/extension && npm test -- settings`
Expected: FAIL — module `../src/lib/settings` not found.

- [ ] **Step 4: Implement `extension/src/lib/settings.ts`**

```ts
import type { KvStorage } from './storage';
import { DEFAULT_SETTINGS, type Settings } from './types';

const KEY = 'settings';

export async function loadSettings(storage: KvStorage): Promise<Settings> {
  const stored = await storage.get<Partial<Settings>>(KEY);
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
}

export async function saveSettings(storage: KvStorage, settings: Settings): Promise<void> {
  await storage.set(KEY, settings);
}

export async function updateSettings(
  storage: KvStorage,
  patch: Partial<Settings>,
): Promise<Settings> {
  const current = await loadSettings(storage);
  const merged = { ...current, ...patch };
  await saveSettings(storage, merged);
  return merged;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /home/sysadmin/ClaudeCode/multitenant/extension && npm test -- settings`
Expected: All 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add extension/src/lib/storage.ts extension/src/lib/settings.ts extension/tests/settings.test.ts
git commit -m "feat(extension): add storage shim and Settings library with defaults"
```

---

## Task 7: Tenant Registry (TDD)

**Files:**
- Create: `extension/src/lib/registry.ts`
- Create: `extension/tests/registry.test.ts`

The registry holds all tenants. CRUD operations + sort by `lastUsedAt`. Slug generation for `userDataDir` is delegated to `toSlug` (Task 5).

- [ ] **Step 1: Write failing tests**

Create `extension/tests/registry.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/sysadmin/ClaudeCode/multitenant/extension && npm test -- registry`
Expected: FAIL — module `../src/lib/registry` not found.

- [ ] **Step 3: Implement `extension/src/lib/registry.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/sysadmin/ClaudeCode/multitenant/extension && npm test -- registry`
Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add extension/src/lib/registry.ts extension/tests/registry.test.ts
git commit -m "feat(extension): add Tenant Registry CRUD with slug-based userDataDir"
```

---

## Task 8: Native Host stdio framing (TDD)

**Files:**
- Create: `native-host/protocol.go`
- Create: `native-host/protocol_test.go`

Native Messaging uses a 4-byte little-endian length prefix followed by UTF-8 JSON payload. Both directions.

- [ ] **Step 1: Write failing tests**

Create `native-host/protocol_test.go`:

```go
package main

import (
	"bytes"
	"encoding/binary"
	"strings"
	"testing"
)

func TestReadMessage_RoundTrip(t *testing.T) {
	payload := []byte(`{"type":"ping"}`)
	var buf bytes.Buffer
	if err := binary.Write(&buf, binary.LittleEndian, uint32(len(payload))); err != nil {
		t.Fatal(err)
	}
	buf.Write(payload)

	got, err := readMessage(&buf)
	if err != nil {
		t.Fatalf("readMessage error: %v", err)
	}
	if string(got) != string(payload) {
		t.Errorf("got %q, want %q", got, payload)
	}
}

func TestReadMessage_RejectsOversizedMessage(t *testing.T) {
	var buf bytes.Buffer
	binary.Write(&buf, binary.LittleEndian, uint32(maxMessageSize+1))
	_, err := readMessage(&buf)
	if err == nil {
		t.Fatal("expected error for oversized message, got nil")
	}
}

func TestReadMessage_ReturnsErrOnEOF(t *testing.T) {
	_, err := readMessage(bytes.NewReader(nil))
	if err == nil {
		t.Fatal("expected error on EOF, got nil")
	}
}

func TestWriteMessage_PrefixesLength(t *testing.T) {
	var buf bytes.Buffer
	payload := []byte(`{"type":"ok"}`)
	if err := writeMessage(&buf, payload); err != nil {
		t.Fatal(err)
	}
	wantPrefix := []byte{byte(len(payload)), 0, 0, 0}
	if !bytes.Equal(buf.Bytes()[:4], wantPrefix) {
		t.Errorf("prefix = %v, want %v", buf.Bytes()[:4], wantPrefix)
	}
	if !bytes.Equal(buf.Bytes()[4:], payload) {
		t.Errorf("payload mismatch")
	}
}

func TestWriteMessage_RejectsOversized(t *testing.T) {
	var buf bytes.Buffer
	huge := []byte(strings.Repeat("x", maxMessageSize+1))
	if err := writeMessage(&buf, huge); err == nil {
		t.Fatal("expected error for oversized payload")
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/sysadmin/ClaudeCode/multitenant/native-host && go test ./...`
Expected: FAIL — undefined `readMessage`, `writeMessage`, `maxMessageSize`.

- [ ] **Step 3: Implement `native-host/protocol.go`**

```go
package main

import (
	"encoding/binary"
	"fmt"
	"io"
)

// Chromium's native messaging limit is 1 MB per direction. We cap below that
// to leave headroom for unforeseen overhead.
const maxMessageSize = 1024 * 1024

// readMessage reads a single Native Messaging frame from r:
// 4-byte little-endian length prefix followed by that many UTF-8 bytes.
func readMessage(r io.Reader) ([]byte, error) {
	var length uint32
	if err := binary.Read(r, binary.LittleEndian, &length); err != nil {
		return nil, fmt.Errorf("read length prefix: %w", err)
	}
	if length > maxMessageSize {
		return nil, fmt.Errorf("message too large: %d > %d", length, maxMessageSize)
	}
	buf := make([]byte, length)
	if _, err := io.ReadFull(r, buf); err != nil {
		return nil, fmt.Errorf("read payload: %w", err)
	}
	return buf, nil
}

// writeMessage writes a single Native Messaging frame to w.
func writeMessage(w io.Writer, payload []byte) error {
	if len(payload) > maxMessageSize {
		return fmt.Errorf("payload too large: %d > %d", len(payload), maxMessageSize)
	}
	if err := binary.Write(w, binary.LittleEndian, uint32(len(payload))); err != nil {
		return fmt.Errorf("write length prefix: %w", err)
	}
	if _, err := w.Write(payload); err != nil {
		return fmt.Errorf("write payload: %w", err)
	}
	return nil
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/sysadmin/ClaudeCode/multitenant/native-host && go test -run TestReadMessage -run TestWriteMessage ./...`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add native-host/protocol.go native-host/protocol_test.go
git commit -m "feat(native-host): implement Native Messaging stdio framing"
```

---

## Task 9: Native Host JSON request/response types and dispatch (TDD)

**Files:**
- Create: `native-host/messages.go`
- Create: `native-host/messages_test.go`

JSON struct definitions matching `NativeRequest`/`NativeResponse` from `extension/src/lib/types.ts`, plus helpers.

- [ ] **Step 1: Write failing tests**

Create `native-host/messages_test.go`:

```go
package main

import (
	"encoding/json"
	"testing"
)

func TestParseRequest_Ping(t *testing.T) {
	req, err := parseRequest([]byte(`{"type":"ping"}`))
	if err != nil {
		t.Fatal(err)
	}
	if req.Type != "ping" {
		t.Errorf("Type = %q, want %q", req.Type, "ping")
	}
}

func TestParseRequest_Launch(t *testing.T) {
	body := `{
		"type": "launch",
		"tenantId": "abc",
		"userDataDir": "C:\\tenants\\mueller",
		"storageBasePath": "C:\\tenants",
		"url": "https://portal.azure.com"
	}`
	req, err := parseRequest([]byte(body))
	if err != nil {
		t.Fatal(err)
	}
	if req.Type != "launch" || req.UserDataDir != `C:\tenants\mueller` || req.URL == "" {
		t.Errorf("unexpected request: %+v", req)
	}
}

func TestParseRequest_InvalidJSON(t *testing.T) {
	_, err := parseRequest([]byte(`{not-json`))
	if err == nil {
		t.Fatal("expected error for invalid JSON")
	}
}

func TestErrorResponse_Marshal(t *testing.T) {
	resp := errorResponse("PATH_NOT_WHITELISTED", "nope")
	bs, err := json.Marshal(resp)
	if err != nil {
		t.Fatal(err)
	}
	want := `{"type":"error","code":"PATH_NOT_WHITELISTED","message":"nope"}`
	if string(bs) != want {
		t.Errorf("got %s, want %s", bs, want)
	}
}

func TestOkResponse_Marshal(t *testing.T) {
	resp := okResponse(map[string]any{"running": true})
	bs, err := json.Marshal(resp)
	if err != nil {
		t.Fatal(err)
	}
	if string(bs) != `{"type":"ok","data":{"running":true}}` {
		t.Errorf("unexpected: %s", bs)
	}
}

func TestOkResponse_NoData(t *testing.T) {
	resp := okResponse(nil)
	bs, _ := json.Marshal(resp)
	if string(bs) != `{"type":"ok"}` {
		t.Errorf("got %s, want %q", bs, `{"type":"ok"}`)
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/sysadmin/ClaudeCode/multitenant/native-host && go test -run TestParseRequest -run TestErrorResponse -run TestOkResponse ./...`
Expected: FAIL — undefined symbols.

- [ ] **Step 3: Implement `native-host/messages.go`**

```go
package main

import (
	"encoding/json"
	"fmt"
)

type request struct {
	Type            string `json:"type"`
	TenantID        string `json:"tenantId,omitempty"`
	UserDataDir     string `json:"userDataDir,omitempty"`
	StorageBasePath string `json:"storageBasePath,omitempty"`
	URL             string `json:"url,omitempty"`
}

type response struct {
	Type    string `json:"type"`
	Code    string `json:"code,omitempty"`
	Message string `json:"message,omitempty"`
	Data    any    `json:"data,omitempty"`
}

func parseRequest(payload []byte) (*request, error) {
	var r request
	if err := json.Unmarshal(payload, &r); err != nil {
		return nil, fmt.Errorf("parse request: %w", err)
	}
	if r.Type == "" {
		return nil, fmt.Errorf("missing type field")
	}
	return &r, nil
}

func okResponse(data any) response {
	return response{Type: "ok", Data: data}
}

func errorResponse(code, message string) response {
	return response{Type: "error", Code: code, Message: message}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/sysadmin/ClaudeCode/multitenant/native-host && go test ./...`
Expected: All 11 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add native-host/messages.go native-host/messages_test.go
git commit -m "feat(native-host): add JSON request/response types"
```

---

## Task 10: Native Host path validation (TDD)

**Files:**
- Create: `native-host/paths.go`
- Create: `native-host/paths_test.go`

The host must refuse to launch Edge with a `userDataDir` that escapes the declared `storageBasePath`, contains traversal, or points at system-sensitive locations.

- [ ] **Step 1: Write failing tests**

Create `native-host/paths_test.go`:

```go
package main

import "testing"

func TestValidateUserDataDir_HappyPath(t *testing.T) {
	err := validateUserDataDir(`C:\Users\you\AppData\Local\TenantSwitcher\profiles\mueller-ag`,
		`C:\Users\you\AppData\Local\TenantSwitcher\profiles`)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestValidateUserDataDir_RejectsParentTraversal(t *testing.T) {
	err := validateUserDataDir(`C:\tenants\..\..\Windows\System32`, `C:\tenants`)
	if err == nil {
		t.Error("expected rejection for .. traversal")
	}
}

func TestValidateUserDataDir_RejectsOutsideBase(t *testing.T) {
	err := validateUserDataDir(`D:\evil`, `C:\tenants`)
	if err == nil {
		t.Error("expected rejection for path outside base")
	}
}

func TestValidateUserDataDir_RejectsBaseItself(t *testing.T) {
	// Don't let user-data-dir equal the base itself; must be a child.
	err := validateUserDataDir(`C:\tenants`, `C:\tenants`)
	if err == nil {
		t.Error("expected rejection for path equal to base")
	}
}

func TestValidateUserDataDir_AcceptsForwardSlashes(t *testing.T) {
	// Normalize Windows + forward-slash mixed paths.
	err := validateUserDataDir(`C:/tenants/mueller-ag`, `C:\tenants`)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestValidateUserDataDir_RejectsRelativePath(t *testing.T) {
	err := validateUserDataDir(`tenants\mueller-ag`, `C:\tenants`)
	if err == nil {
		t.Error("expected rejection for relative path")
	}
}

func TestValidateUserDataDir_RejectsEmptyBase(t *testing.T) {
	err := validateUserDataDir(`C:\tenants\mueller-ag`, ``)
	if err == nil {
		t.Error("expected rejection for empty base path")
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/sysadmin/ClaudeCode/multitenant/native-host && go test -run TestValidateUserDataDir ./...`
Expected: FAIL — undefined `validateUserDataDir`.

- [ ] **Step 3: Implement `native-host/paths.go`**

```go
package main

import (
	"fmt"
	"path/filepath"
	"strings"
)

// normalizePath canonicalizes a path: forward-slashes → backslashes on Windows-style paths,
// resolves "." and ".." components, returns absolute lexical form.
func normalizePath(p string) string {
	p = strings.ReplaceAll(p, "/", `\`)
	return filepath.Clean(p)
}

// isAbsoluteWindows returns true if p looks like an absolute Windows path
// (drive letter or UNC). filepath.IsAbs on non-Windows builds doesn't recognize
// "C:\..." so we check explicitly to keep behavior consistent in tests on Linux.
func isAbsoluteWindows(p string) bool {
	if len(p) >= 3 && p[1] == ':' && (p[2] == '\\' || p[2] == '/') {
		return true
	}
	if strings.HasPrefix(p, `\\`) || strings.HasPrefix(p, `//`) {
		return true
	}
	return false
}

func validateUserDataDir(userDataDir, storageBasePath string) error {
	if storageBasePath == "" {
		return fmt.Errorf("storageBasePath is empty")
	}
	if !isAbsoluteWindows(userDataDir) {
		return fmt.Errorf("userDataDir must be absolute: %q", userDataDir)
	}
	if !isAbsoluteWindows(storageBasePath) {
		return fmt.Errorf("storageBasePath must be absolute: %q", storageBasePath)
	}
	udd := normalizePath(userDataDir)
	base := normalizePath(storageBasePath)

	uddLower := strings.ToLower(udd)
	baseLower := strings.ToLower(base)
	prefix := baseLower + `\`

	if uddLower == baseLower {
		return fmt.Errorf("userDataDir must be a child of storageBasePath, not the base itself")
	}
	if !strings.HasPrefix(uddLower, prefix) {
		return fmt.Errorf("userDataDir %q is not under storageBasePath %q", udd, base)
	}
	return nil
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/sysadmin/ClaudeCode/multitenant/native-host && go test ./...`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add native-host/paths.go native-host/paths_test.go
git commit -m "feat(native-host): add path validation against whitelist base"
```

---

## Task 11: Native Host Edge discovery and launch (TDD)

**Files:**
- Create: `native-host/edge.go`
- Create: `native-host/edge_test.go`

Discovers `msedge.exe` in standard install locations, launches with `--user-data-dir` and the requested URL. The exec function is injected for testability.

- [ ] **Step 1: Write failing tests**

Create `native-host/edge_test.go`:

```go
package main

import (
	"errors"
	"testing"
)

func TestBuildEdgeArgs_BasicLaunch(t *testing.T) {
	args := buildEdgeArgs(`C:\tenants\mueller`, `https://portal.azure.com`)
	want := []string{
		`--user-data-dir=C:\tenants\mueller`,
		`--no-first-run`,
		`--no-default-browser-check`,
		`https://portal.azure.com`,
	}
	if len(args) != len(want) {
		t.Fatalf("len got %d, want %d (%v)", len(args), len(want), args)
	}
	for i := range args {
		if args[i] != want[i] {
			t.Errorf("args[%d] = %q, want %q", i, args[i], want[i])
		}
	}
}

func TestBuildEdgeArgs_OmitsURLWhenEmpty(t *testing.T) {
	args := buildEdgeArgs(`C:\tenants\mueller`, ``)
	for _, a := range args {
		if a == `` {
			t.Error("found empty argument")
		}
	}
	if args[len(args)-1] == `https://portal.azure.com` {
		t.Error("should not have URL when empty was passed")
	}
}

func TestDiscoverEdge_PicksFirstExistingPath(t *testing.T) {
	exists := func(p string) bool {
		return p == `C:\Program Files\Microsoft\Edge\Application\msedge.exe`
	}
	candidates := []string{
		`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`,
		`C:\Program Files\Microsoft\Edge\Application\msedge.exe`,
	}
	got, err := discoverEdge(candidates, exists)
	if err != nil {
		t.Fatal(err)
	}
	if got != `C:\Program Files\Microsoft\Edge\Application\msedge.exe` {
		t.Errorf("got %q", got)
	}
}

func TestDiscoverEdge_ErrorWhenNoneExist(t *testing.T) {
	_, err := discoverEdge([]string{`X:\nope.exe`}, func(string) bool { return false })
	if !errors.Is(err, errEdgeNotFound) {
		t.Errorf("got error %v, want errEdgeNotFound", err)
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/sysadmin/ClaudeCode/multitenant/native-host && go test -run TestBuildEdgeArgs -run TestDiscoverEdge ./...`
Expected: FAIL — undefined symbols.

- [ ] **Step 3: Implement `native-host/edge.go`**

```go
package main

import (
	"errors"
	"os"
	"os/exec"
)

var errEdgeNotFound = errors.New("msedge.exe not found in standard install locations")

// defaultEdgeCandidates returns the standard Windows install locations for Edge,
// after expanding %PROGRAMFILES%, %PROGRAMFILES(X86)%, %LOCALAPPDATA%.
func defaultEdgeCandidates() []string {
	expand := func(envVar string) string {
		v := os.Getenv(envVar)
		if v == "" {
			return ""
		}
		return v + `\Microsoft\Edge\Application\msedge.exe`
	}
	out := []string{}
	for _, env := range []string{"PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA"} {
		if c := expand(env); c != "" {
			out = append(out, c)
		}
	}
	return out
}

func fileExists(p string) bool {
	_, err := os.Stat(p)
	return err == nil
}

// discoverEdge returns the first existing path from candidates.
func discoverEdge(candidates []string, exists func(string) bool) (string, error) {
	for _, c := range candidates {
		if exists(c) {
			return c, nil
		}
	}
	return "", errEdgeNotFound
}

// buildEdgeArgs constructs the argv (without the executable itself).
func buildEdgeArgs(userDataDir, url string) []string {
	args := []string{
		"--user-data-dir=" + userDataDir,
		"--no-first-run",
		"--no-default-browser-check",
	}
	if url != "" {
		args = append(args, url)
	}
	return args
}

// launchEdge starts msedge.exe detached and returns immediately.
// Returns nil error when the process was started successfully.
func launchEdge(edgeExe string, args []string) error {
	cmd := exec.Command(edgeExe, args...)
	if err := cmd.Start(); err != nil {
		return err
	}
	// Detach: don't wait for the child.
	go func() { _ = cmd.Wait() }()
	return nil
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/sysadmin/ClaudeCode/multitenant/native-host && go test ./...`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add native-host/edge.go native-host/edge_test.go
git commit -m "feat(native-host): add Edge discovery and arg construction"
```

---

## Task 12: Native Host main entrypoint and dispatch loop

**Files:**
- Create: `native-host/main.go`

Wires everything together: read message → parse → handle → write response. Loops until stdin closes.

- [ ] **Step 1: Implement `native-host/main.go`**

```go
package main

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"os"
)

func main() {
	if err := run(os.Stdin, os.Stdout, defaultEdgeCandidates(), fileExists, launchEdge); err != nil {
		log.Fatalf("tenant-helper: %v", err)
	}
}

func run(
	in io.Reader,
	out io.Writer,
	edgeCandidates []string,
	exists func(string) bool,
	launch func(string, []string) error,
) error {
	for {
		raw, err := readMessage(in)
		if err != nil {
			// Clean shutdown when the extension closes the port (Edge unloads
			// the host on extension reload, browser quit, or computer sleep).
			if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
				return nil
			}
			return err
		}
		resp := handle(raw, edgeCandidates, exists, launch)
		bs, _ := json.Marshal(resp)
		if err := writeMessage(out, bs); err != nil {
			return err
		}
	}
}

func handle(
	raw []byte,
	edgeCandidates []string,
	exists func(string) bool,
	launch func(string, []string) error,
) response {
	req, err := parseRequest(raw)
	if err != nil {
		return errorResponse("INVALID_REQUEST", err.Error())
	}
	switch req.Type {
	case "ping":
		return okResponse(map[string]any{"pong": true, "version": "0.1.0"})

	case "launch":
		if err := validateUserDataDir(req.UserDataDir, req.StorageBasePath); err != nil {
			return errorResponse("PATH_NOT_WHITELISTED", err.Error())
		}
		edgeExe, err := discoverEdge(edgeCandidates, exists)
		if err != nil {
			return errorResponse("EDGE_NOT_FOUND", err.Error())
		}
		if err := os.MkdirAll(normalizePath(req.UserDataDir), 0o755); err != nil {
			return errorResponse("LAUNCH_FAILED", "create user-data-dir: "+err.Error())
		}
		args := buildEdgeArgs(req.UserDataDir, req.URL)
		if err := launch(edgeExe, args); err != nil {
			return errorResponse("LAUNCH_FAILED", err.Error())
		}
		return okResponse(map[string]any{"launched": true, "edge": edgeExe})

	case "isRunning":
		// Phase 1: simple stub — assume false. We can refine in Phase 2 by
		// checking for the presence of the lockfile inside userDataDir.
		return okResponse(map[string]any{"running": false})

	default:
		return errorResponse("INVALID_REQUEST", "unknown type: "+req.Type)
	}
}
```

- [ ] **Step 2: Add an integration-style test for `handle`**

Create `native-host/main_test.go`:

```go
package main

import (
	"encoding/json"
	"testing"
)

type launchCall struct {
	exe  string
	args []string
}

func mockSetup() (*launchCall, func(string, []string) error, func(string) bool, []string) {
	call := &launchCall{}
	launch := func(exe string, args []string) error {
		call.exe = exe
		call.args = args
		return nil
	}
	exists := func(p string) bool { return p == `C:\Program Files\Microsoft\Edge\Application\msedge.exe` }
	candidates := []string{`C:\Program Files\Microsoft\Edge\Application\msedge.exe`}
	return call, launch, exists, candidates
}

func TestHandle_Ping(t *testing.T) {
	call, launch, exists, candidates := mockSetup()
	resp := handle([]byte(`{"type":"ping"}`), candidates, exists, launch)
	if resp.Type != "ok" {
		t.Errorf("got type %q", resp.Type)
	}
	if call.exe != "" {
		t.Error("ping should not invoke launch")
	}
}

func TestHandle_Launch_RejectsBadPath(t *testing.T) {
	_, launch, exists, candidates := mockSetup()
	body := `{"type":"launch","userDataDir":"D:\\evil","storageBasePath":"C:\\tenants","url":"https://portal.azure.com"}`
	resp := handle([]byte(body), candidates, exists, launch)
	if resp.Type != "error" || resp.Code != "PATH_NOT_WHITELISTED" {
		bs, _ := json.Marshal(resp)
		t.Errorf("got %s", bs)
	}
}

func TestHandle_Launch_InvalidJSON(t *testing.T) {
	_, launch, exists, candidates := mockSetup()
	resp := handle([]byte(`{not-json`), candidates, exists, launch)
	if resp.Code != "INVALID_REQUEST" {
		t.Errorf("got code %q", resp.Code)
	}
}

func TestHandle_Launch_NoEdge(t *testing.T) {
	_, launch, _, _ := mockSetup()
	exists := func(string) bool { return false }
	body := `{"type":"launch","userDataDir":"C:\\tenants\\m","storageBasePath":"C:\\tenants","url":""}`
	resp := handle([]byte(body), []string{`C:\nope.exe`}, exists, launch)
	if resp.Code != "EDGE_NOT_FOUND" {
		t.Errorf("got code %q (%s)", resp.Code, resp.Message)
	}
}
```

Note: `TestHandle_Launch_HappyPath` is intentionally not included because `handle` calls `os.MkdirAll`, which would touch the filesystem in the test. The path validation, edge discovery, and arg construction are each covered by their own unit tests in earlier tasks; the happy path is exercised manually by the smoke-test checklist (Task 21).

- [ ] **Step 3: Run all native-host tests**

Run: `cd /home/sysadmin/ClaudeCode/multitenant/native-host && go test ./...`
Expected: All tests PASS.

- [ ] **Step 4: Build the binary to confirm it compiles**

Run: `cd /home/sysadmin/ClaudeCode/multitenant/native-host && GOOS=windows GOARCH=amd64 go build -o tenant-helper.exe .`
Expected: `tenant-helper.exe` exists, no compile errors. (Cross-compiled from Linux dev box.)

- [ ] **Step 5: Commit**

```bash
git add native-host/main.go native-host/main_test.go
git commit -m "feat(native-host): wire main entrypoint and request dispatcher"
```

---

## Task 13: Native Host PowerShell installer

**Files:**
- Create: `native-host/installer/install.ps1`
- Create: `native-host/installer/uninstall.ps1`
- Create: `native-host/installer/tenant-helper.json.tmpl`

Registers the Native Messaging manifest in the per-user Edge registry hive. Per-user (HKCU) avoids needing admin rights.

- [ ] **Step 1: Create `native-host/installer/tenant-helper.json.tmpl`**

```json
{
  "name": "ch.pluess.tenant_helper",
  "description": "Edge Tenant Switcher native messaging host",
  "path": "{{HELPER_PATH}}",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://{{EXTENSION_ID}}/"
  ]
}
```

- [ ] **Step 2: Create `native-host/installer/install.ps1`**

```powershell
<#
.SYNOPSIS
    Installs the tenant-helper Native Messaging host for Microsoft Edge.

.DESCRIPTION
    Copies tenant-helper.exe to %LOCALAPPDATA%\TenantSwitcher\, writes
    the Native Messaging manifest, and registers it under
    HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\ch.pluess.tenant_helper.

.PARAMETER ExtensionId
    The Edge extension ID (32-char lowercase). Find it under edge://extensions
    after loading the unpacked extension.

.EXAMPLE
    .\install.ps1 -ExtensionId abcdefghijklmnopabcdefghijklmnop
#>
param(
    [Parameter(Mandatory=$true)]
    [ValidatePattern('^[a-p]{32}$')]
    [string]$ExtensionId
)

$ErrorActionPreference = 'Stop'

$HostName = 'ch.pluess.tenant_helper'
$InstallDir = Join-Path $env:LOCALAPPDATA 'TenantSwitcher'
$HelperExe = Join-Path $InstallDir 'tenant-helper.exe'
$ManifestPath = Join-Path $InstallDir 'tenant-helper.json'
$RegistryPath = "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$HostName"

# 1. Create install directory
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir | Out-Null
}

# 2. Copy executable from script's directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SourceExe = Join-Path $ScriptDir 'tenant-helper.exe'
if (-not (Test-Path $SourceExe)) {
    throw "tenant-helper.exe not found next to install.ps1 (looked in $ScriptDir)"
}
Copy-Item -Path $SourceExe -Destination $HelperExe -Force

# 3. Render manifest from template
$TemplatePath = Join-Path $ScriptDir 'tenant-helper.json.tmpl'
$Template = Get-Content -Raw -Path $TemplatePath
$Manifest = $Template `
    -replace '\{\{HELPER_PATH\}\}', ($HelperExe -replace '\\', '\\') `
    -replace '\{\{EXTENSION_ID\}\}', $ExtensionId
Set-Content -Path $ManifestPath -Value $Manifest -Encoding utf8

# 4. Register manifest in registry (default value = manifest path)
if (-not (Test-Path $RegistryPath)) {
    New-Item -Path $RegistryPath -Force | Out-Null
}
Set-ItemProperty -Path $RegistryPath -Name '(Default)' -Value $ManifestPath

Write-Host "Installed tenant-helper:"
Write-Host "  Executable: $HelperExe"
Write-Host "  Manifest:   $ManifestPath"
Write-Host "  Registry:   $RegistryPath"
Write-Host ""
Write-Host "Reload the extension in edge://extensions, then click 'Verbindung pruefen' in the Welcome page."
```

- [ ] **Step 3: Create `native-host/installer/uninstall.ps1`**

```powershell
<#
.SYNOPSIS
    Removes the tenant-helper Native Messaging host installation.
#>
$ErrorActionPreference = 'Stop'

$HostName = 'ch.pluess.tenant_helper'
$InstallDir = Join-Path $env:LOCALAPPDATA 'TenantSwitcher'
$RegistryPath = "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$HostName"

if (Test-Path $RegistryPath) {
    Remove-Item -Path $RegistryPath -Recurse -Force
    Write-Host "Removed registry key: $RegistryPath"
}

if (Test-Path $InstallDir) {
    Remove-Item -Path (Join-Path $InstallDir 'tenant-helper.exe') -Force -ErrorAction SilentlyContinue
    Remove-Item -Path (Join-Path $InstallDir 'tenant-helper.json') -Force -ErrorAction SilentlyContinue
    Write-Host "Removed binaries from: $InstallDir"
}
Write-Host "Note: tenant profile directories under $InstallDir\profiles\ were preserved."
```

- [ ] **Step 4: Verify scripts parse without error**

We can't run PowerShell on Linux easily, but we can lint the template:

Run: `ls /home/sysadmin/ClaudeCode/multitenant/native-host/installer/`
Expected: `install.ps1`, `uninstall.ps1`, `tenant-helper.json.tmpl`

- [ ] **Step 5: Commit**

```bash
git add native-host/installer/
git commit -m "feat(native-host): add PowerShell installer for native messaging manifest"
```

---

## Task 14: Extension Native Messaging client wrapper (TDD)

**Files:**
- Create: `extension/src/lib/native-host.ts`
- Create: `extension/tests/native-host.test.ts`

Wraps `chrome.runtime.sendNativeMessage` (or `connectNative` for long-lived) with typed request/response and a Promise interface.

- [ ] **Step 1: Write failing tests**

Create `extension/tests/native-host.test.ts`:

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { sendNative, NativeHostError } from '../src/lib/native-host';
import type { NativeRequest, NativeResponse } from '../src/lib/types';

interface ChromeRuntimeMock {
  lastError: { message: string } | null;
  sendNativeMessage: (
    host: string,
    msg: NativeRequest,
    cb: (resp: NativeResponse) => void,
  ) => void;
}

function installChromeMock(mock: ChromeRuntimeMock): void {
  (globalThis as unknown as { chrome: { runtime: ChromeRuntimeMock } }).chrome = {
    runtime: mock,
  };
}

describe('sendNative', () => {
  beforeEach(() => {
    installChromeMock({
      lastError: null,
      sendNativeMessage: vi.fn(),
    });
  });

  it('resolves with the response on success', async () => {
    installChromeMock({
      lastError: null,
      sendNativeMessage: (_host, _msg, cb) => cb({ type: 'ok', data: { pong: true } }),
    });
    const resp = await sendNative({ type: 'ping' });
    expect(resp).toEqual({ type: 'ok', data: { pong: true } });
  });

  it('throws NativeHostError when chrome.runtime.lastError is set', async () => {
    installChromeMock({
      lastError: { message: 'Specified native messaging host not found.' },
      sendNativeMessage: (_host, _msg, cb) => cb(undefined as unknown as NativeResponse),
    });
    await expect(sendNative({ type: 'ping' })).rejects.toThrow(NativeHostError);
  });

  it('throws NativeHostError when the host returns type=error', async () => {
    installChromeMock({
      lastError: null,
      sendNativeMessage: (_host, _msg, cb) =>
        cb({ type: 'error', code: 'EDGE_NOT_FOUND', message: 'no msedge.exe' }),
    });
    try {
      await sendNative({ type: 'ping' });
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(NativeHostError);
      expect((e as NativeHostError).code).toBe('EDGE_NOT_FOUND');
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/sysadmin/ClaudeCode/multitenant/extension && npm test -- native-host`
Expected: FAIL — module `../src/lib/native-host` not found.

- [ ] **Step 3: Implement `extension/src/lib/native-host.ts`**

```ts
import type { NativeErrorCode, NativeRequest, NativeResponse } from './types';

const HOST_NAME = 'ch.pluess.tenant_helper';

export class NativeHostError extends Error {
  constructor(
    public readonly code: NativeErrorCode | 'NO_RESPONSE' | 'NOT_CONNECTED',
    message: string,
  ) {
    super(message);
    this.name = 'NativeHostError';
  }
}

export function sendNative(request: NativeRequest): Promise<NativeResponse> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendNativeMessage(HOST_NAME, request, (resp: NativeResponse | undefined) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new NativeHostError('NOT_CONNECTED', lastError.message ?? 'unknown'));
        return;
      }
      if (!resp) {
        reject(new NativeHostError('NO_RESPONSE', 'Native host returned no response'));
        return;
      }
      if (resp.type === 'error') {
        reject(new NativeHostError(resp.code, resp.message));
        return;
      }
      resolve(resp);
    });
  });
}

export async function pingHost(): Promise<boolean> {
  try {
    const r = await sendNative({ type: 'ping' });
    return r.type === 'ok';
  } catch {
    return false;
  }
}

export async function launchTenant(args: {
  tenantId: string;
  userDataDir: string;
  storageBasePath: string;
  url: string;
}): Promise<void> {
  await sendNative({
    type: 'launch',
    tenantId: args.tenantId,
    userDataDir: args.userDataDir,
    storageBasePath: args.storageBasePath,
    url: args.url,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/sysadmin/ClaudeCode/multitenant/extension && npm test -- native-host`
Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add extension/src/lib/native-host.ts extension/tests/native-host.test.ts
git commit -m "feat(extension): add typed Native Messaging client wrapper"
```

---

## Task 15: Real `manifest.json` and extension icon placeholders

**Files:**
- Modify: `extension/src/manifest.json`
- Create: `extension/src/icons/icon-16.png`
- Create: `extension/src/icons/icon-48.png`
- Create: `extension/src/icons/icon-128.png`

- [ ] **Step 1: Replace `extension/src/manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "Edge Tenant Switcher",
  "version": "0.1.0",
  "description": "Manage many Azure/M365 tenants with isolated Edge profiles. One click per customer, no more wrong-tenant logins.",
  "permissions": [
    "storage",
    "nativeMessaging"
  ],
  "background": {
    "service_worker": "src/background/service-worker.ts",
    "type": "module"
  },
  "action": {
    "default_popup": "src/popup/index.html",
    "default_title": "Tenant Switcher",
    "default_icon": {
      "16": "src/icons/icon-16.png",
      "48": "src/icons/icon-48.png",
      "128": "src/icons/icon-128.png"
    }
  },
  "options_page": "src/options/index.html",
  "icons": {
    "16": "src/icons/icon-16.png",
    "48": "src/icons/icon-48.png",
    "128": "src/icons/icon-128.png"
  }
}
```

- [ ] **Step 2: Create placeholder PNG icons**

Run:
```bash
cd /home/sysadmin/ClaudeCode/multitenant/extension/src/icons && \
python3 -c "
import struct, zlib, os
def make_png(size, path):
    # Solid color RGBA PNG, indigo (#5B4DE0) — recognizable, matches future brand
    pixel = bytes([91, 77, 224, 255])
    raw = b''
    for _ in range(size):
        raw += b'\x00' + pixel * size
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    idat = zlib.compress(raw)
    with open(path, 'wb') as f:
        f.write(sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b''))
make_png(16, 'icon-16.png')
make_png(48, 'icon-48.png')
make_png(128, 'icon-128.png')
print('icons created')
"
```
Expected: Three PNG files created.

Run: `ls -la /home/sysadmin/ClaudeCode/multitenant/extension/src/icons/`
Expected: All three icons present, non-zero size.

- [ ] **Step 3: Verify the manifest is valid JSON**

Run: `cd /home/sysadmin/ClaudeCode/multitenant/extension && node -e "JSON.parse(require('fs').readFileSync('src/manifest.json'))" && echo OK`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add extension/src/manifest.json extension/src/icons/
git commit -m "feat(extension): add Manifest V3 with permissions and placeholder icons"
```

---

## Task 16: Service worker (badge color, install hook)

**Files:**
- Create: `extension/src/background/service-worker.ts`

The service worker:
1. On install, opens the welcome page (first-run setup wizard).
2. Listens for messages from popup/options to update the toolbar badge color (visual indicator of "last-used" tenant).

- [ ] **Step 1: Create `extension/src/background/service-worker.ts`**

```ts
// Background service worker for Edge Tenant Switcher.
// Two responsibilities in Phase 1:
//   1. Open the welcome page on first install.
//   2. Update the toolbar badge color when a tenant is launched.

const BADGE_MESSAGE_TYPE = 'tenant-switcher:setBadge';

interface SetBadgeMessage {
  type: typeof BADGE_MESSAGE_TYPE;
  tenantName: string;
  color: string;
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/welcome/index.html') });
  }
});

chrome.runtime.onMessage.addListener(
  (msg: unknown, _sender, sendResponse) => {
    if (!isSetBadgeMessage(msg)) return false;
    const initials = msg.tenantName
      .split(/\s+/)
      .map((p) => p[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase();
    chrome.action.setBadgeBackgroundColor({ color: msg.color });
    chrome.action.setBadgeText({ text: initials });
    chrome.action.setTitle({ title: `Last launched: ${msg.tenantName}` });
    sendResponse({ ok: true });
    return true;
  },
);

function isSetBadgeMessage(msg: unknown): msg is SetBadgeMessage {
  if (typeof msg !== 'object' || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return (
    m.type === BADGE_MESSAGE_TYPE &&
    typeof m.tenantName === 'string' &&
    typeof m.color === 'string'
  );
}

export {};
```

- [ ] **Step 2: Verify it type-checks**

Run: `cd /home/sysadmin/ClaudeCode/multitenant/extension && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add extension/src/background/service-worker.ts
git commit -m "feat(extension): add service worker for welcome page and badge updates"
```

---

## Task 17: Popup UI (tenant list and launch)

**Files:**
- Create: `extension/src/popup/index.html`
- Create: `extension/src/popup/popup.css`
- Create: `extension/src/popup/popup.ts`

The popup is the daily-driver UI: list of tenants (recent first), click launches via native host.

- [ ] **Step 1: Create `extension/src/popup/index.html`**

```html
<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <title>Tenant Switcher</title>
    <link rel="stylesheet" href="popup.css" />
  </head>
  <body>
    <header>
      <h1>Tenant</h1>
      <a href="#" id="open-options" title="Einstellungen">⚙</a>
    </header>

    <section id="recent-section" hidden>
      <h2>Zuletzt verwendet</h2>
      <ul id="recent-list"></ul>
    </section>

    <section id="all-section">
      <h2>Alle Kunden</h2>
      <ul id="all-list"></ul>
    </section>

    <p id="empty-state" hidden>
      Noch keine Tenants angelegt.
      <a href="#" id="open-options-empty">Jetzt einrichten →</a>
    </p>

    <p id="error-banner" class="error" hidden></p>

    <script type="module" src="popup.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `extension/src/popup/popup.css`**

```css
:root {
  --bg: #ffffff;
  --fg: #1a1a1a;
  --muted: #6b6b6b;
  --border: #e0e0e0;
  --hover: #f4f4f4;
  --error-bg: #fde8e8;
  --error-fg: #9b1c1c;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  width: 320px;
  font: 14px system-ui, -apple-system, sans-serif;
  color: var(--fg);
  background: var(--bg);
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
}

header h1 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

header a {
  text-decoration: none;
  color: var(--muted);
  font-size: 16px;
}

section h2 {
  margin: 0;
  padding: 8px 12px 4px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  font-weight: 600;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0 0 4px;
}

li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
}

li:hover {
  background: var(--hover);
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex: 0 0 auto;
}

.name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

#empty-state {
  margin: 16px 12px;
  color: var(--muted);
}

.error {
  margin: 0;
  padding: 8px 12px;
  background: var(--error-bg);
  color: var(--error-fg);
  font-size: 12px;
}
```

- [ ] **Step 3: Create `extension/src/popup/popup.ts`**

```ts
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
```

- [ ] **Step 4: Verify type-checks**

Run: `cd /home/sysadmin/ClaudeCode/multitenant/extension && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add extension/src/popup/
git commit -m "feat(extension): add popup UI for tenant list and one-click launch"
```

---

## Task 18: Options page (Settings + Tenant CRUD)

**Files:**
- Create: `extension/src/options/index.html`
- Create: `extension/src/options/options.css`
- Create: `extension/src/options/options.ts`

The options page has two tabs in spirit (rendered as two sections one after the other for simplicity in v0.1):
1. Settings (storage path, edge executable path)
2. Tenant list with add/edit/delete

- [ ] **Step 1: Create `extension/src/options/index.html`**

```html
<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <title>Tenant Switcher — Einstellungen</title>
    <link rel="stylesheet" href="options.css" />
  </head>
  <body>
    <main>
      <h1>Tenant Switcher</h1>

      <section>
        <h2>Einstellungen</h2>
        <form id="settings-form">
          <label>
            Speicherort der Tenant-Profile
            <input type="text" id="storage-base-path" required />
            <small>Default: <code>%LOCALAPPDATA%\TenantSwitcher\profiles</code></small>
          </label>
          <label>
            Edge-Pfad
            <input type="text" id="edge-executable-path" required />
            <small><code>auto</code> oder voller Pfad zu <code>msedge.exe</code></small>
          </label>
          <button type="submit">Speichern</button>
          <span id="settings-status" class="status"></span>
        </form>
      </section>

      <section>
        <h2>Tenants</h2>
        <button id="add-tenant-btn" class="primary">+ Neuer Tenant</button>

        <table id="tenants-table">
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Tenant-ID</th>
              <th>Profil-Ordner</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="tenants-body"></tbody>
        </table>
        <p id="tenants-empty" hidden>Noch keine Tenants angelegt.</p>
      </section>
    </main>

    <dialog id="tenant-dialog">
      <form method="dialog" id="tenant-form">
        <h3 id="tenant-dialog-title">Neuer Tenant</h3>
        <label>
          Name *
          <input type="text" id="t-name" required />
        </label>
        <label>
          Farbe
          <input type="color" id="t-color" value="#5B4DE0" />
        </label>
        <label>
          Tenant-ID (optional)
          <input type="text" id="t-tenant-id" pattern="[0-9a-fA-F-]{36}" />
        </label>
        <label>
          Start-URL
          <input type="url" id="t-default-url" value="https://portal.azure.com" required />
        </label>
        <label>
          Notizen
          <textarea id="t-notes" rows="2"></textarea>
        </label>
        <menu>
          <button type="button" id="t-cancel">Abbrechen</button>
          <button type="submit" class="primary">Speichern</button>
        </menu>
      </form>
    </dialog>

    <script type="module" src="options.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `extension/src/options/options.css`**

```css
:root {
  --bg: #fafafa;
  --card-bg: #ffffff;
  --fg: #1a1a1a;
  --muted: #6b6b6b;
  --border: #e0e0e0;
  --primary: #5b4de0;
  --primary-fg: #ffffff;
  --danger: #c81e1e;
  --success: #15803d;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font: 14px system-ui, -apple-system, sans-serif;
  background: var(--bg);
  color: var(--fg);
}

main {
  max-width: 880px;
  margin: 24px auto;
  padding: 0 16px;
}

h1 { margin-top: 0; }

section {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px 20px;
  margin-bottom: 16px;
}

section h2 {
  margin: 0 0 12px;
  font-size: 16px;
}

label {
  display: block;
  margin-bottom: 12px;
  font-size: 13px;
}

label input[type="text"], label input[type="url"], label textarea {
  display: block;
  width: 100%;
  margin-top: 4px;
  padding: 6px 8px;
  font: inherit;
  border: 1px solid var(--border);
  border-radius: 4px;
}

small {
  display: block;
  margin-top: 4px;
  color: var(--muted);
  font-size: 12px;
}

button {
  padding: 6px 14px;
  font: inherit;
  border: 1px solid var(--border);
  background: white;
  border-radius: 4px;
  cursor: pointer;
}

button.primary {
  background: var(--primary);
  color: var(--primary-fg);
  border-color: var(--primary);
}

button.danger { color: var(--danger); border-color: var(--danger); }

.status {
  margin-left: 12px;
  font-size: 12px;
  color: var(--success);
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 12px;
}

th, td {
  padding: 8px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}

th {
  font-weight: 600;
  color: var(--muted);
  font-size: 11px;
  text-transform: uppercase;
}

td .dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
}

td code {
  font-size: 12px;
  color: var(--muted);
}

dialog {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px;
  width: 420px;
}

dialog::backdrop { background: rgba(0,0,0,0.4); }

dialog menu {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin: 12px 0 0;
  padding: 0;
}
```

- [ ] **Step 3: Create `extension/src/options/options.ts`**

```ts
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
```

- [ ] **Step 4: Verify type-checks**

Run: `cd /home/sysadmin/ClaudeCode/multitenant/extension && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add extension/src/options/
git commit -m "feat(extension): add Options page with Settings and Tenant CRUD"
```

---

## Task 19: Welcome page (first-run setup wizard)

**Files:**
- Create: `extension/src/welcome/index.html`
- Create: `extension/src/welcome/welcome.css`
- Create: `extension/src/welcome/welcome.ts`

The wizard has four numbered steps. The user works through them sequentially.

- [ ] **Step 1: Create `extension/src/welcome/index.html`**

```html
<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <title>Edge Tenant Switcher — Setup</title>
    <link rel="stylesheet" href="welcome.css" />
  </head>
  <body>
    <main>
      <h1>Willkommen beim Tenant Switcher</h1>
      <p class="lead">
        Vier Schritte, dann öffnest du Microsoft-Tenants per Klick — jeder mit eigener,
        sauber isolierter Edge-Session.
      </p>

      <ol class="wizard">
        <li>
          <h2>1. Native Helper installieren</h2>
          <p>
            Diese Extension allein kann keine zweite Edge-Instanz mit eigenem Profil starten —
            das ist eine Sicherheits-Beschränkung von Chromium. Dafür gibt es ein winziges
            Helper-Programm namens <code>tenant-helper.exe</code> (Open Source, ca. 5 MB).
          </p>
          <ol>
            <li>
              <a href="https://github.com/pluess/edge-tenant-switcher/releases" target="_blank" rel="noopener">
                Helper-ZIP herunterladen ↗
              </a>
            </li>
            <li>ZIP entpacken</li>
            <li>
              In PowerShell:
              <pre><code>cd path\to\unpacked\
.\install.ps1 -ExtensionId &lt;diese Extension-ID&gt;</code></pre>
            </li>
            <li>
              Deine Extension-ID:
              <code id="extension-id-display">(wird gleich angezeigt)</code>
              <button id="copy-extension-id" type="button">Kopieren</button>
            </li>
          </ol>
        </li>

        <li>
          <h2>2. Verbindung prüfen</h2>
          <p>
            Sobald der Helper installiert ist und die Extension neu geladen wurde, klicke hier:
          </p>
          <button id="check-connection" type="button" class="primary">Verbindung prüfen</button>
          <p id="connection-status" class="status" hidden></p>
        </li>

        <li>
          <h2>3. Speicherort festlegen</h2>
          <p>Wo sollen die isolierten Tenant-Profile liegen?</p>
          <input type="text" id="storage-base-path" />
          <button id="save-storage-path" type="button">Speichern</button>
          <p id="storage-status" class="status" hidden></p>
        </li>

        <li>
          <h2>4. Ersten Tenant anlegen</h2>
          <p>Optional jetzt schon, oder später über die Einstellungen.</p>
          <button id="open-options" type="button" class="primary">Einstellungen öffnen →</button>
        </li>
      </ol>
    </main>

    <script type="module" src="welcome.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `extension/src/welcome/welcome.css`**

```css
* { box-sizing: border-box; }

body {
  margin: 0;
  font: 16px/1.5 system-ui, -apple-system, sans-serif;
  background: #fafafa;
  color: #1a1a1a;
}

main {
  max-width: 720px;
  margin: 32px auto 64px;
  padding: 0 24px;
}

h1 { margin-top: 0; font-size: 28px; }
.lead { font-size: 17px; color: #555; }

.wizard {
  list-style: none;
  padding: 0;
  margin: 32px 0 0;
}

.wizard > li {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px 20px 20px;
  margin-bottom: 16px;
}

.wizard > li h2 { margin-top: 0; font-size: 16px; }

input[type="text"] {
  font: inherit;
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  width: 60%;
  margin-right: 8px;
}

button {
  padding: 6px 14px;
  font: inherit;
  border: 1px solid #ccc;
  background: white;
  border-radius: 4px;
  cursor: pointer;
}
button.primary { background: #5b4de0; color: white; border-color: #5b4de0; }

pre {
  background: #f0f0f0;
  padding: 8px 12px;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 13px;
}

code { font-family: ui-monospace, SFMono-Regular, monospace; }

.status { font-size: 14px; margin-top: 8px; }
.status.success { color: #15803d; }
.status.error { color: #c81e1e; }
```

- [ ] **Step 3: Create `extension/src/welcome/welcome.ts`**

```ts
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
```

- [ ] **Step 4: Add Welcome page entry to manifest**

The CRX Vite plugin auto-discovers HTML entrypoints referenced from the manifest. The Welcome page is opened by the service worker via `chrome.runtime.getURL('src/welcome/index.html')`, but Vite's bundler needs an explicit hint to include it. Modify `extension/vite.config.ts`:

Replace its contents with:

```ts
import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'node:path';
import manifest from './src/manifest.json';

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        welcome: resolve(__dirname, 'src/welcome/index.html'),
      },
    },
  },
});
```

- [ ] **Step 5: Verify type-checks and build**

Run: `cd /home/sysadmin/ClaudeCode/multitenant/extension && npx tsc --noEmit`
Expected: No errors.

Run: `cd /home/sysadmin/ClaudeCode/multitenant/extension && npm run build`
Expected: `dist/` is created, no build errors.

- [ ] **Step 6: Commit**

```bash
git add extension/src/welcome/ extension/vite.config.ts
git commit -m "feat(extension): add Welcome page setup wizard"
```

---

## Task 20: Run all tests and confirm green

**Files:** none — verification step only.

- [ ] **Step 1: Run all extension tests**

Run: `cd /home/sysadmin/ClaudeCode/multitenant/extension && npm test`
Expected: All tests PASS. Confirm count: slug (6) + settings (4) + registry (8) + native-host (3) = 21 tests.

- [ ] **Step 2: Run all native-host tests**

Run: `cd /home/sysadmin/ClaudeCode/multitenant/native-host && go test -v ./...`
Expected: All tests PASS. Confirm: protocol (5) + messages (6) + paths (7) + edge (4) + main (4) = 26 tests.

- [ ] **Step 3: Type-check the extension**

Run: `cd /home/sysadmin/ClaudeCode/multitenant/extension && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Build the extension and the Windows binary**

Run: `cd /home/sysadmin/ClaudeCode/multitenant/extension && npm run build`
Expected: `extension/dist/` exists with `manifest.json`, `service-worker.js`, popup, options, welcome HTML/JS bundles, and icons.

Run: `cd /home/sysadmin/ClaudeCode/multitenant/native-host && GOOS=windows GOARCH=amd64 go build -o tenant-helper.exe .`
Expected: `tenant-helper.exe` written.

- [ ] **Step 5: Commit no changes (verification only)**

If any test failed, fix the underlying code in the relevant earlier task and commit those fixes separately. If all green: nothing to commit; proceed to Task 21.

---

## Task 21: Smoke-test checklist (manual, on a Windows machine)

**Files:**
- Create: `docs/SMOKE-TEST.md`

This is a documented checklist the user runs by hand before declaring Phase 1 done. We don't automate it because Microsoft auth and MFA aren't reproducible in CI.

- [ ] **Step 1: Create `docs/SMOKE-TEST.md`**

```markdown
# Phase 1 Smoke Test Checklist

Run this on a Windows 11 machine with Edge installed before declaring Phase 1 shipped.

## Setup

- [ ] Build artifacts exist: `extension/dist/` and `native-host/tenant-helper.exe`
- [ ] Copy `tenant-helper.exe`, `installer/install.ps1`, `installer/tenant-helper.json.tmpl` into one folder on the Windows machine
- [ ] In Edge: open `edge://extensions`, enable Developer mode, "Load unpacked" → pick `extension/dist/`
- [ ] Note the new extension's ID (32 lowercase letters)
- [ ] Open PowerShell, run `.\install.ps1 -ExtensionId <id>` from the helper folder
- [ ] Reload the extension in `edge://extensions`

## First-Run Wizard

- [ ] Welcome page opened automatically after install
- [ ] Step 1 shows the extension ID, "Copy" button works
- [ ] Step 2 "Verbindung prüfen" → green "Verbunden" message
- [ ] Step 3 storage path defaults to `%LOCALAPPDATA%\TenantSwitcher\profiles`, save works
- [ ] Step 4 "Einstellungen öffnen" navigates to options page

## Tenant CRUD

- [ ] Add a tenant: name "Test Tenant 1", color = pink, default URL = `https://portal.azure.com`
- [ ] Tenant appears in the table with a generated `userDataDir`
- [ ] Edit tenant → change color → reload page → color persisted
- [ ] Add 14 more tenants (any names) — all visible, table scrolls cleanly

## Launch

- [ ] Click toolbar icon → popup shows tenant list, sorted alphabetically
- [ ] Click "Test Tenant 1" → a NEW Edge window opens with `portal.azure.com`
- [ ] In the new window, sign in with a real Microsoft account → auth completes normally
- [ ] Toolbar badge in the original window shows "TT" with pink background
- [ ] Original popup re-open → "Test Tenant 1" now in "Recent" section

## Parallel Mode (the hard test)

- [ ] From the popup, click "Test Tenant 2"
- [ ] A SECOND new Edge window opens with `portal.azure.com`
- [ ] Sign in to a DIFFERENT Microsoft account
- [ ] Switch back to the first Edge window — still signed in as the FIRST account
- [ ] Refresh `portal.azure.com` in the first window — does NOT auto-redirect to the second account
- [ ] On disk, both `<storageBasePath>\test-tenant-1\` and `<storageBasePath>\test-tenant-2\` exist with separate cookie databases

## Failure Modes

- [ ] In `edge://extensions`, disable the extension and re-enable. Popup still works.
- [ ] Stop the helper (delete `tenant-helper.exe` to simulate). Click a tenant → red error banner appears with code `NOT_CONNECTED`. Restore the file.
- [ ] In options, set storage path to something completely outside the original (e.g. `D:\test`). Add a new tenant — new tenant launches, profile created under `D:\test\`. Restore original.

## Acceptance

If all the above checkboxes pass:
- Tag the commit: `git tag -a v0.1.0 -m "Phase 1 MVP"`
- Phase 1 is shipped.
```

- [ ] **Step 2: Commit**

```bash
git add docs/SMOKE-TEST.md
git commit -m "docs: add Phase 1 manual smoke test checklist"
```

---

## Self-Review Notes

This plan covers every Phase 1 feature listed in the spec:

| Spec Feature | Implementing Tasks |
|---|---|
| Native Messaging Host (Go binary, stdio, `--user-data-dir`) | 8, 9, 10, 11, 12 |
| Tenant Registry CRUD | 4, 7, 18 |
| Toolbar Popup with recent + all | 17 |
| Visual Indicator (badge color) | 16, 17 (sends message), 21 (verifies) |
| Setup-Wizard | 19 |
| Konfigurierbarer Storage-Pfad (default + per-tenant override) | 4 (`Settings`), 6 (`updateSettings`), 7 (`addTenant` honors `userDataDirOverride`), 18 (UI), 19 (wizard) |
| Native Host installer (PowerShell) | 13 |

Build artifacts and tooling: Tasks 1, 2, 3.
Verification: Task 20 (automated) and Task 21 (manual).

Phase 2 features (Smart Link Router, Tenant Hub, Tab Banner, Quick-Search, Active-Sessions list, Tenant-ID auto-lookup) are intentionally absent — they get their own plan after Phase 1 ships.
