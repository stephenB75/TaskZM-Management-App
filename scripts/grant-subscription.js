#!/usr/bin/env node

/**
 * Grant a manual subscription to a user via the Supabase KV store.
 * Usage:
 *   node scripts/grant-subscription.js <email> [monthly|yearly]
 *
 * Example:
 *   node scripts/grant-subscription.js testuser@taskzm.com yearly
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gflesnyfpxqhaunfskrw.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required. Set it in your environment or .env file.');
  process.exit(1);
}

const email = process.argv[2];
const billingPeriod = (process.argv[3] || 'yearly').toLowerCase();

if (!email) {
  console.error('❌ Email address is required.');
  console.error('Usage: node scripts/grant-subscription.js <email> [monthly|yearly]');
  process.exit(1);
}

if (!['monthly', 'yearly'].includes(billingPeriod)) {
  console.error('❌ Billing period must be "monthly" or "yearly".');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function findUserByEmail(targetEmail) {
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const match = data.users.find((u) => u.email?.toLowerCase() === targetEmail.toLowerCase());
    if (match) return match;

    if (data.users.length < perPage) break;
    page += 1;
  }

  return null;
}

async function grantSubscription() {
  console.log(`\n🔍 Looking up user: ${email}`);
  const user = await findUserByEmail(email);

  if (!user) {
    console.error(`❌ User ${email} not found.`);
    process.exit(1);
  }

  console.log(`✅ Found user ${user.email} (ID: ${user.id})`);

  const startDate = new Date();
  const endDate = new Date(startDate);
  if (billingPeriod === 'yearly') {
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else {
    endDate.setMonth(endDate.getMonth() + 1);
  }

  const kvEntries = [
    { key: `user:${user.id}:tier`, value: 'pro' },
    { key: `user:${user.id}:subscription_status`, value: 'active' },
    { key: `user:${user.id}:subscription_store`, value: 'admin_granted' },
    { key: `user:${user.id}:subscription_start`, value: startDate.toISOString() },
    { key: `user:${user.id}:subscription_expires_at`, value: endDate.toISOString() },
    { key: `user:${user.id}:billing_period`, value: billingPeriod },
    {
      key: `user_${user.id}_subscription`,
      value: {
        tier: 'pro',
        status: 'active',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        cancelAtPeriodEnd: false,
        billingPeriod,
      },
    },
  ];

  console.log('💾 Updating subscription data in kv_store_65e6e67f...');
  const { error } = await supabase.from('kv_store_65e6e67f').upsert(kvEntries);
  if (error) {
    console.error('❌ Failed to update KV store:', error);
    process.exit(1);
  }

  console.log('\n🎉 Subscription granted successfully!');
  console.log('-------------------------------');
  console.log(`User: ${user.email}`);
  console.log(`Tier: Pro`);
  console.log(`Billing Period: ${billingPeriod}`);
  console.log(`Start: ${startDate.toISOString()}`);
  console.log(`End: ${endDate.toISOString()}`);
  console.log('Store: admin_granted');
  console.log('-------------------------------\n');
}

grantSubscription().catch((error) => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});

