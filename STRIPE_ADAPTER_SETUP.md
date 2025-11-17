# Stripe Adapter Configuration for RevenueCat

## Issue: "No available adapters" Error

This error occurs when RevenueCat is configured but Stripe is not set up as a payment adapter in the RevenueCat dashboard.

## How to Fix

### Step 1: Configure Stripe in RevenueCat Dashboard

1. Log in to your RevenueCat dashboard
2. Go to **Project Settings** → **Integrations**
3. Find **Stripe** in the list of integrations
4. Click **Connect** or **Configure**
5. Enter your Stripe API keys:
   - **Publishable Key** (starts with `pk_`)
   - **Secret Key** (starts with `sk_`)
6. Save the configuration

### Step 2: Link Products to Stripe Prices

1. Go to **Products** in RevenueCat dashboard
2. For each product (Monthly and Yearly):
   - Click on the product
   - Under **Stores**, ensure **Stripe** is selected
   - Link the product to a Stripe Price ID
   - Save

### Step 3: Verify Offerings

1. Go to **Offerings** in RevenueCat dashboard
2. Ensure your current offering includes:
   - Monthly package (linked to Stripe product)
   - Yearly package (linked to Stripe product)
3. Verify both packages have valid Stripe price IDs

### Step 4: Test Configuration

After configuration, the app should:
- Load offerings from RevenueCat
- Display correct prices
- Allow purchases through Stripe Checkout

## Environment Variables Required

- `VITE_REVENUECAT_WEB_PUBLIC_KEY` - RevenueCat public API key (already configured)
- Stripe keys are configured in RevenueCat dashboard, not in environment variables

## Verification

Check the browser console for:
- `✅ RevenueCat configured` - SDK initialized
- `✅ RevenueCat configuration verified, offerings accessible` - Adapter working
- `⚠️ RevenueCat configured but Stripe adapter not available` - Adapter not configured

