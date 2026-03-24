; SAI Rolotech Smart Engines — NSIS Custom Script
; Install path: %LOCALAPPDATA%\Programs\SAI Rolotech Smart Engines
; No key prompt — activation inside app

!macro customInit
  ; ── STEP 1: Kill ALL SAI-related processes (force + loop) ──────────────────
  nsExec::ExecToLog 'taskkill /F /IM "SAI Rolotech Smart Engines.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "Sai Rolotech Smart Engines.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "SaiRolotech-SmartEngines.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "SAI-Rolotech-Smart-Engines.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "electron.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "node.exe" /T'
  Sleep 1000

  ; Second kill pass (process restart se bachne ke liye)
  nsExec::ExecToLog 'taskkill /F /IM "SAI Rolotech Smart Engines.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "Sai Rolotech Smart Engines.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "electron.exe" /T'
  Sleep 2000

  ; ── STEP 2: Delete entire old install directory (file lock fix) ────────────
  ; NSIS file-locked "Retry/Close" error hata ne ke liye — pehle sab delete
  RMDir /r "$LOCALAPPDATA\Programs\SAI Rolotech Smart Engines"
  RMDir /r "$LOCALAPPDATA\Programs\Sai Rolotech Smart Engines"
  RMDir /r "$LOCALAPPDATA\Programs\SAI Sai Rolotech Smart Engines AI"

  ; Old PROGRAMFILES installs (v2.2.0 era)
  RMDir /r "$PROGRAMFILES64\SAI Rolotech Smart Engines"
  RMDir /r "$PROGRAMFILES64\Sai Rolotech Smart Engines"
  RMDir /r "$PROGRAMFILES64\SAI Sai Rolotech Smart Engines AI"
  RMDir /r "$PROGRAMFILES\SAI Rolotech Smart Engines"
  RMDir /r "$PROGRAMFILES\Sai Rolotech Smart Engines"
  RMDir /r "$PROGRAMFILES\SAI Sai Rolotech Smart Engines AI"

  ; ── STEP 3: Remove old shortcuts ───────────────────────────────────────────
  Delete "$DESKTOP\SAI Rolotech Smart Engines.lnk"
  Delete "$DESKTOP\Sai Rolotech Smart Engines.lnk"
  Delete "$DESKTOP\SAI Sai Rolotech Smart Engines AI.lnk"
  Delete "$DESKTOP\SaiRolotech-SmartEngines.lnk"

  ; ── STEP 4: Clean old registry entries ─────────────────────────────────────
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Sai Rolotech Smart Engines"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Sai Rolotech Smart Engines"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SAI Sai Rolotech Smart Engines AI"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SAI Sai Rolotech Smart Engines AI"

  ; ── STEP 5: Write version info ─────────────────────────────────────────────
  WriteRegStr HKCU "Software\SAI Rolotech Smart Engines" "Version" "${VERSION}"

!macroend

!macro customInstall
  ; ── Firewall rule for API server ────────────────────────────────────────────
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="SAI Rolotech Smart Engines API"'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="SAI Rolotech Smart Engines API" dir=in action=allow protocol=TCP localport=8080 profile=private'

  ; ── Force-create Desktop shortcut ───────────────────────────────────────────
  CreateShortCut "$DESKTOP\SAI Rolotech Smart Engines.lnk" \
    "$INSTDIR\SAI Rolotech Smart Engines.exe" "" \
    "$INSTDIR\SAI Rolotech Smart Engines.exe" 0 SW_SHOWNORMAL \
    "" "SAI Rolotech Smart Engines v${VERSION}"

  ; ── Force-create Start Menu shortcuts ───────────────────────────────────────
  CreateDirectory "$SMPROGRAMS\SAI Rolotech Smart Engines"
  CreateShortCut "$SMPROGRAMS\SAI Rolotech Smart Engines\SAI Rolotech Smart Engines.lnk" \
    "$INSTDIR\SAI Rolotech Smart Engines.exe" "" \
    "$INSTDIR\SAI Rolotech Smart Engines.exe" 0 SW_SHOWNORMAL \
    "" "SAI Rolotech Smart Engines v${VERSION}"
  CreateShortCut "$SMPROGRAMS\SAI Rolotech Smart Engines\Uninstall SAI Rolotech.lnk" \
    "$INSTDIR\Uninstall SAI Rolotech Smart Engines.exe"
!macroend

!macro customUnInstall
  nsExec::ExecToLog 'taskkill /F /IM "SAI Rolotech Smart Engines.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "electron.exe" /T'
  Sleep 1000
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="SAI Rolotech Smart Engines API"'
  DeleteRegKey HKCU "Software\SAI Rolotech Smart Engines"
  Delete "$DESKTOP\SAI Rolotech Smart Engines.lnk"
  RMDir /r "$SMPROGRAMS\SAI Rolotech Smart Engines"
!macroend
