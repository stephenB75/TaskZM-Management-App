# Avatar Images

TaskZM uses the **Avataaars** flat vector avatar pack by [Pablo Stanley](https://avataaars.com/) (via [DiceBear](https://www.dicebear.com/styles/avataaars/)). This is the same colorful, Flaticon-style profile icon family used across many apps.

## Bundled pack (`avataaars/`)

- **24 SVG portraits** with TaskZM pastel background colors
- Stored as `public/avatars/avataaars/01.svg` … `24.svg`
- Referenced in the app as `taskzm:avataaars:01` … `taskzm:avataaars:24`

Regenerate after changing seeds or colors:

```bash
npm run generate:avatars
```

## Alternative free packs

| Pack | Style | License | URL |
|------|-------|---------|-----|
| **Craftwork Userpics** | 100 colorful flat avatars (PNG/SVG, circle + square) | Free commercial use | [userpics.craftwork.design](https://userpics.craftwork.design/) |
| **Speckyboy Avatar Set** | 50 flat/outlined user icons | Free commercial | [speckyboy.com](https://speckyboy.com/free-cute-user-avatar-icon-set/) |
| **DiceBear Micah** | Flat modern half-body portraits | CC BY 4.0 | [dicebear.com/styles/micah](https://www.dicebear.com/styles/micah/) |
| **Flaticon** | Huge icon/avatar library | Free with attribution (Premium: no attribution) | [flaticon.com](https://www.flaticon.com/) |

## Legacy assets

Older packs (`lorelei/`, `notionists/`, `female-*.png`, `male-*.png`, `taskzm:pastel-*` IDs) are deprecated. Users with legacy paths are mapped automatically to the Avataaars pack by index.
