; SAI Rolotech Smart Engines — NSIS Custom Script

!macro customInit
  ; Kill old app processes (non-blocking)
  nsExec::Exec 'taskkill /F /IM "SAI Rolotech Smart Engines.exe" /T'
  nsExec::Exec 'taskkill /F /IM "electron.exe" /T'
!macroend

!macro customInstall
  nsExec::Exec 'netsh advfirewall firewall delete rule name="SAI Rolotech Smart Engines API"'
  nsExec::Exec 'netsh advfirewall firewall add rule name="SAI Rolotech Smart Engines API" dir=in action=allow protocol=TCP localport=3001 profile=private'
!macroend

!macro customUnInstall
  nsExec::Exec 'taskkill /F /IM "SAI Rolotech Smart Engines.exe" /T'
  nsExec::Exec 'taskkill /F /IM "electron.exe" /T'
  nsExec::Exec 'netsh advfirewall firewall delete rule name="SAI Rolotech Smart Engines API"'
  Delete "$DESKTOP\SAI Rolotech Smart Engines.lnk"
  RMDir /r "$SMPROGRAMS\SAI Rolotech Smart Engines"
!macroend
