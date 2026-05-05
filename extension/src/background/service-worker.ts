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
