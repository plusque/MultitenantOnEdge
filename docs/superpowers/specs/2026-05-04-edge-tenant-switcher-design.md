# Edge Tenant Switcher — Design Spec

**Status:** Draft
**Author:** pluess.philipp@gmail.com
**Date:** 2026-05-04

## Problem

MSP- und Consultant-Workflows mit Microsoft Azure / M365 leiden unter "Auth-Chaos": Beim Klick auf einen Microsoft-Link (z.B. aus Email, Ticket, Doku) loggt Microsoft den User automatisch mit der zuletzt aktiven Session ein — auch wenn der Link zu einem anderen Kunden-Tenant gehört. Folge: versehentliche Änderungen am falschen Kunden, Zeitverlust durch Re-Login, ständiges Anlegen von Inkognito-Fenstern oder Zusatz-Profilen.

Aktueller Workaround: Edge im Inkognito-Modus oder zusätzliche Edge-Profile manuell anlegen. Beides ist umständlich und skaliert nicht für 15–50 Kunden-Tenants.

## Goals

- **Echte Session-Isolation pro Kunde**: Cookies, MSAL-Tokens, History, Bookmarks getrennt — keine Auth-Konflikte.
- **Sequentieller Wechsel mit One-Click-UX**: Kunden-Liste im Edge-Toolbar, Click → richtiges Profil ist offen.
- **Parallel-Modus funktioniert**: Mehrere Tenants gleichzeitig in verschiedenen Fenstern offen (z.B. für Migrationen).
- **Visual Indicator**: Auf einen Blick erkennbar, in welchem Kunden-Tenant man gerade ist.
- **Smart Link Router (Phase 2)**: Klick auf Link aus fremdem Tenant → Vorschlag, im richtigen Profil zu öffnen.

## Non-Goals

