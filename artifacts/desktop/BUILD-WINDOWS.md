# SAI Rolotech Smart Engines v2.2.23 — Windows Build & Update Guide

## Laptop pe Update Karne ka Sahi Tarika

### ✅ Smooth Update (Recommended)
```
UPDATE.bat
```
Double-click karein — automatically sab kuch karta hai:
- App band karta hai
- Latest code GitHub se leta hai
- Rebuild karta hai
- Purana cache saaf karta hai (tools sahi kaam karte hain)
- Nayi EXE ready kar deta hai

### Full Fresh Build
```
BUILD.bat
```
Pehli baar ya major update ke liye.

---

## Requirements (Windows machine pe)

- Node.js 20+ (https://nodejs.org)
- pnpm: `npm install -g pnpm`
- Git (https://git-scm.com)

## Build Types

### Portable EXE (Recommended for Laptops)
```batch
pnpm --filter @workspace/desktop run dist:portable
```
- Koi install nahi chahiye
- Kisi bhi folder se chal jata hai
- File: `SAI-Rolotech-Smart-Engines-Portable-2.2.23.exe`

### NSIS Installer (Proper Install)
```batch
pnpm --filter @workspace/desktop run dist:installer
```
- Start Menu + Desktop shortcut banta hai
- Add/Remove Programs mein dikh ta hai
- Auto-update support
- File: `SAI-Rolotech-Smart-Engines-Setup-2.2.23.exe`

### Dono Build
```batch
pnpm --filter @workspace/desktop run dist:all
```

## System Requirements (End User)

- Windows 10 version 1809 (Build 17763) ya usse baad
- Windows 11 (sabhi versions)
- 64-bit (x64) processor
- 4 GB RAM minimum (8 GB recommended)
- 500 MB free disk space
- Internet jaruri nahi installation ke baad

## What the Installer Does

1. App install karta hai `C:\Program Files\SAI Rolotech Smart Engines\`
2. **Purane files clean karta hai** (broken tools ka main cause)
3. **Cache clear karta hai** (stale data se tools fail nahi hote)
4. Port 3001 pe firewall exception deta hai
5. Start Menu + Desktop shortcut banata hai
6. Uninstaller register karta hai

## Update Karte Waqt Problems Kyu Aate Hain — Aur Fix

| Problem | Karan | Fix |
|---------|-------|-----|
| Tools kaam nahi karte | Purani resource files reh jaati hain | Installer ab resources folder clear karta hai |
| App hang hoti hai | Port 3001 purani process se block tha | Installer ab port free karta hai |
| Screens reload nahi hoti | Electron cache purana data serve karta tha | Cache ab automatically clear hota hai |
| Features missing lagte hain | Old cached JavaScript | Code Cache bhi clear hota hai |

## Troubleshooting

**App start nahi ho rahi**: Diagnostic log dekho:
```
%TEMP%\sai-rolotech-diag\sai-diagnostic.log
```

**API nahi chal rahi**: Port check karo:
```cmd
netstat -an | findstr 3001
```

**White screen aaye**: Ctrl+Shift+R se hard reload karo

**Koi bhi tool kaam na kare**: UPDATE.bat dobara chalao — cache saaf ho jayega
