# Stripe Payment Processing Diagnostics

## Issue: Stripe Not Processing Payments Through RevenueCat

This document helps diagnose why Stripe payments aren't being processed.

## Common Causes

### 1. **Stripe Adapter Not Configured in RevenueCat Dashboard**

**Symptoms:**
- Console shows: `⚠️ RevenueCat configured but Stripe adapter not available`
- Error: `No available adapters`
- `purchasePackage` throws an error without checkout URL

**Fix:**
1. Go to RevenueCat Dashboard → **Project Settings** → **Integrations**
2. Find **Stripe** and click **Connect** or **Configure**
3. Enter your Stripe API keys:
   - **Publishable Key** (starts with `pk_live_` or `pk_test_`)
   - **Secret Key** (starts with `sk_live_` or `sk_test_`)
4. Save configuration

### 2. **Products Not Linked to Stripe Prices**

**Symptoms:**
- Offerings load but packages have no product data
- Console shows: `Product object: undefined`
- Prices show as "—" or default values

**Fix:**
1. Go to RevenueCat Dashboard → **Products**
2. For each product (Monthly: `prodb18a767009`, Yearly: `prod77566b1baf`):
   - Click on the product
   - Under **Stores**, select **Stripe**
   - Link to a Stripe Price ID (create in Stripe if needed)
   - Save

### 3. **Packages Not Linked to Products in Offerings**

**Symptoms:**
- Offerings load but packages are empty
- Console shows: `Current offering has no packages`

**Fix:**
1. Go to RevenueCat Dashboard → **Offerings**
2. Select your current offering
3. Ensure packages are added:
   - Monthly package (identifier: `$rc_monthly` or similar)
   - Yearly package (identifier: `$rc_annual` or similar)
4. Each package must be linked to a product with Stripe price

### 4. **RevenueCat JS SDK Web Behavior**

**How it works:**
- On web, RevenueCat JS SDK with Stripe should return a `checkoutUrl` in the purchase result
- OR it may throw an error with a `checkoutUrl` property
- The app redirects to this URL to complete payment in Stripe Checkout

**What to check in console:**
- `🛒 Calling purchasePackage...` - Purchase initiated
- `📦 Purchase result received:` - Check for `checkoutUrl` in result
- `🔗 Opening Stripe Checkout from purchase result:` - Redirect happening
- OR `🔗 Purchase error contains checkout URL` - Checkout URL in error (also valid)

## Diagnostic Steps

### Step 1: Check Console Logs

When you click "Upgrade", look for these logs:

1. **Configuration:**
   ```
   ✅ RevenueCat configured
   ✅ RevenueCat configuration verified, offerings accessible
   ```
   OR
   ```
   ⚠️ RevenueCat configured but Stripe adapter not available
   ```

2. **Package Selection:**
   ```
   🛒 Purchasing monthly/yearly package:
   ```
   Check if `productId` and `price` are populated

3. **Purchase Attempt:**
   ```
   🛒 Calling purchasePackage...
   📦 Purchase result received:
   ```
   Check if `checkoutUrl` is present

4. **Error Handling:**
   ```
   ❌ RevenueCat purchase error:
   ❌ Error details:
   ```
   Check for `checkoutUrl` in error object

### Step 2: Verify RevenueCat Dashboard Configuration

1. **Stripe Integration:**
   - Dashboard → Project Settings → Integrations → Stripe
   - Status should be "Connected" (green)
   - Keys should be valid

2. **Products:**
   - Dashboard → Products
   - Monthly product (`prodb18a767009`) should have:
     - Stripe store selected
     - Stripe Price ID linked
   - Yearly product (`prod77566b1baf`) should have:
     - Stripe store selected
     - Stripe Price ID linked

3. **Offerings:**
   - Dashboard → Offerings
   - Current offering should have:
     - Monthly package with product linked
     - Yearly package with product linked

### Step 3: Test Purchase Flow

1. Open browser console
2. Click "Upgrade" button
3. Watch console logs for:
   - Package selection
   - Purchase attempt
   - Checkout URL detection
   - Any errors

4. **Expected Flow:**
   ```
   🛒 Purchasing monthly package: { identifier, productId, price }
   🛒 Calling purchasePackage...
   📦 Purchase result received: { hasCheckoutUrl: true, checkoutUrl: "https://..." }
   🔗 Opening Stripe Checkout from purchase result: https://...
   ```
   Then browser should redirect to Stripe Checkout

5. **If No Checkout URL:**
   - Check error details in console
   - Verify Stripe adapter is configured
   - Verify products are linked to Stripe prices

## Environment Variables

Required:
- `VITE_REVENUECAT_WEB_PUBLIC_KEY` - RevenueCat public API key (starts with `rcb_`)

Not required in app (configured in RevenueCat dashboard):
- Stripe keys (configured in RevenueCat dashboard)
- Stripe Price IDs (linked to products in RevenueCat dashboard)

## Next Steps

If after checking all above, payments still don't work:

1. **Check RevenueCat Dashboard Logs:**
   - Dashboard → Events
   - Look for purchase attempts
   - Check for errors

2. **Verify Stripe Dashboard:**
   - Stripe Dashboard → Products
   - Ensure prices exist and are active
   - Check API keys are correct

3. **Test with RevenueCat Test Mode:**
   - Use test API keys in RevenueCat
   - Use Stripe test mode
   - Test with Stripe test card: `4242 4242 4242 4242`

4. **Contact Support:**
   - Share console logs
   - Share RevenueCat dashboard configuration screenshots
   - Share error messages

