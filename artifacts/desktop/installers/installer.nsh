; Sai Rolotech Smart Engines v2.2.0 — Custom NSIS Installer Script
; Windows 10/11 NSIS Installer Customization
; NOTE: electron-builder defines its own .onInit — use customInit macro instead

!macro customInit
  ; Check Windows version (require Windows 10 or higher)
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\Windows NT\CurrentVersion" "CurrentBuildNumber"
  IntCmp $0 17763 win10ok toolow win10ok
  toolow:
    MessageBox MB_OK|MB_ICONSTOP "Sai Rolotech Smart Engines requires Windows 10 (version 1809) or later.$\r$\nPlease upgrade your operating system."
    Abort
  win10ok:

  ; ── Product Key / License Key Verification ──
  ; Check if already activated (registry)
  ReadRegStr $1 HKCU "Software\SAI Rolotech Smart Engines" "ProductKey"
  StrCmp $1 "SAIR-2026-ROLL-FORM" keyalreadyok
  StrCmp $1 "SAIR-2026-ENGI-NEER" keyalreadyok
  StrCmp $1 "SAIR-2026-PREM-IUMS" keyalreadyok
  StrCmp $1 "SAIR-PRO-2026-MSTR" keyalreadyok
  StrCmp $1 "SAIR-DEMO-2026-TRIAL" keyalreadyok

  ; Not activated — ask for product key using VBS InputBox
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

    ; Read the key from temp file
    FileOpen $0 "$TEMP\sai-product-key.txt" r
    FileRead $0 $1
    FileClose $0
    Delete "$TEMP\sai-product-key.txt"
    Delete "$TEMP\sai-key-input.vbs"

    ; Validate key
    StrCmp $1 "" keycancelled
    StrCmp $1 "SAIR-2026-ROLL-FORM" keyok
    StrCmp $1 "SAIR-2026-ENGI-NEER" keyok
    StrCmp $1 "SAIR-2026-PREM-IUMS" keyok
    StrCmp $1 "SAIR-PRO-2026-MSTR" keyok
    StrCmp $1 "SAIR-DEMO-2026-TRIAL" keyok

    ; Invalid key
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "Invalid Product Key!$\r$\n$\r$\nThe key you entered is not valid.$\r$\nPlease check your key and try again.$\r$\n$\r$\nContact SAI Rolotech for a valid key.$\r$\nEmail: support@sairolotech.com" IDRETRY keyentry
    Abort

  keycancelled:
    Delete "$TEMP\sai-product-key.txt"
    Delete "$TEMP\sai-key-input.vbs"
    MessageBox MB_OK|MB_ICONSTOP "Installation cancelled.$\r$\nA valid Product Key is required to install this software."
    Abort

  keyok:
    WriteRegStr HKCU "Software\SAI Rolotech Smart Engines" "ProductKey" "$1"
    WriteRegStr HKCU "Software\SAI Rolotech Smart Engines" "Version" "${VERSION}"

  keyalreadyok:

  ; ── Kill all running instances ──
  nsExec::ExecToLog 'taskkill /F /IM "Sai Rolotech Smart Engines.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "SAI Sai Rolotech Smart Engines AI.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "SaiRolotech-SmartEngines.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "electron.exe" /T'
  Sleep 1500

  ; ── Run registered uninstallers ──
  ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Sai Rolotech Smart Engines" "UninstallString"
  StrCmp $R0 "" +2
    ExecWait '$R0 /S'

  ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Sai Rolotech Smart Engines" "UninstallString"
  StrCmp $R0 "" +2
    ExecWait '$R0 /S'

  ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SAI Sai Rolotech Smart Engines AI" "UninstallString"
  StrCmp $R0 "" +2
    ExecWait '$R0 /S'

  ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SAI Sai Rolotech Smart Engines AI" "UninstallString"
  StrCmp $R0 "" +2
    ExecWait '$R0 /S'

  ; ── Delete old installations ──
  RMDir /r "$PROGRAMFILES64\Sai Rolotech Smart Engines"
  RMDir /r "$PROGRAMFILES64\SAI Sai Rolotech Smart Engines AI"
  RMDir /r "$PROGRAMFILES64\SaiRolotech-SmartEngines"
  RMDir /r "$PROGRAMFILES\Sai Rolotech Smart Engines"
  RMDir /r "$PROGRAMFILES\SAI Sai Rolotech Smart Engines AI"

  Delete "$DESKTOP\Sai Rolotech Smart Engines.lnk"
  Delete "$DESKTOP\SAI Sai Rolotech Smart Engines AI.lnk"
  Delete "$DESKTOP\SaiRolotech-SmartEngines.lnk"

  RMDir /r "$SMPROGRAMS\Sai Rolotech Smart Engines"
  RMDir /r "$SMPROGRAMS\SAI Sai Rolotech Smart Engines AI"

  ; ── Clean old registry ──
  DeleteRegKey HKCU "Software\SAI Sai Rolotech Smart Engines AI"
  DeleteRegKey HKLM "Software\SAI Sai Rolotech Smart Engines AI"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SAI Sai Rolotech Smart Engines AI"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SAI Sai Rolotech Smart Engines AI"
!macroend

!macro customInstall
  ; Create Windows Firewall exception for local API server
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="SAI Sai Rolotech Smart Engines AI API"'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="Sai Rolotech Smart Engines API" dir=in action=allow protocol=TCP localport=3001 profile=private'
!macroend

!macro customUnInstall
  ; Remove firewall rule on uninstall
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Sai Rolotech Smart Engines API"'
  ; Clean registry
  DeleteRegKey HKCU "Software\SAI Rolotech Smart Engines"
!macroend
