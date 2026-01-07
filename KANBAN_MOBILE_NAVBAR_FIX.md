# Kanban Mobile View - Nav Bar Content Visibility Fix

## ✅ Issue Fixed

**Problem:** Content on mobile week page (kanban view) was being hidden by the nav bar.

**Root Cause:** The mobile kanban container lacked bottom padding to account for the fixed nav bar at the bottom of the screen.

## 🔧 Fix Applied

### Changes Made:

1. **Added Bottom Padding to Mobile Container** (Line 728-730)
   - **Before:** No `paddingBottom` - comment said "nav bar clearance handled by spacer in App.tsx"
   - **After:** Added `paddingBottom` using the same calculation as App.tsx scroll container
   - **Calculation:** `calc(${NAV_BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px) + ${NAV_BAR_SCROLL_BUFFER_REM})`
   - **Result:** Content now has proper clearance above the nav bar

2. **Added Missing Import** (Line 37)
   - Added `NAV_BAR_SCROLL_BUFFER_REM` to imports from `layout-constants`

### Code Changes:

```typescript
// Before:
<div 
  className="flex-1 px-4 pt-2 sm:px-6 sm:pt-4" 
  style={{ 
    minHeight: typeof window !== 'undefined' && window.innerWidth < VIEWPORT_BREAKPOINTS.tablet
      ? `calc(100vh - ${HEADER_HEIGHT}px - ${NAV_BAR_HEIGHT}px)`
      : 'auto',
  } as React.CSSProperties}
>

// After:
<div 
  className="flex-1 px-4 pt-2 sm:px-6 sm:pt-4" 
  style={{ 
    minHeight: typeof window !== 'undefined' && window.innerWidth < VIEWPORT_BREAKPOINTS.tablet
      ? `calc(100vh - ${HEADER_HEIGHT}px - ${NAV_BAR_HEIGHT}px)`
      : 'auto',
    // Add bottom padding to ensure content is not hidden by nav bar
    // Use the same calculation as App.tsx scroll container for consistency
    paddingBottom: typeof window !== 'undefined' && window.innerWidth < VIEWPORT_BREAKPOINTS.tablet
      ? `calc(${NAV_BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px) + ${NAV_BAR_SCROLL_BUFFER_REM})`
      : undefined,
  } as React.CSSProperties}
>
```

## ✅ Verification

### Constants Used (No Hardcoded Values):
- ✅ `NAV_BAR_HEIGHT` (112px) - from `layout-constants.ts`
- ✅ `NAV_BAR_SCROLL_BUFFER_REM` ('1rem') - from `layout-constants.ts`
- ✅ `VIEWPORT_BREAKPOINTS.tablet` - from `layout-constants.ts`
- ✅ `env(safe-area-inset-bottom, 0px)` - CSS env variable for safe area

### Consistency Check:
- ✅ Uses same calculation as `App.tsx` scroll container (line 782-783)
- ✅ Matches pattern used in `TodayAgendaView.tsx` (line 960-961)
- ✅ Matches pattern used in `SettingsPanel.tsx` (line 459, 470)

### No Conflicts Found:
- ✅ No hardcoded pixel values
- ✅ No conflicting padding/margin rules
- ✅ Properly scoped to mobile view only (tablet breakpoint check)
- ✅ Doesn't interfere with desktop view

## 📱 Result

**Before:** Content at the bottom of the mobile kanban view was hidden by the fixed nav bar.

**After:** Content now has proper bottom padding (112px nav bar + safe area + 1rem buffer) ensuring all content is visible and scrollable above the nav bar.

## 🎯 Technical Details

**Padding Calculation Breakdown:**
- `NAV_BAR_HEIGHT`: 112px (height of fixed nav bar)
- `env(safe-area-inset-bottom, 0px)`: Safe area for devices with notches/home indicators
- `NAV_BAR_SCROLL_BUFFER_REM`: 1rem (16px) extra buffer to ensure last item is fully visible

**Total Bottom Padding:** ~128px + safe area (varies by device)

This ensures:
1. Content is never hidden by the nav bar
2. Last item can be fully scrolled into view
3. Works on all devices including those with safe areas
4. Consistent with other mobile views in the app

