#!/usr/bin/env node

/**
 * Verify GitHub and Supabase Sync Status
 * Checks git sync, Railway deployment, and Supabase connection
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying GitHub and Supabase Sync Status');
console.log('============================================\n');

let allChecksPassed = true;

// Helper function to run commands safely
function runCommand(command, description) {
  try {
    const result = execSync(command, { 
      encoding: 'utf-8',
      stdio: 'pipe'
    }).trim();
    return { success: true, result, error: null };
  } catch (error) {
    return { 
      success: false, 
      result: null, 
      error: error.message 
    };
  }
}

// 1. Check Git Status
console.log('1️⃣  Checking Git Sync Status...');
const gitStatus = runCommand('git status --porcelain', 'git status');
if (gitStatus.success && gitStatus.result === '') {
  console.log('   ✅ Working tree is clean\n');
} else {
  console.log('   ⚠️  Uncommitted changes detected');
  console.log('   ' + gitStatus.result.split('\n').join('\n   ') + '\n');
  allChecksPassed = false;
}

// 2. Check Local vs Remote
console.log('2️⃣  Checking Local vs Remote Sync...');
try {
  execSync('git fetch origin', { stdio: 'pipe' });
  const localCommit = runCommand('git rev-parse HEAD', 'local commit');
  const remoteCommit = runCommand('git rev-parse origin/main', 'remote commit');
  
  if (localCommit.success && remoteCommit.success) {
    if (localCommit.result === remoteCommit.result) {
      console.log('   ✅ Local and remote are in sync');
      console.log(`   Commit: ${localCommit.result.substring(0, 7)}\n`);
    } else {
      console.log('   ⚠️  Local and remote differ');
      console.log(`   Local:  ${localCommit.result.substring(0, 7)}`);
      console.log(`   Remote: ${remoteCommit.result.substring(0, 7)}\n`);
      allChecksPassed = false;
    }
  }
} catch (error) {
  console.log('   ❌ Error checking remote sync:', error.message, '\n');
  allChecksPassed = false;
}

// 3. Check Environment Variables
console.log('3️⃣  Checking Environment Variables...');
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const hasSupabaseUrl = envContent.includes('VITE_SUPABASE_URL');
  const hasSupabaseKey = envContent.includes('VITE_SUPABASE_ANON_KEY');
  
  if (hasSupabaseUrl && hasSupabaseKey) {
    console.log('   ✅ Supabase environment variables found\n');
  } else {
    console.log('   ⚠️  Missing Supabase environment variables\n');
    allChecksPassed = false;
  }
} else {
  console.log('   ⚠️  .env file not found\n');
  allChecksPassed = false;
}

// 4. Check Supabase Connection (if possible)
console.log('4️⃣  Checking Supabase Configuration...');
try {
  const supabaseClientPath = path.join(process.cwd(), 'src/lib/supabase-client.ts');
  if (fs.existsSync(supabaseClientPath)) {
    const clientContent = fs.readFileSync(supabaseClientPath, 'utf-8');
    if (clientContent.includes('createClient')) {
      console.log('   ✅ Supabase client configured\n');
    } else {
      console.log('   ⚠️  Supabase client may not be properly configured\n');
    }
  } else {
    console.log('   ⚠️  Supabase client file not found\n');
  }
} catch (error) {
  console.log('   ⚠️  Could not verify Supabase configuration\n');
}

// 5. Check Railway Configuration
console.log('5️⃣  Checking Railway Configuration...');
const railwayTomlPath = path.join(process.cwd(), 'railway.toml');
if (fs.existsSync(railwayTomlPath)) {
  console.log('   ✅ railway.toml found\n');
} else {
  console.log('   ⚠️  railway.toml not found\n');
  allChecksPassed = false;
}

// 6. Check Package.json
console.log('6️⃣  Checking Dependencies...');
const packageJsonPath = path.join(process.cwd(), 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const hasSupabase = packageJson.dependencies && (
    packageJson.dependencies['@supabase/supabase-js'] || 
    packageJson.dependencies['@supabase/supabase-js'] !== undefined
  );
  
  if (hasSupabase) {
    console.log('   ✅ Supabase dependency found\n');
  } else {
    console.log('   ⚠️  Supabase dependency not found in package.json\n');
  }
} else {
  console.log('   ⚠️  package.json not found\n');
  allChecksPassed = false;
}

// Summary
console.log('📊 Summary');
console.log('==========\n');

if (allChecksPassed) {
  console.log('✅ All checks passed! Repository is in sync.\n');
  console.log('Next steps:');
  console.log('  1. Run: git push origin main (if needed)');
  console.log('  2. Monitor Railway deployment');
  console.log('  3. Verify Supabase connection in app\n');
} else {
  console.log('⚠️  Some checks failed. Please review the issues above.\n');
  console.log('Common fixes:');
  console.log('  1. Commit uncommitted changes: git add -A && git commit -m "message"');
  console.log('  2. Sync with remote: git pull origin main');
  console.log('  3. Check .env file for Supabase credentials');
  console.log('  4. Verify railway.toml exists\n');
}

process.exit(allChecksPassed ? 0 : 1);
