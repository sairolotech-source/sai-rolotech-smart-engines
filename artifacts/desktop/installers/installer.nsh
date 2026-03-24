; SAI Rolotech Smart Engines — NSIS Custom Script

!macro customInit

  ; Kill old processes (taskkill — reliable, no PowerShell needed)
  nsExec::ExecToLog 'taskkill /F /IM "SAI Rolotech Smart Engines.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "Sai Rolotech Smart Engines.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "SaiRolotech-SmartEngines.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "SAI-Rolotech-Smart-Engines.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "sai-rolotech-smart-engines.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "electron.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "node.exe" /T'
  Sleep 3000
  nsExec::ExecToLog 'taskkill /F /IM "SAI Rolotech Smart Engines.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "electron.exe" /T'
  Sleep 2000

  ; Clean AppData Cache
  RMDir /r "$APPDATA\SAI Rolotech Smart Engines\Cache"
  RMDir /r "$APPDATA\SAI Rolotech Smart Engines\GPUCache"
  RMDir /r "$APPDATA\SAI Rolotech Smart Engines\Code Cache"
  RMDir /r "$LOCALAPPDATA\SAI Rolotech Smart Engines\Cache"
  RMDir /r "$LOCALAPPDATA\SAI Rolotech Smart Engines\GPUCache"

  ; Run old uninstallers silently
  nsExec::ExecToLog '"$LOCALAPPDATA\Programs\sai-rolotech-smart-engines\Uninstall SAI Rolotech Smart Engines.exe" /S'
  nsExec::ExecToLog '"$LOCALAPPDATA\Programs\SAI Rolotech Smart Engines\Uninstall SAI Rolotech Smart Engines.exe" /S'
  nsExec::ExecToLog '"$LOCALAPPDATA\Programs\Sai Rolotech Smart Engines\Uninstall Sai Rolotech Smart Engines.exe" /S'
  Sleep 3000

  ; Delete old install directories
  RMDir /r "$LOCALAPPDATA\Programs\sai-rolotech-smart-engines"
  RMDir /r "$LOCALAPPDATA\sai-rolotech-smart-engines"
  RMDir /r "$LOCALAPPDATA\Programs\SAI Rolotech Smart Engines"
  RMDir /r "$LOCALAPPDATA\Programs\Sai Rolotech Smart Engines"
  RMDir /r "$PROGRAMFILES64\SAI Rolotech Smart Engines"
  RMDir /r "$PROGRAMFILES64\sai-rolotech-smart-engines"
  RMDir /r "$PROGRAMFILES\SAI Rolotech Smart Engines"
  RMDir /r "$PROGRAMFILES\sai-rolotech-smart-engines"

  ; Clean updater and AppData
  RMDir /r "$LOCALAPPDATA\sai-rolotech-smart-engines-updater"
  RMDir /r "$APPDATA\sai-rolotech-smart-engines"
  RMDir /r "$APPDATA\SAI Rolotech Smart Engines"

  ; Remove old shortcuts
  Delete "$DESKTOP\SAI Rolotech Smart Engines.lnk"
  Delete "$DESKTOP\Sai Rolotech Smart Engines.lnk"
  Delete "$DESKTOP\sai-rolotech-smart-engines.lnk"

  ; Clean old registry entries
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\sai-rolotech-smart-engines"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\sai-rolotech-smart-engines"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SAI Rolotech Smart Engines"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SAI Rolotech Smart Engines"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Sai Rolotech Smart Engines"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Sai Rolotech Smart Engines"

  WriteRegStr HKCU "Software\SAI Rolotech Smart Engines" "Version" "${VERSION}"

!macroend

!macro customInstall
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="SAI Rolotech Smart Engines API"'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="SAI Rolotech Smart Engines API" dir=in action=allow protocol=TCP localport=3001 profile=private'
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
