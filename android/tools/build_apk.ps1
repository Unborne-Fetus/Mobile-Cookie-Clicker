# Standalone Windows builder for the user's own locally imported Cookie Clicker files.
# No Android Studio or existing Gradle installation is required.
# Downloads Google's Android command-line tools and Gradle from their official sites.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$project = Split-Path -Parent $PSScriptRoot
$gameIndex = Join-Path $project 'app\src\main\assets\game\index.html'
$apk = Join-Path $project 'app\build\outputs\apk\debug\app-debug.apk'
$cache = Join-Path $env:LOCALAPPDATA 'CookieClickerAndroidBuildTools'
$androidSdk = Join-Path $cache 'sdk'
$gradleDir = Join-Path $cache 'gradle-8.9'
$gradleBat = Join-Path $gradleDir 'bin\gradle.bat'
$cmdlineTools = Join-Path $androidSdk 'cmdline-tools\latest'
$sdkManager = Join-Path $cmdlineTools 'bin\sdkmanager.bat'

function Say($message) { Write-Host $message -ForegroundColor Cyan }
function EnsureFolder($path) { if (-not (Test-Path $path)) { New-Item -ItemType Directory -Force -Path $path | Out-Null } }
function DownloadFile($url, $destination) {
    Say "Downloading $url"
    Invoke-WebRequest -Uri $url -OutFile $destination -UseBasicParsing
}
function CheckSha256($path, $expected) {
    $actual = (Get-FileHash -Path $path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $expected.ToLowerInvariant()) {
        Remove-Item -Force -ErrorAction SilentlyContinue $path
        throw "SHA-256 verification failed for $path. The download was discarded."
    }
}
function JavaMajor($jdkHome) {
    if (-not $jdkHome) { return 0 }
    $javac = Join-Path $jdkHome 'bin\javac.exe'
    if (-not (Test-Path $javac)) { return 0 }
    $versionText = (& $javac -version 2>&1 | Out-String)
    if ($versionText -match 'javac\s+(\d+)') { return [int]$Matches[1] }
    return 0
}
function FindJava {
    $candidates = New-Object 'System.Collections.Generic.List[string]'
    if ($env:JAVA_HOME) { $candidates.Add($env:JAVA_HOME) }
    $javacCommand = Get-Command javac.exe -ErrorAction SilentlyContinue
    if ($javacCommand) { $candidates.Add((Split-Path -Parent (Split-Path -Parent $javacCommand.Source))) }
    $roots = @(
        (Join-Path $env:ProgramFiles 'Microsoft'),
        (Join-Path $env:ProgramFiles 'Eclipse Adoptium'),
        (Join-Path $env:ProgramFiles 'Java'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Eclipse Adoptium')
    )
    foreach ($root in $roots) {
        if (Test-Path $root) {
            foreach ($entry in (Get-ChildItem -Path $root -Directory -ErrorAction SilentlyContinue)) {
                $candidates.Add($entry.FullName)
            }
        }
    }
    foreach ($candidate in ($candidates | Select-Object -Unique)) {
        $major = JavaMajor $candidate
        if (($major -ge 17) -and ($major -le 23)) { return $candidate }
    }
    return $null
}

try {
    Write-Host ''
    Write-Host 'COOKIE CLICKER - ANDROID APK BUILDER' -ForegroundColor Green
    Write-Host '------------------------------------'
    Write-Host "Project: $project"
    if (-not (Test-Path (Join-Path $project 'app\build.gradle'))) {
        throw 'Run build-apk.bat from the cookie-clicker-android-port project folder.'
    }
    if (-not (Test-Path $gameIndex)) {
        Write-Warning 'Steam game files were not found. This would build online-only mode, not an offline copy.'
        $answer = Read-Host 'Build online-only APK anyway? (y/N)'
        if ($answer -notin @('y','Y','yes','YES')) { throw 'Canceled. Run prepare_game.py first.' }
    } else {
        Say 'Local Cookie Clicker game files detected.'
    }
    EnsureFolder $cache

    Say '[1/4] Finding a compatible Java Development Kit (JDK 17-23)...'
    $javaHome = FindJava
    if (-not $javaHome) {
        Write-Host 'A JDK is required, but no compatible one was found.' -ForegroundColor Yellow
        $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
        if (-not $winget) {
            throw 'Install Microsoft OpenJDK 17 from https://learn.microsoft.com/java/openjdk/download and try again.'
        }
        $answer = Read-Host 'Install free Microsoft OpenJDK 17 using Windows Package Manager now? (y/N)'
        if ($answer -notin @('y','Y','yes','YES')) { throw 'Canceled. Java 17 is required to build the APK.' }
        & winget.exe install --id Microsoft.OpenJDK.17 --exact --source winget --accept-source-agreements --accept-package-agreements
        if ($LASTEXITCODE -ne 0) { throw 'Java installation did not succeed. Install Microsoft OpenJDK 17 manually and try again.' }
        $javaHome = FindJava
        if (-not $javaHome) { throw 'Java was installed but could not be found. Close this window, reopen it, and run build-apk.bat again.' }
    }
    $env:JAVA_HOME = $javaHome
    $env:PATH = (Join-Path $javaHome 'bin') + ';' + $env:PATH
    Say "Using Java: $javaHome"

    Say '[2/4] Setting up official Android SDK command-line tools...'
    $env:ANDROID_HOME = $androidSdk
    $env:ANDROID_SDK_ROOT = $androidSdk
    if (-not (Test-Path $sdkManager)) {
        $zip = Join-Path $cache 'android-commandline-tools.zip'
        $unpack = Join-Path $cache 'android-commandline-tools-unpack'
        if (Test-Path $unpack) { Remove-Item $unpack -Recurse -Force }
        # SHA-256 published on developer.android.com/studio on Nov 22, 2026.
        DownloadFile 'https://dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip' $zip
        CheckSha256 $zip '90ae805d20434428bffcb699c290860f19bb5f66a67e6b330067e3de801fb04a'
        Say 'Extracting Android command-line tools...'
        Expand-Archive -LiteralPath $zip -DestinationPath $unpack -Force
        EnsureFolder (Join-Path $androidSdk 'cmdline-tools')
        Move-Item -LiteralPath (Join-Path $unpack 'cmdline-tools') -Destination $cmdlineTools
        Remove-Item $unpack -Recurse -Force
        Remove-Item $zip -Force
    }
    if (-not (Test-Path (Join-Path $androidSdk 'platforms\android-35\android.jar'))) {
        Write-Host ''
        Write-Host 'Google Android SDK licenses will be shown. Read them and enter y only if you agree.' -ForegroundColor Yellow
        & $sdkManager "--sdk_root=$androidSdk" --licenses
        if ($LASTEXITCODE -ne 0) { throw 'Android SDK license setup failed or was declined.' }
        Say 'Installing SDK platform 35 and build tools 35.0.0...'
        & $sdkManager "--sdk_root=$androidSdk" 'platforms;android-35' 'build-tools;35.0.0' 'platform-tools'
        if ($LASTEXITCODE -ne 0) { throw 'Android SDK component installation failed.' }
    }

    Say '[3/4] Setting up Gradle 8.9...'
    if (-not (Test-Path $gradleBat)) {
        $zip = Join-Path $cache 'gradle-8.9-bin.zip'
        $url = 'https://services.gradle.org/distributions/gradle-8.9-bin.zip'
        # PowerShell 5.1 may return .Content as System.Byte[] for SHA256 text files.
        # Converting to text before Trim avoids the System.Byte.Trim exception.
        if (Test-Path $zip) {
            Say 'Using the previously downloaded Gradle ZIP...'
        } else {
            DownloadFile $url $zip
        }
        $shaResponse = Invoke-WebRequest -Uri "$url.sha256" -UseBasicParsing
        $shaContent = $shaResponse.Content
        if ($shaContent -is [byte[]]) {
            $shaText = [System.Text.Encoding]::UTF8.GetString($shaContent)
        } else {
            $shaText = [string]$shaContent
        }
        $sha = ($shaText.Trim() -split '\s+')[0]
        if ($sha -notmatch '^[A-Fa-f0-9]{64}$') {
            throw 'Could not parse Gradle SHA-256 checksum response.'
        }
        CheckSha256 $zip $sha
        Say 'Extracting Gradle...'
        Expand-Archive -LiteralPath $zip -DestinationPath $cache -Force
        Remove-Item $zip -Force
    }

    Say '[4/4] Building your private debug APK...'
    & $gradleBat --project-dir "$project" ':app:assembleDebug' --no-daemon --console=plain
    if ($LASTEXITCODE -ne 0) { throw 'Gradle reported a build failure. See the error text above.' }
    if (-not (Test-Path $apk)) { throw 'Gradle succeeded, but the expected APK file was not found.' }
    Write-Host ''
    Write-Host 'APK BUILT SUCCESSFULLY' -ForegroundColor Green
    Write-Host "APK: $apk" -ForegroundColor Green
    Write-Host 'This is an experimental private test APK, not a verified complete port.'
    Write-Host 'Do not publicly upload an APK containing Steam game assets without permission.'
    exit 0
} catch {
    Write-Host ''
    Write-Host 'BUILD STOPPED:' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host 'Send the error shown above so we can diagnose it.'
    exit 1
}
