; SAI Rolotech Smart Engines — NSIS Custom Script
; Install path: %LOCALAPPDATA%\Programs\SAI Rolotech Smart Engines
; No key prompt during install — activation handled inside the app

!macro customInit
  ; ── Kill all running instances before install ──
  nsExec::ExecToLog 'taskkill /F /IM "SAI Rolotech Smart Engines.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "Sai Rolotech Smart Engines.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "SaiRolotech-SmartEngines.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "electron.exe" /T'
  Sleep 2000

  ; ── Remove old PROGRAMFILES installs (v2.2.0 era) ──
  RMDir /r "$PROGRAMFILES64\SAI Rolotech Smart Engines"
  RMDir /r "$PROGRAMFILES64\Sai Rolotech Smart Engines"
  RMDir /r "$PROGRAMFILES64\SAI Sai Rolotech Smart Engines AI"
  RMDir /r "$PROGRAMFILES\SAI Rolotech Smart Engines"
  RMDir /r "$PROGRAMFILES\Sai Rolotech Smart Engines"
  RMDir /r "$PROGRAMFILES\SAI Sai Rolotech Smart Engines AI"

  ; ── Remove old Desktop shortcuts ──
  Delete "$DESKTOP\SAI Rolotech Smart Engines.lnk"
  Delete "$DESKTOP\Sai Rolotech Smart Engines.lnk"
  Delete "$DESKTOP\SAI Sai Rolotech Smart Engines AI.lnk"
  Delete "$DESKTOP\SaiRolotech-SmartEngines.lnk"

  ; ── Clean old registry uninstall entries ──
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Sai Rolotech Smart Engines"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Sai Rolotech Smart Engines"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SAI Sai Rolotech Smart Engines AI"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SAI Sai Rolotech Smart Engines AI"

  ; ── Write version info (no key required at install time) ──
  WriteRegStr HKCU "Software\SAI Rolotech Smart Engines" "Version" "${VERSION}"
  WriteRegStr HKCU "Software\SAI Rolotech Smart Engines" "InstalledAt" "$TEMP"

!macroend

!macro customInstall
  ; ── Firewall rule for API server ──
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="SAI Rolotech Smart Engines API"'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="SAI Rolotech Smart Engines API" dir=in action=allow protocol=TCP localport=8080 profile=private'

  ; ── Force-create Desktop shortcut ──
  CreateShortCut "$DESKTOP\SAI Rolotech Smart Engines.lnk" \
    "$INSTDIR\SAI Rolotech Smart Engines.exe" "" \
    "$INSTDIR\SAI Rolotech Smart Engines.exe" 0 SW_SHOWNORMAL \
    "" "SAI Rolotech Smart Engines v${VERSION}"

  ; ── Force-create Start Menu shortcuts ──
  CreateDirectory "$SMPROGRAMS\SAI Rolotech Smart Engines"
  CreateShortCut "$SMPROGRAMS\SAI Rolotech Smart Engines\SAI Rolotech Smart Engines.lnk" \
    "$INSTDIR\SAI Rolotech Smart Engines.exe" "" \
    "$INSTDIR\SAI Rolotech Smart Engines.exe" 0 SW_SHOWNORMAL \
    "" "SAI Rolotech Smart Engines v${VERSION}"
  CreateShortCut "$SMPROGRAMS\SAI Rolotech Smart Engines\Uninstall SAI Rolotech.lnk" \
    "$INSTDIR\Uninstall SAI Rolotech Smart Engines.exe"
!macroend

!macro customUnInstall
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="SAI Rolotech Smart Engines API"'
  DeleteRegKey HKCU "Software\SAI Rolotech Smart Engines"
  Delete "$DESKTOP\SAI Rolotech Smart Engines.lnk"
  RMDir /r "$SMPROGRAMS\SAI Rolotech Smart Engines"
!macroend
