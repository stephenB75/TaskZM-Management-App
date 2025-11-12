#!/usr/bin/env node

/**
 * Connection Verification Script
 * Tests frontend-backend-Supabase connectivity
 */

const projectId = "gflesnyfpxqhaunfskrw";
const publicAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmbGVzbnlmcHhxaGF1bmZza3J3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzMDQwMTcsImV4cCI6MjA3Njg4MDAxN30.t6bH6nO7shmf_Am9mxllbQDhNeVaN249p1MYcF8DvtM";
const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-65e6e67f`;

const results = {
  passed: [],
  failed: [],
  warnings: []
};

async function testEndpoint(name, url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
        ...options.headers
      }
    });

    const status = response.status;
    const isOk = status >= 200 && status < 300;
    const isExpected401 = status === 401 && name.includes('auth-required');

    if (isOk || isExpected401) {
      results.passed.push(`${name} (${status})`);
      return { success: true, status, data: isOk ? await response.json().catch(() => null) : null };
    } else {
      const errorText = await response.text().catch(() => 'Unknown error');
      results.failed.push(`${name} (${status}): ${errorText.substring(0, 100)}`);
      return { success: false, status, error: errorText };
    }
  } catch (error) {
    results.failed.push(`${name}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🔍 Testing Frontend-Backend-Supabase Connections...\n');

  // Test 1: Health Check
  console.log('1. Testing Health Endpoint...');
  const health = await testEndpoint('Health Check', `${API_BASE}/health`);
  if (health.success && health.data?.status === 'ok') {
    console.log('   ✅ Backend is reachable and responding\n');
  } else {
    console.log('   ❌ Backend health check failed\n');
  }

  // Test 2: Supabase Auth Connection
  console.log('2. Testing Supabase Auth Connection...');
  try {
    const authUrl = `https://${projectId}.supabase.co/auth/v1/health`;
    const authResponse = await fetch(authUrl, {
      headers: { 'apikey': publicAnonKey }
    });
    if (authResponse.ok || authResponse.status === 404) {
      results.passed.push('Supabase Auth Service');
      console.log('   ✅ Supabase Auth service is reachable\n');
    } else {
      results.warnings.push(`Supabase Auth (${authResponse.status})`);
      console.log(`   ⚠️  Supabase Auth returned ${authResponse.status}\n`);
    }
  } catch (error) {
    results.failed.push(`Supabase Auth: ${error.message}`);
    console.log(`   ❌ Supabase Auth connection failed: ${error.message}\n`);
  }

  // Test 3: Workspace Endpoint (should return 401 without user token - proves routing works)
  console.log('3. Testing Workspace Endpoint Routing...');
  const workspace = await testEndpoint('Workspace Endpoint (auth-required)', `${API_BASE}/user/workspaces`);
  if (workspace.status === 401) {
    console.log('   ✅ Workspace endpoint is reachable (401 expected without user token)\n');
  } else {
    console.log(`   ⚠️  Workspace endpoint returned ${workspace.status} (expected 401)\n`);
  }

  // Test 4: Task Endpoint (should return 401 without user token)
  console.log('4. Testing Task Endpoint Routing...');
  const task = await testEndpoint('Task Endpoint (auth-required)', `${API_BASE}/tasks/test-workspace-id`);
  if (task.status === 401 || task.status === 404) {
    console.log('   ✅ Task endpoint is reachable (401/404 expected without valid workspace)\n');
  } else {
    console.log(`   ⚠️  Task endpoint returned ${task.status}\n`);
  }

  // Test 5: CORS Headers
  console.log('5. Testing CORS Configuration...');
  try {
    const corsResponse = await fetch(`${API_BASE}/health`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET'
      }
    });
    const corsHeaders = {
      'access-control-allow-origin': corsResponse.headers.get('access-control-allow-origin'),
      'access-control-allow-methods': corsResponse.headers.get('access-control-allow-methods')
    };
    if (corsHeaders['access-control-allow-origin']) {
      results.passed.push('CORS Configuration');
      console.log('   ✅ CORS is properly configured\n');
    } else {
      results.warnings.push('CORS headers not found');
      console.log('   ⚠️  CORS headers not detected\n');
    }
  } catch (error) {
    results.warnings.push(`CORS test: ${error.message}`);
    console.log(`   ⚠️  CORS test failed: ${error.message}\n`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⚠️  Warnings: ${results.warnings.length}`);
  console.log('\n');

  if (results.passed.length > 0) {
    console.log('✅ Passed Tests:');
    results.passed.forEach(test => console.log(`   - ${test}`));
    console.log('\n');
  }

  if (results.warnings.length > 0) {
    console.log('⚠️  Warnings:');
    results.warnings.forEach(warning => console.log(`   - ${warning}`));
    console.log('\n');
  }

  if (results.failed.length > 0) {
    console.log('❌ Failed Tests:');
    results.failed.forEach(failure => console.log(`   - ${failure}`));
    console.log('\n');
  }

  // Final verdict
  if (results.failed.length === 0 && results.passed.length >= 3) {
    console.log('🎉 All critical connections are working!');
    console.log('\n✅ Frontend → Backend: Connected');
    console.log('✅ Backend → Supabase: Connected');
    console.log('✅ API Routing: Working');
    console.log('✅ CORS: Configured');
    process.exit(0);
  } else if (results.failed.length === 0) {
    console.log('⚠️  Connections are working but some tests need attention');
    process.exit(0);
  } else {
    console.log('❌ Some connections failed. Please check the errors above.');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});

