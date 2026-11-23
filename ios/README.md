# Cookie Clicker iOS — separate IPA builder (experimental)

This source-only ZIP is a **separate iPhone/iPad project**. It does **not** alter or replace the working Android APK builder. The project carries over the same compatibility approach from Android **v0.3**, including the bundled **Wooden Panel Resizer v1.7**.

**This is NOT a prebuilt IPA.** Building an iPhone app requires macOS with Xcode. This package does not include Cookie Clicker's copyrighted game files, artwork, music, or your installed third-party Steam mods. It copies those files **locally from your own Steam installation** for private testing. Do not share a finished game-containing IPA or the Windows-generated `*-prepared-PRIVATE.zip` without the relevant rights holders' permission.

## Step 1 — Prepare on your Windows PC

1. Extract this ZIP to a new folder. Do not merge it into your Android project.
2. Double-click **`PREPARE-ON-WINDOWS.bat`**.
3. The script uses the usual Steam folder `C:\Program Files (x86)\Steam\steamapps\common\Cookie Clicker`, or asks for your actual folder.
4. It copies `resources/app/src` into this project's **private** `Website/game` directory, strips the Electron bootstrap references from the **copied** `index.html`, and snapshots your installed Steam mods from `resources/app/mods/local` and `mods/workshop`.
5. It also includes the built-in **Wooden Panel Resizer v1.7**. An older installed Steam copy with the same ID is skipped, preventing duplicate loading.
6. When done, the script produces **`cookie-clicker-ios-prepared-PRIVATE.zip`** alongside the project folder.

> That PRIVATE ZIP contains copyrighted game and mod files. It is for transfer to **your own Mac** only; do not publish it. The original download you received from ChatGPT is source-only and does not include them.

If you have Steam Cookie Clicker on a Mac instead, skip Windows preparation. In Terminal in the extracted project folder run:

```bash
python3 tools/prepare_game.py "/path/to/Cookie Clicker"
python3 tools/sync_steam_mods.py "/path/to/Cookie Clicker"
```

## Step 2 — Build on a Mac

1. Install Apple **Xcode** and select its command-line tools (`xcode-select -s /Applications/Xcode.app/Contents/Developer` if required).
2. Transfer and extract `cookie-clicker-ios-prepared-PRIVATE.zip` to the Mac. Open Terminal in its `cookie-clicker-ios-ipa-builder` folder.
3. Run:

```bash
bash BUILD-IPA.command
```

By default this creates **`output/cookie-clicker-ios-UNSIGNED.ipa`** if Xcode succeeds. This IPA **cannot be installed on a normal iPhone unless signed**. It is meant for use with legitimate Apple provisioning/signing workflows.

For an Apple team with working development provisioning, optionally run:

```bash
APPLE_TEAM_ID=YOUR_TEAM_ID bash BUILD-IPA.command
```

The script will attempt a signed Xcode archive and export. Xcode will need valid provisioning for the device and may prompt for Apple account access. Signing and distribution requirements depend on your Apple account; automatic export is not guaranteed. Alternatively, open `CookiePortIOS.xcodeproj` in Xcode, choose your device and Apple team under **Signing & Capabilities**, then run **Product → Run** directly on your own device. For an installable IPA, use Xcode's **Archive → Distribute App** workflow with a suitable signing profile.

**Windows alone cannot compile an iOS IPA using this builder.** The Windows step prepares all of the content so you do not have to install Steam again on the Mac.

## Included features (same goals as the Android APK)

- Offline Steam **desktop game code**, rather than a browser shortcut, copied from your installation.
- Steam mod snapshot (local/workshop), standard `info.txt`/`main.js`/`Game.registerMod()` support; mods are managed inside **Options → Mods** with iOS-specific enabled/order preferences. Electron-, Node-, or Steamworks-specific mods may not function.
- **Wooden Panel Resizer v1.7 pre-bundled**, without requiring a separate Steam installation; wooden dividers, wider Store card/third-party control-bar support, and the original achievement-triggered resizing for **Cookie-dunker** and **Stifling the press**.
- Touch-friendly selection/tap highlight fix while leaving text fields selectable.
- Save persistence in `WKWebView`'s default website data store, with a native **Export save / Import save** menu using Apple's file picker/share sheet; save export is recommended before updating the app.
- Native **Steam concurrent-player Heralds**, using Steam App ID `1454400` and `ISteamUserStats/GetNumberOfCurrentPlayers`; first fetch and 5-minute refresh while active; cached last-known value when offline; 100 cap and original CpS calculation. **Heralds heavenly upgrade still required.** Does not fabricate an iOS player count.
- Mod safe mode, reload, viewport zoom, achievement-layout diagnostics, local/online toggle.

## How the iOS port differs from Android

- Uses **WKWebView** instead of Android WebView, and native Apple `URLSession` for Heralds instead of Java networking.
- Uses `cookieport://app/` to serve app-bundled game resources through a `WKURLSchemeHandler`; the Steam/Electron bootstrap is removed from the copied HTML. The mod catalog is bundled as JavaScript to avoid local-file `fetch()` limitations.
- SwiftUI app shell + UIKit controls, native share sheet/document picker; minimum deployment target is **iOS 15.0**.
- Importing a save into the offline game does **not** import the app's mod preferences; those are stored separately.
- The Steam mods are included at **build time**, not downloaded from the Workshop on the iPhone. To update them, prepare/rebuild the IPA.

## Reliability and limitations

The project files, copied mod catalog, HTML transformation, JS syntax, Xcode project/plist syntax, and mock mod snapshot tests can be validated on non-Apple machines. **Actual Xcode compilation, code signing, a live iPhone launch, audio playback, WebKit storage persistence, and compatibility with each installed mod must be tested on a Mac/iPhone.** We cannot honestly claim this is a verified working iOS port yet.

The default IPA is unsigned, so iOS won't accept it until signed appropriately. The built app will also contain the original copyrighted game and mod assets; this source-only ZIP deliberately does not. The project isn't affiliated with Orteil, DashNet, Playsaurus, Steam, or Apple.

## Diagnostics

If the game is blank: confirm `CookiePortIOS/Resources/Website/game/index.html` exists in your **prepared private project**, and that `Website` is included as a folder resource in Xcode. If a mod breaks startup: open the ☰ menu and choose **Disable all mods and restart**. If the export build fails with signing errors: test Xcode's **Product → Run** with your personal device and configure signing there before trying IPA export.
