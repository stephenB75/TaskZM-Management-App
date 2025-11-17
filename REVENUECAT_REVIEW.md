# RevenueCat Implementation Review

## Overview
This document reviews the current RevenueCat integration in the TaskZM app.

## Current Implementation Status

### ✅ What's Working

1. **RevenueCat SDK Integration** (`src/lib/revenuecat.ts`)
   - SDK is properly loaded dynamically
   - Configuration function with user ID support
   - Proper error handling and initialization guards
   - Functions for fetching offerings, customer info, and restoring purchases

2. **Offerings Display** (`src/components/PricingDialog.tsx`)
   - Fetches offerings from RevenueCat when dialog opens
   - Displays monthly and yearly pricing dynamically
   - Falls back to default prices if RevenueCat unavailable
   - Shows loading states appropriately

3. **Subscription Status Sync** (`src/contexts/SubscriptionContext.tsx`)
   - Merges RevenueCat entitlements with backend subscription data
   - Checks for PRO entitlements (pro, PRO-Monthly, PRO-Yearly)
   - Periodic sync every 5 minutes
   - Syncs on window focus

4. **Webhook Handler** (`src/supabase/functions/server/index.tsx`)
   - RevenueCat webhook endpoint at `/revenuecat-webhook`
   - Handles subscription events
   - Maps entitlements to subscription tiers
   - Saves subscription data to KV store

### ⚠️ Issues & Gaps

1. **Missing Purchase Flow**
   - `PricingDialog` calls `upgradeToPro()` which throws an error in production
   - No RevenueCat `purchasePackage()` call is implemented
   - No integration with RevenueCat's purchase flow
   - The app appears to rely on Stripe checkout directly, bypassing RevenueCat for purchases

2. **Incomplete Package Matching**
   - `getOfferings()` uses simple keyword matching (`findByIdentifier('month')`)
   - No explicit product ID matching (e.g., `prodb18a767009`, `prod77566b1baf`)
   - May not reliably find packages if identifiers don't contain keywords

3. **No Purchase Error Handling**
   - No RevenueCat purchase error handling
   - No user-friendly error messages for purchase failures
   - No retry logic for failed purchases

4. **Missing Functions**
   - No `purchaseProSubscription()` function in `revenuecat.ts`
   - No package selection logic for monthly vs yearly
   - No purchase completion callback handling

5. **Webhook Verification**
   - Webhook uses simple Bearer token check
   - RevenueCat recommends HMAC signature verification for better security

## Architecture Analysis

### Current Flow:
```
User clicks "Upgrade" 
  → PricingDialog.handleUpgradeMonthly/Yearly()
  → upgradeToPro() (throws error in production)
  → ??? (unclear what happens next)
```

### Expected Flow (with RevenueCat):
```
User clicks "Upgrade"
  → PricingDialog identifies package (monthly/yearly)
  → purchaseProSubscription(packageIdentifier)
  → RevenueCat processes payment via Stripe
  → Webhook updates backend
  → Frontend refreshes subscription status
```

## Recommendations

### 1. Implement Purchase Flow
Add `purchaseProSubscription()` function to `src/lib/revenuecat.ts`:

```typescript
export async function purchaseProSubscription(
  packageType: 'monthly' | 'yearly'
): Promise<{ success: boolean; error?: string }> {
  if (!isRevenueCatConfigured()) {
    return { success: false, error: 'RevenueCat not configured' };
  }

  try {
    const offerings = await purchasesInstance.getOfferings();
    const availablePackages = offerings?.current?.availablePackages ?? [];
    
    // Find the correct package
    const packageIdentifier = packageType === 'monthly' ? 'monthly' : 'yearly';
    const selectedPackage = availablePackages.find((pkg: any) => {
      const identifier = pkg?.identifier?.toLowerCase?.() ?? '';
      return identifier.includes(packageIdentifier);
    });

    if (!selectedPackage) {
      return { success: false, error: 'Package not found' };
    }

    // Purchase the package
    const { customerInfo } = await purchasesInstance.purchasePackage(selectedPackage);
    
    // Verify entitlement
    const hasPro = Object.keys(customerInfo.entitlements.active).some(
      key => key.toLowerCase().includes('pro')
    );

    if (!hasPro) {
      return { success: false, error: 'Purchase completed but entitlement not active' };
    }

    return { success: true };
  } catch (error: any) {
    console.error('RevenueCat purchase error:', error);
    return { 
      success: false, 
      error: error?.message || 'Purchase failed' 
    };
  }
}
```

