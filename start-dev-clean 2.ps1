$ErrorActionPreference = "SilentlyContinue"
$project = "c:\Users\seryw\Desktop\ticketsbuzz"
$log = Join-Path $project "dev-server.log"
Get-CimInstance Win32_Process | Where-Object { $_.Name -eq "node.exe" -and $_.CommandLine -match "next dev|next\\dist\\bin\\next" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 3000,3013 } | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
$lock = Join-Path $project ".next\dev\lock"
if (Test-Path $lock) { Remove-Item -LiteralPath $lock -Force }
if (Test-Path $log) { Remove-Item -LiteralPath $log -Force }
Start-Process -FilePath "cmd.exe" -ArgumentList "/c","npm run dev -- --port 3000 > dev-server.log 2>&1" -WorkingDirectory $project -WindowStyle Minimized
Start-Sleep -Seconds 10
try { $r = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 8; "HTTP3000=$($r.StatusCode)" } catch { "HTTP3000=FAIL" }
if (Test-Path $log) { "LOG_OK"; Get-Content -LiteralPath $log -Tail 20 }
