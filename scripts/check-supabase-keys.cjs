#!/usr/bin/env node

/**
 * Check Supabase Keys Configuration
 * Verifies what Supabase keys are available and their validity
 */

const fs = require('fs');
const path = require('path');

// Load .env manually
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

// Check all possible key variable names
const keys = {
  'SUPABASE_SERVICE_ROLE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY,
  'VITE_SUPABASE_SERVICE_ROLE_KEY': process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
  'SUPABASE_ANON_KEY': process.env.SUPABASE_ANON_KEY,
  'VITE_SUPABASE_ANON_KEY': process.env.VITE_SUPABASE_ANON_KEY,
  'DATABASE_URL': process.env.DATABASE_URL,
  'SUPABASE_DB_URL': process.env.SUPABASE_DB_URL,
};

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔍 Checking Supabase Keys Configuration');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

let foundKeys = [];
let missingKeys = [];

for (const [keyName, keyValue] of Object.entries(keys)) {
  if (keyValue) {
    const masked = keyValue.length > 20 
      ? keyValue.substring(0, 10) + '...' + keyValue.substring(keyValue.length - 10)
      : '***';
    foundKeys.push({ name: keyName, value: masked, length: keyValue.length });
  } else {
    missingKeys.push(keyName);
  }
}

console.log('✅ Found Keys:');
if (foundKeys.length > 0) {
  foundKeys.forEach(({ name, value, length }) => {
    console.log(`   ${name}: ${value} (${length} chars)`);
  });
} else {
  console.log('   None found');
}
console.log('');

console.log('❌ Missing Keys:');
if (missingKeys.length > 0) {
  missingKeys.forEach(name => {
    console.log(`   ${name}`);
  });
} else {
  console.log('   None (all keys found!)');
}
console.log('');

// Test connection if we have a key
async function testConnection() {
  if (keys.SUPABASE_SERVICE_ROLE_KEY || keys.VITE_SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient } = require('@supabase/supabase-js');
    const testKey = keys.SUPABASE_SERVICE_ROLE_KEY || keys.VITE_SUPABASE_SERVICE_ROLE_KEY;
    
    console.log('🔗 Testing Connection with Service Role Key...\n');
    
    try {
      const supabase = createClient(SUPABASE_URL, testKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
      
      // Try a simple query to test the connection
      const { data, error } = await supabase
        .from('user_awards')
        .select('user_id')
        .limit(1);
      
      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('does not exist') || error.message?.includes('Could not find the table')) {
          console.log('✅ Connection successful! (Table does not exist yet - this is expected)');
          console.log('   The service role key is valid and working.\n');
        } else {
          console.log('⚠️  Connection test result:', error.message);
          console.log('   Error code:', error.code);
          console.log('   Key may be valid but encountered an error.\n');
        }
      } else {
        console.log('✅ Connection successful! Table exists.\n');
      }
    } catch (error) {
      console.log('❌ Connection failed:', error.message);
      console.log('   The key may be invalid.\n');
    }
  } else {
    console.log('⚠️  No service role key available to test connection\n');
  }
}

testConnection();

// Check DATABASE_URL format if available
if (keys.DATABASE_URL || keys.SUPABASE_DB_URL) {
  const dbUrl = keys.DATABASE_URL || keys.SUPABASE_DB_URL;
  console.log('📊 Database URL Status:');
  if (dbUrl.includes('postgresql://')) {
    console.log('   ✅ Valid PostgreSQL connection string format');
    if (dbUrl.includes('[PASSWORD]') || dbUrl.includes('YOUR_PASSWORD')) {
      console.log('   ⚠️  Contains placeholder - needs actual password');
    } else {
      console.log('   ✅ Contains actual password');
    }
  } else {
    console.log('   ⚠️  May not be a valid PostgreSQL connection string');
  }
  console.log('');
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('💡 Recommendations:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (keys.SUPABASE_SERVICE_ROLE_KEY || keys.VITE_SUPABASE_SERVICE_ROLE_KEY) {
  console.log('✅ Service role key found! You can use it to create tables.');
  console.log('   However, Supabase PostgREST API doesn\'t support DDL (CREATE TABLE).');
  console.log('   You\'ll need to use the SQL Editor or DATABASE_URL with psql.\n');
}

if (!keys.DATABASE_URL && !keys.SUPABASE_DB_URL) {
  console.log('📝 To create tables automatically via psql, add to .env:');
  console.log('   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.' + PROJECT_REF + '.supabase.co:5432/postgres');
  console.log('   (Find password in: Supabase Dashboard > Settings > Database > Connection string)\n');
}

console.log('🔗 Supabase Dashboard:');
console.log(`   https://supabase.com/dashboard/project/${PROJECT_REF}/settings/api\n`);
