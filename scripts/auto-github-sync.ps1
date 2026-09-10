param(
  [ValidateRange(1, 3600)][int]$IntervalSeconds = 60,
  [ValidateRange(1, 60)][int]$QuietCycles = 2,
  [switch]$InstallTask,
  [switch]$Once
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$SyncScriptPath = $PSCommandPath
$LogDir = Join-Path $env:LOCALAPPDATA "Shagritm"
$LogPath = Join-Path $LogDir "auto-github-sync.log"
$MutexName = "ShagritmAutoGithubSync"
$GitAutoSyncPathspec = @(
  ".",
  ":(exclude,icase,glob)**/*.apk",
  ":(exclude,icase,glob)**/*.keystore"
)

function Write-SyncLog {
  param([string]$Message)

  if (-not (Test-Path -LiteralPath $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
  }
  $line = "{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
  Add-Content -LiteralPath $LogPath -Value $line
}

function New-AutoSyncLauncher {
  param([string]$PowerShellPath, [string]$ScriptPath)

  if (-not [IO.Path]::IsPathRooted($PowerShellPath) -or -not [IO.Path]::IsPathRooted($ScriptPath)) {
    throw "Auto sync launcher requires absolute executable and script paths."
  }
  $escapedScriptPath = $ScriptPath.Replace("'", "''")
  $command = "& '$escapedScriptPath' -IntervalSeconds $IntervalSeconds -QuietCycles $QuietCycles"
  $encodedCommand = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
  $arguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -EncodedCommand $encodedCommand"
  $launchCommand = '"' + $PowerShellPath + '" ' + $arguments
  $escapedLaunchCommand = $launchCommand.Replace('"', '""')
  return "Set shell = CreateObject(`"WScript.Shell`")`r`nshell.Run `"$escapedLaunchCommand`", 0, False`r`n"
}

function Install-AutoSyncTask {
  $powerShellPath = (Get-Command powershell.exe -ErrorAction Stop).Source
  $startupDir = [Environment]::GetFolderPath("Startup")
  if (-not $startupDir) { throw "The current user's Startup directory is unavailable." }
  $startupScript = Join-Path $startupDir "shagritm-auto-github-sync.vbs"
  $launcher = New-AutoSyncLauncher -PowerShellPath $powerShellPath -ScriptPath $SyncScriptPath
  Set-Content -LiteralPath $startupScript -Value $launcher -Encoding Unicode

  $oldLauncher = Join-Path $startupDir "shagritm-auto-github-sync.cmd"
  if (Test-Path -LiteralPath $oldLauncher) {
    Remove-Item -LiteralPath $oldLauncher
  }
  Write-SyncLog "Installed hidden Startup launcher. It will run at the next Windows sign-in."
  Write-Host "Installed Startup launcher '$startupScript'."
}

function Invoke-Git {
  param([string[]]$Arguments)

  # Windows PowerShell treats Git's ordinary stderr progress as errors under Stop.
  $previousErrorAction = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & git @Arguments 2>&1
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorAction
  }
  if ($exitCode -ne 0) {
    # Git output can contain repository URLs or file contents; keep it out of logs.
    throw "Git operation '$($Arguments[0])' failed (exit code $exitCode)."
  }
  return $output
}

function Get-StatusFingerprint {
  $status = Invoke-Git (@("status", "--porcelain=v1", "--untracked-files=all", "--") + $GitAutoSyncPathspec)
  if (-not ($status -join "").Trim()) { return "" }

  $parts = [Collections.Generic.List[string]]::new()
  $parts.Add(($status -join "`n"))
  foreach ($arguments in @(
    @("diff", "--no-ext-diff", "--no-textconv", "--binary", "--"),
    @("diff", "--cached", "--no-ext-diff", "--no-textconv", "--binary", "--")
  )) {
    $parts.Add(((Invoke-Git ($arguments + $GitAutoSyncPathspec)) -join "`n"))
  }
  $untracked = Invoke-Git (@("-c", "core.quotepath=false", "ls-files", "--others", "--exclude-standard", "--") + $GitAutoSyncPathspec)
  foreach ($file in $untracked) {
    $filePath = Join-Path $RepoRoot $file
    $parts.Add($file)
    $parts.Add((Get-FileHash -LiteralPath $filePath -Algorithm SHA256).Hash)
  }
  $hashAlgorithm = [Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [Text.Encoding]::UTF8.GetBytes(($parts -join "`0"))
    return [Convert]::ToBase64String($hashAlgorithm.ComputeHash($bytes))
  } finally {
    $hashAlgorithm.Dispose()
  }
}

function Get-RemoteTrackingCommit {
  param([string]$Branch)

  $reference = "refs/remotes/origin/$Branch"
  $references = Invoke-Git @("for-each-ref", "--format=%(refname) %(objectname)", $reference)
  foreach ($entry in $references) {
    $fields = $entry -split " ", 2
    if ($fields[0] -eq $reference) { return $fields[1] }
  }
  return ""
}

function Test-PendingPush {
  param([string]$Branch)

  $remoteCommit = Get-RemoteTrackingCommit $Branch
  $localCommit = (Invoke-Git @("rev-parse", "HEAD") | Select-Object -First 1).Trim()
  return $localCommit -ne $remoteCommit
}

function Assert-SyncReady {
  param([string]$Branch)

  foreach ($operation in @("MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply")) {
    $operationPath = (Invoke-Git @("rev-parse", "--path-format=absolute", "--git-path", $operation) | Select-Object -First 1).Trim()
    if (Test-Path -LiteralPath $operationPath) {
      throw "Automatic sync is paused while a Git merge, rebase, or cherry-pick is in progress."
    }
  }
  $stagedExcludedFiles = Invoke-Git @("diff", "--cached", "--name-only", "--", ":(icase,glob)**/*.apk", ":(icase,glob)**/*.keystore")
  if (($stagedExcludedFiles -join "").Trim()) {
    throw "APK or signing files are already staged. Unstage them before automatic sync."
  }
  $remoteCommit = Get-RemoteTrackingCommit $Branch
  if ($remoteCommit) {
    & git merge-base --is-ancestor $remoteCommit HEAD *> $null
    if ($LASTEXITCODE -eq 1) {
      throw "Origin has changes missing from '$Branch'. Integrate them manually before automatic sync."
    }
    if ($LASTEXITCODE -ne 0) { throw "Cannot verify the remote branch ancestry." }
  }
}

function Invoke-AutoSync {
  $branch = ((Invoke-Git @("branch", "--show-current")) -join "").Trim()
  if (-not $branch) { throw "Automatic sync is paused because the repository is in detached HEAD." }
  Assert-SyncReady $branch
  Invoke-Git (@("add", "-A", "--") + $GitAutoSyncPathspec) | Out-Null
  $staged = Invoke-Git @("diff", "--cached", "--name-only")
  if (($staged -join "").Trim()) {
    $message = "Auto sync {0}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    Invoke-Git @("commit", "-m", $message) | Out-Null
    Write-SyncLog "Committed changes on '$branch'."
  }
  if (Test-PendingPush $branch) {
    try {
      # WARNING: Saved source changes are committed and published automatically.
      Invoke-Git @("push", "-u", "origin", "${branch}:refs/heads/$branch") | Out-Null
    } catch {
      throw "Push failed. Local commits are retained for retry. Check connectivity; if origin advanced, integrate its changes manually."
    }
    Write-SyncLog "Pushed '$branch'."
  }
}

# Dot-sourcing loads the functions for local regression tests without starting sync.
if ($MyInvocation.InvocationName -eq ".") { return }

if ($InstallTask) {
  Install-AutoSyncTask
  exit 0
}

$mutex = [System.Threading.Mutex]::new($false, $MutexName)
if (-not $mutex.WaitOne(0)) {
  Write-SyncLog "Another auto sync process is already running."
  $mutex.Dispose()
  exit 0
}

try {
  Push-Location $RepoRoot
  Invoke-Git @("rev-parse", "--is-inside-work-tree") | Out-Null
  Invoke-Git @("remote", "get-url", "origin") | Out-Null
  Write-SyncLog "Auto sync started for $RepoRoot."
  if ($Once) {
    Invoke-AutoSync
    return
  }
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
          $stableCycles = 0
        }
        if ($stableCycles -ge $QuietCycles) {
          Invoke-AutoSync
          $lastFingerprint = ""
          $stableCycles = 0
        }
      } else {
        $lastFingerprint = ""
        $stableCycles = 0
        $branch = ((Invoke-Git @("branch", "--show-current")) -join "").Trim()
        if ($branch -and (Test-PendingPush $branch)) { Invoke-AutoSync }
      }
    } catch {
      Write-SyncLog "Sync error: $($_.Exception.Message)"
    }
    Start-Sleep -Seconds $IntervalSeconds
  }
} finally {
  Pop-Location
  $mutex.ReleaseMutex()
  $mutex.Dispose()
}
