; SAI Rolotech Smart Engines — NSIS Custom Script (oneClick mode)
; Fixed install path: %LOCALAPPDATA%\Programs\SAI Rolotech Smart Engines
; Old version auto-killed and replaced on every install

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

  ; ── Keep license key (preserve user data) ──
  ReadRegStr $1 HKCU "Software\SAI Rolotech Smart Engines" "ProductKey"
  StrCmp $1 "SAIR-2026-ROLL-FORM" keyok
  StrCmp $1 "SAIR-2026-ENGI-NEER" keyok
  StrCmp $1 "SAIR-2026-PREM-IUMS" keyok
  StrCmp $1 "SAIR-PRO-2026-MSTR" keyok
  StrCmp $1 "SAIR-DEMO-2026-TRIAL" keyok

  ; No key found — ask for it
  keyentry:
    FileOpen $0 "$TEMP\sai-key-input.vbs" w
    FileWrite $0 'key = InputBox("Enter your Product Key:" & vbCrLf & vbCrLf & "Format: XXXX-XXXX-XXXX-XXXX" & vbCrLf & "Email: support@sairolotech.com", "SAI Rolotech — Activation", "")$\r$\n'
    FileWrite $0 'If key = "" Then WScript.Quit 1$\r$\n'
    FileWrite $0 'Set fso = CreateObject("Scripting.FileSystemObject")$\r$\n'
    FileWrite $0 'Set f = fso.CreateTextFile("$TEMP\sai-product-key.txt", True)$\r$\n'
    FileWrite $0 'f.Write UCase(Trim(key))$\r$\n'
    FileWrite $0 'f.Close$\r$\n'
    FileClose $0
    nsExec::ExecToLog 'wscript.exe "$TEMP\sai-key-input.vbs"'
    Pop $2
    IntCmp $2 1 keycancelled
    FileOpen $0 "$TEMP\sai-product-key.txt" r
    FileRead $0 $1
    FileClose $0
    Delete "$TEMP\sai-product-key.txt"
    Delete "$TEMP\sai-key-input.vbs"
    StrCmp $1 "SAIR-2026-ROLL-FORM" keyok
    StrCmp $1 "SAIR-2026-ENGI-NEER" keyok
    StrCmp $1 "SAIR-2026-PREM-IUMS" keyok
    StrCmp $1 "SAIR-PRO-2026-MSTR" keyok
    StrCmp $1 "SAIR-DEMO-2026-TRIAL" keyok
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "Invalid Product Key! Try again." IDRETRY keyentry
    Abort

  keycancelled:
    MessageBox MB_OK|MB_ICONSTOP "Installation cancelled. Valid Product Key required."
    Abort

  keyok:
    WriteRegStr HKCU "Software\SAI Rolotech Smart Engines" "ProductKey" "$1"
    WriteRegStr HKCU "Software\SAI Rolotech Smart Engines" "Version" "${VERSION}"

!macroend

!macro customInstall
  ; ── Firewall rule for API server ──
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="SAI Rolotech Smart Engines API"'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="SAI Rolotech Smart Engines API" dir=in action=allow protocol=TCP localport=8080 profile=private'

  ; ── Force-create Desktop shortcut (guarantee it always appears) ──
  CreateShortCut "$DESKTOP\SAI Rolotech Smart Engines.lnk" \
    "$INSTDIR\SAI Rolotech Smart Engines.exe" "" \
    "$INSTDIR\SAI Rolotech Smart Engines.exe" 0 SW_SHOWNORMAL \
    "" "SAI Rolotech Smart Engines v${VERSION}"

  ; ── Force-create Start Menu shortcut ──
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
!macroend
