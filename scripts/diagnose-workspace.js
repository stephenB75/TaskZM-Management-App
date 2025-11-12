/**
 * Workspace Diagnostic Script
 * 
 * This script helps diagnose workspace issues for a specific user.
 * It checks:
 * 1. User exists in Supabase Auth
 * 2. Workspace association key exists
 * 3. Workspace data exists
 * 4. Workspace membership is correct
 * 
 * Usage:
 *   node scripts/diagnose-workspace.js "user@example.com"
 *   OR
 *   node scripts/diagnose-workspace.js "userId"
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

async function diagnoseWorkspace(identifier) {
  console.log('\n🔍 Workspace Diagnostic Tool\n');
  console.log('='.repeat(60));
  
  let userId;
  let userEmail;
  
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
    console.log(`✅ User found: ${user.user_metadata?.name || 'Unknown'} (ID: ${userId})`);
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
    console.log(`✅ User found: ${userData.user.user_metadata?.name || 'Unknown'} (${userEmail})`);
  }
  
  console.log('\n' + '-'.repeat(60));
  console.log('📦 Checking Workspace Data...\n');
  
  // Check workspace association
  const workspaceKey = `user_${userId}_workspace`;
  console.log(`1️⃣  Checking workspace association key: ${workspaceKey}`);
  
  const { data: workspaceData, error: workspaceError } = await supabase
    .from('kv_store_65e6e67f')
    .select('*')
    .eq('key', workspaceKey)
    .single();
  
  if (workspaceError || !workspaceData) {
    console.log('   ❌ Workspace association key NOT FOUND');
    console.log('   ⚠️  This means the user has no workspace assigned!');
    console.log('\n   💡 Solution: Create a workspace for this user');
    console.log('      The app should auto-create one, but if it failed, you can:');
    console.log('      1. Have the user log in again (triggers workspace creation)');
    console.log('      2. Or manually create it via API');
    return;
  }
  
  const workspaceId = workspaceData.value;
  console.log(`   ✅ Workspace ID found: ${workspaceId}`);
  
  // Check workspace owner
  const ownerKey = `workspace_${workspaceId}_owner`;
  console.log(`\n2️⃣  Checking workspace owner: ${ownerKey}`);
  
  const { data: ownerData, error: ownerError } = await supabase
    .from('kv_store_65e6e67f')
    .select('*')
    .eq('key', ownerKey)
    .single();
  
  if (ownerError || !ownerData) {
    console.log('   ❌ Workspace owner key NOT FOUND');
    console.log('   ⚠️  Workspace exists but owner is missing!');
  } else {
    const ownerId = ownerData.value;
    console.log(`   ✅ Owner ID: ${ownerId}`);
    if (ownerId !== userId) {
      console.log(`   ⚠️  WARNING: Owner ID doesn't match user ID!`);
    }
  }
  
  // Check workspace members
  const membersKey = `workspace_${workspaceId}_members`;
  console.log(`\n3️⃣  Checking workspace members: ${membersKey}`);
  
  const { data: membersData, error: membersError } = await supabase
    .from('kv_store_65e6e67f')
    .select('*')
    .eq('key', membersKey)
    .single();
  
  if (membersError || !membersData) {
    console.log('   ❌ Workspace members key NOT FOUND');
    console.log('   ⚠️  Workspace exists but members list is missing!');
  } else {
    const members = Array.isArray(membersData.value) ? membersData.value : JSON.parse(membersData.value || '[]');
    console.log(`   ✅ Members: ${JSON.stringify(members)}`);
    if (!members.includes(userId)) {
      console.log(`   ⚠️  WARNING: User is not in members list!`);
    }
  }
  
  // Check workspace name
  const nameKey = `workspace_${workspaceId}_name`;
  console.log(`\n4️⃣  Checking workspace name: ${nameKey}`);
  
  const { data: nameData, error: nameError } = await supabase
    .from('kv_store_65e6e67f')
    .select('*')
    .eq('key', nameKey)
    .single();
  
  if (nameError || !nameData) {
    console.log('   ⚠️  Workspace name not found (optional)');
  } else {
    console.log(`   ✅ Workspace name: ${nameData.value}`);
  }
  
  // Check for tasks
  console.log(`\n5️⃣  Checking for tasks in workspace...`);
  const { data: taskData, error: taskError } = await supabase
    .from('kv_store_65e6e67f')
    .select('key')
    .like('key', `workspace_${workspaceId}_task_%`)
    .limit(5);
  
  if (taskError) {
    console.log('   ⚠️  Error checking tasks');
  } else {
    const taskCount = taskData?.length || 0;
    console.log(`   📋 Found ${taskCount} task key(s) (showing first 5)`);
    if (taskCount > 0) {
      console.log('   Sample task keys:');
      taskData.slice(0, 3).forEach(item => {
        console.log(`      - ${item.key}`);
      });
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Summary:');
  console.log(`   User: ${userEmail} (${userId})`);
  console.log(`   Workspace: ${workspaceId || 'NOT FOUND'}`);
  
  if (!workspaceData) {
    console.log('\n❌ ISSUE DETECTED: No workspace found for this user');
    console.log('\n🔧 Recommended Fix:');
    console.log('   1. Check if user signed up correctly');
    console.log('   2. Check server logs for workspace creation errors');
    console.log('   3. Manually create workspace using:');
    console.log(`      POST /user/workspaces with userId: ${userId}`);
  } else {
    console.log('\n✅ Workspace structure appears correct');
  }
  
  console.log('\n');
}

// Get identifier from command line
const identifier = process.argv[2];

if (!identifier) {
  console.error('❌ Usage: node scripts/diagnose-workspace.js "email@example.com"');
  console.error('   OR: node scripts/diagnose-workspace.js "userId"');
  process.exit(1);
}

diagnoseWorkspace(identifier).catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

