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
