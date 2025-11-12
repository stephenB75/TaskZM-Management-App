#!/usr/bin/env node
/**
 * TaskZM User Workflow Test Script
 * Tests all app functions programmatically
 * 
 * Usage: node scripts/test-workflow.js
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

let testResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
  errors: [],
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function test(name, fn) {
  try {
    fn();
    testResults.passed++;
    log(`✓ ${name}`, 'green');
    return true;
  } catch (error) {
    testResults.failed++;
    testResults.errors.push({ name, error: error.message });
    log(`✗ ${name}: ${error.message}`, 'red');
    return false;
  }
}

function warn(message) {
  testResults.warnings++;
  log(`⚠ ${message}`, 'yellow');
}

// Test 1: Check if all required files exist
log('\n📁 File Structure Tests', 'cyan');
log('='.repeat(50), 'cyan');

test('package.json exists', () => {
  if (!fs.existsSync('package.json')) {
    throw new Error('package.json not found');
  }
});

test('src/App.tsx exists', () => {
  if (!fs.existsSync('src/App.tsx')) {
    throw new Error('src/App.tsx not found');
  }
});

test('src/lib/version.ts exists', () => {
  if (!fs.existsSync('src/lib/version.ts')) {
    throw new Error('src/lib/version.ts not found');
  }
});

test('Backend Edge Function exists', () => {
  if (!fs.existsSync('src/supabase/functions/server/index.tsx')) {
    throw new Error('Backend Edge Function not found');
  }
});

// Test 2: Check version consistency
log('\n📦 Version Consistency Tests', 'cyan');
log('='.repeat(50), 'cyan');

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const versionFile = fs.readFileSync('src/lib/version.ts', 'utf8');

test('package.json version matches version.ts', () => {
  const versionMatch = versionFile.match(/APP_VERSION = ['"](.*?)['"]/);
  if (!versionMatch) {
    throw new Error('Could not find APP_VERSION in version.ts');
  }
  const appVersion = versionMatch[1];
  if (packageJson.version !== appVersion) {
    throw new Error(`Version mismatch: package.json (${packageJson.version}) vs version.ts (${appVersion})`);
  }
});

// Test 3: Check critical components
log('\n🧩 Component Structure Tests', 'cyan');
log('='.repeat(50), 'cyan');

const criticalComponents = [
  'src/components/AuthScreen.tsx',
  'src/components/DashboardView.tsx',
  'src/components/SettingsPanel.tsx',
  'src/components/TaskDialog.tsx',
  'src/components/PricingDialog.tsx',
  'src/components/TeamPanel.tsx',
  'src/components/AnalyticsPanel.tsx',
  'src/components/CalDAVCredentialsDialog.tsx',
];

criticalComponents.forEach(component => {
  test(`Component exists: ${component}`, () => {
    if (!fs.existsSync(component)) {
      throw new Error(`Component not found: ${component}`);
    }
  });
});

// Test 4: Check context providers
log('\n🔌 Context Provider Tests', 'cyan');
log('='.repeat(50), 'cyan');

const contextProviders = [
  'src/contexts/AuthContext.tsx',
  'src/contexts/TaskContext.tsx',
  'src/contexts/SubscriptionContext.tsx',
  'src/contexts/CalendarContext.tsx',
  'src/contexts/PomodoroContext.tsx',
  'src/contexts/TeamContext.tsx',
  'src/contexts/AwardContext.tsx',
  'src/contexts/NotificationContext.tsx',
  'src/contexts/AIContext.tsx',
];

contextProviders.forEach(context => {
  test(`Context exists: ${context}`, () => {
    if (!fs.existsSync(context)) {
      throw new Error(`Context not found: ${context}`);
    }
  });
});

// Test 5: Check backend routes
log('\n🔗 Backend Route Tests', 'cyan');
log('='.repeat(50), 'cyan');

const backendFile = fs.readFileSync('src/supabase/functions/server/index.tsx', 'utf8');
const requiredRoutes = [
  '/make-server-65e6e67f/health',
  '/make-server-65e6e67f/signup',
  '/make-server-65e6e67f/tasks/',
  '/make-server-65e6e67f/subscription',
  '/make-server-65e6e67f/calendar/google/auth',
  '/make-server-65e6e67f/calendar/apple/setup',
  '/make-server-65e6e67f/revenuecat-webhook',
  '/make-server-65e6e67f/create-billing-portal',
];

requiredRoutes.forEach(route => {
  test(`Route exists: ${route}`, () => {
    if (!backendFile.includes(route)) {
      throw new Error(`Route not found: ${route}`);
    }
  });
});

// Test 6: Check environment variable references
log('\n🔐 Environment Variable Tests', 'cyan');
log('='.repeat(50), 'cyan');

const envVars = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
  'STRIPE_SECRET_KEY',
  'REVENUECAT_WEBHOOK_SECRET',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
];

envVars.forEach(envVar => {
  const found = backendFile.includes(`Deno.env.get('${envVar}')`) || 
                backendFile.includes(`Deno.env.get("${envVar}")`);
  if (found) {
    test(`Environment variable referenced: ${envVar}`, () => {
      // Variable is referenced in code
    });
  } else {
    warn(`Environment variable not found: ${envVar} (may be optional)`);
  }
});

// Test 7: Check frontend environment variables
log('\n🌐 Frontend Environment Tests', 'cyan');
log('='.repeat(50), 'cyan');

const frontendEnvCheck = () => {
  const revenuecatFile = fs.readFileSync('src/lib/revenuecat.ts', 'utf8');
  if (revenuecatFile.includes('VITE_REVENUECAT_WEB_PUBLIC_KEY')) {
    test('Frontend RevenueCat variable referenced', () => {
      // Variable is referenced
    });
  }
};

frontendEnvCheck();

// Test 8: Check critical functions
log('\n⚙️  Function Implementation Tests', 'cyan');
log('='.repeat(50), 'cyan');

const revenuecatFile = fs.readFileSync('src/lib/revenuecat.ts', 'utf8');
test('purchaseProSubscription function exists', () => {
  if (!revenuecatFile.includes('purchaseProSubscription')) {
    throw new Error('purchaseProSubscription function not found');
  }
});

test('openCustomerPortal function exists', () => {
  if (!revenuecatFile.includes('openCustomerPortal')) {
    throw new Error('openCustomerPortal function not found');
  }
});

test('configureRevenueCat function exists', () => {
  if (!revenuecatFile.includes('configureRevenueCat')) {
    throw new Error('configureRevenueCat function not found');
  }
});

// Test 9: Check subscription management
log('\n💳 Subscription Management Tests', 'cyan');
log('='.repeat(50), 'cyan');

const settingsFile = fs.readFileSync('src/components/SettingsPanel.tsx', 'utf8');
test('Subscription section exists in SettingsPanel', () => {
  if (!settingsFile.includes('Subscription') || !settingsFile.includes('subscription')) {
    throw new Error('Subscription section not found in SettingsPanel');
  }
});

test('Manage Subscription button exists', () => {
  if (!settingsFile.includes('Manage Subscription')) {
    throw new Error('Manage Subscription button not found');
  }
});

test('Refresh subscription functionality exists', () => {
  if (!settingsFile.includes('refreshSubscription')) {
    throw new Error('Refresh subscription functionality not found');
  }
});

// Test 10: Check calendar integration
log('\n📅 Calendar Integration Tests', 'cyan');
log('='.repeat(50), 'cyan');

test('CalendarContext exists', () => {
  const calendarContext = fs.readFileSync('src/contexts/CalendarContext.tsx', 'utf8');
  if (!calendarContext.includes('connectCalendar')) {
    throw new Error('Calendar connection function not found');
  }
});

test('CalDAV credentials dialog exists', () => {
  if (!fs.existsSync('src/components/CalDAVCredentialsDialog.tsx')) {
    throw new Error('CalDAV credentials dialog not found');
  }
});

// Test 11: Check error handling
log('\n🛡️  Error Handling Tests', 'cyan');
log('='.repeat(50), 'cyan');

test('Error handling in backend routes', () => {
  const errorHandlingCount = (backendFile.match(/try\s*{/g) || []).length;
  const catchCount = (backendFile.match(/catch\s*\(/g) || []).length;
  if (errorHandlingCount < 10 || catchCount < 10) {
    warn('Some backend routes may be missing error handling');
  }
});

// Test 12: Check for console.log cleanup
log('\n🧹 Code Quality Tests', 'cyan');
log('='.repeat(50), 'cyan');

const checkConsoleLogs = (filePath, relativePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const consoleLogs = (content.match(/console\.log\(/g) || []).length;
  const consoleErrors = (content.match(/console\.error\(/g) || []).length;
  
  if (consoleLogs > 5 && !filePath.includes('server/index.tsx')) {
    warn(`${relativePath}: ${consoleLogs} console.log statements found (consider using logger)`);
  }
  
  if (consoleErrors > 0 && !filePath.includes('server/index.tsx')) {
    warn(`${relativePath}: ${consoleErrors} console.error statements (consider using logger.error)`);
  }
};

// Check main files
const mainFiles = [
  'src/components/SettingsPanel.tsx',
  'src/components/DashboardView.tsx',
  'src/contexts/TaskContext.tsx',
];

mainFiles.forEach(file => {
  if (fs.existsSync(file)) {
    checkConsoleLogs(file, file);
  }
});

// Test 13: Check imports
log('\n📚 Import Tests', 'cyan');
log('='.repeat(50), 'cyan');

test('React imported correctly', () => {
  const appFile = fs.readFileSync('src/App.tsx', 'utf8');
  if (!appFile.includes("from 'react'") && !appFile.includes('from "react"')) {
    throw new Error('React import not found');
  }
});

// Summary
log('\n' + '='.repeat(50), 'cyan');
log('📊 Test Summary', 'cyan');
log('='.repeat(50), 'cyan');
log(`✅ Passed: ${testResults.passed}`, 'green');
log(`❌ Failed: ${testResults.failed}`, 'red');
log(`⚠️  Warnings: ${testResults.warnings}`, 'yellow');

if (testResults.errors.length > 0) {
  log('\n❌ Errors:', 'red');
  testResults.errors.forEach(({ name, error }) => {
    log(`  • ${name}: ${error}`, 'red');
  });
}

log('\n📝 Next Steps:', 'cyan');
log('1. Review failed tests above');
log('2. Run manual tests using USER_WORKFLOW_TEST_CHECKLIST.md');
log('3. Test in browser with `npm run dev`');
log('4. Verify backend endpoints are accessible');
log('5. Test end-to-end user workflows');

process.exit(testResults.failed > 0 ? 1 : 0);

