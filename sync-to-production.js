#!/usr/bin/env node

/**
 * Sync Localhost and Production Codebases
 * This script ensures production matches localhost by pushing to origin/main
 */

const { execSync } = require('child_process');

console.log('🔄 Syncing Localhost and Production');
console.log('===================================\n');

try {
  // Disable pager
  process.env.GIT_PAGER = 'cat';
  process.env.PAGER = 'cat';
  
  // Get current commit
  const currentCommit = execSync('git rev-parse HEAD', { 
    encoding: 'utf-8',
    env: { ...process.env, GIT_PAGER: 'cat', PAGER: 'cat' }
  }).trim();
  
  const currentCommitShort = execSync('git rev-parse --short HEAD', {
    encoding: 'utf-8',
    env: { ...process.env, GIT_PAGER: 'cat', PAGER: 'cat' }
  }).trim();
  
  console.log(`📍 Current Local Commit: ${currentCommitShort}\n`);
  
  // Check for uncommitted changes
  try {
    execSync('git diff-index --quiet HEAD --', {
      encoding: 'utf-8',
      env: { ...process.env, GIT_PAGER: 'cat', PAGER: 'cat' }
    });
    console.log('✅ No uncommitted changes\n');
  } catch (e) {
    console.log('⚠️  Uncommitted changes detected');
    console.log('   Staging all changes...\n');
    execSync('git add -A', {
      encoding: 'utf-8',
      env: { ...process.env, GIT_PAGER: 'cat', PAGER: 'cat' }
    });
    
    try {
      execSync('git diff --cached --quiet', {
        encoding: 'utf-8',
        env: { ...process.env, GIT_PAGER: 'cat', PAGER: 'cat' }
      });
      console.log('✅ No changes to commit\n');
    } catch (e) {
      console.log('   Committing changes...\n');
      execSync('git commit -m "Sync: Update to match localhost state"', {
        encoding: 'utf-8',
        env: { ...process.env, GIT_PAGER: 'cat', PAGER: 'cat' }
      });
    }
  }
  
  // Fetch remote
  console.log('🔍 Checking remote status...\n');
  execSync('git fetch origin main', {
    encoding: 'utf-8',
    env: { ...process.env, GIT_PAGER: 'cat', PAGER: 'cat' },
    stdio: 'inherit'
  });
  
  const remoteCommit = execSync('git rev-parse origin/main', {
    encoding: 'utf-8',
    env: { ...process.env, GIT_PAGER: 'cat', PAGER: 'cat' }
  }).trim();
  
  const remoteCommitShort = execSync('git rev-parse --short origin/main', {
    encoding: 'utf-8',
    env: { ...process.env, GIT_PAGER: 'cat', PAGER: 'cat' }
  }).trim();
  
  console.log(`📍 Remote (origin/main) Commit: ${remoteCommitShort}\n`);
  
  if (currentCommit === remoteCommit) {
    console.log('✅ Local and remote are already in sync\n');
    console.log('🚀 Pushing to trigger Railway deployment...\n');
  } else {
    console.log('⚠️  Local and remote differ');
    console.log(`   Local:  ${currentCommitShort}`);
    console.log(`   Remote: ${remoteCommitShort}\n`);
    console.log('🚀 Pushing local changes to remote...\n');
  }
  
  // Push to origin/main
  execSync('git push origin main', {
    encoding: 'utf-8',
    env: { ...process.env, GIT_PAGER: 'cat', PAGER: 'cat' },
    stdio: 'inherit'
  });
  
  console.log('\n✅ Push completed!\n');
  console.log('📊 Railway will automatically deploy the latest code');
  console.log('   Monitor: https://railway.app/dashboard\n');
  console.log('⏱️  Estimated deployment time: 5-7 minutes\n');
  console.log('✅ Sync process completed!\n');
  console.log('Next steps:');
  console.log('  1. Wait for Railway deployment (5-7 minutes)');
  console.log('  2. Verify production version matches localhost (1.0.9)');
  console.log('  3. Test key features in production\n');
  
} catch (error) {
  console.error('\n❌ Error during sync:', error.message);
  process.exit(1);
}

