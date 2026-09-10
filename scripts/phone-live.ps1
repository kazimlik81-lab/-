param(
  [int]$MetroPort = 8081
)

$ErrorActionPreference = "Stop"

function Resolve-AdbPath {
  $adbCommand = Get-Command adb -ErrorAction SilentlyContinue

  if ($adbCommand) {
    return $adbCommand.Source
  }

  $candidatePaths = @()

  if ($env:LOCALAPPDATA) {
    $candidatePaths += Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
  }

  if ($env:ANDROID_HOME) {
    $candidatePaths += Join-Path $env:ANDROID_HOME "platform-tools\adb.exe"
  }

  if ($env:ANDROID_SDK_ROOT) {
    $candidatePaths += Join-Path $env:ANDROID_SDK_ROOT "platform-tools\adb.exe"
  }

  foreach ($candidatePath in $candidatePaths) {
    if ($candidatePath -and (Test-Path $candidatePath)) {
      return $candidatePath
    }
  }

  throw "adb was not found. Install Android SDK Platform Tools or add adb.exe to PATH."
}

function Get-ConnectedAndroidDeviceSerials {
  param([string]$AdbPath)

  $deviceSerials = @()
  $deviceRows = & $AdbPath devices

  foreach ($deviceRow in $deviceRows) {
    if ($deviceRow -match "^(\S+)\s+device$") {
      $deviceSerials += $Matches[1]
    }
  }

  if ($deviceSerials.Count -eq 0) {
    throw "No Android phones are connected. Enable USB debugging, connect phones by USB, and approve the RSA prompt on every phone."
  }

  return $deviceSerials
}

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$adbPath = Resolve-AdbPath
$deviceSerials = Get-ConnectedAndroidDeviceSerials -AdbPath $adbPath

foreach ($deviceSerial in $deviceSerials) {
  & $adbPath -s $deviceSerial reverse "tcp:$MetroPort" "tcp:$MetroPort"
}

Start-Job -ScriptBlock {
  param([string]$JobAdbPath, [string[]]$JobDeviceSerials)

  Start-Sleep -Seconds 5
  foreach ($deviceSerial in $JobDeviceSerials) {
    & $JobAdbPath -s $deviceSerial shell monkey -p com.personal.pedometer -c android.intent.category.LAUNCHER 1 | Out-Null
  }
} -ArgumentList $adbPath, $deviceSerials | Out-Null

Set-Location $projectRoot
npx expo start --host localhost --port $MetroPort
