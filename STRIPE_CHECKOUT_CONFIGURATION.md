# Stripe Checkout Configuration Guide

## Payment Form Field Activation & Logo Configuration

Since we're using RevenueCat Web Billing, which redirects to Stripe Checkout, some settings need to be configured in the Stripe Dashboard.

### 1. Logo Configuration (Stripe Dashboard)

To make the logo larger and more visible on the payment form:

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Settings** → **Branding**
3. Under **Checkout branding**:
   - Upload your logo (recommended size: 128x128px or larger, square format)
   - Set logo size to **Large** or **Medium**
   - Ensure the logo is high resolution for best display
4. Save changes

**Note:** The logo should be:
- Square format (1:1 aspect ratio)
- At least 128x128px (256x256px recommended)
- PNG or SVG format
- Transparent background preferred

### 2. Payment Form Field Activation

Stripe Checkout requires country selection before payment fields become active (for tax calculation). To improve the user experience:

#### Option A: Configure in Stripe Dashboard (Recommended)

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Settings** → **Checkout**
3. Under **Customer information**:
   - Enable **"Auto-detect country"** - This will attempt to pre-select the country based on the user's IP address
   - Enable **"Collect billing address"** - Set to **"Auto"** to pre-fill when possible
4. Under **Payment methods**:
   - Ensure **"Card"** is enabled
   - Consider enabling **"Save payment method"** for returning customers
5. Save changes

#### Option B: Use Custom Checkout Session (Advanced)

If you need more control, you can use the custom checkout session endpoint at:
- `POST /make-server-65e6e67f/create-checkout-session`

This endpoint already includes:
- `billing_address_collection: 'auto'` - Attempts to pre-fill billing address
- `payment_method_collection: 'always'` - Always collects payment method
- Logo URL configuration

### 3. Testing the Configuration

After making changes:

1. Clear browser cache
2. Test the checkout flow:
   - Click "Upgrade" in the app
   - Verify logo appears and is visible
   - Verify country is auto-detected (if enabled)
   - Verify payment fields activate when clicking into them

### 4. Mobile vs Desktop

Stripe Checkout is responsive and will:
- Show larger logo on desktop
- Show appropriately sized logo on mobile
- Adapt form fields for touch input on mobile

### 5. Troubleshooting

**Logo not showing:**
- Verify logo URL is publicly accessible (HTTPS)
- Check logo format (PNG/SVG recommended)
- Ensure logo meets size requirements
- Check Stripe Dashboard branding settings

**Fields not activating:**
- Ensure country is selected first (required by Stripe for tax calculation)
- Check if auto-detect country is enabled in Stripe Dashboard
- Verify billing address collection is set to "Auto"
- Clear browser cache and cookies

**Fields activate on click but not before country selection:**
- This is expected Stripe behavior for tax compliance
- The country selection is required before payment fields can be used
- Consider adding a hint in the app (already implemented) to guide users

## Current Implementation

The app currently:
- ✅ Shows a helpful tip about selecting country first
- ✅ Detects user's country from browser locale
- ✅ Provides personalized hints based on detected country
- ✅ Includes logo URL in checkout session creation
- ✅ Configures billing address collection to 'auto'

## Next Steps

1. **Configure Stripe Dashboard:**
   - Upload logo in Settings → Branding
   - Enable auto-detect country in Settings → Checkout
   - Set billing address collection to "Auto"

2. **Test the flow:**
   - Verify logo appears on checkout page
   - Verify country is auto-detected
   - Verify fields activate properly

3. **Monitor user feedback:**
   - Check if users still report issues
   - Adjust hints/messages if needed

