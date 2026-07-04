# Avatar Images

Served by Vite from `src/public/avatars/` → `/avatars/...` in the app.

TaskZM uses **[Craftwork Userpics](https://userpics.craftwork.design/)** — 27 diverse flat profile illustrations (free commercial use).

## Bundled pack (`userpics/`)

- **27 PNG portraits** from the Craftwork Userpics pack
- Files: `src/public/avatars/userpics/01.png` … `27.png`
- App IDs: `taskzm:userpics:01` … `taskzm:userpics:27`

Refresh assets:

```bash
npm run generate:avatars
```

Legacy avatar paths (`/avatars/male-*.png`, DiceBear URLs, older `taskzm:*` IDs) are migrated automatically in `avatar-utils.ts`.
