COOKIE CLICKER ANDROID - STEAM MOD SNAPSHOT (EXPERIMENTAL)
=========================================================

WHAT CHANGED
- Removed the previous Android ZIP/JS mod importer and its separate mod manager.
- On every Windows APK build, copy mods installed in the local Steam game:
    Cookie Clicker\resources\app\mods\local
    Cookie Clicker\resources\app\mods\workshop
  Some Workshop mods are stored in ZIP files; the builder supports these.
- Package copies into APK assets and load enabled JavaScript mods BEFORE Game.Init.
- Show mod controls within Cookie Clicker's in-game Options -> Mods area.
- Use the game's existing Game.registerMod(), Game.launchMods(), and save hooks.
- Enable/disable/order choices made on Android are stored on the Android device.
- Keep safe mode in the Android ☰ recovery menu.

HOW TO BUILD
1. Extract this ZIP into a fresh folder, or merge into the PARENT folder of
   your existing cookie-clicker-android-port project; replace files.
2. Double-click START-HERE.bat.
3. The log prints PACKAGED N mod(s) (builder-included + Steam). Confirm this is the count you expect.
4. Build output: app\build\outputs\apk\debug\app-debug.apk
5. Install the APK OVER your existing app; don't uninstall it (keep saves).
6. Inside Cookie Clicker, open Options, scroll to Mods, tap Manage mods.

BUILT-IN RESIZER SOURCE (v1.7)
The builder contains bundled_mods\CookiePortAndroidWoodenResizer and automatically
includes it first in each APK. If your Steam mods contain the same ID, that
older version is skipped. It can be turned off in Android's Options -> Mods;
the initial default is ON. The standalone PC mod is still a separate ZIP.

WHAT THIS DOES NOT DO
- The *literal* original Steam/Electron mod manager cannot run inside Android
  WebView: its back-end expects Node.js, Electron, and Steam Workshop APIs.
  This version uses the base game's own Options styling/location and mod API,
  plus an Android-compatible manager back-end. It is not a byte-for-byte clone.
- No Steam Workshop downloads or synchronization after the APK is installed.
  Installing/uninstalling a mod on your PC requires rebuilding the APK.
- Steam's current enable/disable and custom load-order preferences may be stored
  outside the mod folders; those cannot reliably be inferred from info.txt.
  Initial Android selection comes from each mod's 'Disabled' default; subsequent
  Android selections persist locally across compatible app updates.
- Mods requiring Electron, Node 'require', filesystem APIs, or Steamworks can fail.
  Language-only mods are included but not yet activated; see build warnings.
- Never redistribute the APK or packaged third-party mods without permission.
  The source-only builder ZIP contains the original resizer source, but no game files or other third-party Steam mods.

SAFE MODE
If a mod prevents gameplay, open the Android ☰ menu and select
'Disable all bundled mods and restart (safe mode)'.
Back up your save before testing new mods.
