#!/usr/bin/env node

/**
 * Automated deployment script for shared terminology database function
 * 
 * This script deploys the upsert_shared_terminology function to Supabase
 * to fix the PGRST202 error when saving terminology.
 * 
 * Usage:
 *   node scripts/deploy-shared-terminology-function.js
 * 
 * Or with environment variables:
 *   SUPABASE_URL=https://your-project.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
 *   node scripts/deploy-shared-terminology-function.js
 */

const fs = require('fs');
const path = require('path');

// Get Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://gflesnyfpxqhaunfskrw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('');
  console.error('Please set it in one of these ways:');
  console.error('  1. Environment variable: export SUPABASE_SERVICE_ROLE_KEY=your-key');
  console.error('  2. .env file: VITE_SUPABASE_SERVICE_ROLE_KEY=your-key');
  console.error('  3. Command line: SUPABASE_SERVICE_ROLE_KEY=your-key node scripts/deploy-shared-terminology-function.js');
  console.error('');
  console.error('You can find your service role key in:');
  console.error('  Supabase Dashboard > Project Settings > API > service_role key');
  process.exit(1);
}

async function deployFunction() {
  try {
    console.log('🚀 Deploying shared terminology function to Supabase...');
    console.log(`   Project: ${SUPABASE_URL}`);
    console.log('');

    // Read the SQL file
    const sqlPath = path.join(__dirname, 'fix-shared-terminology-function.sql');
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`SQL file not found: ${sqlPath}`);
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('📄 Read SQL file:', sqlPath);
    console.log('');

    // Execute SQL via Supabase REST API
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ sql }),
    });

    if (!response.ok) {
      // Try alternative method: direct SQL execution via PostgREST
      console.log('⚠️  Direct RPC method not available, trying alternative method...');
      console.log('');
      console.log('📋 Please run the SQL manually in Supabase SQL Editor:');
      console.log(`   File: ${sqlPath}`);
      console.log('');
      console.log('Or copy and paste this SQL:');
      console.log('');
      console.log('─'.repeat(60));
      console.log(sql);
      console.log('─'.repeat(60));
      return;
    }

    const result = await response.json();
    console.log('✅ Function deployed successfully!');
    console.log('');

    // Verify the function exists
    console.log('🔍 Verifying function...');
    const verifyResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/verify_function`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ 
        function_name: 'upsert_shared_terminology' 
      }),
    });

    if (verifyResponse.ok) {
      const verifyResult = await verifyResponse.json();
      console.log('✅ Function verified:', verifyResult);
    } else {
      console.log('⚠️  Could not verify function automatically');
      console.log('   Run scripts/verify-shared-terminology-function.sql to verify manually');
    }

    console.log('');
    console.log('🎉 Deployment complete!');
    console.log('');
    console.log('The upsert_shared_terminology function is now available.');
    console.log('Terminology saving should work without PGRST202 errors.');

  } catch (error) {
    console.error('❌ Error deploying function:', error.message);
    console.error('');
    console.error('📋 Alternative: Run the SQL manually in Supabase SQL Editor');
    console.error(`   File: ${path.join(__dirname, 'fix-shared-terminology-function.sql')}`);
    console.error('');
    console.error('Steps:');
    console.error('  1. Go to: https://supabase.com/dashboard/project/gflesnyfpxqhaunfskrw/sql/new');
    console.error('  2. Copy the contents of fix-shared-terminology-function.sql');
    console.error('  3. Paste and run in the SQL Editor');
    process.exit(1);
  }
}

// Alternative: Use psql if DATABASE_URL is available
async function deployWithPSQL() {
  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    return false;
  }

  try {
    const { execSync } = require('child_process');
    console.log('🔧 Using psql with DATABASE_URL...');
    
    const sqlPath = path.join(__dirname, 'fix-shared-terminology-function.sql');
    
    execSync(`psql "${dbUrl}" -f "${sqlPath}"`, {
      stdio: 'inherit',
      cwd: __dirname,
    });
    
    console.log('');
    console.log('✅ Function deployed successfully via psql!');
    return true;
  } catch (error) {
    console.error('Error with psql:', error.message);
    return false;
  }
}

// Main execution
(async () => {
  // Try psql first, then fallback to manual instructions
  const psqlSuccess = await deployWithPSQL();
  if (!psqlSuccess) {
    await deployFunction();
  }
})();
