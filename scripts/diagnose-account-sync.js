/**
 * Account Sync Diagnostic Script
 * 
 * This script diagnoses sync issues for a specific user account.
 * It checks:
 * 1. User exists in Supabase Auth
 * 2. Workspace association
 * 3. Data sync status (tasks, projects, folders, settings)
 * 4. Whether data is being saved/loaded properly
 * 
 * Usage:
 *   node scripts/diagnose-account-sync.js "user@example.com"
 *   OR
 *   node scripts/diagnose-account-sync.js "userId"
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gflesnyfpxqhaunfskrw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required');
  console.error('   Set it in .env file or as environment variable');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function diagnoseAccountSync(identifier) {
  console.log('\n🔍 Account Sync Diagnostic Tool\n');
  console.log('='.repeat(70));
  
  let userId;
  let userEmail;
  let userName;
  
  // Check if identifier is email or userId
  if (identifier.includes('@')) {
    // It's an email
    userEmail = identifier;
    console.log(`📧 Looking up user by email: ${userEmail}`);
    
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError);
      return;
    }
    
    const user = users.users.find(u => u.email?.toLowerCase() === userEmail.toLowerCase());
    
    if (!user) {
      console.error(`❌ User with email ${userEmail} not found in Supabase Auth`);
      return;
    }
    
    userId = user.id;
    userName = user.user_metadata?.name || 'Unknown';
    console.log(`✅ User found: ${userName} (ID: ${userId})`);
  } else {
    // It's a userId
    userId = identifier;
    console.log(`🔑 Looking up user by ID: ${userId}`);
    
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    
    if (userError || !userData?.user) {
      console.error(`❌ User with ID ${userId} not found in Supabase Auth`);
      return;
    }
    
    userEmail = userData.user.email;
    userName = userData.user.user_metadata?.name || 'Unknown';
    console.log(`✅ User found: ${userName} (${userEmail})`);
  }
  
  console.log('\n' + '-'.repeat(70));
  console.log('📦 Checking Workspace Association...\n');
  
  // Check workspace association
  const workspaceKey = `user_${userId}_workspace`;
  console.log(`1️⃣  Checking: ${workspaceKey}`);
  
  const { data: workspaceData, error: workspaceError } = await supabase
    .from('kv_store_65e6e67f')
    .select('*')
    .eq('key', workspaceKey)
    .single();
  
  if (workspaceError || !workspaceData) {
    console.log('   ❌ Workspace association NOT FOUND');
    console.log('   ⚠️  CRITICAL: User has no workspace assigned!');
    console.log('\n   💡 This is why data is not syncing - no workspace to sync to!');
    console.log('\n   🔧 Solution:');
    console.log('      1. User should log out and log back in');
    console.log('      2. Or call GET /user/workspaces (auto-creates if missing)');
    console.log('      3. Or manually create workspace');
    return;
  }
  
  const workspaceId = workspaceData.value;
  console.log(`   ✅ Workspace ID: ${workspaceId}`);
  
  // Check workspace owner
  const ownerKey = `workspace_${workspaceId}_owner`;
  const { data: ownerData } = await supabase
    .from('kv_store_65e6e67f')
    .select('*')
    .eq('key', ownerKey)
    .single();
  
  if (ownerData) {
    const ownerId = ownerData.value;
    console.log(`   ✅ Owner: ${ownerId} ${ownerId === userId ? '(matches user)' : '⚠️ MISMATCH!'}`);
  }
  
  // Check workspace members
  const membersKey = `workspace_${workspaceId}_members`;
  const { data: membersData } = await supabase
    .from('kv_store_65e6e67f')
    .select('*')
    .eq('key', membersKey)
    .single();
  
  if (membersData) {
    let members = membersData.value;
    if (typeof members === 'string') {
      try {
        members = JSON.parse(members);
      } catch (e) {
        members = [];
      }
    }
    const isMember = Array.isArray(members) && members.includes(userId);
    console.log(`   ✅ Members: ${JSON.stringify(members)} ${isMember ? '(user included)' : '⚠️ USER NOT IN LIST!'}`);
  }
  
  console.log('\n' + '-'.repeat(70));
  console.log('📊 Checking Data Sync Status...\n');
  
  // Check tasks
  console.log(`2️⃣  Tasks in workspace:`);
  const { data: taskKeys, error: taskError } = await supabase
    .from('kv_store_65e6e67f')
    .select('key')
    .like('key', `workspace_${workspaceId}_task_%`);
  
  if (taskError) {
    console.log(`   ⚠️  Error checking tasks: ${taskError.message}`);
  } else {
    const taskCount = taskKeys?.length || 0;
    console.log(`   📋 Found ${taskCount} task(s) in database`);
    if (taskCount > 0) {
      console.log('   Sample task keys:');
      taskKeys.slice(0, 3).forEach(item => {
        console.log(`      - ${item.key}`);
      });
    } else {
      console.log('   ⚠️  No tasks found in database');
      console.log('   💡 This could mean:');
      console.log('      - User hasn\'t created any tasks yet');
      console.log('      - Tasks are only in localStorage (not synced)');
      console.log('      - Sync failed and data wasn\'t saved');
    }
  }
  
  // Check projects
  console.log(`\n3️⃣  Projects in workspace:`);
  const { data: projectKeys, error: projectError } = await supabase
    .from('kv_store_65e6e67f')
    .select('key')
    .like('key', `workspace_${workspaceId}_project_%`);
  
  if (projectError) {
    console.log(`   ⚠️  Error checking projects: ${projectError.message}`);
  } else {
    const projectCount = projectKeys?.length || 0;
    console.log(`   📁 Found ${projectCount} project(s) in database`);
  }
  
  // Check folders
  console.log(`\n4️⃣  Folders in workspace:`);
  const { data: folderKeys, error: folderError } = await supabase
    .from('kv_store_65e6e67f')
    .select('key')
    .like('key', `workspace_${workspaceId}_folder_%`);
  
  if (folderError) {
    console.log(`   ⚠️  Error checking folders: ${folderError.message}`);
  } else {
    const folderCount = folderKeys?.length || 0;
    console.log(`   📂 Found ${folderCount} folder(s) in database`);
  }
  
  // Check settings
  console.log(`\n5️⃣  Settings in workspace:`);
  const settingsKey = `workspace_${workspaceId}_settings`;
  const { data: settingsData } = await supabase
    .from('kv_store_65e6e67f')
    .select('*')
    .eq('key', settingsKey)
    .single();
  
  if (settingsData) {
    console.log(`   ✅ Settings found`);
  } else {
    console.log(`   ⚠️  Settings not found (may be using defaults)`);
  }
  
  // Check activity logs
  console.log(`\n6️⃣  Activity logs:`);
  const { data: activityKeys, error: activityError } = await supabase
    .from('kv_store_65e6e67f')
    .select('key')
    .like('key', `workspace_${workspaceId}_activity_%`)
    .limit(5);
  
  if (activityError) {
    console.log(`   ⚠️  Error checking activity: ${activityError.message}`);
  } else {
    const activityCount = activityKeys?.length || 0;
    console.log(`   📝 Found ${activityCount} activity log(s) (showing first 5)`);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('\n📊 Summary:');
  console.log(`   User: ${userName} (${userEmail})`);
  console.log(`   User ID: ${userId}`);
  console.log(`   Workspace ID: ${workspaceId || 'NOT FOUND'}`);
  console.log(`   Tasks in DB: ${taskKeys?.length || 0}`);
  console.log(`   Projects in DB: ${projectKeys?.length || 0}`);
  console.log(`   Folders in DB: ${folderKeys?.length || 0}`);
  
  // Diagnose issues
  console.log('\n' + '='.repeat(70));
  console.log('🔍 Diagnosis:\n');
  
  if (!workspaceData) {
    console.log('❌ CRITICAL ISSUE: No workspace found');
    console.log('   → User cannot sync data without a workspace');
    console.log('   → Solution: Workspace will be auto-created on next login');
  } else if ((taskKeys?.length || 0) === 0 && (projectKeys?.length || 0) === 0) {
    console.log('⚠️  POTENTIAL ISSUE: No data found in database');
    console.log('   → This could mean:');
    console.log('      - User hasn\'t created any tasks/projects yet');
    console.log('      - Data exists only in localStorage (not synced)');
    console.log('      - Sync operations are failing silently');
    console.log('   → Solution: Check browser console for sync errors');
  } else {
    console.log('✅ Workspace and data structure appear correct');
    console.log('   → If sync still not working, check:');
    console.log('      - Browser console for API errors');
    console.log('      - Network tab for failed requests');
    console.log('      - Authentication token validity');
  }
  
  console.log('\n');
}

// Get identifier from command line
const identifier = process.argv[2];

if (!identifier) {
  console.error('❌ Usage: node scripts/diagnose-account-sync.js "email@example.com"');
  console.error('   OR: node scripts/diagnose-account-sync.js "userId"');
  console.error('\n   Example: node scripts/diagnose-account-sync.js "stephen.brown@example.com"');
  process.exit(1);
}

diagnoseAccountSync(identifier).catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

