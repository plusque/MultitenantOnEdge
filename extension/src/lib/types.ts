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
