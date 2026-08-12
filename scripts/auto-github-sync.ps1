param(
  [int]$IntervalSeconds = 60,
  [int]$QuietCycles = 2,
  [switch]$InstallTask,
  [switch]$Once
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$TaskName = "Shagritm Auto GitHub Sync"
$LogDir = Join-Path $env:LOCALAPPDATA "Shagritm"
$LogPath = Join-Path $LogDir "auto-github-sync.log"
$MutexName = "ShagritmAutoGithubSync"

function Write-SyncLog {
  param([string]$Message)

  if (-not (Test-Path -LiteralPath $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
  }

  $line = "{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
  Add-Content -LiteralPath $LogPath -Value $line
}

function Install-AutoSyncTask {
  $powerShellPath = (Get-Command powershell.exe).Source
  $scriptPath = $PSCommandPath
  $arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -IntervalSeconds $IntervalSeconds -QuietCycles $QuietCycles"
  $userId = if ($env:USERDOMAIN) { "$env:USERDOMAIN\$env:USERNAME" } else { $env:USERNAME }

  try {
    $action = New-ScheduledTaskAction -Execute $powerShellPath -Argument $arguments -WorkingDirectory $RepoRoot
    $trigger = New-ScheduledTaskTrigger -AtLogOn
    $principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited

    Register-ScheduledTask `
      -TaskName $TaskName `
      -Action $action `
      -Trigger $trigger `
      -Principal $principal `
      -Description "Automatically commits and pushes Shagritm project changes to GitHub." `
      -Force | Out-Null

    Write-SyncLog "Installed scheduled task '$TaskName' for $userId."
    Write-Host "Installed scheduled task '$TaskName'."
  } catch {
    $startupDir = [Environment]::GetFolderPath("Startup")
    $startupScript = Join-Path $startupDir "shagritm-auto-github-sync.cmd"
    $command = "@echo off`r`nstart `"`" /min `"$powerShellPath`" $arguments`r`n"

    Set-Content -LiteralPath $startupScript -Value $command -Encoding ASCII
    Write-SyncLog "Scheduled task install failed, installed Startup launcher '$startupScript'. Error: $($_.Exception.Message)"
    Write-Host "Installed Startup launcher '$startupScript'."
  }
}

function Invoke-Git {
  param([string[]]$Arguments)

  $output = & git @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Arguments -join ' ') failed: $($output -join [Environment]::NewLine)"
  }

  return $output
}

function Get-StatusFingerprint {
  $status = Invoke-Git @("status", "--porcelain=v1", "--untracked-files=all")
  return ($status -join [Environment]::NewLine).Trim()
}

function Test-RemoteBranchExists {
  param([string]$Branch)

  & git ls-remote --exit-code --heads origin $Branch *> $null
  return $LASTEXITCODE -eq 0
}

function Invoke-AutoSync {
  $branch = (Invoke-Git @("branch", "--show-current") | Select-Object -First 1).Trim()
  if (-not $branch) {
    Write-SyncLog "Skipped sync because the repository is in detached HEAD."
    return
  }

  Invoke-Git @("add", "-A", "--", ".") | Out-Null

  $staged = Invoke-Git @("diff", "--cached", "--name-only")
  if (-not ($staged -join "").Trim()) {
    Write-SyncLog "Skipped sync because there are no staged changes."
    return
  }

  $message = "Auto sync {0}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
  Invoke-Git @("commit", "-m", $message) | Out-Null

  if (Test-RemoteBranchExists $branch) {
    Invoke-Git @("pull", "--rebase", "--autostash", "origin", $branch) | Out-Null
  }

  Invoke-Git @("push", "-u", "origin", $branch) | Out-Null
  Write-SyncLog "Pushed '$branch' with commit '$message'."
}

if ($InstallTask) {
  Install-AutoSyncTask
  exit 0
}

$mutex = [System.Threading.Mutex]::new($false, $MutexName)
if (-not $mutex.WaitOne(0)) {
  Write-SyncLog "Another auto sync process is already running."
  exit 0
}

try {
  Push-Location $RepoRoot
  Invoke-Git @("rev-parse", "--is-inside-work-tree") | Out-Null
  Invoke-Git @("remote", "get-url", "origin") | Out-Null

  Write-SyncLog "Auto sync started for $RepoRoot."
  $lastFingerprint = ""
  $stableCycles = 0

  while ($true) {
    try {
      $fingerprint = Get-StatusFingerprint

      if ($fingerprint) {
        if ($fingerprint -eq $lastFingerprint) {
          $stableCycles += 1
        } else {
          $lastFingerprint = $fingerprint
          $stableCycles = 1
        }

        if ($stableCycles -ge $QuietCycles) {
          Invoke-AutoSync
          $lastFingerprint = ""
          $stableCycles = 0
        }
      } else {
        $lastFingerprint = ""
        $stableCycles = 0
      }
    } catch {
      Write-SyncLog "Sync error: $($_.Exception.Message)"
    }

    if ($Once) {
      break
    }

    Start-Sleep -Seconds $IntervalSeconds
  }
} finally {
  Pop-Location
  $mutex.ReleaseMutex()
  $mutex.Dispose()
}
