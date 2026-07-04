# Avatar Images

TaskZM uses **[Multiavatar](https://multiavatar.com/)** — 32 multicultural SVG avatars generated in-app (free for use in products per the Multiavatar license).

## How it works

- **32 picker options** — 16 inclusive base characters (parts `00`–`15`), each with two color themes (`A`, `B`)
- **Male / Female tabs** — 16 options per tab (see gender tags in `src/lib/avatar-constants.ts`)
- **App IDs** — `taskzm:multiavatar:00:A` … `taskzm:multiavatar:15:B`
- **Rendering** — SVG is generated client-side via `@multiavatar/multiavatar` (`src/lib/avatar-render.ts`)

No PNG assets are bundled; avatars always render as crisp SVG in circular frames.

Legacy avatar paths (`/avatars/userpics/*`, DiceBear URLs, older `taskzm:*` IDs) migrate automatically in `avatar-utils.ts`.
