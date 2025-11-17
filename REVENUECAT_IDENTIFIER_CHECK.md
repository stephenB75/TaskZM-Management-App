# RevenueCat Identifier Verification Guide

## Current Identifiers in Code

### Product IDs
- **Monthly**: `prodb18a767009`
- **Yearly**: `prod77566b1baf`

### Package Identifiers (Expected Patterns)
- **Monthly**: Should contain "month" or "monthly" (case-insensitive)
- **Yearly**: Should contain "year", "yearly", "annual", or "annually" (case-insensitive)
- **Common examples**: `$rc_monthly`, `$rc_annual`, `monthly`, `yearly`, etc.

### Entitlement IDs (Checked in Code)
- **Frontend checks** (case-insensitive):
  - `pro`
  - `pro-monthly`
  - `pro-yearly`
  - Any key containing "pro"
  
- **Backend webhook checks** (case-sensitive):
  - `pro`
  - `PRO-Monthly`
  - `PRO-Yearly`

## Potential Issues

### 1. Entitlement ID Case Sensitivity
The backend webhook checks for `PRO-Monthly` and `PRO-Yearly` (uppercase), but the frontend checks are case-insensitive. If RevenueCat returns different casing, there could be a mismatch.

**Fix**: Ensure RevenueCat dashboard entitlements match exactly:
- Either use `PRO-Monthly` and `PRO-Yearly` (uppercase)
- OR update backend to be case-insensitive

### 2. Product ID Mismatch
If the Product IDs in RevenueCat dashboard don't match `prodb18a767009` and `prod77566b1baf`, packages won't be found by product ID.

**Fix**: 
1. Check RevenueCat Dashboard → Products
2. Verify Product IDs match exactly
3. Update `subscription-constants.ts` if different

### 3. Package Identifier Mismatch
If package identifiers in RevenueCat don't contain expected keywords, they won't be matched.

**Fix**:
1. Check RevenueCat Dashboard → Offerings → Current Offering
2. Verify package identifiers contain "month"/"monthly" or "year"/"yearly"/"annual"
3. Update package identifiers in RevenueCat if needed

## How to Verify

### Step 1: Check Console Logs
When the app loads, check browser console for:

```
🔍 Searching for monthly package:
   Expected Product ID: prodb18a767009
   Expected Keywords: month, monthly
   Available packages: [...]
```

Compare:
- **Expected Product ID** vs **Actual Product IDs** in packages
- **Package identifiers** vs **Expected keywords**

### Step 2: Check RevenueCat Dashboard

1. **Products**:
   - Monthly product ID should be: `prodb18a767009`
   - Yearly product ID should be: `prod77566b1baf`

2. **Offerings**:
   - Current offering should have packages
   - Package identifiers should contain "month"/"monthly" or "year"/"yearly"/"annual"
   - Packages must be linked to products

3. **Entitlements**:
   - Should be named: `pro`, `PRO-Monthly`, `PRO-Yearly` (or lowercase equivalents)
   - Products must grant these entitlements

### Step 3: Check Package Matching
Look for console logs:
```
✅ Found monthly package by product ID: prodb18a767009
```
OR
```
✅ Found monthly package by identifier: $rc_monthly
```

If you see:
```
⚠️ monthly package not found. Available packages: [...]
```
Then identifiers don't match.

## Common Identifier Mismatches

1. **Product ID typo**: `prodb18a767009` vs `prodb18a76700` (missing last digit)
2. **Package identifier**: `monthly_subscription` vs `monthly` (extra text)
3. **Entitlement case**: `pro-monthly` vs `PRO-Monthly` (case mismatch)
4. **Missing product link**: Package exists but not linked to product in RevenueCat

## Quick Fix Script

Run the verification script:
```bash
node scripts/check-revenuecat-identifiers.js
```

This shows all identifiers used in the codebase.

