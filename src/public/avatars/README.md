# Avatar Images

Served by Vite from `src/public/avatars/` → `/avatars/...` in the app.

TaskZM uses **[Craftwork Userpics](https://userpics.craftwork.design/)** — 30 diverse flat profile illustrations (free commercial use).

## Bundled pack (`userpics/`)

- **30 PNG single portraits** from the Craftwork Userpics pack (`s-5-img-*.png`)
- Files: `src/public/avatars/userpics/01.png` … `30.png`
- App IDs: `taskzm:userpics:01` … `taskzm:userpics:30`
- Male / female filters in the picker use tags in `src/lib/avatar-constants.ts`

Refresh assets:

```bash
npm run generate:avatars
```

Legacy avatar paths (`/avatars/male-*.png`, DiceBear URLs, older `taskzm:*` IDs) are migrated automatically in `avatar-utils.ts`.
