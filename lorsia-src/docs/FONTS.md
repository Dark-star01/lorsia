# App Font («خط التطبيق») — bundled fonts and licenses

The app has exactly five choices in the single global setting «خط التطبيق». All are bundled locally; no network font loading and no font upload control.

| ID | Arabic label | Font family | Bundled files | License |
|---|---|---|---|---|
| `naskh` (default) | نسخ | Noto Naskh Arabic | `fonts/naskh-400.woff2`, `fonts/naskh-700.woff2` | SIL OFL 1.1 |
| `amiri` | أميري | Amiri | `fonts/amiri-400.woff2`, `fonts/amiri-700.woff2` | SIL OFL 1.1 |
| `dejavu` | ديفاجو | DejaVu Sans | `fonts/dejavu-sans-400.woff`, `fonts/dejavu-sans-700.woff` | Bitstream Vera license + DejaVu public-domain changes |
| `kufi` | كوفي | Noto Kufi Arabic | `fonts/kufi-400.woff2`, `fonts/kufi-700.woff2` | SIL OFL 1.1 |
| `nastaliq` | نستعليق (أردو) | Noto Nastaliq Urdu | `fonts/nastaliq-400.woff2`, `fonts/nastaliq-700.woff2` | SIL OFL 1.1 |

License notices for the Noto families are stored beside the fonts as `NOTO-OFL-LICENSE.txt`, `NOTO-KUFI-OFL-LICENSE.txt`, and `NOTO-NASTALIQ-OFL-LICENSE.txt`. The Noto Kufi Arabic files were taken from the installed Noto font package (font metadata copyright 2019 Google LLC); Noto Nastaliq Urdu from the installed Noto font package (font metadata copyright 2017 Google Inc.). The Noto package copyright notice identifies the font software as SIL Open Font License 1.1. Both pairs were converted from TTF to WOFF2 without changing glyph outlines.

## Notes on choosing a font

- **Noto Naskh Arabic** is the default balanced reading font.
- **Amiri** is a more classical, book-like Arabic style.
- **DejaVu Sans** is a broad, utilitarian sans-serif fallback.
- **Noto Kufi Arabic** is a cleaner geometric/Kufi style and is a good interface-oriented alternative.
- **Noto Nastaliq Urdu** is deliberately more calligraphic and designed primarily for Urdu/Persian typography; Arabic prose may look noticeably different. It is included as an optional stylistic choice, not as the default.

The registry is `U.FONTS` in `lorsia-src/js/ui.js`; the CSS font faces and `data-font` stacks are in `lorsia-src/css/app.css`. The saved preference is `S.font` in IndexedDB `prefs`; `localStorage['lorsia-font']` is only a startup mirror to prevent a flash of the default font.

## Verification

The browser test checks that the setting lists exactly five fonts, each local font file resolves, each choice applies to the same global CSS token, and changing the font does not replace the editor node or alter selection, focus, or scroll. Glyph coverage is checked with `node tests/font_coverage.js`; run `python3 tests/fonts_icons_ui.py` for the browser suite. Android WebView testing is still required on a real device.
