$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "auto-github-sync.ps1")

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw "Regression failed: $Message" }
}

function Assert-Throws {
  param([scriptblock]$Action, [string]$ExpectedMessage)
  $failure = $null
  try { & $Action } catch { $failure = $_.Exception.Message }
  Assert-True ($null -ne $failure -and $failure.Contains($ExpectedMessage)) "Expected error containing '$ExpectedMessage'."
}

$testRoot = Join-Path ([IO.Path]::GetTempPath()) ("shagritm-sync-tests-" + [Guid]::NewGuid().ToString("N"))
$RepoRoot = Join-Path $testRoot "working repo"
$remotePath = Join-Path $testRoot "origin.git"
$peerPath = Join-Path $testRoot "peer"
$LogDir = Join-Path $testRoot "logs"
$LogPath = Join-Path $LogDir "sync.log"
New-Item -ItemType Directory -Path $RepoRoot -Force | Out-Null
Push-Location $RepoRoot

try {
  Invoke-Git @("init", "--initial-branch=main") | Out-Null
  Invoke-Git @("config", "user.name", "Auto Sync Test") | Out-Null
  Invoke-Git @("config", "user.email", "auto-sync-test@example.invalid") | Out-Null
  Invoke-Git @("config", "commit.gpgsign", "false") | Out-Null
  Invoke-Git @("init", "--bare", "--initial-branch=main", $remotePath) | Out-Null
  Invoke-Git @("remote", "add", "origin", $remotePath) | Out-Null
  $trackedPath = Join-Path $RepoRoot "screen.txt"
  Set-Content -LiteralPath $trackedPath -Value "initial"
  Invoke-Git @("add", ".") | Out-Null
  Invoke-Git @("commit", "-m", "Initial") | Out-Null
  Invoke-Git @("push", "-u", "origin", "main") | Out-Null
  Assert-True ((Get-StatusFingerprint) -eq "") "Clean repository must have no content fingerprint."
  Assert-True (-not (Test-PendingPush "main")) "Published HEAD must not need another push."

  Set-Content -LiteralPath $trackedPath -Value "design revision one"
  $firstTrackedFingerprint = Get-StatusFingerprint
  Set-Content -LiteralPath $trackedPath -Value "design revision two"
  Assert-True ((Get-StatusFingerprint) -ne $firstTrackedFingerprint) "A second save to the same tracked file must restart the quiet period."
  Invoke-Git @("add", "screen.txt") | Out-Null
  $stagedFingerprint = Get-StatusFingerprint
  Set-Content -LiteralPath $trackedPath -Value "design revision three"
  Assert-True ((Get-StatusFingerprint) -ne $stagedFingerprint) "Edits after staging must change the fingerprint."

  $unicodeName = ([char]0x0448).ToString() + " new screen.txt"
  $untrackedPath = Join-Path $RepoRoot $unicodeName
  Set-Content -LiteralPath $untrackedPath -Value "first draft"
  $firstUntrackedFingerprint = Get-StatusFingerprint
  Set-Content -LiteralPath $untrackedPath -Value "second draft"
  Assert-True ((Get-StatusFingerprint) -ne $firstUntrackedFingerprint) "Untracked Unicode filenames must be hashed by content."
  $beforeExcludedFiles = Get-StatusFingerprint
  Set-Content -LiteralPath (Join-Path $RepoRoot "release.apk") -Value "package"
  Set-Content -LiteralPath (Join-Path $RepoRoot "signing.keystore") -Value "signing fixture"
  $nestedDirectory = Join-Path $RepoRoot "nested"
  New-Item -ItemType Directory -Path $nestedDirectory | Out-Null
  $unicodeSigningPath = Join-Path $nestedDirectory ($unicodeName + ".KEYSTORE")
  Set-Content -LiteralPath $unicodeSigningPath -Value "nested signing fixture"
  Assert-True ((Get-StatusFingerprint) -eq $beforeExcludedFiles) "APK and keystore files must not affect automatic sync."
  Invoke-AutoSync
  Assert-True ((Get-StatusFingerprint) -eq "") "Source changes must be committed."
  $trackedFiles = Invoke-Git @("ls-files")
  Assert-True (-not ($trackedFiles -match '\.(apk|keystore)$')) "APK and keystore files must not be committed."

  Invoke-Git @("add", "signing.keystore") | Out-Null
  Assert-Throws { Invoke-AutoSync } "APK or signing files are already staged"
  Invoke-Git @("reset", "HEAD", "--", "signing.keystore") | Out-Null
  Invoke-Git @("add", "--", $unicodeSigningPath) | Out-Null
  Assert-Throws { Invoke-AutoSync } "APK or signing files are already staged"
  Invoke-Git @("reset", "HEAD", "--", $unicodeSigningPath) | Out-Null

  $missingRemotePath = Join-Path $testRoot "offline-origin.git"
  Invoke-Git @("remote", "set-url", "--push", "origin", $missingRemotePath) | Out-Null
  Set-Content -LiteralPath $trackedPath -Value "saved while offline"
  Assert-Throws { Invoke-AutoSync } "Local commits are retained for retry"
  $offlineCommit = (Invoke-Git @("rev-parse", "HEAD")) -join ""
  Assert-True ((Get-StatusFingerprint) -eq "") "Failed push must preserve a committed clean worktree."
  Assert-True (Test-PendingPush "main") "A failed push must remain pending even without staged files."
  Invoke-Git @("remote", "set-url", "--push", "origin", $remotePath) | Out-Null
  Invoke-AutoSync
  Assert-True (-not (Test-PendingPush "main")) "A later clean-tree cycle must retry the pending push."
  Assert-True (((Invoke-Git @("rev-parse", "HEAD")) -join "") -eq $offlineCommit) "Retry must push the existing commit without another commit."

  Invoke-Git @("clone", $remotePath, $peerPath) | Out-Null
  Invoke-Git @("-C", $peerPath, "config", "user.name", "Remote Test") | Out-Null
  Invoke-Git @("-C", $peerPath, "config", "user.email", "remote-test@example.invalid") | Out-Null
  Invoke-Git @("-C", $peerPath, "config", "commit.gpgsign", "false") | Out-Null
  Set-Content -LiteralPath (Join-Path $peerPath "remote.txt") -Value "remote change"
  Invoke-Git @("-C", $peerPath, "add", ".") | Out-Null
  Invoke-Git @("-C", $peerPath, "commit", "-m", "Remote change") | Out-Null
  Invoke-Git @("-C", $peerPath, "push") | Out-Null
  Set-Content -LiteralPath $trackedPath -Value "local divergent change"
  Assert-Throws { Invoke-AutoSync } "if origin advanced, integrate its changes manually"
  $divergentCommit = (Invoke-Git @("rev-parse", "HEAD")) -join ""
  Invoke-Git @("fetch", "origin") | Out-Null
  Set-Content -LiteralPath $trackedPath -Value "live editor unsaved-to-git change"
  Assert-Throws { Invoke-AutoSync } "Origin has changes missing"
  Assert-True (((Invoke-Git @("rev-parse", "HEAD")) -join "") -eq $divergentCommit) "Known divergence must not create a commit or rebase."
  Assert-True ((Get-Content -LiteralPath $trackedPath -Raw).Trim() -eq "live editor unsaved-to-git change") "Divergence must leave live editor changes untouched."
  Assert-True (-not (Test-Path -LiteralPath (Join-Path $RepoRoot ".git/rebase-merge"))) "Automatic sync must never start a rebase."

  $unicodeScriptPath = Join-Path $testRoot (($unicodeName + "'s") + "/auto-github-sync.ps1")
  $launcher = New-AutoSyncLauncher -PowerShellPath "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -ScriptPath $unicodeScriptPath
  Assert-True ($launcher -match '-EncodedCommand ([A-Za-z0-9+/=]+)') "Launcher must use an encoded command."
  $decodedCommand = [Text.Encoding]::Unicode.GetString([Convert]::FromBase64String($Matches[1]))
  Assert-True ($decodedCommand.Contains($unicodeScriptPath.Replace("'", "''"))) "Launcher must preserve Unicode and escaped apostrophes."
  Assert-True ($launcher.Contains('", 0, False')) "Startup launcher must run PowerShell hidden."
  $launcherPath = Join-Path $testRoot "launcher.vbs"
  Set-Content -LiteralPath $launcherPath -Value $launcher -Encoding Unicode
  Assert-True ((Get-Content -LiteralPath $launcherPath -Raw -Encoding Unicode).Contains($launcher.Trim())) "Launcher must survive a UTF-16 file round trip."

  Write-Host "Auto sync regression checks passed: content quiet period, exclusions, offline retry, divergence, Unicode hidden launcher."
} finally {
  Pop-Location
  $resolvedTestRoot = [IO.Path]::GetFullPath($testRoot)
  $tempDirectory = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  if (-not $resolvedTestRoot.StartsWith($tempDirectory, [StringComparison]::OrdinalIgnoreCase) -or
      (Split-Path -Leaf $resolvedTestRoot) -notmatch '^shagritm-sync-tests-[a-f0-9]{32}$') {
    throw "Refusing to remove an unexpected regression test directory."
  }
  Remove-Item -LiteralPath $resolvedTestRoot -Recurse -Force
}
