param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('locked', 'unlocked')]
  [string]$State
)

$ErrorActionPreference = 'Stop'
$sessionDirectory = Join-Path $PSScriptRoot '..\data\windows-session'
$statePath = Join-Path $sessionDirectory 'session-state.json'

New-Item -ItemType Directory -Path $sessionDirectory -Force | Out-Null

$event = [ordered]@{
  state = $State
  updatedAt = [DateTimeOffset]::UtcNow.AddHours(-5).ToString('yyyy-MM-ddTHH:mm:ss.fffffff-05:00')
  source = 'Task Scheduler'
  sessionId = [Diagnostics.Process]::GetCurrentProcess().SessionId
}

$temporaryPath = Join-Path $sessionDirectory ([IO.Path]::GetRandomFileName())

try {
  Set-Content -LiteralPath $temporaryPath -Value ($event | ConvertTo-Json) -Encoding UTF8
  Move-Item -LiteralPath $temporaryPath -Destination $statePath -Force
}
finally {
  Remove-Item -LiteralPath $temporaryPath -Force -ErrorAction SilentlyContinue
}
