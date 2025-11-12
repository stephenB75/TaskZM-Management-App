#!/usr/bin/env node
/**
 * TaskZM Remove Admin Role Script
 * Removes admin role from a user and sets Pro subscription
 * 
 * Usage: node scripts/remove-admin-role.js <email>
 * Example: node scripts/remove-admin-role.js "stephen.brown@example.com"
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.error('❌ Error: Email address is required');
  console.log('\nUsage: node scripts/remove-admin-role.js "stephen.brown@example.com"');
  process.exit(1);
}

// Get environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gflesnyfpxqhaunfskrw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.log('\nSet it in your .env file or export it:');
  console.log('  export SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
  process.exit(1);
}

// Initialize Supabase Admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function removeAdminRole() {
  try {
    console.log(`\n🔍 Looking up user: ${email}`);
    
    // Find user by email
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError);
      process.exit(1);
    }

    const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      console.error(`❌ User with email ${email} not found`);
      process.exit(1);
    }

    const userId = user.id;
    console.log(`✅ Found user: ${user.email} (ID: ${userId})`);
    console.log(`   Name: ${user.user_metadata?.name || 'N/A'}`);

    // Get current role and tier from KV store
    const { data: kvData, error: kvError } = await supabase
      .from('kv_store_65e6e67f')
      .select('key, value')
      .in('key', [
        `user_${userId}_role`,
        `user:${userId}:tier`,
        `user_${userId}_tier`,
      ]);

    if (kvError) {
      console.error('❌ Error querying KV store:', kvError);
      process.exit(1);
    }

    const roleEntry = kvData?.find(d => d.key === `user_${userId}_role`);
    const tierEntry = kvData?.find(d => d.key === `user:${userId}:tier`) || 
                     kvData?.find(d => d.key === `user_${userId}_tier`);

    const currentRole = roleEntry?.value || 'member';
    const currentTier = tierEntry?.value || 'free';

    console.log(`\n📊 Current Status:`);
    console.log(`   Role: ${currentRole}`);
    console.log(`   Tier: ${currentTier}`);

    // Update role to 'member' (remove admin)
    console.log(`\n🔄 Updating role to 'member'...`);
    const { error: roleError } = await supabase
      .from('kv_store_65e6e67f')
      .upsert({
        key: `user_${userId}_role`,
        value: 'member'
      }, {
        onConflict: 'key'
      });

    if (roleError) {
      console.error('❌ Error updating role:', roleError);
      process.exit(1);
    }
    console.log('✅ Role updated to: member');

    // Update tier to 'pro'
    console.log(`\n🔄 Updating tier to 'pro'...`);
    
    // Set tier in both formats for compatibility
    const tierUpdates = [
      { key: `user:${userId}:tier`, value: 'pro' },
      { key: `user_${userId}_tier`, value: 'pro' },
      { key: `user:${userId}:subscription_status`, value: 'active' },
      { key: `user:${userId}:subscription_start`, value: new Date().toISOString() },
      { key: `user:${userId}:subscription_store`, value: 'admin_granted' },
      { 
        key: `user_${userId}_subscription`, 
        value: {
          tier: 'pro',
          status: 'active',
          startDate: new Date().toISOString(),
          endDate: null,
          cancelAtPeriodEnd: false,
        }
      }
    ];

    for (const update of tierUpdates) {
      const { error: updateError } = await supabase
        .from('kv_store_65e6e67f')
        .upsert({
          key: update.key,
          value: update.value
        }, {
          onConflict: 'key'
        });

      if (updateError) {
        console.error(`❌ Error updating ${update.key}:`, updateError);
        process.exit(1);
      }
    }

    console.log('✅ Tier updated to: pro');
    console.log('✅ Subscription status set to: active');

    // Verify changes
    console.log(`\n🔍 Verifying changes...`);
    const { data: verifyData, error: verifyError } = await supabase
      .from('kv_store_65e6e67f')
      .select('key, value')
      .in('key', [
        `user_${userId}_role`,
        `user:${userId}:tier`,
      ]);

    if (verifyError) {
      console.error('❌ Error verifying changes:', verifyError);
    } else {
      const newRoleEntry = verifyData?.find(d => d.key === `user_${userId}_role`);
      const newTierEntry = verifyData?.find(d => d.key === `user:${userId}:tier`);

      console.log(`\n✅ Success! Updated user ${email}:`);
      console.log(`   Role: ${currentRole} → ${newRoleEntry?.value || 'member'}`);
      console.log(`   Tier: ${currentTier} → ${newTierEntry?.value || 'pro'}`);
    }

    console.log(`\n📝 Summary:`);
    console.log(`   - Admin role removed`);
    console.log(`   - Pro subscription activated`);
    console.log(`   - User is now a regular member with Pro access\n`);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run the script
removeAdminRole();

