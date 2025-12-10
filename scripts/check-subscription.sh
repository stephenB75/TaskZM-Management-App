#!/bin/bash
# TaskZM Subscription Verification Script
# Verifies subscription plan for Stephen Brown
#
# Usage: ./scripts/check-subscription.sh <email>
# Example: ./scripts/check-subscription.sh "stephen.brown@example.com"

EMAIL="${1:-stephen.brown@example.com}"
API_BASE="https://gflesnyfpxqhaunfskrw.supabase.co/functions/v1/taskzm-database-function"

echo ""
echo "🔍 Verifying subscription for: $EMAIL"
echo "============================================================"
echo ""
echo "📝 Note: This requires admin authentication."
echo ""
echo "To verify subscription, you can:"
echo ""
echo "1. Use the Admin API endpoint (requires admin access token):"
echo "   curl -X GET \\"
echo "     \"$API_BASE/admin/get-user/$(echo $EMAIL | sed 's/@/%40/g')\" \\"
echo "     -H \"Authorization: Bearer YOUR_ADMIN_TOKEN\""
echo ""
echo "2. Check Supabase Dashboard:"
echo "   - Go to: https://supabase.com/dashboard/project/gflesnyfpxqhaunfskrw"
echo "   - Navigate to: Database → Table Editor → kv_store_65e6e67f"
echo "   - Search for keys containing the user's subscription data"
echo ""
echo "3. Use the Node.js verification script:"
echo "   node scripts/verify-subscription.js \"$EMAIL\""
echo ""
echo "4. Check via Supabase Auth Dashboard:"
echo "   - Go to: Authentication → Users"
echo "   - Search for: $EMAIL"
echo "   - Get User ID, then query KV store"
echo ""
echo "============================================================"

