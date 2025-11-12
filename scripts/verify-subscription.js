#!/usr/bin/env node
/**
 * TaskZM Subscription Verification Script
 * Verifies subscription plan for a user by email
 * 
 * Usage: node scripts/verify-subscription.js <email>
 * Example: node scripts/verify-subscription.js "stephen.brown@example.com"
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

// Get Supabase credentials from environment or use defaults
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gflesnyfpxqhaunfskrw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not found in environment variables');
  console.error('   Please set it in .env file or as environment variable');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.error('❌ Error: Email address required');
  console.error('   Usage: node scripts/verify-subscription.js <email>');
  console.error('   Example: node scripts/verify-subscription.js "stephen.brown@example.com"');
  process.exit(1);
}

async function verifySubscription() {
  try {
    console.log(`\n🔍 Verifying subscription for: ${email}\n`);
    console.log('='.repeat(60));

    // Step 1: Find user by email
    console.log('\n📧 Step 1: Finding user by email...');
    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError);
      process.exit(1);
    }

    const user = usersData.users.find(u => 
      u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!user) {
      console.error(`❌ User with email "${email}" not found`);
      console.log('\n💡 Available users:');
      usersData.users.slice(0, 10).forEach(u => {
        console.log(`   - ${u.email} (${u.user_metadata?.name || 'No name'})`);
      });
      if (usersData.users.length > 10) {
        console.log(`   ... and ${usersData.users.length - 10} more`);
      }
      process.exit(1);
    }

    console.log(`✅ User found: ${user.email}`);
    console.log(`   Name: ${user.user_metadata?.name || 'Not set'}`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`);

    // Step 2: Query subscription data from KV store
    console.log('\n💳 Step 2: Checking subscription data...');
    
    const userId = user.id;
    
    // Query KV store for subscription data
    const { data: kvData, error: kvError } = await supabase
      .from('kv_store_65e6e67f')
      .select('key, value')
      .in('key', [
        `user:${userId}:tier`,
        `user:${userId}:subscription_status`,
        `user:${userId}:subscription_store`,
        `user:${userId}:subscription_start`,
        `user:${userId}:subscription_expires_at`,
        `user:${userId}:stripe_customer_id`,
        `user_${userId}_subscription`,
        `user_${userId}_tier`,
        `user_${userId}_role`,
      ]);

    if (kvError) {
      console.error('❌ Error querying KV store:', kvError);
      process.exit(1);
    }

    // Parse subscription data
    const kvMap = {};
    kvData.forEach(item => {
      kvMap[item.key] = item.value;
    });

    // Extract subscription information
    const tier = kvMap[`user:${userId}:tier`] || kvMap[`user_${userId}_tier`] || 'free';
    const status = kvMap[`user:${userId}:subscription_status`] || 'none';
    const store = kvMap[`user:${userId}:subscription_store`] || null;
    const startDate = kvMap[`user:${userId}:subscription_start`] || null;
    const expiresAt = kvMap[`user:${userId}:subscription_expires_at`] || null;
    const stripeCustomerId = kvMap[`user:${userId}:stripe_customer_id`] || null;
    const legacySubscription = kvMap[`user_${userId}_subscription`] || null;
    const role = kvMap[`user_${userId}_role`] || 'member';

    // Determine subscription details
    const subscriptionTier = tier !== 'free' ? tier : (legacySubscription?.tier || 'free');
    const subscriptionStatus = status !== 'none' ? status : (legacySubscription?.status || 'active');
    const subscriptionStartDate = startDate || legacySubscription?.startDate || null;
    const subscriptionEndDate = expiresAt || legacySubscription?.endDate || null;
    const cancelAtPeriodEnd = legacySubscription?.cancelAtPeriodEnd || false;

    // Display results
    console.log('\n📊 Subscription Details:');
    console.log('='.repeat(60));
    console.log(`   Plan: ${subscriptionTier.toUpperCase()}`);
    console.log(`   Status: ${subscriptionStatus}`);
    console.log(`   Role: ${role}`);
    
    if (store) {
      console.log(`   Store: ${store}`);
    }
    
    if (subscriptionStartDate) {
      const start = new Date(subscriptionStartDate);
      console.log(`   Start Date: ${start.toLocaleDateString()} ${start.toLocaleTimeString()}`);
    }
    
    if (subscriptionEndDate) {
      const end = new Date(subscriptionEndDate);
      const isExpired = end < new Date();
      console.log(`   End Date: ${end.toLocaleDateString()} ${end.toLocaleTimeString()}`);
      console.log(`   Expired: ${isExpired ? 'Yes ❌' : 'No ✅'}`);
    } else if (subscriptionTier === 'pro') {
      console.log(`   End Date: Ongoing (no expiration)`);
    }
    
    if (cancelAtPeriodEnd) {
      console.log(`   Cancellation: Will cancel at period end`);
    }
    
    if (stripeCustomerId) {
      console.log(`   Stripe Customer ID: ${stripeCustomerId}`);
    }

    // Additional info
    console.log('\n📋 Additional Information:');
    console.log('='.repeat(60));
    console.log(`   Webhook Format Tier: ${tier || 'not set'}`);
    console.log(`   Webhook Format Status: ${status || 'not set'}`);
    console.log(`   Legacy Format: ${legacySubscription ? 'Yes' : 'No'}`);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📝 Summary:');
    console.log('='.repeat(60));
    
    if (subscriptionTier === 'pro') {
      console.log(`✅ User ${email} has an ACTIVE PRO subscription`);
      if (subscriptionStatus === 'active') {
        console.log(`   Subscription is active and in good standing`);
      } else if (subscriptionStatus === 'cancelled') {
        console.log(`   ⚠️  Subscription is cancelled but remains active until ${subscriptionEndDate ? new Date(subscriptionEndDate).toLocaleDateString() : 'period end'}`);
      } else {
        console.log(`   ⚠️  Subscription status: ${subscriptionStatus}`);
      }
    } else {
      console.log(`ℹ️  User ${email} is on the FREE plan`);
    }

    console.log('\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verifySubscription();

