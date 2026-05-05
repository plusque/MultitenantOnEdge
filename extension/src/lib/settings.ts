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
