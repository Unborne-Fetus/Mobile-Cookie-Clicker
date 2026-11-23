# Cookie Clicker Android — single ZIP (with no-Studio builder)

**Windows quick start:** Extract the ZIP, open the `cookie-clicker-android-port`
folder, and double-click **`START-HERE.bat`**. It copies your own installed Steam
game files if necessary, then calls `build-apk.bat` to build the private APK using
command-line tools. **Android Studio is not required.** The first run downloads
Java (if approved), Android SDK tools, and Gradle as needed. The output is:

`app/build/outputs/apk/debug/app-debug.apk`

This merged archive does **not** contain Cookie Clicker's game files or a built APK.
If you already imported the game into the older project, either copy the folder
`app/src/main/assets/game` from that project to this one or run `START-HERE.bat`
to import it again. The Android port is experimental and is **not yet validated**
on actual devices.

---

# Cookie Clicker Desktop-to-Android — experimental shell

**Not an official Cookie Clicker release.** This project contains only an original
Android shell and a private asset-import helper, **not** Cookie Clicker code or art.
The game's copyright and trademarks belong to Orteil/DashNet and the relevant
rights holders. You need permission to redistribute an APK with their files.

## Current state (v0.1 alpha)

- Android WebView host with persistent DOM storage (Java Android app)
- Runs **the official live browser version** without repackaging game assets
- Optional **local file mode** to test your own Steam `resources/app/src` files
- Native save export/import (Cookie Clicker save string)
- Pinch zoom, zoom menu, fullscreen, portrait/landscape rotation support
- Local vs web origin saves kept separate

**Not yet a finished desktop port:** Steam integration is not replaced, local
Steam files have not been verified on a physical Android device, and the original
fixed-width desktop UI needs phone-oriented touch layout work. Don't call this
100% functional until tested. Steam cloud, achievements, Workshop, C418 soundtrack
licensing, app signing, and automatic updates are not implemented.

## Build a private offline test

1. **Recommended:** Run `START-HERE.bat` without Android Studio. Alternatively install Android Studio (JDK 17 or newer; Android SDK 35), and open this folder.
2. In Steam, right-click Cookie Clicker → Manage → Browse local files.
3. Run this on the PC with the game installed:

   `python tools/prepare_game.py "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Cookie Clicker"`

   Change the location if your Steam library is elsewhere. Alternatively pass
   the exact folder `.../resources/app/src`.
4. In Android Studio, **Build → Build APK(s)**. The APK will be under
   `app/build/outputs/apk/debug/`.
5. Optionally run `python tools/verify_local_assets.py` for a static check.
6. Install the debug APK on your own device for private testing. It defaults
   to local mode if `index.html` was included, otherwise uses the live official
   browser version at https://orteil.dashnet.org/cookieclicker/.

If you don't import game files, the APK **still launches**, but requires
internet to play the official web edition; it is not an offline port.

## Test checklist

- [ ] Launch local Steam index.html without blank screen or Electron errors
- [ ] Verify cookies count, building purchases, upgrades
- [ ] Verify Garden, Pantheon, Grimoire, Stock Market
- [ ] Verify sugar lumps, seasonal content, Grandmapocalypse, ascension
- [ ] Test mouse/touch behavior, drag gestures, scroll, keyboard dialogs
- [ ] Test background/resume and offline income after several hours
- [ ] Test native import/export with a backup, including version mismatch
- [ ] Test low-RAM devices, portrait and landscape layouts
- [ ] Test update/re-install without loss of save (backup first)

## Legal and source distinction

Being able to see or modify the original game's JavaScript doesn't make it
open-source. Some browser builds explicitly ask people not to re-host or profit
from the code. This repository provides no game assets or modified copies.
Distribution of an APK embedding the game requires appropriate permission.

## Engineering plan

1. **Compatibility audit:** test Steam `index.html` and desktop JS in Android
   WebView and identify Electron/Steam API assumptions.
2. **Touch layout:** responsive sections, accessible tooltips and minigames.
3. **Persistence:** native automatic backups, migration, corruption recovery.
4. **Parity:** verify every desktop mechanic and provide feature-level tests.
5. **Release:** only after distribution rights are confirmed.

## Cloud APK build (without copyrighted files)

The included GitHub Actions workflow builds a **debug APK in online mode** on
manual dispatch or push. It explicitly stops if the game files have been checked
in. This means you can compile the experimental Android shell in the cloud, but
cloud builds are **not** full offline copies. For private offline tests, build
locally after running `prepare_game.py`.

Android Studio may ask you to install Gradle 8.9 because this source ZIP does
not include a Gradle wrapper binary.


## Gradle download fix (Nov 22, 2026)

This version fixes an error in Windows PowerShell when reading Gradle's `.sha256` file:
`Method invocation failed because [System.Byte] does not contain a method named 'Trim'.`

If upgrading an already-extracted project, extract this ZIP into the **parent folder**
containing `cookie-clicker-android-port` and choose **Replace files**.
Do **not** delete the old project folder: your privately copied Steam assets are
stored there and are intentionally not bundled in this ZIP.

