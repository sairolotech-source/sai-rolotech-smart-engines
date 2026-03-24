; SAI Rolotech Smart Engines — NSIS Custom Script
; AGGRESSIVE cleanup of ALL old versions before installing new one

!macro customInit
  ; ── STEP 1: Kill ALL related processes ────────────────────────────────────
  nsExec::ExecToLog 'taskkill /F /IM "SAI Rolotech Smart Engines.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "Sai Rolotech Smart Engines.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "SaiRolotech-SmartEngines.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "SAI-Rolotech-Smart-Engines.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "sai-rolotech-smart-engines.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "electron.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "node.exe" /T'
  Sleep 2000

  nsExec::ExecToLog 'taskkill /F /IM "SAI Rolotech Smart Engines.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "electron.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "node.exe" /T'
  Sleep 2000

  ; ── STEP 2: Run ALL possible old uninstallers silently ────────────────────
  nsExec::ExecToLog '"$LOCALAPPDATA\Programs\sai-rolotech-smart-engines\Uninstall SAI Rolotech Smart Engines.exe" /S'
  nsExec::ExecToLog '"$LOCALAPPDATA\Programs\sai-rolotech-smart-engines\Uninstall sai-rolotech-smart-engines.exe" /S'
  nsExec::ExecToLog '"$LOCALAPPDATA\Programs\SAI Rolotech Smart Engines\Uninstall SAI Rolotech Smart Engines.exe" /S'
  nsExec::ExecToLog '"$LOCALAPPDATA\Programs\Sai Rolotech Smart Engines\Uninstall Sai Rolotech Smart Engines.exe" /S'
  nsExec::ExecToLog '"$PROGRAMFILES64\SAI Rolotech Smart Engines\Uninstall SAI Rolotech Smart Engines.exe" /S'
  nsExec::ExecToLog '"$PROGRAMFILES\SAI Rolotech Smart Engines\Uninstall SAI Rolotech Smart Engines.exe" /S'
  Sleep 3000

  ; ── STEP 3: Delete ALL possible old install directories ──────────────────
  ; lowercase with hyphens (electron-builder default for older builds)
  RMDir /r "$LOCALAPPDATA\Programs\sai-rolotech-smart-engines"
  RMDir /r "$LOCALAPPDATA\sai-rolotech-smart-engines"

  ; Title case with spaces
  RMDir /r "$LOCALAPPDATA\Programs\SAI Rolotech Smart Engines"
  RMDir /r "$LOCALAPPDATA\Programs\Sai Rolotech Smart Engines"
  RMDir /r "$LOCALAPPDATA\Programs\SAI Sai Rolotech Smart Engines AI"

  ; Program Files variants
  RMDir /r "$PROGRAMFILES64\SAI Rolotech Smart Engines"
  RMDir /r "$PROGRAMFILES64\Sai Rolotech Smart Engines"
  RMDir /r "$PROGRAMFILES64\SAI Sai Rolotech Smart Engines AI"
  RMDir /r "$PROGRAMFILES64\sai-rolotech-smart-engines"
  RMDir /r "$PROGRAMFILES\SAI Rolotech Smart Engines"
  RMDir /r "$PROGRAMFILES\Sai Rolotech Smart Engines"
  RMDir /r "$PROGRAMFILES\SAI Sai Rolotech Smart Engines AI"
  RMDir /r "$PROGRAMFILES\sai-rolotech-smart-engines"

  ; ── STEP 4: Clean updater cache (old version data) ────────────────────────
  RMDir /r "$LOCALAPPDATA\sai-rolotech-smart-engines-updater"
  RMDir /r "$LOCALAPPDATA\SAI-Rolotech"
  RMDir /r "$LOCALAPPDATA\SAI Rolotech Smart Engines"

  ; ── STEP 5: Clean AppData (old app settings/cache) ───────────────────────
  RMDir /r "$APPDATA\sai-rolotech-smart-engines"
  RMDir /r "$APPDATA\SAI-Rolotech"
  RMDir /r "$APPDATA\SAI Rolotech Smart Engines"

  ; ── STEP 6: Remove ALL old shortcuts ──────────────────────────────────────
  Delete "$DESKTOP\SAI Rolotech Smart Engines.lnk"
  Delete "$DESKTOP\Sai Rolotech Smart Engines.lnk"
  Delete "$DESKTOP\SAI Sai Rolotech Smart Engines AI.lnk"
  Delete "$DESKTOP\SaiRolotech-SmartEngines.lnk"
  Delete "$DESKTOP\sai-rolotech-smart-engines.lnk"

  ; ── STEP 7: Clean ALL old registry entries ────────────────────────────────
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\sai-rolotech-smart-engines"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\sai-rolotech-smart-engines"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Sai Rolotech Smart Engines"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Sai Rolotech Smart Engines"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SAI Sai Rolotech Smart Engines AI"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SAI Sai Rolotech Smart Engines AI"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SAI Rolotech Smart Engines"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SAI Rolotech Smart Engines"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\{com.saisai-rolotech-smart-engines.rollformingai}"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\{com.saisai-rolotech-smart-engines.rollformingai}"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\{com.sai-rolotech.rollformingai}"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\{com.sai-rolotech.rollformingai}"

  ; ── STEP 8: Write new version info ───────────────────────────────────────
  WriteRegStr HKCU "Software\SAI Rolotech Smart Engines" "Version" "${VERSION}"

!macroend

!macro customInstall
  ; ── Firewall rule for API server ──────────────────────────────────────────
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="SAI Rolotech Smart Engines API"'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="SAI Rolotech Smart Engines API" dir=in action=allow protocol=TCP localport=3001 profile=private'

  ; ── Force-create Desktop shortcut ─────────────────────────────────────────
  CreateShortCut "$DESKTOP\SAI Rolotech Smart Engines.lnk" \
    "$INSTDIR\SAI Rolotech Smart Engines.exe" "" \
    "$INSTDIR\SAI Rolotech Smart Engines.exe" 0 SW_SHOWNORMAL \
    "" "SAI Rolotech Smart Engines v${VERSION}"

  ; ── Force-create Start Menu shortcuts ─────────────────────────────────────
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
  nsExec::ExecToLog 'taskkill /F /IM "node.exe" /T'
  Sleep 1000
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="SAI Rolotech Smart Engines API"'
  DeleteRegKey HKCU "Software\SAI Rolotech Smart Engines"
  Delete "$DESKTOP\SAI Rolotech Smart Engines.lnk"
  RMDir /r "$SMPROGRAMS\SAI Rolotech Smart Engines"
!macroend
