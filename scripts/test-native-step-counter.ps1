param([string]$GradleHome, [string]$AndroidSdkRoot)

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$wrapperPropertiesPath = Join-Path $projectRoot "android/gradle/wrapper/gradle-wrapper.properties"

if (-not $GradleHome) {
  $wrapperProperties = Get-Content -LiteralPath $wrapperPropertiesPath -Raw
  if ($wrapperProperties -notmatch 'gradle-([\d.]+)-(bin|all)\.zip') {
    throw "Cannot read the Gradle distribution version from $wrapperPropertiesPath."
  }
  $gradleVersion = $Matches[1]
  $gradleDistributionType = $Matches[2]
  $gradleCacheRoot = if ($env:GRADLE_USER_HOME) { $env:GRADLE_USER_HOME } else { Join-Path $env:USERPROFILE ".gradle" }
  $distributionDirectory = Join-Path $gradleCacheRoot "wrapper/dists/gradle-$gradleVersion-$gradleDistributionType"
  if (Test-Path -LiteralPath $distributionDirectory) {
    foreach ($cacheDirectory in Get-ChildItem -LiteralPath $distributionDirectory -Directory) {
      $candidateDirectory = Join-Path $cacheDirectory.FullName "gradle-$gradleVersion"
      if (Test-Path -LiteralPath (Join-Path $candidateDirectory "lib")) {
        $GradleHome = $candidateDirectory
        break
      }
    }
  }
  if (-not $GradleHome) {
    throw "Gradle $gradleVersion is not cached. Run android/gradlew.bat --version first or pass -GradleHome."
  }
}

$gradleLibraryDirectory = Join-Path (Resolve-Path -LiteralPath $GradleHome).Path "lib"
$standardLibrary = Get-ChildItem -LiteralPath $gradleLibraryDirectory -File | Where-Object { $_.Name -match '^kotlin-stdlib-[\d.]+\.jar$' } | Select-Object -First 1
if (-not $standardLibrary) {
  throw "The Gradle distribution has no Kotlin standard library: $gradleLibraryDirectory."
}
$javaExecutable = if ($env:JAVA_HOME) { Join-Path $env:JAVA_HOME "bin/java.exe" } else { (Get-Command java -ErrorAction Stop).Source }
if (-not $AndroidSdkRoot) {
  $sdkCandidates = @(
    $env:ANDROID_HOME,
    $env:ANDROID_SDK_ROOT,
    (Join-Path $projectRoot ".local-build/android-sdk"),
    (Join-Path $env:LOCALAPPDATA "Android/Sdk")
  )
  foreach ($sdkCandidate in $sdkCandidates) {
    if ($sdkCandidate -and (Test-Path -LiteralPath (Join-Path $sdkCandidate "platforms"))) {
      $AndroidSdkRoot = $sdkCandidate
      break
    }
  }
}
if (-not $AndroidSdkRoot) {
  throw "Android SDK platforms were not found. Set ANDROID_HOME or pass -AndroidSdkRoot."
}
$platformDirectories = Get-ChildItem -LiteralPath (Join-Path $AndroidSdkRoot "platforms") -Directory |
  Where-Object { $_.Name -match '^android-\d+$' } |
  Sort-Object { [int]$_.Name.Substring("android-".Length) } -Descending
$androidJar = $null
foreach ($platformDirectory in $platformDirectories) {
  $candidateJar = Join-Path $platformDirectory.FullName "android.jar"
  if (Test-Path -LiteralPath $candidateJar) {
    $androidJar = $candidateJar
    break
  }
}
if (-not $androidJar) { throw "No installed Android platform contains android.jar in $AndroidSdkRoot." }
$appClassesDirectory = Join-Path $projectRoot "android/app/build/tmp/kotlin-classes/debug"
if (-not (Test-Path -LiteralPath (Join-Path $appClassesDirectory "com/personal/pedometer/AndroidStepCounterService.class"))) {
  throw "Compiled native service constants are missing. Run android/gradlew.bat :app:compileDebugKotlin first."
}
$outputDirectory = Join-Path $projectRoot ".local-build/native-step-counter-tests"
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$testJar = Join-Path $outputDirectory "step-counter-tests.jar"
$sourceFiles = @(
  (Join-Path $projectRoot "android/app/src/main/java/com/personal/pedometer/contracts/StepCounterState.kt"),
  (Join-Path $projectRoot "android/app/src/main/java/com/personal/pedometer/StepCounterCalculation.kt"),
  (Join-Path $projectRoot "android/app/src/main/java/com/personal/pedometer/AndroidStepHistoryStore.kt"),
  (Join-Path $projectRoot "tests/native/StepCounterCalculationTest.kt"),
  (Join-Path $projectRoot "tests/native/AndroidStepHistoryStoreTest.kt")
)
$javaEncodingOptions = @("-Dfile.encoding=UTF-8", "-Dsun.jnu.encoding=UTF-8")
$dependencyClassPath = @($standardLibrary.FullName, $androidJar, $appClassesDirectory) -join [IO.Path]::PathSeparator
& $javaExecutable @javaEncodingOptions -cp (Join-Path $gradleLibraryDirectory "*") org.jetbrains.kotlin.cli.jvm.K2JVMCompiler -no-stdlib -no-reflect -classpath $dependencyClassPath -jvm-target 17 -d $testJar @sourceFiles
if ($LASTEXITCODE -ne 0) { throw "Native regression test compilation failed (exit $LASTEXITCODE)." }
$runtimeClassPath = "$testJar$([IO.Path]::PathSeparator)$dependencyClassPath"
& $javaExecutable @javaEncodingOptions -cp $runtimeClassPath com.personal.pedometer.StepCounterCalculationTestKt
if ($LASTEXITCODE -ne 0) { throw "Native step-counter regression tests failed (exit $LASTEXITCODE)." }
& $javaExecutable @javaEncodingOptions -cp $runtimeClassPath com.personal.pedometer.AndroidStepHistoryStoreTest
if ($LASTEXITCODE -ne 0) { throw "Native step-history regression tests failed (exit $LASTEXITCODE)." }