Then double-click `cookie-clicker-android-port/START-HERE.bat` again.
Previously installed Android tools and accepted licenses should be reused.


## Android window-size achievement controls (revision 2)

This revision adds **three entries** to the native ☰ port menu: toggle narrow viewport
(for **Stifling the press**), toggle short left cookie panel (for **Cookie-dunker**),
and check current layout/achievement status. A fourth entry restores the normal
layout. These controls temporarily change the layout and let the **original game
achievement logic** fire; they do **not** call Game.Win() or modify save data.

**How to test:** export a save first. Open ☰, enable the narrow layout, inspect
the layout diagnostics (game width must read below 900), then tap the **news
ticker**. Restore the layout. For Cookie-dunker, earn at least three regular
achievements, enable the short cookie panel, and allow a second for the milk/cookie
overlap to be detected by the original code. Then restore the layout.

The injected helper is our own app source at
`app/src/main/assets/window-achievement-layout.js`, not a copied game file.
Your Steam game files are still **not included** in this ZIP: run START-HERE.bat
from the extracted project to copy them and build a PRIVATE APK.

These changes are source-inspected but **not yet phone-tested**. If the viewport
meta change is ignored by a specific Android WebView version, use the new
diagnostics screen to capture the actual width for further troubleshooting.

## Steam mod snapshot build (new)

This revision **removes the previous standalone Android mod importer/manager**.
Double-click `START-HERE.bat`: on **every build** the script looks in your
personal Steam Cookie Clicker installation under `resources/app/mods/local` and
`resources/app/mods/workshop`, then bundles the installed mods into the private
APK. Workshop ZIPs are recognized. The console prints the number packaged.

Inside the game, find **Options → Mods → Manage mods**. This uses the game's
existing in-game Options section and standard `Game.registerMod()` loading/save
hooks. It is not the literal Electron mod manager, which requires native desktop
APIs unavailable to Android WebView. Android has its own settings for enabling
and ordering bundled mods. The initial state uses each mod's `info.txt` `Disabled`
default; Steam's *current* toggles may be stored outside those files and are **not
synced**. To get PC changes onto Android, rebuild the APK.

The source-only ZIP includes no mod/game files. A generated APK **does** contain
those copyrighted files and should not be distributed without the rights holders'
permission. Some Steam mods depend on Node/Electron or Workshop APIs and may not
run in WebView. See `STEAM-MODS-README.txt` for all limitations and recovery steps.

### Android touch compatibility (included in builder)

This APK builder injects `android-touch-compat.css` to prevent accidental blue
text-selection and tap highlights on touch devices. Text inputs and save
import/export remain selectable. **This is the only touch UI fix included in
the builder.**

### Bundled wooden panel resizer (v1.7)

The builder now **includes the standalone Wooden Panel Resizer source** under
`bundled_mods/CookiePortAndroidWoodenResizer/`. You do **not** have to install
it into Steam first. Every run of `build-apk.bat` bundles this version first,
then snapshots other installed local/Workshop mods. If Steam has an older
resizer with the same mod ID, the builder skips that duplicate. Android uses
its own saved enable/disable choice in Options → Mods; the bundled mod is
enabled by default on a fresh installation.

The mod is **also distributed separately for PC**, and still works on Windows
and Android. The APK builder and standalone PC mod can be maintained separately.

On wide Stores, vanilla 300×64 product cards wrap into columns. The mod attempts
to place small black control bars from other mods into the same centered row
as the vanilla Buy/Sell controls without changing those mods' event handlers.
Mod UI with unusual DOM assumptions may still require targeted adapters.
The narrow Store remains vanilla; the cookie-panel's earlier black-gap fix
and both achievement-resizing interactions remain available.

### Steam concurrent-player Heralds on Android

The Android **local Steam-game mode** now fetches the real Cookie Clicker
Steam concurrent-player count (Steam App ID `1454400`) from the official
`ISteamUserStats/GetNumberOfCurrentPlayers` endpoint using native Android HTTPS.
This avoids browser CORS and does not need a Steam API key or an untrusted proxy.
On first load and every 5 minutes while the app is active, the resulting count
is passed to the game's original `Game.heralds` logic. UI displays
`min(100, floor(players / 100))`; original Steam gain math keeps fractional
`players / 100` (capped at 100). The Heralds heavenly upgrade is still required
for the CpS multiplier. Nothing is granted automatically.

If Steam or your network is unavailable, the app reuses the last **confirmed**
player count; it does not invent 100 Heralds or force 0. The ☰ menu now includes
**Herald status (live Steam players)** with last confirmed count and freshness.
The official browser mode is not modified by this compatibility shim. It does
not count Android app users, since there is no reliable global counter for them.

### Validations and limitations

Tests cover vanilla-width/wide Store layouts, dynamically injected third-party
bars, original event listeners, DOM rebuilds, restore, bundling priority,
mod ZIP safety, and cached/live Herald data behavior. Android Java source was
syntax-checked, but the full build still requires your Windows Android SDK and
on-device testing. No copyrighted Cookie Clicker files are inside this ZIP;
your locally built APK includes your personally copied game and mods.
