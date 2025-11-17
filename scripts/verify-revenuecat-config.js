#!/usr/bin/env node

/**
 * RevenueCat Configuration Verification Script
 * 
 * Verifies that the RevenueCat API key and product IDs in the app
 * match what's configured in the RevenueCat dashboard.
 * 
 * Usage:
 *   node scripts/verify-revenuecat-config.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 RevenueCat Configuration Verification\n');
console.log('='.repeat(60));

// 1. Check Product IDs in constants file
console.log('\n📦 Product IDs in App Code:');
const constantsPath = path.join(__dirname, '../src/lib/subscription-constants.ts');
let monthlyMatch = null;
let yearlyMatch = null;
let monthlyEntitlementMatch = null;
let yearlyEntitlementMatch = null;

if (fs.existsSync(constantsPath)) {
  const constantsContent = fs.readFileSync(constantsPath, 'utf8');
  
  monthlyMatch = constantsContent.match(/REVENUECAT_MONTHLY_PRODUCT_ID\s*=\s*["']([^"']+)["']/);
  yearlyMatch = constantsContent.match(/REVENUECAT_YEARLY_PRODUCT_ID\s*=\s*["']([^"']+)["']/);
  
  if (monthlyMatch) {
    const monthlyId = monthlyMatch[1];
    console.log(`   ✅ Monthly Product ID: ${monthlyId}`);
    console.log(`      Expected: prodb18a767009`);
    console.log(`      Match: ${monthlyId === 'prodb18a767009' ? '✅ YES' : '❌ NO'}`);
  } else {
    console.log('   ❌ Monthly Product ID not found in constants file');
  }
  
  if (yearlyMatch) {
    const yearlyId = yearlyMatch[1];
    console.log(`   ✅ Yearly Product ID: ${yearlyId}`);
    console.log(`      Expected: prod77566b1baf`);
    console.log(`      Match: ${yearlyId === 'prod77566b1baf' ? '✅ YES' : '❌ NO'}`);
  } else {
    console.log('   ❌ Yearly Product ID not found in constants file');
  }
  
  // Check Entitlement IDs
  monthlyEntitlementMatch = constantsContent.match(/REVENUECAT_MONTHLY_ENTITLEMENT_ID\s*=\s*["']([^"']+)["']/);
  yearlyEntitlementMatch = constantsContent.match(/REVENUECAT_YEARLY_ENTITLEMENT_ID\s*=\s*["']([^"']+)["']/);
  
  if (monthlyEntitlementMatch) {
    console.log(`   ✅ Monthly Entitlement ID: ${monthlyEntitlementMatch[1]}`);
    console.log(`      Expected: PRO-Monthly`);
    console.log(`      Match: ${monthlyEntitlementMatch[1] === 'PRO-Monthly' ? '✅ YES' : '❌ NO'}`);
  }
  
  if (yearlyEntitlementMatch) {
    console.log(`   ✅ Yearly Entitlement ID: ${yearlyEntitlementMatch[1]}`);
    console.log(`      Expected: PRO-Yearly`);
    console.log(`      Match: ${yearlyEntitlementMatch[1] === 'PRO-Yearly' ? '✅ YES' : '❌ NO'}`);
  }
} else {
  console.log('   ❌ Constants file not found:', constantsPath);
}

// 2. Check API Key in environment
console.log('\n🔑 RevenueCat API Key:');
const envPath = path.join(__dirname, '../.env');
const envLocalPath = path.join(__dirname, '../.env.local');

let apiKey = null;
let apiKeySource = null;

// Check .env file
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const keyMatch = envContent.match(/VITE_REVENUECAT_WEB_PUBLIC_KEY\s*=\s*([^\s#]+)/);
  if (keyMatch) {
    apiKey = keyMatch[1].trim();
    apiKeySource = '.env';
  }
}

// Check .env.local file (takes precedence)
if (fs.existsSync(envLocalPath)) {
  const envLocalContent = fs.readFileSync(envLocalPath, 'utf8');
  const keyMatch = envLocalContent.match(/VITE_REVENUECAT_WEB_PUBLIC_KEY\s*=\s*([^\s#]+)/);
  if (keyMatch) {
    apiKey = keyMatch[1].trim();
    apiKeySource = '.env.local';
  }
}

if (apiKey) {
  const keyPrefix = apiKey.substring(0, Math.min(10, apiKey.length));
  const keySuffix = apiKey.length > 10 ? apiKey.substring(apiKey.length - 4) : '****';
  console.log(`   ✅ API Key found in ${apiKeySource}`);
  console.log(`      Key: ${keyPrefix}...${keySuffix} (${apiKey.length} chars)`);
  
  // Validate format
  if (apiKey.startsWith('rc_') || apiKey.startsWith('rcb_')) {
    console.log(`      Format: ✅ Valid (${apiKey.startsWith('rcb_') ? 'PUBLIC (web)' : 'PUBLIC (legacy)'})`);
  } else {
    console.log(`      Format: ❌ Invalid (should start with 'rc_' or 'rcb_')`);
  }
  
  // Check if it's a placeholder
  if (apiKey === 'dev_mode_placeholder' || apiKey.trim() === '') {
    console.log(`      Status: ⚠️  Placeholder/Empty (not a real key)`);
  } else {
    console.log(`      Status: ✅ Appears to be a real API key`);
  }
  
  // Verify against expected key
  const expectedKey = 'rcb_yptsEebLZbQoBdXImWlxpbgtifLS';
  if (apiKey === expectedKey) {
    console.log(`      Verification: ✅ Matches expected key`);
  } else {
    console.log(`      Verification: ⚠️  Does NOT match expected key`);
    console.log(`      Expected: ${expectedKey.substring(0, 10)}...${expectedKey.substring(expectedKey.length - 4)}`);
  }
} else {
  console.log('   ❌ API Key not found in .env or .env.local');
  console.log('      Please set VITE_REVENUECAT_WEB_PUBLIC_KEY in your .env file');
}

// 3. Check Expected App ID
console.log('\n🆔 RevenueCat App ID:');
const revenuecatPath = path.join(__dirname, '../src/lib/revenuecat.ts');
let appIdMatch = null;
if (fs.existsSync(revenuecatPath)) {
  const revenuecatContent = fs.readFileSync(revenuecatPath, 'utf8');
  appIdMatch = revenuecatContent.match(/EXPECTED_REVENUECAT_APP_ID\s*=\s*["']([^"']+)["']/);
  
  if (appIdMatch) {
    const appId = appIdMatch[1];
    console.log(`   ✅ Expected App ID: ${appId}`);
    console.log(`      Expected: app4689b9299f`);
    console.log(`      Match: ${appId === 'app4689b9299f' ? '✅ YES' : '❌ NO'}`);
  } else {
    console.log('   ⚠️  Expected App ID not found in revenuecat.ts');
  }
} else {
  console.log('   ⚠️  revenuecat.ts file not found');
}

// 4. Summary
console.log('\n' + '='.repeat(60));
console.log('📋 Verification Summary:');
console.log('='.repeat(60));

const checks = {
  monthlyProductId: monthlyMatch && monthlyMatch[1] === 'prodb18a767009',
  yearlyProductId: yearlyMatch && yearlyMatch[1] === 'prod77566b1baf',
  monthlyEntitlement: monthlyEntitlementMatch && monthlyEntitlementMatch[1] === 'PRO-Monthly',
  yearlyEntitlement: yearlyEntitlementMatch && yearlyEntitlementMatch[1] === 'PRO-Yearly',
  apiKeyFound: !!apiKey && apiKey !== 'dev_mode_placeholder' && apiKey.trim() !== '',
  apiKeyFormat: apiKey && (apiKey.startsWith('rc_') || apiKey.startsWith('rcb_')),
  appId: appIdMatch && appIdMatch[1] === 'app4689b9299f'
};

const allPassed = Object.values(checks).every(v => v === true);

if (allPassed) {
  console.log('✅ All checks passed! Configuration matches expected values.');
} else {
  console.log('⚠️  Some checks failed. Please review the issues above.');
  console.log('\nIssues found:');
  if (!checks.monthlyProductId) console.log('   ❌ Monthly Product ID mismatch');
  if (!checks.yearlyProductId) console.log('   ❌ Yearly Product ID mismatch');
  if (!checks.monthlyEntitlement) console.log('   ❌ Monthly Entitlement ID mismatch');
  if (!checks.yearlyEntitlement) console.log('   ❌ Yearly Entitlement ID mismatch');
  if (!checks.apiKeyFound) console.log('   ❌ API Key not found or is placeholder');
  if (!checks.apiKeyFormat) console.log('   ❌ API Key format invalid');
  if (!checks.appId) console.log('   ❌ App ID mismatch');
}

console.log('\n📝 Expected Configuration:');
console.log('   Monthly Product ID: prodb18a767009');
console.log('   Yearly Product ID: prod77566b1baf');
console.log('   Monthly Entitlement: PRO-Monthly');
console.log('   Yearly Entitlement: PRO-Yearly');
console.log('   App ID: app4689b9299f');
console.log('   API Key: VITE_REVENUECAT_WEB_PUBLIC_KEY (should start with rc_ or rcb_)');
console.log('\n');

