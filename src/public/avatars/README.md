# Avatar Images

TaskZM uses **[Multiavatar](https://multiavatar.com/)** — 48 multicultural SVG avatars generated in-app (free for use in products per the Multiavatar license).

## How it works

- **48 picker options** — 16 inclusive base characters (parts `00`–`15`), each with three color themes (`A`, `B`, `C`)
- **Full catalog** — all characters are shown together; no gender filter hides options
- **App IDs** — `taskzm:multiavatar:00:A` … `taskzm:multiavatar:15:C`
- **Rendering** — SVG is generated client-side via `@multiavatar/multiavatar` (`src/lib/avatar-render.ts`)

No PNG assets are bundled; avatars always render as crisp SVG in circular frames.

Legacy avatar paths (`/avatars/userpics/*`, DiceBear URLs, older `taskzm:*` IDs) migrate automatically in `avatar-utils.ts`.
