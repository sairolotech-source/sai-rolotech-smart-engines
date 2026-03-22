; Sai Rolotech Smart Engines v2.2.0 — Custom NSIS Installer Script
; Windows 10/11 NSIS Installer Customization

; ── Welcome page ──
!define MUI_WELCOMEPAGE_TITLE "Welcome to Sai Rolotech Smart Engines v2.2.0 Setup"
!define MUI_WELCOMEPAGE_TEXT "This will install Sai Rolotech Smart Engines v${VERSION} on your computer.$\r$\n$\r$\nNote: All previous versions and duplicate copies will be automatically removed.$\r$\n$\r$\nFeatures:$\r$\n• Flower Pattern Generation$\r$\n• Roll Tooling Design and CAM Plans$\r$\n• AutoCAD DXF + G-Code Export$\r$\n• AI Defect Diagnosis (fully offline)$\r$\n• Digital Twin Simulation$\r$\n$\r$\nClick Next to continue."

; ── Finish page ──
!define MUI_FINISHPAGE_RUN "$INSTDIR\Sai Rolotech Smart Engines.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch Sai Rolotech Smart Engines"
!define MUI_FINISHPAGE_SHOWREADME ""
!define MUI_FINISHPAGE_SHOWREADME_TEXT "Create Desktop Shortcut"
!define MUI_FINISHPAGE_SHOWREADME_FUNCTION createDesktopShortcut

; ── Pre-install function ──
Function .onInit
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

  ; Not activated — ask for product key
  keyentry:
    MessageBox MB_OK|MB_ICONINFORMATION "Product Key Required$\r$\n$\r$\nYou need a valid Product Key to install this software.$\r$\nFormat: XXXX-XXXX-XXXX-XXXX$\r$\n$\r$\nContact SAI Rolotech for your license key.$\r$\nEmail: support@sairolotech.com"

    ; Use InputBox via System plugin
    System::Call 'user32::MessageBoxW(i $HWNDPARENT, w "Enter your Product Key in the next dialog.", w "SAI Rolotech — Activation", i 0x40)'

    ; Simple approach: write a VBS script to show InputBox and read result
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

    ; Check if user cancelled (exit code 1)
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
    ; Save the product key in registry
    WriteRegStr HKCU "Software\SAI Rolotech Smart Engines" "ProductKey" "$1"
    WriteRegStr HKCU "Software\SAI Rolotech Smart Engines" "Version" "${VERSION}"

  keyalreadyok:

  ; ── Step 1: Kill all running instances ──
  nsExec::ExecToLog 'taskkill /F /IM "Sai Rolotech Smart Engines.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "SAI Sai Rolotech Smart Engines AI.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "SaiRolotech-SmartEngines.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "electron.exe" /T'
  Sleep 1500

  ; ── Step 2: Run registered uninstallers (any/all old versions) ──
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

  ; ── Step 3: Delete old Program Files folders ──
  RMDir /r "$PROGRAMFILES64\Sai Rolotech Smart Engines"
  RMDir /r "$PROGRAMFILES64\SAI Sai Rolotech Smart Engines AI"
  RMDir /r "$PROGRAMFILES64\SaiRolotech-SmartEngines"
  RMDir /r "$PROGRAMFILES\Sai Rolotech Smart Engines"
  RMDir /r "$PROGRAMFILES\SAI Sai Rolotech Smart Engines AI"

  ; ── Step 4: Delete old Desktop shortcuts ──
  Delete "$DESKTOP\Sai Rolotech Smart Engines.lnk"
  Delete "$DESKTOP\SAI Sai Rolotech Smart Engines AI.lnk"
  Delete "$DESKTOP\SaiRolotech-SmartEngines.lnk"

  ; ── Step 5: Delete old Start Menu entries ──
  RMDir /r "$SMPROGRAMS\Sai Rolotech Smart Engines"
  RMDir /r "$SMPROGRAMS\SAI Sai Rolotech Smart Engines AI"

  ; ── Step 6: Delete old portable/extracted folders from common locations ──
  ; Downloads folder
  RMDir /r "$PROFILE\Downloads\SaiRolotech-SmartEngines-v2.2.0-Windows"
  RMDir /r "$PROFILE\Downloads\SaiRolotech-SmartEngines-v2.1.0-Windows"
  RMDir /r "$PROFILE\Downloads\SaiRolotech-SmartEngines-v2.0.0-Windows"
  RMDir /r "$PROFILE\Downloads\SaiRolotech-SmartEngines-v1.0.0-Windows"
  RMDir /r "$PROFILE\Downloads\SaiRolotech-SmartEngines-Windows"
  RMDir /r "$PROFILE\Downloads\SAI-Sai Rolotech Smart Engines-AI-win32-x64"

  ; Desktop extracted folders
  RMDir /r "$DESKTOP\SaiRolotech-SmartEngines-v2.2.0-Windows"
  RMDir /r "$DESKTOP\SaiRolotech-SmartEngines-v2.1.0-Windows"
  RMDir /r "$DESKTOP\SaiRolotech-SmartEngines-Windows"

  ; Documents folder
  RMDir /r "$DOCUMENTS\SaiRolotech-SmartEngines-v2.2.0-Windows"
  RMDir /r "$DOCUMENTS\SaiRolotech-SmartEngines-Windows"

  ; ── Step 7: Clean old registry keys ──
  DeleteRegKey HKCU "Software\SAI Sai Rolotech Smart Engines AI"
  DeleteRegKey HKLM "Software\SAI Sai Rolotech Smart Engines AI"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SAI Sai Rolotech Smart Engines AI"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SAI Sai Rolotech Smart Engines AI"

FunctionEnd

; ── Desktop shortcut function ──
Function createDesktopShortcut
  CreateShortCut "$DESKTOP\Sai Rolotech Smart Engines.lnk" "$INSTDIR\Sai Rolotech Smart Engines.exe"
FunctionEnd

; ── Custom install section ──
Section "Create Windows Firewall Exception" SecFirewall
  ; Allow the API server through Windows Firewall (local only)
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="SAI Sai Rolotech Smart Engines AI API"'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="Sai Rolotech Smart Engines API" dir=in action=allow protocol=TCP localport=3001 profile=private'
SectionEnd
