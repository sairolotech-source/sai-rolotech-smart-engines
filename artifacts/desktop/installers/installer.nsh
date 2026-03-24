; SAI Rolotech Smart Engines — Custom NSIS Installer Script
; Auto-removes any old version before installing new one

!macro customInit

  ; ── Check Windows 10 or higher ──
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\Windows NT\CurrentVersion" "CurrentBuildNumber"
  IntCmp $0 17763 win10ok toolow win10ok
  toolow:
    MessageBox MB_OK|MB_ICONSTOP "SAI Rolotech Smart Engines requires Windows 10 or later."
    Abort
  win10ok:

  ; ── License Key Check ──
  ReadRegStr $1 HKCU "Software\SAI Rolotech Smart Engines" "ProductKey"
  StrCmp $1 "SAIR-2026-ROLL-FORM" keyalreadyok
  StrCmp $1 "SAIR-2026-ENGI-NEER" keyalreadyok
  StrCmp $1 "SAIR-2026-PREM-IUMS" keyalreadyok
  StrCmp $1 "SAIR-PRO-2026-MSTR" keyalreadyok
  StrCmp $1 "SAIR-DEMO-2026-TRIAL" keyalreadyok

  keyentry:
    FileOpen $0 "$TEMP\sai-key-input.vbs" w
    FileWrite $0 'key = InputBox("Enter your Product Key:" & vbCrLf & vbCrLf & "Format: XXXX-XXXX-XXXX-XXXX" & vbCrLf & "Contact SAI Rolotech for your key." & vbCrLf & "Email: support@sairolotech.com", "SAI Rolotech — Product Activation", "")$\r$\n'
    FileWrite $0 'If key = "" Then$\r$\n'
    FileWrite $0 '  WScript.Quit 1$\r$\n'
    FileWrite $0 'End If$\r$\n'
    FileWrite $0 'Set fso = CreateObject("Scripting.FileSystemObject")$\r$\n'
    FileWrite $0 'Set f = fso.CreateTextFile("$TEMP\sai-product-key.txt", True)$\r$\n'
    FileWrite $0 'f.Write UCase(Trim(key))$\r$\n'
    FileWrite $0 'f.Close$\r$\n'
    FileClose $0

    nsExec::ExecToLog 'wscript.exe "$TEMP\sai-key-input.vbs"'
    Pop $2
    StrCmp $2 "error" keycancelled
    IntCmp $2 1 keycancelled

    FileOpen $0 "$TEMP\sai-product-key.txt" r
    FileRead $0 $1
    FileClose $0
    Delete "$TEMP\sai-product-key.txt"
    Delete "$TEMP\sai-key-input.vbs"

    StrCmp $1 "" keycancelled
    StrCmp $1 "SAIR-2026-ROLL-FORM" keyok
    StrCmp $1 "SAIR-2026-ENGI-NEER" keyok
    StrCmp $1 "SAIR-2026-PREM-IUMS" keyok
    StrCmp $1 "SAIR-PRO-2026-MSTR" keyok
    StrCmp $1 "SAIR-DEMO-2026-TRIAL" keyok

    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "Invalid Product Key! Please check and try again." IDRETRY keyentry
    Abort

  keycancelled:
    Delete "$TEMP\sai-product-key.txt"
    Delete "$TEMP\sai-key-input.vbs"
    MessageBox MB_OK|MB_ICONSTOP "Installation cancelled. A valid Product Key is required."
    Abort

  keyok:
    WriteRegStr HKCU "Software\SAI Rolotech Smart Engines" "ProductKey" "$1"
    WriteRegStr HKCU "Software\SAI Rolotech Smart Engines" "Version" "${VERSION}"

  keyalreadyok:

  ; ═══════════════════════════════════════════════════
  ;   AUTO-REMOVE OLD VERSION — Kill + Uninstall + Clean
  ; ═══════════════════════════════════════════════════

  ; Kill all running instances
  nsExec::ExecToLog 'taskkill /F /IM "SAI Rolotech Smart Engines.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "Sai Rolotech Smart Engines.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "SAI-Rolotech-Smart-Engines.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "SaiRolotech-SmartEngines.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "SAI Sai Rolotech Smart Engines AI.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "electron.exe" /T'
  Sleep 2000

  ; ── Run old uninstallers silently (all known registry key names) ──

  ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SAI Rolotech Smart Engines" "UninstallString"
  StrCmp $R0 "" chk1
    ExecWait '"$R0" /S'
  chk1:
  ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SAI Rolotech Smart Engines" "UninstallString"
  StrCmp $R0 "" chk2
    ExecWait '"$R0" /S'
  chk2:
  ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Sai Rolotech Smart Engines" "UninstallString"
  StrCmp $R0 "" chk3
    ExecWait '"$R0" /S'
  chk3:
  ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Sai Rolotech Smart Engines" "UninstallString"
  StrCmp $R0 "" chk4
    ExecWait '"$R0" /S'
  chk4:
  ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SAI Sai Rolotech Smart Engines AI" "UninstallString"
  StrCmp $R0 "" chk5
    ExecWait '"$R0" /S'
  chk5:
  ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SAI Sai Rolotech Smart Engines AI" "UninstallString"
  StrCmp $R0 "" chk6
    ExecWait '"$R0" /S'
  chk6:

  ; Per-user install uninstallers (Local\Programs)
  IfFileExists "$LOCALAPPDATA\Programs\SAI Rolotech Smart Engines\Uninstall SAI Rolotech Smart Engines.exe" 0 chk7
    ExecWait '"$LOCALAPPDATA\Programs\SAI Rolotech Smart Engines\Uninstall SAI Rolotech Smart Engines.exe" /S'
  chk7:
  IfFileExists "$LOCALAPPDATA\Programs\Sai Rolotech Smart Engines\Uninstall Sai Rolotech Smart Engines.exe" 0 chk8
    ExecWait '"$LOCALAPPDATA\Programs\Sai Rolotech Smart Engines\Uninstall Sai Rolotech Smart Engines.exe" /S'
  chk8:

  Sleep 2000

  ; ── Force delete all old installation directories ──
  RMDir /r "$PROGRAMFILES64\SAI Rolotech Smart Engines"
  RMDir /r "$PROGRAMFILES64\Sai Rolotech Smart Engines"
  RMDir /r "$PROGRAMFILES64\SAI Sai Rolotech Smart Engines AI"
  RMDir /r "$PROGRAMFILES64\SaiRolotech-SmartEngines"
  RMDir /r "$PROGRAMFILES\SAI Rolotech Smart Engines"
  RMDir /r "$PROGRAMFILES\Sai Rolotech Smart Engines"
  RMDir /r "$PROGRAMFILES\SAI Sai Rolotech Smart Engines AI"
  RMDir /r "$LOCALAPPDATA\Programs\SAI Rolotech Smart Engines"
  RMDir /r "$LOCALAPPDATA\Programs\Sai Rolotech Smart Engines"
  RMDir /r "$LOCALAPPDATA\Programs\SAI Sai Rolotech Smart Engines AI"

  ; ── Remove old shortcuts ──
  Delete "$DESKTOP\SAI Rolotech Smart Engines.lnk"
  Delete "$DESKTOP\Sai Rolotech Smart Engines.lnk"
  Delete "$DESKTOP\SAI Sai Rolotech Smart Engines AI.lnk"
  Delete "$DESKTOP\SaiRolotech-SmartEngines.lnk"
  RMDir /r "$SMPROGRAMS\SAI Rolotech Smart Engines"
  RMDir /r "$SMPROGRAMS\Sai Rolotech Smart Engines"
  RMDir /r "$SMPROGRAMS\SAI Sai Rolotech Smart Engines AI"

  ; ── Clean old registry keys ──
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SAI Rolotech Smart Engines"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SAI Rolotech Smart Engines"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Sai Rolotech Smart Engines"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Sai Rolotech Smart Engines"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SAI Sai Rolotech Smart Engines AI"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SAI Sai Rolotech Smart Engines AI"
  DeleteRegKey HKCU "Software\SAI Sai Rolotech Smart Engines AI"
  DeleteRegKey HKLM "Software\SAI Sai Rolotech Smart Engines AI"

!macroend

!macro customInstall
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="SAI Rolotech Smart Engines API"'
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="SAI Sai Rolotech Smart Engines AI API"'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="SAI Rolotech Smart Engines API" dir=in action=allow protocol=TCP localport=8080 profile=private'
!macroend

!macro customUnInstall
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="SAI Rolotech Smart Engines API"'
  DeleteRegKey HKCU "Software\SAI Rolotech Smart Engines"
!macroend
