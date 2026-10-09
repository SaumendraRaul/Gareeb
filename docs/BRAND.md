# Gareeb identity

The little pocket: a folded pocket holding space for a gold coin. The two overlapping curves suggest care and a little room to grow. Keep the name lowercase, without a full stop or an additional G monogram.

The UI uses a green pocket, sage fold, and warm gold coin on ivory. Dark mode uses the existing light green text color. Launcher artwork uses ivory and gold on deep forest green. The symbol is vector artwork, not a font glyph, and remains legible at small sizes.

`src/brand.json` is the shared shape source. The Logo component renders it directly. Run `npm run brand:generate` after changes to regenerate public SVG/PNG exports, all Android launcher densities, round/adaptive icons, Android 13 themed icons, and launch screens. The Android foreground stays inside the adaptive safe circle.

Exports: `public/icon.svg`, `public/brand/app-icon.png` (1024 px), and transparent `mark.svg`, `mark-light.svg`, `mark-monochrome.svg`. Use the original SVG when resizing. Do not stretch, rotate, add a second monogram, or place the dark mark on a dark background.
