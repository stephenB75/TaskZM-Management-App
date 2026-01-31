# TaskZM App State - Version 1.0.17

**Date**: January 23, 2026  
**Version**: 1.0.17 - Notifications, Badging & Settings Spacing

## Current State Summary

### Major Features & Improvements

#### Priority & Status Badging (Pill Shape)
- **Task Dialog**: Status and Priority selection buttons use pill shape (`rounded-full`) instead of rounded rectangle (`rounded-xl`) so selected items appear as capsules
- **Task Cards**: Priority badges use pill shape (`rounded-full`) instead of `rounded-md` for consistent appearance
- **Components Updated**: TaskDialog.tsx (Status + Priority pills), DraggableTaskCard.tsx, TaskCard.tsx, DraggableTodayAgendaTask.tsx (priority badge)
- **Design**: Pill = capsule with fully rounded ends; ensures badges are not oval and read clearly as pills

#### In-App Notifications Above Dialogs
- **Toast Z-Index**: In-app toasts (Sonner) now use z-index 9990 so they appear above dialogs (z-50) and in-dialog dropdowns (z-200)
- **Constants**: `Z_INDEX.TOAST` set to 9990 in layout-constants.ts; globals.css `[data-sonner-toaster]` and mobile top-center rule use `z-index: 9990 !important`
- **Sonner Component**: src/components/ui/sonner.tsx applies `Z_INDEX.TOAST` via inline style; comment updated
- **Result**: Users always see toast messages when a dialog is open (e.g. validation, sync, delete confirmations)

#### Settings Panel Spacing
- **Accordion Sections**: Increased margin between accordion items (`SETTINGS_PANEL_ACCORDION_ITEM_MARGIN_Y` 1.25rem → 1.5rem; medium/desktop variants increased)
- **Accordion Content**: More padding and gap inside content (content padding top/bottom, `ACCORDION_CONTENT_SPACING` 1.25rem → 1.5rem)
- **Separators**: `SETTINGS_PANEL_SEPARATOR_MARGIN_Y` 1rem → 1.25rem; Notifications section separator now uses constant instead of `my-3 md:my-4`
- **Form Rows**: `SETTINGS_PANEL_ROW_PADDING_Y` 0.5rem → 0.75rem; `SETTINGS_PANEL_SPACING_MEDIUM` 1rem → 1.25rem; SPACING_LARGE/XLARGE increased
- **Profile Section**: Profile content padding top/bottom increased; panel gaps (PANEL_GAP_*, PANEL_FIELD_SPACING) increased for breathing room
- **Margins**: MARGIN_BOTTOM_SMALL/MEDIUM/LARGE increased for labels and blocks
- **Constants**: All changes in src/lib/layout-constants.ts; SettingsPanel uses these throughout

#### Settings Panel Import Fix
- **SETTINGS_PANEL_ROW_PADDING_Y**: Constant was used in SettingsPanel.tsx (Notifications, Tags sections) but not imported from layout-constants; added to import list to fix ReferenceError in production

### Code Quality Improvements

#### Constants Usage
- No new hardcoded spacing in Settings panel; all spacing driven by layout-constants
- Toast and dialog z-index documented in layout-constants (TOAST, DIALOG, SELECT_CONTENT)

#### Component Updates
- **TaskDialog.tsx**: Status and Priority buttons `rounded-xl` → `rounded-full`
- **DraggableTaskCard.tsx**: Priority badge `rounded-md` → `rounded-full`
- **TaskCard.tsx**: Priority Badge className includes `rounded-full`
- **DraggableTodayAgendaTask.tsx**: Priority badge `rounded-md` → `rounded-full`
- **SettingsPanel.tsx**: Import `SETTINGS_PANEL_ROW_PADDING_Y`; Notifications separator uses `SETTINGS_PANEL_SEPARATOR_MARGIN_Y`
- **sonner.tsx**: Uses Z_INDEX.TOAST; comment updated
- **globals.css**: Toaster z-index 100 → 9990 for both default and mobile top-center
- **layout-constants.ts**: TOAST 100 → 9990; all Settings panel spacing constants increased as above

### Files Modified

#### Core Components
- `src/components/TaskDialog.tsx`: Pill shape for Status and Priority
- `src/components/DraggableTaskCard.tsx`: Pill shape for priority badge
- `src/components/TaskCard.tsx`: Pill shape for priority badge
- `src/components/DraggableTodayAgendaTask.tsx`: Pill shape for priority badge
- `src/components/SettingsPanel.tsx`: Import SETTINGS_PANEL_ROW_PADDING_Y; separator constant
- `src/components/ui/sonner.tsx`: Z_INDEX.TOAST comment

#### Constants & Styles
- `src/lib/layout-constants.ts`: TOAST 9990; Settings panel spacing constants (accordion, separator, row padding, spacing, margins, profile, panel gaps)
- `src/styles/globals.css`: [data-sonner-toaster] z-index 9990

### Verification Status

#### Functionality
- ✅ Priority/Status pills render as pill shape in Task Dialog
- ✅ Priority badges on task cards render as pill shape
- ✅ Toasts appear above open dialogs and in-dialog dropdowns
- ✅ Settings panel sections have clearer spacing; no ReferenceError for SETTINGS_PANEL_ROW_PADDING_Y

#### Code Quality
- ✅ All spacing uses constants
- ✅ SETTINGS_PANEL_ROW_PADDING_Y imported in SettingsPanel
- ✅ No linter errors
- ✅ No TypeScript errors

### Build & Deployment

- **Version**: 1.0.17
- **Build Number**: 20260123-1
- **Status**: ✅ Ready for deployment
- **Breaking Changes**: None
- **Migration Required**: None
