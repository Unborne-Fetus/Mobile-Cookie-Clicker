WOODEN PANEL RESIZER — PC + ANDROID (v1.7.0)
================================================

Standalone mod. Contains NO game files or APK builder.

VISUAL FIXES (replacing the poorly laid out v1.4):
- Original wooden separators restored (no brass handles or hover labels).
- A resized, shortened Cookie panel cannot leave its old black gradient
  extending down the screen; the exposed area continues the blue wallpaper.
- Wider Stores place original 300x64 building cards in responsive columns.
  Cards are never stretched or placed in a single horizontal strip.
- At normal Store widths the original single-column layout stays untouched.
- The middle Buildings panel keeps its original rendering and controls.

ACHIEVEMENTS:
- Stifling the press: narrow the middle/news area and click the ticker.
- Cookie-dunker: have at least 3 regular achievements and drag the cookie
  panel's wooden bottom edge upward until the cookie overlaps milk.
- No achievements are awarded or manually modified by this mod.

INSTALL ON PC:
1. Close Cookie Clicker.
2. Copy the folder CookiePortAndroidWoodenResizer to your Steam install:
   resources\app\mods\local\CookiePortAndroidWoodenResizer
3. Replace the older version, enable the mod in Options -> Mods, relaunch.

ANDROID:
1. Put the mod in Steam's mods/local as above.
2. Run your separate Android APK builder to copy your installed Steam mods.
3. Install the updated private APK over the previous one, do not uninstall.

CONTROLS:
- Drag wooden vertical dividers with mouse or finger to resize panels.
- Drag the wooden bottom edge of the cookie panel to change its height.
- Double-click or double-tap a divider to reset all sizes.
- Previously saved widths/heights remain compatible.

LIMITATIONS:
- Changes to very wide Store layouts are CSS-only; existing mod content that
  relies on fixed store markup may need a compatibility adjustment.
- Tested in a Chromium fixture using the original game CSS; real Steam/Android
  gameplay should be checked before calling this a final release.

V1.6 STORE CORRECTION
---------------------
- The previously stretched, half-screen building cards are gone.
- The wide Store uses actual vanilla 300px x 64px building tiles, with the
  original icons, background textures, price labels and hover effects.
- Buy/Sell and bulk quantity controls now span their own row above the cards,
  instead of being laid out as if they were a building.
- Store grid layout only activates if TWO normal-size tiles can fit. Narrower
  Stores retain the original unmodified layout.
- No extra brass handles, overlays, new sprites or added buttons.
- The left cookie panel fix from v1.5 is unchanged.
- The mod is separate from the Android APK builder.

NEW IN v1.7
- On wide Stores, keep vanilla cards and group the Buy/Sell controls with
  compact third-party black control bars in a centered header row.
- Common separate-mod controls are detected after creation and moved with
  their original event listeners; they revert when the Store is narrowed.
- No visual changes to the left cookie panel or the wooden divider textures.
- The Android builder now auto-includes v1.7 without requiring Steam install.
- Some mods with unusual DOM/CSS constraints may require a specific adapter.
