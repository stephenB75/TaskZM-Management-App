#!/usr/bin/env node

/**
 * Check if user_awards table exists
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load .env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      process.env[key] = value;
    }
  });
}

const PROJECT_REF = 'gflesnyfpxqhaunfskrw';
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in .env');
  process.exit(1);
}

async function checkTable() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 Checking if user_awards table exists...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // Try to query the table
    const { data, error } = await supabase
      .from('user_awards')
      .select('user_id, award_id, earned_at, progress')
      .limit(1);
    
    if (error) {
      const errorCode = error.code || '';
      const errorMessage = error.message || '';
      
      if (errorCode === 'PGRST205' || 
          errorCode === '42P01' ||
          errorMessage.includes('does not exist') ||
          errorMessage.includes('Could not find the table')) {
        console.log('❌ Table does NOT exist yet\n');
        console.log('📋 To create it, run:');
        console.log('   npm run create-user-awards-table');
        console.log('   Then copy the SQL and run it in Supabase SQL Editor\n');
        return false;
      } else {
        console.log('⚠️  Error querying table:', errorMessage);
        console.log('   Error code:', errorCode);
        console.log('   Table may exist but has permission issues\n');
        return null; // Unknown
      }
    } else {
      console.log('✅ Table EXISTS!\n');
      console.log('📊 Table Status:');
      console.log('   - Table name: user_awards');
      console.log('   - Schema: public');
      if (data && data.length > 0) {
        console.log(`   - Records: ${data.length} (sample shown)`);
        console.log('   - Sample data:', data[0]);
      } else {
        console.log('   - Records: 0 (table is empty)');
      }
      console.log('');
      return true;
    }
  } catch (error) {
    console.error('❌ Error checking table:', error.message);
    return null;
  }
}

checkTable().then(exists => {
  if (exists === true) {
    console.log('✅ All good! The table is ready to use.');
    console.log('   The 500 errors should be resolved.\n');
    process.exit(0);
  } else if (exists === false) {
    console.log('🔗 Create the table here:');
    console.log(`   https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new\n`);
    process.exit(1);
  } else {
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
