# Edge Tenant Switcher

Microsoft Edge extension + Go native messaging host that lets MSP/Consultant users manage many Azure/M365 customer tenants with isolated Edge profiles per tenant.

See `docs/superpowers/specs/2026-05-04-edge-tenant-switcher-design.md` for the design.

## Components

- `extension/` — Edge extension (TypeScript + Vite + Manifest V3)
- `native-host/` — `tenant-helper.exe` (Go binary, Windows-only)

## Build

See per-component READMEs (`extension/README.md`, `native-host/README.md`).
