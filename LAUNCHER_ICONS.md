# Theme-specific Android launcher icons (PNG)

## How it works in this build (what is implemented)
- JS: `lorsia-src/js/launcher-icon.js` — on every theme apply, remembers the theme id and, when the app goes to the background (`visibilitychange`/`pagehide`),
  calls the Capacitor plugin `LorsiaLauncherIcon.setIcon({theme})`. Deferred on purpose so editing/navigation is never disturbed. Reuses the existing stable theme ids and the existing `prefs.theme` persistence; synced again on every startup.
- Native: `plugins/lorsia-launcher-icon/` (Kotlin, same plugin mechanism as `lorsia-file-saver`) enables one `activity-alias` and disables the other three with `PackageManager.setComponentEnabledSetting(..., DONT_KILL_APP)`.
- Build: `hooks/pre-build.sh` → `hooks/launcher_icons.py` (APKMaker 2.0 pre-build hook, runs after `cap add android`, `native/` and plugins, before Gradle). It adds the 4 aliases to `AndroidManifest.xml` and removes the LAUNCHER filter from `MainActivity` (so there is exactly ONE launcher entry — no duplicate shortcuts), only when PNG art exists. `appId` (`com.lorsia.app`) is never touched.
- With no PNGs in the repo (today) the hook does nothing: the stock icon stays, the manifest is byte-identical, and the plugin answers `supported:false`.

STATUS: implemented and unit/mock-tested; NOT built into an APK and NOT run on a device from this workspace (no Android SDK/Gradle network). See the report for exact test results.

## Theme → icon mapping
| Theme (UI name) | Stable theme id | Alias component (generated) | PNG base name |
|---|---|---|---|
| Light / Day («عصري») | `modern` (default theme, alias enabled by default) | `com.lorsia.app.IconModern` | `ic_launcher_modern` |
| Library («مكتبة») | `library` | `com.lorsia.app.IconLibrary` | `ic_launcher_library` |
| Snow («ثلج») | `snow` | `com.lorsia.app.IconSnow` | `ic_launcher_snow` |
| Dark / Night («ليل») | `night` | `com.lorsia.app.IconNight` | `ic_launcher_night` |

A theme without a complete PNG set uses the stock `@mipmap/ic_launcher` (not final art) and the build log warns about it.

## Asset checklist — supplied classic icons are included in this project
Put files in the repo at `native/android/app/src/main/res/mipmap-<density>/` (APKMaker copies `native/android/**` to `android/**`; the push trigger already watches `native/**`). 32-bit PNG (RGBA), sRGB, no animation.

A) REQUIRED per theme — classic icon (Android 6–7 and launchers without adaptive support), file `ic_launcher_<id>.png`. The four supplied designs are already resized and placed in all five density folders in `native/android/app/src/main/res/`:
| density folder | px |
|---|---|
| `mipmap-mdpi` | 48×48 |
| `mipmap-hdpi` | 72×72 |
| `mipmap-xhdpi` | 96×96 |
| `mipmap-xxhdpi` | 144×144 |
| `mipmap-xxxhdpi` | 192×192 |
All 5 densities must exist for a theme to be picked up. Own shape/rounded corners with transparent edges are fine here.

B) RECOMMENDED per theme — adaptive icon foreground (Android 8+), file `ic_launcher_<id>_foreground.png`, transparent background:
`mipmap-mdpi` 108×108, `hdpi` 162×162, `xhdpi` 216×216, `xxhdpi` 324×324, `xxxhdpi` 432×432.
Keep the artwork inside the central 66dp circle (61% of the canvas); the outer 18dp per side can be masked or cropped by the launcher. Without B, Android 8+ shows file A inside the launcher's own backing shape.

C) OPTIONAL per theme — adaptive background, file `ic_launcher_<id>_background.png`, same sizes as B, fully opaque. If absent, a solid color is used (generated `res/values/lorsia_launcher_colors.xml`): modern `#f3f5f9`, library `#efe6d0`, snow `#e8f2fb`, night `#08090D` (the themes' background colors; change them in `hooks/launcher_icons.py` THEMES if you want others).

Counts: 20 classic PNG icons are included (4 themes × 5 densities). Original artwork is preserved in `assets/launcher-icons-source/`. Adaptive foreground PNGs are not included because the supplied images are opaque full-square artwork; Android will use the generated solid-color adaptive background unless transparent foreground art is added later. With recommended foregrounds = 40; with optional backgrounds = 60. Example for Night:
`mipmap-xxxhdpi/ic_launcher_night.png` (192), `mipmap-xxxhdpi/ic_launcher_night_foreground.png` (432), `mipmap-xxxhdpi/ic_launcher_night_background.png` (432, optional).
The hook warns (does not fail) if a PNG has the wrong pixel size.

## Limits you should know
- Launchers cache icons and may refresh after a delay or only after the home screen redraws; no instant update is promised.
- The switch happens when the app is sent to the background, not at the moment of tapping a theme.
- First install of a build that has aliases: the old home-screen shortcut (which pointed at `MainActivity`) may disappear on some launchers after updating; the new icon then appears in the app drawer and can be re-added.
- Changing the icon via aliases can briefly confuse some OEM launchers; it is a standard technique but device behaviour varies.
