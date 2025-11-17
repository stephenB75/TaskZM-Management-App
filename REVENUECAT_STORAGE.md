# RevenueCat Data Storage

## Overview
RevenueCat SDK manages subscription data and does NOT use localStorage. The app uses RevenueCat as the **source of truth** for subscription status.

## Data Flow

### 1. RevenueCat SDK (Source of Truth)
- RevenueCat SDK manages its own internal state
- SDK stores data in its own internal cache (not accessible via localStorage)
- Subscription status is fetched via `getCustomerInfo()` API call
- **No localStorage usage by RevenueCat SDK itself**

### 2. App's localStorage (Cache Only)
- Used as a **cache/fallback** for offline access
- Key format: `subscription_${userId}`
- **NOT the source of truth** - only used when:
  - RevenueCat is unavailable
  - Backend is unavailable
  - Offline mode

### 3. Backend Database (Sync Target)
- Synced FROM RevenueCat (RevenueCat → Backend)
- Used as secondary source when RevenueCat unavailable
- Backend is updated when RevenueCat status changes

## Data Priority (Source of Truth Order)

1. **RevenueCat SDK** (Primary Source)
   - Fetched via `getSubscriptionStatus()` → `getCustomerInfo()`
   - Checks entitlements: `PRO-Monthly`, `PRO-Yearly`, or legacy `pro`
   - Always checked first in `loadSubscription()`

2. **Backend Database** (Secondary Source)
   - Used when RevenueCat unavailable
   - Synced from RevenueCat when available

3. **localStorage** (Cache/Fallback)
   - Only used when both RevenueCat and backend unavailable
   - Last resort for offline access

## Code Locations

### RevenueCat Status Check
- `src/lib/revenuecat.ts` → `getSubscriptionStatus()`
  - Calls `purchasesInstance.getCustomerInfo()`
  - Checks `customerInfo.entitlements.active`
  - Returns `'pro'` or `'free'`

### Subscription Context
- `src/contexts/SubscriptionContext.tsx` → `loadSubscription()`
  - First checks RevenueCat (line 88-98)
  - Syncs RevenueCat status to backend (line 101-171)
  - Falls back to backend if RevenueCat unavailable (line 174)
  - Falls back to localStorage only as last resort (line 197-210)

### localStorage Keys
- `subscription_${userId}` - Cached subscription data
- Set after successful RevenueCat/backend fetch
- Cleared on sign out

## Important Notes

1. **RevenueCat SDK does NOT use localStorage**
   - SDK manages its own internal state
   - Data is fetched via API calls, not localStorage

2. **localStorage is cache only**
   - Never used as source of truth
   - Only for offline/fallback scenarios

3. **RevenueCat is always checked first**
   - `loadSubscription()` always tries RevenueCat first
   - Backend and localStorage are fallbacks

4. **No hardcoded subscription data**
   - Initial state defaults to 'free' (safe default)
   - All actual subscription data comes from RevenueCat
   - Feature flags are derived from tier, not hardcoded

## Verification

To verify RevenueCat is source of truth:
1. Check `src/contexts/SubscriptionContext.tsx` line 83-98
2. RevenueCat status is fetched first
3. Backend is synced FROM RevenueCat (not the other way)
4. localStorage is only set AFTER fetching from RevenueCat/backend

