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
