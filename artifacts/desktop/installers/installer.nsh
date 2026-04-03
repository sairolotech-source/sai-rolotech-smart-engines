; SAI Rolotech Smart Engines — NSIS Custom Script
; Smooth update: old files properly saaf karta hai

!macro customInit
  ; Step 1: Running processes band karo
  nsExec::Exec 'taskkill /F /IM "SAI Rolotech Smart Engines.exe" /T'
  nsExec::Exec 'taskkill /F /IM "electron.exe" /T'
  nsExec::Exec 'taskkill /F /IM "node.exe" /T'
  ; Processes close hone ka wait
  Sleep 2000

  ; Step 2: Port 3001 free karo (API server ka port)
  nsExec::Exec 'cmd /C "for /f "tokens=5" %a in (''netstat -aon ^| findstr :3001'') do taskkill /F /PID %a"'
!macroend

!macro customInstall
  ; Step 3: Purane resource files delete karo (broken tools ki wajah yahi hoti hai)
  RMDir /r "$INSTDIR\resources\api-server"
  RMDir /r "$INSTDIR\resources\frontend"
  Delete "$INSTDIR\resources\app.asar"

  ; Step 4: Windows Firewall rule update karo
  nsExec::Exec 'netsh advfirewall firewall delete rule name="SAI Rolotech Smart Engines API"'
  nsExec::Exec 'netsh advfirewall firewall add rule name="SAI Rolotech Smart Engines API" dir=in action=allow protocol=TCP localport=3001 profile=private'

  ; Step 5: Electron cache clear karo (stale files se tools break hote hain)
  ; AppData\Roaming\SAI Rolotech Smart Engines\Cache
  nsExec::Exec 'cmd /C "rd /s /q "%APPDATA%\SAI Rolotech Smart Engines\Cache" 2>nul"'
  nsExec::Exec 'cmd /C "rd /s /q "%APPDATA%\SAI Rolotech Smart Engines\Code Cache" 2>nul"'
  nsExec::Exec 'cmd /C "rd /s /q "%APPDATA%\SAI Rolotech Smart Engines\GPUCache" 2>nul"'
!macroend

!macro customUnInstall
  ; Processes band karo
  nsExec::Exec 'taskkill /F /IM "SAI Rolotech Smart Engines.exe" /T'
  nsExec::Exec 'taskkill /F /IM "electron.exe" /T'
  nsExec::Exec 'taskkill /F /IM "node.exe" /T'
  Sleep 1500

  ; Firewall rule hata do
  nsExec::Exec 'netsh advfirewall firewall delete rule name="SAI Rolotech Smart Engines API"'

  ; Shortcuts hata do
  Delete "$DESKTOP\SAI Rolotech Smart Engines.lnk"
  RMDir /r "$SMPROGRAMS\SAI Rolotech Smart Engines"
!macroend
