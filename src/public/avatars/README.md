# Avatar Images

TaskZM uses **[DiceBear](https://www.dicebear.com/)** — 48 illustrated SVG portraits generated in-app (MIT license).

## How it works

- **48 picker options** — 16 curated seeds in each of three hand-crafted styles:
  - **Lorelei** — illustrated ink-line portraits
  - **Notionists** — modern editorial portraits
  - **Micah** — hand-drawn sketch portraits
- **App IDs** — `taskzm:lorelei:01` … `taskzm:micah:16`
- **Rendering** — SVG is generated client-side via `@dicebear/core` and `@dicebear/styles` (`src/lib/avatar-render.ts`)

No PNG assets are bundled; avatars always render as crisp SVG in circular frames.

Legacy avatar paths (Multiavatar IDs, `/avatars/userpics/*`, DiceBear HTTP URLs, older `taskzm:*` IDs) migrate automatically in `avatar-utils.ts`.
