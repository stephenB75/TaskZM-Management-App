# App Store screenshots (v2.0.1)

One folder per App Store Connect display tab. Drag a folder's files into the matching tab in filename order. Every file is a JPEG with an embedded sRGB profile and no transparency.

| Folder | App Store Connect tab | Size (portrait / landscape) |
|---|---|---|
| `iphone-6.9/` | iPhone 6.9" Display | 1320 × 2868 |
| `iphone-6.5/` | iPhone 6.5" Display | 1284 × 2778 |
| `iphone-6.3/` | iPhone 6.3" Display | 1206 × 2622 |
| `iphone-6.1/` | iPhone 6.1" Display | 1179 × 2556 |
| `ipad-13/` | iPad 13" Display | 2752 × 2064 |
| `ipad-12.9/` | iPad 12.9" Display | 2732 × 2048 |

Each folder only fits its own tab; dropping a set into a different tab gives a "dimensions are wrong" error, so check the tab name above the drop zone first. App Store Connect can scale the 6.9" and 13" sets down for smaller devices, so the other folders are only needed when a tab asks for its own screenshots.

`source/captioned/` holds the lossless captioned masters (iPhone 1320 × 2868, iPad 2752 × 2064) that every folder above is generated from. `source/raw/` holds the uncaptioned captures, for other uses or for redoing captions.

## Product page header and search results artwork

`product-page/` holds the landscape artwork App Store Connect asks for on the product page:

| File | Use for | Size | Format |
|---|---|---|---|
| `universal-5244x2950.png` | Header **and** search results (tick "Use header asset in search results") | 5244 × 2950 (16:9) | PNG only |
| `header-3840x1646.jpg` | Header only | 3840 × 1646 (21:9) | JPG or PNG |
| `search-results-3840x2560.jpg` | Search results only | 3840 × 2560 (3:2) | JPG or PNG |

Upload either the universal PNG, or the dedicated header and search results pair. The App Store crops the universal asset to 21:9 for the header and 3:2 for search results, so its text and devices sit inside the area both crops keep. None of the files have transparency. Regenerate them from the raw captures with `node scripts/generate-product-page-art.mjs`. Specs: [Creative assets specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications/).

## Captions

### iPhone

1. Your whole day, on one timeline. *See what's next at a glance.*
2. Tasks and meetings, side by side. *Syncs with iCloud, Google and Outlook.*
3. Type it. TaskZM schedules it. *The auto scheduler finds time for every task.*
4. Every detail in one place. *Priorities, subtasks, tags, repeats and more.*
5. Stay focused with a Pomodoro timer. *Focus minutes log straight to your task.*
6. Capture now, plan later. *An inbox for everything on your mind.*
7. Easy on the eyes, day or night. *Full dark mode support.*

### iPad

1. Plan your week at a glance. *Timeline, calendar and auto scheduler side by side.*
2. Type it. TaskZM schedules it. *Drafts tasks and finds time around your meetings.*
3. Your month, all in one view. *Tasks and calendar events together.*
4. Every detail in one place. *Priorities, subtasks, tags, repeats and Pomodoro.*
5. Capture now, plan later. *An inbox for everything on your mind.*
6. Easy on the eyes, day or night. *Full dark mode support.*

All names, tasks and events shown are sample data.
