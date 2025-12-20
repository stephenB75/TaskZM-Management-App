#!/usr/bin/env node
/**
 * TaskZM RevenueCat User Registration Check
 * Checks which users have been registered with RevenueCat
 * 
 * Note: Users are automatically registered in RevenueCat when:
 * 1. They log in and the app calls configureRevenueCat(userId)
 * 2. They interact with RevenueCat SDK (getOfferings, purchase, etc.)
 * 
 * This script checks which users from Supabase have likely been registered
 * by checking if they have any RevenueCat webhook data.
 * 
 * Usage: node scripts/check-revenuecat-users.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gflesnyfpxqhaunfskrw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not found in environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkRevenueCatUsers() {
  try {
    console.log('\n🔍 Checking RevenueCat User Registration Status...\n');
    console.log('='.repeat(60));

    // Get all users
    console.log('\n📧 Step 1: Fetching all users...');
    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError);
      process.exit(1);
    }

    const users = usersData.users;
    console.log(`✅ Found ${users.length} total user(s)\n`);

    // Check each user for RevenueCat registration indicators
    console.log('💳 Step 2: Checking RevenueCat registration status...');
    console.log('='.repeat(60));

    const results = [];
    let registeredCount = 0;
    let notRegisteredCount = 0;
    let demoCount = 0;

    for (const user of users) {
      if (!user.email) {
        continue;
      }

      const userId = user.id;
      
      // Check for RevenueCat indicators:
      // 1. Subscription store from RevenueCat (stripe, app_store, play_store)
      // 2. Webhook data (subscription_store indicates webhook was received)
      // 3. Demo accounts (not registered with RevenueCat, use demo_account store)
      
      const { data: kvData, error: kvError } = await supabase
        .from('kv_store_65e6e67f')
        .select('key, value')
        .in('key', [
          `user:${userId}:subscription_store`,
          `user:${userId}:tier`,
          `user_${userId}_is_demo`,
        ]);

      if (kvError) {
        console.error(`❌ Error checking ${user.email}:`, kvError);
        continue;
      }

      const kvMap = {};
      kvData.forEach(item => {
        kvMap[item.key] = item.value;
      });

      const store = kvMap[`user:${userId}:subscription_store`];
      const isDemo = kvMap[`user_${userId}_is_demo`] === 'true';
      const tier = kvMap[`user:${userId}:tier`] || 'free';

      // Determine registration status
      let status = 'unknown';
      let reason = '';

      if (isDemo) {
        status = 'demo';
        reason = 'Demo account (not registered with RevenueCat)';
        demoCount++;
      } else if (store === 'stripe' || store === 'app_store' || store === 'play_store') {
        status = 'registered';
        reason = `Registered via ${store} (has active subscription)`;
        registeredCount++;
      } else if (store === 'demo_account') {
        status = 'demo';
        reason = 'Demo account';
        demoCount++;
      } else if (tier === 'pro' && !store) {
        status = 'possibly_registered';
        reason = 'Pro tier but no store info (may have been granted manually)';
        registeredCount++;
      } else {
        status = 'not_registered';
        reason = 'No RevenueCat webhook data (user may not have logged in or interacted with RevenueCat)';
        notRegisteredCount++;
      }

      results.push({
        email: user.email,
        userId,
        status,
        reason,
        store,
        tier,
        isDemo,
      });

      const statusIcon = status === 'registered' ? '✅' : status === 'demo' ? '🎭' : status === 'possibly_registered' ? '⚠️' : '❌';
      console.log(`${statusIcon} ${user.email}`);
      console.log(`   Status: ${status}`);
      console.log(`   Reason: ${reason}`);
      if (store) {
        console.log(`   Store: ${store}`);
      }
      console.log(`   Tier: ${tier}`);
      console.log('');
    }

    // Summary
    console.log('='.repeat(60));
    console.log('📊 Summary:');
    console.log('='.repeat(60));
    console.log(`   Total users: ${users.length}`);
    console.log(`   ✅ Registered with RevenueCat: ${registeredCount}`);
    console.log(`   🎭 Demo accounts: ${demoCount}`);
    console.log(`   ❌ Not registered: ${notRegisteredCount}`);
    console.log('');

    // Explanation
    console.log('📝 Notes:');
    console.log('='.repeat(60));
    console.log('• Users are automatically registered in RevenueCat when they:');
    console.log('  1. Log in to the app (configureRevenueCat is called)');
    console.log('  2. View pricing/offerings (getOfferings is called)');
    console.log('  3. Make a purchase (purchaseProSubscription is called)');
    console.log('');
    console.log('• RevenueCat registration happens client-side when the SDK is configured');
    console.log('  with the user\'s ID (appUserId). No server-side registration is needed.');
    console.log('');
    console.log('• Users with "not_registered" status may not have:');
    console.log('  - Logged in since RevenueCat was integrated');
    console.log('  - Opened the pricing dialog');
    console.log('  - Made any purchases');
    console.log('');
    console.log('• Demo accounts are not registered with RevenueCat (they use demo_account store)');
    console.log('');

    // List users that need registration
    const notRegistered = results.filter(r => r.status === 'not_registered');
    if (notRegistered.length > 0) {
      console.log('⚠️  Users not registered with RevenueCat:');
      notRegistered.forEach(r => {
        console.log(`   • ${r.email}`);
      });
      console.log('');
      console.log('💡 These users will be automatically registered when they:');
      console.log('   - Log in and the app loads');
      console.log('   - Open the pricing dialog');
      console.log('   - Try to make a purchase');
      console.log('');
    }

    console.log('✅ Check complete!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkRevenueCatUsers();