- ❌ Credential-/Passwort-Management (Edge's eingebauter Password Manager pro Profil reicht)
- ❌ Integriertes MFA-Tool (Authenticator-App / FIDO-Key wie gehabt)
- ❌ Cross-Browser-Unterstützung in Phase 1+2 (Edge only)
- ❌ Eigene Cloud-Sync-Komponente (chrome.storage.sync oder JSON-Export reichen)
- ❌ Reporting-/Audit-Logs
- ❌ Cookie-/Storage-Swap-Ansatz (zu fragil mit MSAL, bricht Parallel-Modus)

## Constraints

- **Browser**: Microsoft Edge (Chromium-basiert), Windows-only für Phase 1+2
- **Auth-Modell**: Dedizierte Admin-Accounts pro Tenant (klassisches MSP-Setup)
- **Skalierung**: 15–50 aktive Kunden-Tenants
- **Manifest-Version**: Edge-Store-Pflicht ist Manifest V3
- **Native Code erforderlich**: Chromium-Extensions können keine Browser-Instanzen mit eigenem Profil-Dir starten — Native Messaging Host als offizielle Brücke ist Pflicht

## Architektur

```
┌─────────────────────────┐         ┌─────────────────────────┐
│  Edge Extension         │ <-----> │  Native Messaging Host  │
│  (UI + Logik im Browser)│  stdio  │  (Go binary auf OS)     │
└──────────┬──────────────┘         └──────────┬──────────────┘
           │                                   │
           │                                   │ startet Edge mit
           │                                   │ --user-data-dir=<tenant>
           ▼                                   ▼
┌─────────────────────────┐         ┌─────────────────────────┐
│  Tenant Registry        │         │  Edge-Instanz pro Tenant│
│  (chrome.storage.local) │         │  (eigene Cookies, MSAL, │
│                         │         │   Bookmarks, History)   │
└─────────────────────────┘         └─────────────────────────┘
```

Drei Komponenten mit klar getrennten Verantwortlichkeiten:

1. **Edge Extension** (TypeScript, Manifest V3) — alle UI, Tenant-Erkennungslogik, Routing-Entscheidungen.
2. **Native Messaging Host** (Go binary `tenant-helper.exe`) — minimaler Wrapper, der Edge mit isoliertem `--user-data-dir` startet. Akzeptiert nur whitelisted Befehle.
3. **Tenant Registry** — JSON-Store in `chrome.storage.local`, optional `chrome.storage.sync`.

### Warum Native Messaging Host?

Chromium-Extensions haben keine API zum Starten von Browser-Instanzen mit dedizierten Profil-Verzeichnissen. Native Messaging ist die offizielle, sichere Brücke: Extension verbindet sich via stdio mit einem registrierten Helper-Programm. Manifest-Pinning erlaubt nur unsere Extension-ID — andere Extensions können den Helper nicht missbrauchen.

## Phasen-Schnitt

### Phase 1 — MVP "Tenant Launcher"

**Akzeptanzkriterium**: User kann 15+ Kunden anlegen, einen davon per Click in eigenem Edge-Profil öffnen, parallel zwei verschiedene Tenants in zwei Fenstern haben — ohne dass Microsoft automatisch in den falschen Account einloggt.

| Feature | Beschreibung |
|---|---|
| Native Messaging Host | Go-Binary, stdio-Protokoll, startet Edge mit `--user-data-dir` |
| Tenant Registry CRUD | Options-Page: Tenant hinzufügen/löschen/bearbeiten |
| Toolbar Popup | Liste aller Kunden, sortiert nach "zuletzt verwendet", Click → Launch |
| Visual Indicator (Light) | Toolbar-Badge-Farbe zeigt aktiven Tenant |
| Setup-Wizard | Native-Host-Registrierung, Connection-Test, ersten Tenant anlegen, Test-Launch |
| Konfigurierbarer Storage-Pfad | Default `%LOCALAPPDATA%\TenantSwitcher\profiles\`, in Settings änderbar, pro Tenant überschreibbar |

**Nicht in Phase 1**: Smart Link Router, Tenant-Hub mit Quick-Links, automatische Tenant-Erkennung aus URLs, Tab-Banner.

### Phase 2 — Smart Routing & Hub

**Akzeptanzkriterium**: Wenn User in Email/Ticket auf MS-Link klickt, der zu Kunde X gehört, wird er gefragt (oder direkt geleitet), bevor er sich in fremdem Tenant einloggt.

| Feature | Beschreibung |
|---|---|
| Smart Link Router | URL-Inspektion: tid-Parameter, domain_hint, vanity-Domains. Bei Mismatch → Banner-Vorschlag |
| Tab-Banner | Dezenter Streifen am Tab-Top mit Kundenname + Farbe |
| Tenant Hub | Pro Kunde Quick-Links: Azure Portal, Entra Admin, Exchange Admin, SharePoint Admin, Intune, Defender, Compliance |
| Quick-Search | Fuzzy-Search durch Kunden im Toolbar-Popup |
| Kontext-Menü | Rechtsklick auf MS-Link → "Öffne in Kunde XY" |
| "Aktive Sessions"-Liste | Welche Tenant-Fenster sind gerade offen, "Alle ausser aktuelles schliessen" |
| Tenant-ID Auto-Lookup | via `https://login.microsoftonline.com/<domain>/.well-known/openid-configuration` |

## Datenmodell

### Tenant Registry (pro Eintrag)

```js
{
  id: "uuid-v4",
  name: "Müller AG",
  color: "#E91E63",
  tenantId: "abc-123-def-456",                // optional, für URL-Matching
  domains: [                                  // Phase 2
    "muelleragag.onmicrosoft.com",
    "muelleragag.com",
    "muelleragag.sharepoint.com"
  ],
  userDataDir: "D:\\Work\\edge-tenants\\mueller-ag",  // Override per Tenant möglich
  defaultUrl: "https://portal.azure.com",
  customLinks: [                              // Phase 2
    { label: "Entra Admin", url: "https://entra.microsoft.com/..." }
  ],
  notes: "",
  createdAt: "2026-05-04T10:00:00Z",
  lastUsedAt: "2026-05-04T14:30:00Z"
}
```

### Globale Settings

```js
{
  storageBasePath: "D:\\Work\\edge-tenants",  // Default: %LOCALAPPDATA%\TenantSwitcher\profiles
  edgeExecutablePath: "auto",                 // oder expliziter Pfad
  syncEnabled: false,                         // chrome.storage.sync opt-in
  routerMode: "ask",                          // "ask" | "auto" | "off"  (Phase 2)
}
```

### `userDataDir`-Pfad-Konvention

```
<storageBasePath>\
  ├── mueller-ag\          ← Edge user-data-dir
  ├── kunde-xy-gmbh\
  ├── stiftung-abc\
  └── _meta\registry.json  ← Backup der Registry
```

Slug-basiert (lowercase, kebab-case) statt UUID — im Filesystem direkt erkennbar.

## Tenant-Erkennung aus URLs (Phase 2)

Smart Link Router prüft beim Navigations-Event in dieser Reihenfolge und ordnet jedem Match einen **Confidence-Level** zu:

| Stufe | Quelle | Confidence | Beispiel |
|---|---|---|---|
| 1 | URL enthält `?tid=<guid>` oder `/tenant/<guid>` mit Match auf `registry[].tenantId` | **HIGH** | `https://portal.azure.com/?tid=abc-123` |
| 2 | URL enthält `?domain_hint=<domain>` oder `?whr=<domain>` mit Match auf `registry[].domains` | **HIGH** | `https://login.microsoftonline.com/...?domain_hint=kunde.com` |
| 3 | Hostname matcht Kunden-Vanity-Domain in `registry[].domains` (z.B. `<kunde>.sharepoint.com`, `<kunde>.crm.dynamics.com`, `<kunde>.onmicrosoft.com`) | **MEDIUM** | `https://kunde.sharepoint.com/sites/...` |
| 4 | Bekannte MS-Standard-URL ohne Tenant-Hint (`portal.azure.com`, `admin.microsoft.com`, `entra.microsoft.com`) | **NONE** (User-Choice nötig) | `https://portal.azure.com` ohne Parameter |
| 5 | Nicht-MS-URL | — (Extension mischt sich nicht ein) | `https://stackoverflow.com` |

**Auto-Routing-Verhalten** (gesteuert über `routerMode` in den Settings):

- `routerMode: "ask"` (Default): Banner-Vorschlag bei jedem HIGH/MEDIUM-Match. Bei NONE: nur Vorschlag, falls User vorher noch nie auf "Hier bleiben" für genau diese URL geklickt hat.
- `routerMode: "auto"`: Sofortiges Re-Routing nur bei HIGH-Confidence (Stufen 1+2). MEDIUM (Stufe 3) zeigt weiterhin Banner. NONE (Stufe 4) macht nichts.
- `routerMode: "off"`: Smart Link Router komplett deaktiviert.

**Designentscheidung**: Niemals automatisch ohne User-Bestätigung umleiten bei MEDIUM-Confidence — Vanity-Domains können sich überschneiden (z.B. wenn ein Kunde mehrere Tenants hat). HIGH-Matches sind eindeutig und sicher.

## Native Messaging Protokoll

Stdio-basiert, JSON-Messages mit Längen-Prefix (Standard Native-Messaging-Format).

### Befehle (Extension → Host)

```jsonc
// Launch a tenant
{
  "type": "launch",
  "tenantId": "uuid-v4",
  "userDataDir": "D:\\...\\mueller-ag",
  "url": "https://portal.azure.com",
  "edgeArgs": []  // optional, currently unused
}

// Status check
{ "type": "ping" }

// Check active Edge processes for a tenant
{ "type": "isRunning", "userDataDir": "D:\\...\\mueller-ag" }

// Move profile directory (Phase 2)
{ "type": "moveProfile", "from": "...", "to": "..." }
```

### Antworten (Host → Extension)

```jsonc
{ "type": "ok", "data": { ... } }
{ "type": "error", "code": "PATH_NOT_WHITELISTED", "message": "..." }
```

### Fehler-Codes

| Code | Bedeutung |
|---|---|
| `EDGE_NOT_FOUND` | `msedge.exe` nicht in Standard-Pfaden gefunden |
| `PATH_NOT_WHITELISTED` | userDataDir liegt nicht unter `storageBasePath` |
| `LAUNCH_FAILED` | Edge konnte nicht gestartet werden (z.B. Profil-Lock) |
| `INVALID_REQUEST` | JSON-Parse-Fehler oder Schema-Verletzung |

## UX-Flows

### Flow 1: First-Run Setup (einmalig)

1. Extension aus Edge-Store installieren
2. Welcome-Page öffnet sich automatisch
3. **Native Helper separat installieren**: Manifest-V3-Extensions dürfen keine Executables herunterladen oder ausführen. Welcome-Page zeigt einen Direkt-Link zum Installer (Projekt-eigene Download-Seite / GitHub Releases). User klickt, lädt `tenant-helper-setup.exe` herunter und führt sie aus. Der Installer registriert den Native-Messaging-Manifest in der Windows-Registry unter `HKCU\Software\Microsoft\Edge\NativeMessagingHosts\<host-name>`.
4. Welcome-Page hat einen "Verbindung prüfen"-Button → Extension versucht `chrome.runtime.connectNative()` und pingt Helper. Ergebnis: grünes "Verbunden" oder rotes "Nicht gefunden — Installer ausführen?"
5. "Storage-Pfad festlegen" → Default-Vorschlag oder eigener Pfad
6. "Ersten Tenant anlegen" → Formular Name/Farbe/Tenant-ID
7. "Test-Launch" → öffnet Edge mit neuem Profil
8. ✓ Setup fertig

### Flow 2: Tenant hinzufügen (Routine)

```
Extension-Popup → "+ Neuer Tenant"
  → Formular (Name, Farbe, Tenant-ID, Domains, Start-URL)
  → "Speichern & Profil anlegen"
  → Native Host erstellt user-data-dir
  → Registry wird aktualisiert
  → Sofort verfügbar in Tenant-Liste
```

### Flow 3: Täglicher Wechsel

```
Toolbar-Icon → Popup mit Liste (Recent + All)
  → Click auf "Müller AG"
  → Native Host startet Edge mit Müller-AG-user-data-dir
  → Neues Edge-Fenster öffnet sich mit defaultUrl
```

### Flow 4: Smart Link Router (Phase 2)

```
User klickt MS-Link in Outlook → Edge öffnet im aktuellen Profil
  → Content-Script erkennt: URL enthält tid=abc-123
  → Match in Registry: tid=abc-123 → "Müller AG"
  → Aktuelles Profil ist aber "Kunde XY GmbH"
  → Banner am Tab-Top:
    "⚠ Dieser Link gehört zu Müller AG, du bist in Kunde XY"
    [In Müller AG öffnen] [Hier bleiben] [Nicht mehr fragen]
  → "In Müller AG öffnen" → Native Host öffnet/aktiviert Müller-AG-Fenster
```

### Flow 5: Native Host nicht erreichbar

```
Extension versucht Launch → Host antwortet nicht / Timeout
  → Klares Error-Banner:
    "Native Helper läuft nicht. Bitte aus Settings neu installieren."
    [Settings öffnen] [Re-Installation starten]
```

## Sicherheits-Modell

Der Native Host läuft ausserhalb der Browser-Sandbox und ist die kritischste Komponente.

**Was der Native Host DARF:**
- Edge starten mit `--user-data-dir=<pfad>` aus whitelisted Edge-Standard-Pfaden
- Verzeichnisse innerhalb des konfigurierten `storageBasePath` erstellen/löschen
- Status zurückgeben (z.B. ob Edge-Prozess für einen Tenant läuft)

**Was der Native Host NICHT macht:**
- ❌ Beliebige Programme starten (nur `msedge.exe` aus Standard-Pfaden)
- ❌ Pfade ausserhalb `storageBasePath` anfassen (Whitelist-Check)
- ❌ Cookie-/Auth-Daten lesen oder weitergeben
- ❌ Mit dem Internet kommunizieren (nur stdio mit Extension)

**Manifest-Pinning**: Native-Messaging-Manifest setzt `allowed_origins` auf einzelne Extension-ID. Andere Extensions können den Helper nicht ansprechen.

**Code-Signing (empfohlen)**: `tenant-helper.exe` mit Code-Signing-Zertifikat signieren, damit SmartScreen/AV nicht meckert. Besonders wichtig falls Extension Kollegen weitergegeben wird.

**Worst-Case-Szenarien:**

| Szenario | Mitigation |
|---|---|
| Andere Extension wird bösartig | Manifest-Pinning blockt Verbindung. Whitelisted Befehle limitieren Schaden. |
| User-PC kompromittiert | Out of scope (Local Admin liest eh alles). Wir machen das Problem nicht schlimmer. |
| Registry-JSON exfiltriert | Enthält keine Credentials/Cookies — nur Namen, Tenant-IDs, Pfade. Niedrige Sensitivität. |

## Tech Stack

| Komponente | Wahl | Begründung |
|---|---|---|
| Extension Manifest | Manifest V3 | Edge-Store-Pflicht ab 2024 |
| Extension UI | Vanilla TypeScript + minimale CSS | Popup ist klein, Options-Page ist Formular-getrieben — keine Framework-Last nötig |
| Build | Vite + `@crxjs/vite-plugin` | HMR, Manifest-V3-Support |
| Native Host | Go (cross-compiled zu `tenant-helper.exe`, ~5MB) | Single-Binary, kein Runtime, sauberes stdio, trivial signierbar, später cross-platform-fähig |
| Distribution Native Host | ZIP+install.ps1 (Phase 1), MSI-Installer (Phase 2) | PS-Skript reicht für Self-Use; MSI bei breiterer Verteilung |
| Storage | `chrome.storage.local` (default), `chrome.storage.sync` opt-in | Sync-Limit ~100KB reicht für 50 Tenants |
| Tests | Vitest (Unit), Go testing (Native Host), manuelle E2E-Checkliste | MFA-haltige E2E-Automatisierung gegen Microsoft ist nicht praktikabel |

## Testing-Strategie

| Ebene | Was wird getestet | Tool |
|---|---|---|
| Unit (Extension) | Tenant-Erkennung aus URLs, Registry-CRUD, Slug-Generierung | Vitest |
| Unit (Native Host) | JSON-Protokoll, Pfad-Whitelist-Check, Edge-Argument-Konstruktion | Go `testing` |
| Integration | Extension ↔ Native-Host stdio-Roundtrip mit Mock-Edge | Vitest + Go-Mock-Binary |
| E2E (manuell) | Echter Edge-Launch, echte MS-Auth, echtes Tenant-Switching | Dokumentierte Test-Checkliste |
| Smoke vor Release | Setup-Wizard, Tenant anlegen, launchen, parallel-Mode | Manuell |

**Bewusste Auslassung**: Kein automatisiertes E2E gegen echte MS-Tenants — MFA + Conditional Access nicht in CI reproduzierbar.

## Risiken & Mitigations

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|---|---|---|---|
| Edge-Update bricht `--user-data-dir` | Niedrig | Hoch | Flag ist seit Jahren stabil, Chromium-dokumentiert. Setup zeigt Edge-Version. |
| MS ändert MSAL-Cache-Format | Mittel | Niedrig | Wir cachen MSAL nicht selbst — Edge handhabt das im Profil-Dir |
| 50+ Profile × 50–500MB → Storage voll | Mittel | Mittel | Storage-Anzeige in Settings, "Profil leeren"-Button (löscht Cache, behält Logins) |
| Vergessenes Edge-Fenster zu altem Kunden | Hoch | Niedrig | Phase 2: Aktive-Sessions-Liste, "Alle ausser aktuelles schliessen" |
| Extension-Update stört laufende Sessions | Niedrig | Niedrig | Service-Worker startet sauber, Edge-Fenster davon unabhängig |
| Sync zwischen 2 PCs vergisst Tenants | Mittel | Niedrig | `storage.sync` opt-in. JSON-Export als Fallback |
| SmartScreen blockt Native Host | Mittel | Mittel | Code-Signing-Zertifikat (~$100/Jahr) ODER dokumentierter "Trotzdem ausführen"-Workflow für Phase 1 |
| Tenant-ID nicht bekannt | Hoch | Niedrig | Tenant-ID-Feld optional. Phase 2: Auto-Lookup via OIDC discovery |
| GDAP/Lighthouse-User wollen Tool nutzen | Mittel | — | Out of scope, aber Architektur kompatibel (zusätzlicher Auth-Modus) |

## Offene Entscheidungen

Folgende Punkte werden während der Implementierung entschieden, sind nicht Spec-blockierend:

- **Genaue Toolbar-Popup-Layout-Variante** (Tabs vs. Akkordion vs. flache Liste mit Recent-Section)
- **Code-Signing-Zertifikat ja/nein** für Phase 1 (abhängig davon, ob Verteilung an Kollegen geplant ist)
- **Lokalisierungs-Strategie** (DE only oder DE+EN) — vorerst DE, EN-Strings erst wenn nötig
- **Default-Farb-Palette** für Tenant-Badges (12er-Set vorgeneriert oder Color-Picker)

## Erfolgskriterien

Phase 1 ist erfolgreich, wenn:
- ✅ User kann ≥15 Tenants anlegen ohne UX-Probleme
- ✅ Click auf Tenant öffnet Edge mit korrekt isoliertem Profil in <3 Sekunden
- ✅ Zwei Tenants parallel offen → keine Auth-Cross-Contamination
- ✅ Setup-Wizard durchläuft auf frischem Windows-PC ohne externe Hilfe
- ✅ User berichtet "kein versehentlicher falscher Tenant mehr seit Tag 1"

Phase 2 ist erfolgreich, wenn:
- ✅ ≥80% der MS-Links aus typischen Quellen (Email, Tickets) werden korrekt einem Tenant zugeordnet
- ✅ Banner ist sichtbar genug, um den falschen Login zu verhindern, aber unaufdringlich genug, um nicht zu nerven (User-Feedback-driven, ggf. Settings für Banner-Stil)
- ✅ Tenant-Hub ersetzt mindestens drei manuell gepflegte Bookmark-Ordner pro Kunde
