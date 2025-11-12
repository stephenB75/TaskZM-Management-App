/**
 * Workspace Fix Script
 * 
 * This script can fix workspace issues for a user by:
 * 1. Creating a missing workspace
 * 2. Fixing broken workspace associations
 * 3. Verifying workspace structure
 * 
 * Usage:
 *   node scripts/fix-workspace.js "user@example.com"
 *   OR
 *   node scripts/fix-workspace.js "userId" --create
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gflesnyfpxqhaunfskrw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setKV(key, value) {
  const { error } = await supabase
    .from('kv_store_65e6e67f')
    .upsert({ key, value }, { onConflict: 'key' });
  
  if (error) {
    throw new Error(`Failed to set ${key}: ${error.message}`);
  }
}

async function getKV(key) {
  const { data, error } = await supabase
    .from('kv_store_65e6e67f')
    .select('value')
    .eq('key', key)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = not found
    throw new Error(`Failed to get ${key}: ${error.message}`);
  }
  
  return data?.value || null;
}

async function fixWorkspace(identifier, shouldCreate = false) {
  console.log('\n🔧 Workspace Fix Tool\n');
  console.log('='.repeat(60));
  
  let userId;
  let userEmail;
  let userName;
  
  // Get user info
  if (identifier.includes('@')) {
    const { data: users } = await supabase.auth.admin.listUsers();
    const user = users.users.find(u => u.email?.toLowerCase() === identifier.toLowerCase());
    if (!user) {
      console.error(`❌ User not found: ${identifier}`);
      return;
    }
    userId = user.id;
    userEmail = user.email;
    userName = user.user_metadata?.name || 'User';
  } else {
    const { data: userData } = await supabase.auth.admin.getUserById(identifier);
    if (!userData?.user) {
      console.error(`❌ User not found: ${identifier}`);
      return;
    }
    userId = userData.user.id;
    userEmail = userData.user.email;
    userName = userData.user.user_metadata?.name || 'User';
  }
  
  console.log(`👤 User: ${userName} (${userEmail})`);
  console.log(`🆔 User ID: ${userId}\n`);
  
  // Check existing workspace
  const workspaceKey = `user_${userId}_workspace`;
  const existingWorkspaceId = await getKV(workspaceKey);
  
  if (existingWorkspaceId) {
    console.log(`✅ Workspace already exists: ${existingWorkspaceId}`);
    
    // Verify workspace structure
    console.log('\n🔍 Verifying workspace structure...');
    
    const ownerKey = `workspace_${existingWorkspaceId}_owner`;
    const membersKey = `workspace_${existingWorkspaceId}_members`;
    const nameKey = `workspace_${existingWorkspaceId}_name`;
    
    const owner = await getKV(ownerKey);
    const members = await getKV(membersKey);
    const name = await getKV(nameKey);
    
    let needsFix = false;
    
    if (!owner || owner !== userId) {
      console.log(`⚠️  Fixing owner: ${ownerKey}`);
      await setKV(ownerKey, userId);
      needsFix = true;
    }
    
    if (!members || !Array.isArray(members) || !members.includes(userId)) {
      console.log(`⚠️  Fixing members: ${membersKey}`);
      await setKV(membersKey, [userId]);
      needsFix = true;
    }
    
    if (!name) {
      console.log(`⚠️  Setting workspace name: ${nameKey}`);
      await setKV(nameKey, `${userName}'s Workspace`);
      needsFix = true;
    }
    
    if (needsFix) {
      console.log('\n✅ Workspace structure fixed!');
    } else {
      console.log('\n✅ Workspace structure is correct');
    }
    
    return existingWorkspaceId;
  }
  
  // No workspace found
  if (!shouldCreate) {
    console.log('❌ No workspace found');
    console.log('\n💡 To create a workspace, run with --create flag:');
    console.log(`   node scripts/fix-workspace.js "${identifier}" --create`);
    return null;
  }
  
  // Create workspace
  console.log('📦 Creating new workspace...');
  
  const workspaceId = `workspace_${userId}_${Date.now()}`;
  const workspaceName = `${userName}'s Workspace`;
  
  await setKV(workspaceKey, workspaceId);
  await setKV(`workspace_${workspaceId}_owner`, userId);
  await setKV(`workspace_${workspaceId}_members`, [userId]);
  await setKV(`workspace_${workspaceId}_name`, workspaceName);
  
  console.log(`\n✅ Workspace created successfully!`);
  console.log(`   Workspace ID: ${workspaceId}`);
  console.log(`   Workspace Name: ${workspaceName}`);
  console.log(`   Owner: ${userId}`);
  console.log(`   Members: [${userId}]`);
  
  return workspaceId;
}

const identifier = process.argv[2];
const shouldCreate = process.argv.includes('--create');

if (!identifier) {
  console.error('❌ Usage: node scripts/fix-workspace.js "email@example.com" [--create]');
  console.error('   OR: node scripts/fix-workspace.js "userId" [--create]');
  process.exit(1);
}

fixWorkspace(identifier, shouldCreate).catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

