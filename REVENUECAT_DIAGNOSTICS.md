# RevenueCat Connection Diagnostics Guide

## Overview

This document outlines the systematic approach to diagnosing RevenueCat connection issues. A comprehensive diagnostic tool has been integrated into the PricingDialog that will automatically run when the dialog opens.

## Diagnostic Tool

The diagnostic tool (`src/lib/revenuecat-diagnostics.ts`) performs 8 systematic checks:

### 1. Environment Variables Check
- ✅ Verifies `VITE_REVENUECAT_WEB_PUBLIC_KEY` exists
- ✅ Validates API key format (should start with `rc_` or `rcb_`)
- ✅ Checks key type (PUBLIC web key should start with `rcb_`)

### 2. Platform Detection
- ✅ Detects current platform (web/iOS/Android)
- ✅ Ensures correct SDK is used for platform

### 3. SDK Import Check
- ✅ Verifies `@revenuecat/purchases-js` is installed
- ✅ Checks that Purchases class is available
- ✅ Validates SDK methods are accessible

### 4. Configuration Status
- ✅ Checks if RevenueCat is configured
- ✅ Verifies user ID is set
- ✅ Identifies configuration issues

### 5. SDK Instance Check
- ✅ Tests `getSharedInstance()` call
- ✅ Verifies instance methods are available
- ✅ Identifies instance initialization issues

### 6. Offerings Call Test
- ✅ Tests `getOfferings()` function
- ✅ Checks for current offering
- ✅ Validates package count
- ✅ Identifies API errors (401, network, etc.)

### 7. Product Data Check
- ✅ Verifies packages have product data
- ✅ Identifies packages missing product information
- ✅ Checks product object structure

### 8. Direct SDK Call Test
- ✅ Bypasses wrapper functions
- ✅ Tests direct SDK API calls
- ✅ Identifies SDK-level issues

## How to Use

### Automatic Diagnostics
The diagnostic tool runs automatically when:
- The PricingDialog opens
- RevenueCat is configured

Check the browser console for the diagnostic report.

### Manual Diagnostics
You can also run diagnostics manually:

```typescript
import { runRevenueCatDiagnostics, logDiagnosticReport } from './lib/revenuecat-diagnostics';

const report = await runRevenueCatDiagnostics();
logDiagnosticReport(report);
```

## Common Issues and Solutions

### Issue 1: API Key Not Found
**Symptoms:**
- Diagnostic shows "VITE_REVENUECAT_WEB_PUBLIC_KEY not found"
- Configuration fails

**Solutions:**
1. Check `.env` file exists in project root
2. Verify key is named exactly: `VITE_REVENUECAT_WEB_PUBLIC_KEY`
3. Ensure key starts with `VITE_` prefix
4. Restart development server after adding key

### Issue 2: API Key Invalid Format
**Symptoms:**
- Diagnostic shows "API key format is invalid"
- Key doesn't start with `rc_` or `rcb_`

**Solutions:**
1. Get PUBLIC API key from RevenueCat Dashboard
2. For web apps, use key starting with `rcb_`
3. Verify key is for the correct app (app4689b9299f)
4. Update `.env` file and restart server

### Issue 3: SDK Not Configured
**Symptoms:**
- Diagnostic shows "RevenueCat is not configured"
- `isRevenueCatConfigured()` returns false

**Solutions:**
1. Ensure `configureRevenueCat()` is called on user login
2. Check that user ID is available when configuring
3. Verify API key is set before configuration
4. Check for configuration errors in console

### Issue 4: No Current Offering
**Symptoms:**
- Diagnostic shows "No current offering in RevenueCat"
- `getOfferings()` returns null

**Solutions:**
1. Go to RevenueCat Dashboard → Offerings
2. Ensure at least one offering exists
3. Set an offering as "current"
4. Verify offering has packages attached

### Issue 5: No Packages Found
**Symptoms:**
- Diagnostic shows "No packages found in offering"
- Package count is 0

**Solutions:**
1. Go to RevenueCat Dashboard → Offerings
2. Click on your current offering
3. Add packages to the offering
4. Verify packages are linked to products

### Issue 6: Missing Product Data
**Symptoms:**
- Diagnostic shows "packages without product data"
- Packages exist but `product` object is empty

**Solutions:**
1. Go to RevenueCat Dashboard → Products
2. Ensure products are created
3. Link products to packages in the offering
4. Verify Stripe integration is configured
5. Check that products have pricing set in Stripe

### Issue 7: 401 Unauthorized Error
**Symptoms:**
- Diagnostic shows "API credentials error (401 Unauthorized)"
- Error message includes "credentials" or "Unauthorized"

**Solutions:**
1. Verify API key is correct in RevenueCat Dashboard
2. Check API key hasn't been revoked or expired
3. Ensure you're using PUBLIC key (not secret key)
4. Verify key is for correct app
5. Update `.env` file and restart server

### Issue 8: Network Errors
**Symptoms:**
- Diagnostic shows network/fetch errors
- Cannot connect to RevenueCat API

**Solutions:**
1. Check internet connection
2. Verify RevenueCat service status
3. Check for firewall/proxy blocking requests
4. Verify CORS settings if applicable

## Diagnostic Report Structure

The diagnostic report includes:

```typescript
{
  overallStatus: 'connected' | 'partial' | 'failed',
  results: [
    {
      step: string,
      status: 'success' | 'error' | 'warning' | 'info',
      message: string,
      data?: any,
      timestamp: string
    }
  ],
  summary: {
    apiKeyFound: boolean,
    apiKeyValid: boolean,
    sdkConfigured: boolean,
    sdkInitialized: boolean,
    offeringsAvailable: boolean,
    packagesFound: boolean,
    productDataAvailable: boolean
  },
  recommendations: string[]
}
```

## Integration Points

### PricingDialog Integration
The diagnostic tool is automatically called when:
- PricingDialog opens (`open === true`)
- RevenueCat is configured
- User is logged in

### Console Output
All diagnostic information is logged to the browser console with:
- ✅ Success indicators
- ❌ Error indicators
- ⚠️ Warning indicators
- ℹ️ Info indicators

## Next Steps After Diagnostics

1. **Review the diagnostic report** - Check overall status and individual step results
2. **Follow recommendations** - The report includes specific recommendations for each issue
3. **Check RevenueCat Dashboard** - Verify configuration matches diagnostic findings
4. **Test again** - Re-run diagnostics after making changes
5. **Check console logs** - Additional detailed logs are available in the console

## Verification Checklist

Use this checklist to verify RevenueCat setup:

- [ ] API key is in `.env` file as `VITE_REVENUECAT_WEB_PUBLIC_KEY`
- [ ] API key starts with `rcb_` (for web)
- [ ] API key is for app `app4689b9299f`
- [ ] RevenueCat SDK is installed (`@revenuecat/purchases-js`)
- [ ] `configureRevenueCat()` is called on user login
- [ ] A "current" offering is set in RevenueCat dashboard
- [ ] Packages are added to the offering
- [ ] Products are created in RevenueCat
- [ ] Products are linked to packages
- [ ] Stripe integration is configured
- [ ] Products have pricing set in Stripe

## Support

If diagnostics show all checks passing but issues persist:
1. Check browser console for detailed error messages
2. Verify RevenueCat dashboard configuration matches expected values
3. Test with a fresh browser session (clear cache)
4. Check network tab for failed API requests
5. Verify environment variables are loaded correctly