### 2. Update PricingDialog
Modify `handleUpgradeMonthly` and `handleUpgradeYearly` to use RevenueCat purchase:

```typescript
const handleUpgradeMonthly = async () => {
  try {
    setIsUpgrading(true);
    await configureRevenueCat(user.id);
    
    const result = await purchaseProSubscription('monthly');
    if (!result.success) {
      throw new Error(result.error || 'Purchase failed');
    }
    
    await refreshSubscription();
    toast.success(SUBSCRIPTION_UI_TEXT.messages.upgradeSuccess);
    onOpenChange(false);
  } catch (error: any) {
    toast.error(SUBSCRIPTION_UI_TEXT.upgrade.failed, {
      description: error.message,
    });
  } finally {
    setIsUpgrading(false);
  }
};
```

### 3. Improve Package Matching
Add explicit product ID matching:

```typescript
const REVENUECAT_MONTHLY_PRODUCT_ID = 'prodb18a767009';
const REVENUECAT_YEARLY_PRODUCT_ID = 'prod77566b1baf';

const findPackage = (type: 'monthly' | 'yearly') => {
  const productId = type === 'monthly' 
    ? REVENUECAT_MONTHLY_PRODUCT_ID 
    : REVENUECAT_YEARLY_PRODUCT_ID;
  
  return availablePackages.find((pkg: any) => {
    const pkgProductId = pkg?.storeProduct?.identifier ?? '';
    const pkgIdentifier = pkg?.identifier?.toLowerCase() ?? '';
    
    return pkgProductId === productId || 
           pkgIdentifier.includes(type) ||
           pkgIdentifier.includes('month') && type === 'monthly' ||
           pkgIdentifier.includes('year') && type === 'yearly';
  });
};
```

### 4. Enhance Webhook Security
Implement HMAC signature verification:

```typescript
import { createHmac } from 'crypto';

// Verify webhook signature
const signature = c.req.header('Authorization');
const payload = await c.req.text();
const expectedSignature = createHmac('sha256', webhookSecret)
  .update(payload)
  .digest('hex');

if (signature !== `sha256=${expectedSignature}`) {
  return c.json({ error: 'Invalid signature' }, 401);
}
```

### 5. Add Error Handling
Implement comprehensive error handling for:
- Network failures
- Payment declined
- User cancellation
- Invalid package
- Entitlement not granted

## Environment Variables Required

- `VITE_REVENUECAT_WEB_PUBLIC_KEY` - Public API key for frontend
- `REVENUECAT_WEBHOOK_SECRET` - Secret for webhook verification (backend)

## Testing Checklist

- [ ] RevenueCat SDK loads correctly
- [ ] Offerings are fetched and displayed
- [ ] Monthly package purchase works
- [ ] Yearly package purchase works
- [ ] Purchase errors are handled gracefully
- [ ] Webhook receives and processes events
- [ ] Subscription status updates after purchase
- [ ] Restore purchases works
- [ ] Entitlements are correctly mapped to features

## Next Steps

1. Implement `purchaseProSubscription()` function
2. Update `PricingDialog` to use RevenueCat purchases
3. Add product ID constants for reliable package matching
4. Enhance webhook security with HMAC verification
5. Add comprehensive error handling
6. Test end-to-end purchase flow
7. Document the complete purchase flow

