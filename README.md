# Mobile Cookie Clicker

Unofficial, experimental **Android and iOS source builders for Cookie Clicker**. Both platforms live together in this repository and share the same compatibility goals, but retain independent app projects and build processes.

> **Downloads:** [Latest release](https://github.com/Unborne-Fetus/Mobile-Cookie-Clicker/releases/latest) · [Android builder ZIP](https://github.com/Unborne-Fetus/Mobile-Cookie-Clicker/releases/download/v0.1.0/Cookie-Clicker-Android-Builder.zip) · [iOS builder ZIP](https://github.com/Unborne-Fetus/Mobile-Cookie-Clicker/releases/download/v0.1.0/Cookie-Clicker-iOS-IPA-Builder.zip)
>
> **These downloads are source projects, not ready-to-install APK or IPA files.** Game assets, the original game code, and third-party Steam mod installations are **not distributed** in this repository. Offline builds require importing files from your own installation for private testing.

## Choose your platform

| | Android | iPhone / iPad |
| --- | --- | --- |
| Source code | [`android/`](android/) | [`ios/`](ios/) |
| Technology | Java + Android WebView | SwiftUI/UIKit + WKWebView |
| Setup | Windows `START-HERE.bat` | Windows `PREPARE-ON-WINDOWS.bat` or macOS preparation |
| Build system | Android SDK + Gradle; Android Studio optional | **macOS + Xcode required** |
| Local output | `android/app/build/outputs/apk/debug/app-debug.apk` | `ios/output/cookie-clicker-ios-UNSIGNED.ipa` (unless signed separately) |
| Documentation | [Android guide](android/README.md) | [iOS guide](ios/README.md) |
| Prebuilt, publicly redistributable game included? | **No** | **No** |

Both source projects are tracked in **`main`**. There are no Android-only or iOS-only development branches to switch between.

## Quick start: Android

1. Download **`Cookie-Clicker-Android-Builder.zip`** from [Releases](https://github.com/Unborne-Fetus/Mobile-Cookie-Clicker/releases) and extract it on Windows; or clone this repository and open `android/`.
2. Install **Python** and have access to your own Steam installation of Cookie Clicker. The setup script can help obtain Java / Android command-line build tools as needed. Android Studio is optional.
3. Double-click **`START-HERE.bat`** within `android/`. If the game is in a nondefault Steam library, provide its folder when prompted.
4. The script imports your local game files (when needed), adds the included Wooden Panel Resizer, snapshots local/Workshop mods found in your Steam installation, and runs the APK builder.
5. After a successful build, find your **debug APK** at `android/app/build/outputs/apk/debug/app-debug.apk`. Back up your save before testing or replacing an older version.

You can also build the experimental **online-mode WebView shell** without importing game assets. Online mode loads the official Cookie Clicker website and needs an internet connection; it is **not** an offline desktop port. For prerequisites, failure recovery, and a detailed feature test list, see the [Android README](android/README.md).

## Quick start: iOS

1. Download **`Cookie-Clicker-iOS-IPA-Builder.zip`** from [Releases](https://github.com/Unborne-Fetus/Mobile-Cookie-Clicker/releases) and extract it separately; or clone the repository and open `ios/`.
2. On Windows, run **`PREPARE-ON-WINDOWS.bat`**, supplying the location of your Steam Cookie Clicker installation when requested. This prepares game resources, bundles the Wooden Panel Resizer and other installed mods, and produces `cookie-clicker-ios-prepared-PRIVATE.zip`.
3. Transfer that **private prepared archive** to your own Mac and extract it. From the project directory on the Mac run:
   
   ```bash
   bash BUILD-IPA.command
   ```
4. With Xcode installed, the script attempts an **unsigned** IPA at `ios/output/cookie-clicker-ios-UNSIGNED.ipa`. This file **cannot be installed on an ordinary iPhone until it is properly signed**.
5. For personal device testing, set up signing in Xcode and use **Product → Run**, or provide a valid `APPLE_TEAM_ID` to the build script and follow Xcode's provisioning/export flow.

If you already have the Steam installation on macOS, the [iOS README](ios/README.md) explains how to prepare it directly. **Windows alone cannot build or sign an iOS app with this project.** Do not upload the `*-prepared-PRIVATE.zip`: it contains your imported game and mod files.

## Features and compatibility work

| Feature | Android | iOS |
| --- | --- | --- |
| Desktop game asset import for private offline testing | Included | Included |
| Locally captured Steam mod snapshot (local and Workshop mods) | Included | Included |
| Built-in **Wooden Panel Resizer v1.7** source, without installing the mod separately | Included | Included |
| Touch/tap-highlight compatibility | Included | Included |
| Native save import/export | Included | Included |
| Resize controls for **Cookie-dunker** and **Stifling the press** | Included | Included |
| Steam concurrent-player-based Herald count compatibility | Included | Included |
| Physical-device validation and full desktop feature parity | **Not confirmed** | **Not confirmed** |

**Heralds:** the private local-game compatibility code requests Steam's publicly available concurrent-player count for Cookie Clicker (app `1454400`), derives the count from those players, and caches the last confirmed value if a refresh fails. This is **not** a count of mobile players. The regular Heralds upgrade is still required for its in-game effect.

**Mods:** the snapshot contains mods installed on your PC at build time; rebuilding is required to pick up changes. Some third-party mods depend on Steamworks, Electron, Node.js or desktop-specific APIs and therefore may not work on mobile. The built-in Wooden Panel Resizer is also maintained as a separate PC-compatible mod.

**Status:** these builders are experimental. The source and compatibility scripts have been checked, but a successful compilation does not mean the original Steam game, audio, saves, minigames, or every mod has been verified on physical Android/iOS hardware.

## Repository layout

```text
Mobile-Cookie-Clicker/
├── android/                       # Android app, asset importer, private APK builder
│   ├── START-HERE.bat
│   ├── build-apk.bat
│   ├── app/
│   ├── bundled_mods/
│   └── tools/
├── ios/                           # iOS Xcode project and private IPA builder
│   ├── PREPARE-ON-WINDOWS.bat
│   ├── BUILD-IPA.command
│   ├── CookiePortIOS.xcodeproj/
│   ├── CookiePortIOS/
│   ├── bundled_mods/
│   └── tools/
└── .github/workflows/
    └── release-mobile.yml        # Separate ZIPs, one GitHub Release
```

### Releasing

The [release workflow](.github/workflows/release-mobile.yml) packages `android/` into **`Cookie-Clicker-Android-Builder.zip`** and `ios/` into **`Cookie-Clicker-iOS-IPA-Builder.zip`**, with both attached to the **same** versioned GitHub Release. It does not package locally imported game assets. To create a new release, run the workflow from **Actions → Publish Android and iOS builder packages → Run workflow** on `main` with a **new** version tag (for example `v0.1.1`). The existing `v0.1.0` release remains available.

Do **not** run the workflow to publish a local game-containing APK or IPA. These releases are for source/builder distribution only.

## Known limitations and safety notes

- **Save first:** export and back up your saves before testing, updating, or reinstalling either experimental app.
- **No guaranteed parity:** browser APIs, desktop Steam APIs, minigames, input handling, audio and mod compatibility still need device-level verification.
- **No Apple signing included:** an unsigned iOS IPA cannot be directly installed. You need legitimate Xcode signing/provisioning for your device.
- **No Steam Cloud or Workshop client parity:** installed Steam mods are copied only during private preparation; desktop online integrations are not implemented.
- **Do not publish imported assets:** files from your Steam game installation and third-party mods may be copyrighted. Use these tools only as permitted by the applicable licenses and rights holders.

## Credits and disclaimer

Cookie Clicker is created by **Orteil**; its game assets and trademarks belong to their respective rights holders. This community experiment is **unofficial** and is not affiliated with or endorsed by Orteil, DashNet, Playsaurus, Steam/Valve, Google or Apple. The repository provides original wrapper/build utilities and compatibility code; it does **not** grant permission to redistribute Cookie Clicker's game files or a finished game-containing app.
