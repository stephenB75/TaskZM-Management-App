# Avatar Images

TaskZM uses **[IconScout](https://iconscout.com/free-icon-packs/avatars)** faceless character avatars — cropped to transparent PNG silhouettes (no background circle).

## How it works

- **42 picker options** — 7 bundled IconScout sets × 6 square-cropped characters each
- **Transparent assets** — white pack backgrounds are trimmed away
- **App IDs** — `taskzm:iconscout:01` … `taskzm:iconscout:42`
- **Assets** — bundled PNGs in `public/avatars/iconscout/`

Legacy avatar IDs (Multiavatar, Icon54, DiceBear, etc.) migrate automatically in `avatar-utils.ts`.

## Regenerate avatars

```bash
npm run generate:avatars
```

This reads the seven bundled pack sheets in `assets/iconscout-source/` (`pack-25077.png` … `pack-89116.png`), square-crops each icon from the 3×2 grid, trims the white background, normalizes to 128×128 transparent PNGs, and writes 42 assets to `src/public/avatars/iconscout/`.

### Optional: manual SVG pack

Download a pack from IconScout and unzip SVGs to `assets/iconscout-avatar-pack/`, then run `npm run generate:avatars` to import those instead.
