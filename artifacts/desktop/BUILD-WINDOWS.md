# Sai Rolotech Smart Engines v2.2.0 — Windows Build Instructions

## Requirements (on your Windows machine)

- Node.js 20+ (https://nodejs.org)
- pnpm: `npm install -g pnpm`
- Git (https://git-scm.com)
- Visual Studio Build Tools 2022 (for native modules)

## Quick Build (Windows)

```batch
:: Clone / copy this project to your Windows machine
cd workspace

:: Install all dependencies
pnpm install

:: Build Windows installer
pnpm --filter @workspace/desktop run dist:installer

:: OR build portable exe (no install required)
pnpm --filter @workspace/desktop run dist:portable

:: OR build both
pnpm --filter @workspace/desktop run dist:all
```

## Output Files

After build completes, find your installer in:
```
artifacts/desktop/release/
├── SAI-Sai Rolotech Smart Engines-AI-Setup-2.2.0.exe     ← Windows Installer (NSIS)
└── SAI-Sai Rolotech Smart Engines-AI-Portable-2.2.0.exe  ← Portable (no install)
```

> NOTE: The new installer automatically detects and removes any previous version
> before installing. No duplicate copies will be created.

## System Requirements (end-user)

- Windows 10 version 1809 (Build 17763) or later
- Windows 11 (all versions)
- 64-bit (x64) processor
- 4 GB RAM minimum (8 GB recommended)
- 500 MB free disk space
- No internet required after installation

## What the Installer Does

1. Installs app to `C:\Program Files\SAI Sai Rolotech Smart Engines AI\`
2. Creates Start Menu shortcut
3. Creates Desktop shortcut
4. Creates `HKCU\Software\SAI Sai Rolotech Smart Engines AI` registry key
5. Adds Windows Firewall exception for local API (port 3001)
6. Registers uninstaller in "Add/Remove Programs"

## Troubleshooting

**App won't start**: Check Windows Event Viewer → Application logs
**API not responding**: Port 3001 may be in use. Check with: `netstat -an | findstr 3001`
**White screen**: Try Ctrl+Shift+R to reload. Check DevTools (Ctrl+Shift+I)

## Development Mode (on Windows)

```batch
:: Start in development mode (uses live Vite dev server)
pnpm --filter @workspace/desktop run dev
```
