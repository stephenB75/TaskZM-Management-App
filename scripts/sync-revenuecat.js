#!/usr/bin/env node
/**
 * TaskZM RevenueCat Sync Verification Script
 * Verifies subscription data is correctly synced from RevenueCat webhooks
 * 
 * This script:
 * 1. Fetches all users from Supabase (or filters by email)
 * 2. Checks subscription data stored in KV store (from RevenueCat webhooks)
 * 3. Verifies data consistency between webhook format and legacy format
 * 4. Reports any inconsistencies or missing data
 * 
 * Note: RevenueCat webhooks automatically sync subscriptions when events occur.
 * This script verifies the data is correct and consistent.
 * 
 * Usage: node scripts/sync-revenuecat.js [email]
 * Example: node scripts/sync-revenuecat.js "stephen75@me.com"
 *          node scripts/sync-revenuecat.js (verifies all users)
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

// Get Supabase credentials from environment
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gflesnyfpxqhaunfskrw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REVENUECAT_WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not found in environment variables');
  process.exit(1);
}

// REVENUECAT_WEBHOOK_SECRET is optional for verification script
// (only needed for processing webhooks, not for reading subscription data)

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Get optional email filter from command line
const emailFilter = process.argv[2];

async function syncUserSubscription(userId, email) {
  try {
    console.log(`\n🔄 Syncing subscription for: ${email} (${userId})`);
    
    // Step 1: Get current subscription data from KV store
    const { data: kvData, error: kvError } = await supabase
      .from('kv_store_65e6e67f')
      .select('key, value')
      .in('key', [
        `user:${userId}:tier`,
        `user:${userId}:subscription_status`,
        `user:${userId}:subscription_store`,
        `user:${userId}:subscription_start`,
        `user:${userId}:subscription_expires_at`,
        `user:${userId}:billing_period`,
        `user_${userId}_subscription`,
      ]);

    if (kvError) {
      console.error(`❌ Error fetching subscription data:`, kvError);
      return { success: false, error: kvError.message };
    }

    const kvMap = {};
    kvData.forEach(item => {
      kvMap[item.key] = item.value;
    });

    const currentTier = kvMap[`user:${userId}:tier`] || 'free';
    const currentStatus = kvMap[`user:${userId}:subscription_status`] || 'none';
    const currentStore = kvMap[`user:${userId}:subscription_store`] || null;
    const currentBillingPeriod = kvMap[`user:${userId}:billing_period`] || null;
    
    console.log(`   Current: ${currentTier} (${currentStatus}) from ${currentStore || 'none'}`);
    if (currentBillingPeriod) {
      console.log(`   Billing: ${currentBillingPeriod}`);
    }

    // Step 2: Verify subscription data is consistent
    // Note: RevenueCat webhooks automatically sync subscriptions when events occur
    // This script verifies the data stored in Supabase is correct and consistent

    // Step 2: Check for data consistency between formats
    const legacySubscription = kvMap[`user_${userId}_subscription`] || null;
    
    // Verify data consistency
    const webhookTier = kvMap[`user:${userId}:tier`] || 'free';
    const legacyTier = legacySubscription?.tier || 'free';
    const finalTier = webhookTier !== 'free' ? webhookTier : legacyTier;
    
    const webhookStatus = kvMap[`user:${userId}:subscription_status`] || 'none';
    const legacyStatus = legacySubscription?.status || 'active';
    const finalStatus = webhookStatus !== 'none' ? webhookStatus : legacyStatus;
    
    const billingPeriod = kvMap[`user:${userId}:billing_period`] || legacySubscription?.billingPeriod || null;
    const startDate = kvMap[`user:${userId}:subscription_start`] || legacySubscription?.startDate || null;
    const endDate = kvMap[`user:${userId}:subscription_expires_at`] || legacySubscription?.endDate || null;

    // Check for inconsistencies
    const hasInconsistency = 
      (webhookTier !== 'free' && legacyTier !== 'free' && webhookTier !== legacyTier) ||
      (webhookStatus !== 'none' && legacyStatus !== 'active' && webhookStatus !== legacyStatus);

    if (hasInconsistency) {
      console.log(`   ⚠️  Data inconsistency detected:`);
      if (webhookTier !== legacyTier) {
        console.log(`      Tier mismatch: webhook=${webhookTier}, legacy=${legacyTier}`);
      }
      if (webhookStatus !== legacyStatus) {
        console.log(`      Status mismatch: webhook=${webhookStatus}, legacy=${legacyStatus}`);
      }
    } else {
      console.log(`   ✅ Data is consistent`);
    }

    console.log(`   Final: ${finalTier} (${finalStatus}) from ${currentStore || 'none'}`);
    if (billingPeriod) {
      console.log(`   Billing: ${billingPeriod}`);
    }
    if (startDate) {
      console.log(`   Start: ${new Date(startDate).toLocaleDateString()}`);
    }
    if (endDate) {
      const isExpired = new Date(endDate) < new Date();
      console.log(`   End: ${new Date(endDate).toLocaleDateString()} ${isExpired ? '(Expired)' : ''}`);
    }

    return {
      success: true,
      subscription: {
        tier: finalTier,
        status: finalStatus,
        store: currentStore,
        billingPeriod,
        startDate,
        endDate,
      },
      hasInconsistency,
      webhookFormat: { tier: webhookTier, status: webhookStatus },
      legacyFormat: { tier: legacyTier, status: legacyStatus },
    };

  } catch (error) {
    console.error(`❌ Error syncing subscription:`, error);
    return { success: false, error: error.message };
  }
}

async function syncAllUsers() {
  try {
    console.log('\n🔄 Starting RevenueCat subscription sync...\n');
    console.log('='.repeat(60));

    // Step 1: Get all users
    console.log('\n📧 Step 1: Fetching users...');
    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError);
      process.exit(1);
    }

    let users = usersData.users;
    
    // Filter by email if provided
    if (emailFilter) {
      users = users.filter(u => 
        u.email?.toLowerCase().includes(emailFilter.toLowerCase())
      );
      
      if (users.length === 0) {
        console.error(`❌ No users found matching email: ${emailFilter}`);
        process.exit(1);
      }
      
      console.log(`✅ Found ${users.length} user(s) matching "${emailFilter}"`);
    } else {
      console.log(`✅ Found ${users.length} total user(s)`);
    }

    // Step 2: Verify subscription data for each user
    console.log('\n💳 Step 2: Verifying subscription data...');
    console.log('='.repeat(60));
    console.log('Note: RevenueCat webhooks automatically sync subscriptions.');
    console.log('This script verifies the data stored in Supabase is correct.\n');

    const results = [];
    let successCount = 0;
    let changedCount = 0;
    let errorCount = 0;

    for (const user of users) {
      if (!user.email) {
        console.log(`\n⚠️  Skipping user ${user.id} (no email)`);
        continue;
      }

      const result = await syncUserSubscription(user.id, user.email);
      results.push({ user: user.email, ...result });

      if (result.success) {
        successCount++;
        if (result.hasInconsistency) {
          changedCount++;
        }
      } else {
        errorCount++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Step 3: Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Verification Summary:');
    console.log('='.repeat(60));
    console.log(`   Total users processed: ${users.length}`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ⚠️  Inconsistencies found: ${changedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   ✅ Consistent: ${successCount - changedCount}`);
    
    // Count subscription tiers
    const tierCounts = {};
    results.forEach(r => {
      if (r.subscription) {
        const tier = r.subscription.tier || 'free';
        tierCounts[tier] = (tierCounts[tier] || 0) + 1;
      }
    });
    
    if (Object.keys(tierCounts).length > 0) {
      console.log('\n📊 Subscription Distribution:');
      Object.entries(tierCounts).forEach(([tier, count]) => {
        console.log(`   ${tier}: ${count} user(s)`);
      });
    }

    // Show users with inconsistencies
    if (changedCount > 0) {
      console.log('\n⚠️  Users with data inconsistencies:');
      results
        .filter(r => r.hasInconsistency)
        .forEach(r => {
          console.log(`   • ${r.user}:`);
          console.log(`     Webhook: ${r.webhookFormat.tier} (${r.webhookFormat.status})`);
          console.log(`     Legacy: ${r.legacyFormat.tier} (${r.legacyFormat.status})`);
        });
    }

    // Show errors
    if (errorCount > 0) {
      console.log('\n❌ Users with errors:');
      results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`   • ${r.user}: ${r.error || 'Unknown error'}`);
        });
    }

    console.log('\n✅ Sync complete!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the sync
syncAllUsers();

