# RevenueCat Package Identifier Guide

## Issue: Package Identifiers May Not Match

The code is looking for packages with identifiers like `$rc_monthly` and `$rc_yearly`, but RevenueCat may use different identifier formats.

## Current Identifier Matching

The code now checks for these patterns (case-insensitive):

### Monthly:
- `month`
- `monthly`
- `rc_monthly`
- `$rc_monthly`

### Yearly:
- `year`
- `yearly`
- `annual`
- `annually`
- `rc_yearly`
- `rc_annual`
- `$rc_yearly`
- `$rc_annual`

## Where Identifiers Are Checked

The code checks identifiers in multiple locations:

1. **Package Identifier** (`pkg.identifier`)
2. **Store Product Identifier** (`pkg.storeProduct.identifier`)
3. **RC Billing Product Identifier** (`pkg.rcBillingProduct.identifier`)
4. **Product Identifier** (`pkg.product.identifier`)

## How to Find Your Actual Identifiers

### Step 1: Check Console Logs

When the app loads, look for:
```
🔍 Searching for monthly package among X packages:
   Available packages (full details): [...]
```

This will show:
- `identifier`: The package identifier
- `allIdentifiers`: All identifier variations found
- `keywordMatches`: Which keywords matched

### Step 2: Check RevenueCat Dashboard

1. Go to **RevenueCat Dashboard** → **Offerings**
2. Select your **Current Offering**
3. Look at the **Packages** section
4. Check the **Identifier** field for each package

Common identifier formats:
- `$rc_monthly` / `$rc_yearly` (with dollar sign)
- `rc_monthly` / `rc_yearly` (without dollar sign)
- `monthly` / `yearly` (simple)
- `monthly_subscription` / `yearly_subscription` (with suffix)
- Custom names you've set

### Step 3: Update Code if Needed

If your identifiers don't match any of the patterns, you can:

1. **Update the keywords array** in `src/lib/revenuecat.ts`:
   ```typescript
   const keywords = type === 'monthly' 
     ? ['month', 'monthly', 'rc_monthly', '$rc_monthly', 'YOUR_CUSTOM_IDENTIFIER'] 
     : ['year', 'yearly', 'annual', 'annually', 'rc_yearly', 'rc_annual', '$rc_yearly', '$rc_annual', 'YOUR_CUSTOM_IDENTIFIER'];
   ```

2. **Or update identifiers in RevenueCat** to match the expected patterns

## Product ID Matching (More Reliable)

The code also matches by **Product ID**, which is more reliable:

- Monthly Product ID: `prodb18a767009`
- Yearly Product ID: `prod77566b1baf`

If packages are linked to these products in RevenueCat, they will be found even if identifiers don't match.

## Debugging

The enhanced logging will show:
- All available package identifiers
- Which identifiers matched (if any)
- Product IDs for each package
- Why a package was or wasn't selected

Check the console for detailed information about what identifiers are actually being used.

