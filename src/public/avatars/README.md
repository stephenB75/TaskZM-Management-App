# Avatar Images

TaskZM uses **[Multiavatar](https://multiavatar.com/)** — 48 multicultural SVG portraits styled with TaskZM pastel palettes, generated in-app.

## How it works

- **48 picker options** — 16 inclusive base characters (parts `00`–`15`), each with three color themes (`A`, `B`, `C`)
- **Pastel styling** — avatar backgrounds use the app’s pastel palette from `color-theme.ts`
- **App IDs** — `taskzm:multiavatar:00:A` … `taskzm:multiavatar:15:C`
- **Rendering** — SVG is generated client-side via `@multiavatar/multiavatar` (`src/lib/avatar-render.ts`)

Multiavatar characters are designed to represent people from many cultures and backgrounds. No PNG assets are bundled; avatars render as crisp SVG in circular frames.

Legacy avatar paths (DiceBear style IDs, `/avatars/userpics/*`, HTTP DiceBear URLs, older `taskzm:*` IDs) migrate automatically in `avatar-utils.ts`.
