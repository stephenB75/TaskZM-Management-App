# Phosphor Icons Duotone Integration Guide

## ✅ Installation Complete

Phosphor Icons is already installed: `phosphor-react`

## 🎨 Icon Component

Created `src/components/Icon.tsx` that:
- Uses Phosphor Icons with duotone support
- Automatically enables duotone for special icons (sparkles, brain, target, calendar, etc.)
- Integrates with your theme colors (`COLOR_PRIMARY`, `COLOR_PRIMARY_LIGHT`, etc.)
- Maps common icon names to Phosphor icon names

## 📖 Basic Usage

### Simple Usage
```tsx
import { Icon } from './components/Icon';

// Duotone auto-enabled for special icons
<Icon name="sparkles" size={24} />

// Regular icons use regular weight
<Icon name="settings" size={24} />
```

### Explicit Duotone
```tsx
<Icon 
  name="calendar" 
  size={32} 
  weight="duotone"
  color="#9B87E8"
  secondaryColor="#D4C5F9"
/>
```

### With Theme Colors
```tsx
import { COLOR_PRIMARY, COLOR_PRIMARY_LIGHT } from '../lib/color-theme';

<Icon 
  name="target" 
  weight="duotone"
  color={COLOR_PRIMARY}
  secondaryColor={COLOR_PRIMARY_LIGHT}
/>
```

## 🎯 Icon Weights

- `thin` - Very light stroke
- `light` - Light stroke
- `regular` - Default (outline)
- `bold` - Bold stroke
- `fill` - Filled icons
- `duotone` - Two-color icons (perfect for gradients!)

## 🔄 Migration from Lucide React

### Before (Lucide)
```tsx
import { Sparkles, Calendar, Settings } from 'lucide-react';

<Sparkles size={24} color="#9B87E8" />
<Calendar size={24} />
<Settings size={24} />
```

### After (Phosphor with Icon component)
```tsx
import { Icon } from './components/Icon';

<Icon name="sparkles" size={24} />  // Auto duotone!
<Icon name="calendar" size={24} />   // Auto duotone!
<Icon name="settings" size={24} />    // Regular weight
```

## 🎨 Icons That Auto-Use Duotone

These icons automatically use duotone for better visual appeal:
- `sparkles`
- `brain`
- `target`
- `trophy` / `award`
- `crown`
- `zap`
- `calendar`
- `calendar-days`
- `check-circle`

## 📝 Icon Name Mapping

The Icon component maps common names to Phosphor icons:
- `sparkles` → `Sparkle`
- `calendar` → `Calendar`
- `calendar-days` → `CalendarBlank`
- `settings` → `Gear`
- `check` → `Check`
- `x` → `X`
- `plus` → `Plus`
- `folder` → `Folder`
- `inbox` → `Inbox`
- `search` → `MagnifyingGlass`
- ... and many more

## 🚀 Next Steps

1. **Replace Lucide imports** in your components:
   ```tsx
   // Remove
   import { Sparkles } from 'lucide-react';
   
   // Add
   import { Icon } from './components/Icon';
   ```

2. **Update icon usage**:
   ```tsx
   // Before
   <Sparkles size={24} />
   
   // After
   <Icon name="sparkles" size={24} />
   ```

3. **Test duotone icons** - Check the demo: `src/components/PhosphorIconDemo.tsx`

4. **Customize colors** - Use your theme colors for duotone:
   ```tsx
   <Icon 
     name="sparkles" 
     weight="duotone"
     color={COLOR_PRIMARY}
     secondaryColor={COLOR_PRIMARY_LIGHT}
   />
   ```

## 💡 Tips

- Duotone works best with your gradient theme colors
- Use `weight="duotone"` explicitly when you want two-tone effect
- Regular icons (settings, folder, etc.) use regular weight by default
- Special icons (sparkles, brain, etc.) auto-use duotone for visual appeal
