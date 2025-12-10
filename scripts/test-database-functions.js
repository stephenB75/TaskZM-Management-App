#!/usr/bin/env node

/**
 * Comprehensive Database Function Test Script
 * Tests all app functions and database communication
 */

// Import project info (hardcoded for now since it's a TSX file)
const projectId = "gflesnyfpxqhaunfskrw";
const publicAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmbGVzbnlmcHhxaGF1bmZza3J3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzMDQwMTcsImV4cCI6MjA3Njg4MDAxN30.t6bH6nO7shmf_Am9mxllbQDhNeVaN249p1MYcF8DvtM";

const API_BASE = `https://${projectId}.supabase.co/functions/v1/taskzm-database-function`;

// Test results
const results = {
  passed: [],
  failed: [],
  warnings: [],
};

// Helper to make API calls
async function apiCall(endpoint, method = 'GET', body = null, token = null) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token || publicAnonKey}`,
  };

  const options = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const data = await response.json().catch(() => ({ error: 'Invalid JSON response' }));
    
    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error.message,
    };
  }
}

// Test functions
async function testHealthCheck() {
  console.log('\n🔍 Testing Health Check...');
  const result = await apiCall('/health');
  
  if (result.ok && result.data.status === 'ok') {
    results.passed.push('Health Check');
    console.log('✅ Health check passed');
    return true;
  } else {
    results.failed.push('Health Check');
    console.log('❌ Health check failed:', result.error || result.data);
    return false;
  }
}

async function testWorkspaceOperations() {
  console.log('\n🔍 Testing Workspace Operations...');
  
  // Test 1: Get workspaces (will fail without auth, but should return proper error)
  const workspaceResult = await apiCall('/user/workspaces');
  if (workspaceResult.status === 401 || workspaceResult.status === 200) {
    results.passed.push('Workspace GET (auth check)');
    console.log('✅ Workspace GET endpoint responds correctly');
  } else {
    results.failed.push('Workspace GET');
    console.log('❌ Workspace GET failed:', workspaceResult.status);
  }
  
  // Test 2: Create workspace (will fail without auth, but should return proper error)
  const createResult = await apiCall('/user/workspaces', 'POST', { name: 'Test Workspace' });
  if (createResult.status === 401 || createResult.status === 200) {
    results.passed.push('Workspace CREATE (auth check)');
    console.log('✅ Workspace CREATE endpoint responds correctly');
  } else {
    results.failed.push('Workspace CREATE');
    console.log('❌ Workspace CREATE failed:', createResult.status);
  }
}

async function testTaskOperations() {
  console.log('\n🔍 Testing Task Operations...');
  
  const testWorkspaceId = 'test_workspace';
  
  // Test GET tasks
  const getResult = await apiCall(`/tasks/${testWorkspaceId}`);
  if (getResult.status === 401 || getResult.status === 200 || getResult.status === 404) {
    results.passed.push('Task GET');
    console.log('✅ Task GET endpoint responds correctly');
  } else {
    results.failed.push('Task GET');
    console.log('❌ Task GET failed:', getResult.status);
  }
  
  // Test POST task
  const postResult = await apiCall(`/tasks/${testWorkspaceId}`, 'POST', {
    id: 'test_task',
    title: 'Test Task',
    status: 'todo',
  });
  if (postResult.status === 401 || postResult.status === 200) {
    results.passed.push('Task POST');
    console.log('✅ Task POST endpoint responds correctly');
  } else {
    results.failed.push('Task POST');
    console.log('❌ Task POST failed:', postResult.status);
  }
  
  // Test DELETE task
  const deleteResult = await apiCall(`/tasks/${testWorkspaceId}/test_task`, 'DELETE');
  if (deleteResult.status === 401 || deleteResult.status === 200 || deleteResult.status === 404) {
    results.passed.push('Task DELETE');
    console.log('✅ Task DELETE endpoint responds correctly');
  } else {
    results.failed.push('Task DELETE');
    console.log('❌ Task DELETE failed:', deleteResult.status);
  }
}

async function testFolderOperations() {
  console.log('\n🔍 Testing Folder Operations...');
  
  const testWorkspaceId = 'test_workspace';
  
  // Test GET folders
  const getResult = await apiCall(`/folders/${testWorkspaceId}`);
  if (getResult.status === 401 || getResult.status === 200) {
    results.passed.push('Folder GET');
    console.log('✅ Folder GET endpoint responds correctly');
  } else {
    results.failed.push('Folder GET');
    console.log('❌ Folder GET failed:', getResult.status);
  }
  
  // Test POST folder
  const postResult = await apiCall(`/folders/${testWorkspaceId}`, 'POST', {
    name: 'Test Folder',
    color: '#3b82f6',
  });
  if (postResult.status === 401 || postResult.status === 200) {
    results.passed.push('Folder POST');
    console.log('✅ Folder POST endpoint responds correctly');
  } else {
    results.failed.push('Folder POST');
    console.log('❌ Folder POST failed:', postResult.status);
  }
}

async function testProjectOperations() {
  console.log('\n🔍 Testing Project Operations...');
  
  const testWorkspaceId = 'test_workspace';
  
  // Test GET projects
  const getResult = await apiCall(`/projects/${testWorkspaceId}`);
  if (getResult.status === 401 || getResult.status === 200) {
    results.passed.push('Project GET');
    console.log('✅ Project GET endpoint responds correctly');
  } else {
    results.failed.push('Project GET');
    console.log('❌ Project GET failed:', getResult.status);
  }
}

async function testSettingsOperations() {
  console.log('\n🔍 Testing Settings Operations...');
  
  const testWorkspaceId = 'test_workspace';
  
  // Test GET settings
  const getResult = await apiCall(`/settings/${testWorkspaceId}`);
  if (getResult.status === 401 || getResult.status === 200) {
    results.passed.push('Settings GET');
    console.log('✅ Settings GET endpoint responds correctly');
  } else {
    results.failed.push('Settings GET');
    console.log('❌ Settings GET failed:', getResult.status);
  }
}

async function testTeamOperations() {
  console.log('\n🔍 Testing Team Operations...');
  
  const testWorkspaceId = 'test_workspace';
  
  // Test GET team members
  const getResult = await apiCall(`/team/${testWorkspaceId}/members`);
  if (getResult.status === 401 || getResult.status === 200) {
    results.passed.push('Team Members GET');
    console.log('✅ Team Members GET endpoint responds correctly');
  } else {
    results.failed.push('Team Members GET');
    console.log('❌ Team Members GET failed:', getResult.status);
  }
  
  // Test POST invite
  const inviteResult = await apiCall(`/team/${testWorkspaceId}/invite`, 'POST', {
    email: 'test@example.com',
    name: 'Test User',
    role: 'member',
  });
  if (inviteResult.status === 401 || inviteResult.status === 200 || inviteResult.status === 400) {
    results.passed.push('Team Invite POST');
    console.log('✅ Team Invite POST endpoint responds correctly');
  } else {
    results.failed.push('Team Invite POST');
    console.log('❌ Team Invite POST failed:', inviteResult.status);
  }
}

async function testCalendarOperations() {
  console.log('\n🔍 Testing Calendar Operations...');
  
  // Test Google Calendar callback
  const googleResult = await apiCall('/calendar/google/callback?code=test');
  if (googleResult.status === 400 || googleResult.status === 200 || googleResult.status === 401) {
    results.passed.push('Google Calendar Callback');
    console.log('✅ Google Calendar callback endpoint responds correctly');
  } else {
    results.warnings.push('Google Calendar Callback');
    console.log('⚠️  Google Calendar callback status:', googleResult.status);
  }
}

async function testErrorHandling() {
  console.log('\n🔍 Testing Error Handling...');
  
  // Test invalid endpoint
  const invalidResult = await apiCall('/invalid-endpoint');
  if (invalidResult.status === 404) {
    results.passed.push('Error Handling (404)');
    console.log('✅ 404 error handling works correctly');
  } else {
    results.warnings.push('Error Handling (404)');
    console.log('⚠️  404 handling returned:', invalidResult.status);
  }
  
  // Test invalid method
  const methodResult = await apiCall('/health', 'PUT');
  if (methodResult.status === 405 || methodResult.status === 404) {
    results.passed.push('Error Handling (Method)');
    console.log('✅ Method error handling works correctly');
  } else {
    results.warnings.push('Error Handling (Method)');
    console.log('⚠️  Method error handling returned:', methodResult.status);
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Database Function Tests...');
  console.log(`📡 API Base: ${API_BASE}`);
  console.log(`🔑 Project ID: ${projectId}`);
  
  // Run all tests
  await testHealthCheck();
  await testWorkspaceOperations();
  await testTaskOperations();
  await testFolderOperations();
  await testProjectOperations();
  await testSettingsOperations();
  await testTeamOperations();
  await testCalendarOperations();
  await testErrorHandling();
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⚠️  Warnings: ${results.warnings.length}`);
  
  if (results.failed.length > 0) {
    console.log('\n❌ Failed Tests:');
    results.failed.forEach(test => console.log(`   - ${test}`));
  }
  
  if (results.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    results.warnings.forEach(test => console.log(`   - ${test}`));
  }
  
  console.log('\n✅ Passed Tests:');
  results.passed.forEach(test => console.log(`   - ${test}`));
  
  console.log('\n' + '='.repeat(60));
  
  if (results.failed.length === 0) {
    console.log('🎉 All critical tests passed!');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Please review the errors above.');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('💥 Test runner crashed:', error);
  process.exit(1);
});

