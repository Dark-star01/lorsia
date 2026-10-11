# Lorsia launcher icon assets

The four user-supplied icon artworks are included in this repository.

- Original source PNGs: `assets/launcher-icons-source/`
- Android resources: `native/android/app/src/main/res/mipmap-*/`
- 20 classic launcher PNGs are included: 4 themes × 5 densities (48, 72, 96, 144, 192 px).
- Names: `ic_launcher_modern.png`, `ic_launcher_library.png`, `ic_launcher_snow.png`, `ic_launcher_night.png`.

The APKMaker pre-build hook detects these files and configures the theme-specific launcher aliases during the Android build. This wiring still needs a real APK build and on-device test; it has not been verified on a physical device in this workspace.
