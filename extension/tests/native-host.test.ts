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
