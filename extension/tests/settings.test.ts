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
