$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = "$PSScriptRoot"
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true
$server = $null

function Start-Server {
    $script:server = Start-Process -NoNewWindow -FilePath "node" -ArgumentList "server.js" -PassThru
    Write-Host "`n✅ ONIX backend running at http://localhost:3000" -ForegroundColor Green
    Write-Host "📁 Watching all files for changes (Ctrl+C to stop)`n" -ForegroundColor Cyan
}

function Stop-Server {
    if ($script:server -and !$script:server.HasExited) {
        $script:server.Kill()
        $script:server.WaitForExit(2000)
    }
}

Start-Server

try {
    while ($true) {
        $result = $watcher.WaitForChanged('Changed', 1500)
        if ($result.TimedOut) { continue }
        $name = $result.Name -replace '.*\\', ''
        if ($name -match '\.(js|html|txt|css|env|json)$' -and $name -notmatch 'node_modules') {
            Write-Host "🔄 $name changed, restarting..." -ForegroundColor Yellow
            Stop-Server
            Start-Sleep 1
            Start-Server
        }
    }
}
finally {
    Stop-Server
    $watcher.Dispose()
}
