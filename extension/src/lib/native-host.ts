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
