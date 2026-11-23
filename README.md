# Mobile Cookie Clicker — Android & iOS builders

This repository keeps both **experimental, unofficial mobile port builders** on one branch: [`mobile-ports`](https://github.com/Unborne-Fetus/Mobile-Cookie-Clicker/tree/mobile-ports).

| Platform | Source folder | Released download | Build requirements |
|---|---|---|---|
| Android | `android/` | `Cookie-Clicker-Android-Builder.zip` | Windows, Java and Android SDK tools (setup via `START-HERE.bat`) |
| iPhone/iPad | `ios/` | `Cookie-Clicker-iOS-IPA-Builder.zip` | Windows can prepare files; macOS with Xcode is required to build an IPA |

**Download from [Releases](https://github.com/Unborne-Fetus/Mobile-Cookie-Clicker/releases)** once a release is published.

## Important scope

These are **source/builder packages, not finished offline APK/IPA installers**. They intentionally do not contain Cookie Clicker's proprietary game files or third-party Steam mod installations. Import game files from a legitimate personal installation on your own machine for private testing. Do not publicly distribute a game-containing APK/IPA without permission from the rights holders.

The Android builder can create an APK locally; the iOS builder can prepare on Windows and build/sign using Xcode on a Mac. The iOS source package is not itself a signed or installable IPA.

## Source arrangement

- `android/`: Android WebView port, asset import, Wooden Panel Resizer v1.7, Steam mod snapshot support, touch tweaks and Herald compatibility.
- `ios/`: WKWebView/SwiftUI shell, iOS asset import and mod snapshot, Wooden Panel Resizer v1.7, save import/export, touch tweaks and Herald compatibility.
- `.github/workflows/release-mobile.yml`: Publishes two distinct source ZIP assets, one for each platform, to **one GitHub Release**.

Platform-specific installation and build steps are in `android/README.md` and `ios/README.md`.

## Build locally

**Android:** Extract the Android builder ZIP, run `START-HERE.bat` on Windows, and follow the included README. The assembled private APK is at `app/build/outputs/apk/debug/app-debug.apk` after a successful local build.

**iOS:** Extract the iOS builder ZIP, run `PREPARE-ON-WINDOWS.bat` to prepare a **private** local snapshot, then transfer it to your Mac and run `bash BUILD-IPA.command` with Xcode installed. An unsigned IPA cannot be installed on ordinary devices without signing.

## Release workflow

The workflow packages the two directories separately and publishes GitHub Release `v0.1.0`. It refuses to package an imported game. It does not publish user-created private game snapshots, copyrighted assets, or an unsigned IPA as an installable binary.
