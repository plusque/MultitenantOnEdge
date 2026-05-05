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
