# Remove Admin Role Script

This script removes the admin role from a user and sets them to a regular member with Pro subscription.

## Prerequisites

1. **Environment Variables**: Make sure you have `SUPABASE_SERVICE_ROLE_KEY` set in your `.env` file or as an environment variable.

2. **Dependencies**: The script requires `@supabase/supabase-js` and `dotenv` packages.

## Usage

```bash
node scripts/remove-admin-role.js "stephen.brown@example.com"
```

Replace `stephen.brown@example.com` with Stephen Brown's actual email address.

## What the Script Does

1. **Finds the user** by email address
2. **Displays current status** (role and tier)
3. **Removes admin role** - Sets role to `'member'`
4. **Sets Pro subscription** - Updates tier to `'pro'` and activates subscription
5. **Verifies changes** - Confirms the updates were successful

## Changes Made

- **Role**: `admin` → `member`
- **Tier**: `free` → `pro`
- **Subscription Status**: Set to `active`
- **Subscription Start Date**: Set to current date/time

## Example Output

```
🔍 Looking up user: stephen.brown@example.com
✅ Found user: stephen.brown@example.com (ID: abc123...)
   Name: Stephen Brown

📊 Current Status:
   Role: admin
   Tier: free

🔄 Updating role to 'member'...
✅ Role updated to: member

🔄 Updating tier to 'pro'...
✅ Tier updated to: pro
✅ Subscription status set to: active

🔍 Verifying changes...

✅ Success! Updated user stephen.brown@example.com:
   Role: admin → member
   Tier: free → pro

📝 Summary:
   - Admin role removed
   - Pro subscription activated
   - User is now a regular member with Pro access
```

## Notes

- The script uses the Supabase Admin API (service role key) to bypass authentication
- All changes are made directly to the KV store (`kv_store_65e6e67f` table)
- The script updates subscription data in multiple formats for compatibility
- After running, Stephen Brown will no longer have admin access but will have Pro features

