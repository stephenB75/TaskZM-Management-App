#!/usr/bin/env node

/**
 * RevenueCat Identifier Verification Script
 * Checks all RevenueCat identifiers used in the codebase
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

console.log('🔍 RevenueCat Identifier Verification\n');
console.log('=' .repeat(60));

// Read subscription constants
const constantsPath = path.join(PROJECT_ROOT, 'src/lib/subscription-constants.ts');
const constantsContent = fs.readFileSync(constantsPath, 'utf-8');

// Extract product IDs
const monthlyProductIdMatch = constantsContent.match(/REVENUECAT_MONTHLY_PRODUCT_ID\s*=\s*['"]([^'"]+)['"]/);
const yearlyProductIdMatch = constantsContent.match(/REVENUECAT_YEARLY_PRODUCT_ID\s*=\s*['"]([^'"]+)['"]/);

const monthlyProductId = monthlyProductIdMatch ? monthlyProductIdMatch[1] : 'NOT FOUND';
const yearlyProductId = yearlyProductIdMatch ? yearlyProductIdMatch[1] : 'NOT FOUND';

console.log('\n📦 Product IDs (from subscription-constants.ts):');
console.log(`  Monthly: ${monthlyProductId}`);
console.log(`  Yearly:  ${yearlyProductId}`);

// Check revenuecat.ts for identifiers
const revenuecatPath = path.join(PROJECT_ROOT, 'src/lib/revenuecat.ts');
const revenuecatContent = fs.readFileSync(revenuecatPath, 'utf-8');

// Extract package matching keywords
const monthlyKeywordsMatch = revenuecatContent.match(/keywords\s*=\s*type\s*===\s*['"]monthly['"]\s*\?\s*\[([^\]]+)\]/);
const yearlyKeywordsMatch = revenuecatContent.match(/keywords\s*=\s*type\s*===\s*['"]yearly['"]\s*\?\s*\[([^\]]+)\]/);

console.log('\n🔑 Package Matching Keywords:');
if (monthlyKeywordsMatch) {
  const keywords = monthlyKeywordsMatch[1].split(',').map(k => k.trim().replace(/['"]/g, ''));
  console.log(`  Monthly: ${keywords.join(', ')}`);
}
if (yearlyKeywordsMatch) {
  const keywords = yearlyKeywordsMatch[1].split(',').map(k => k.trim().replace(/['"]/g, ''));
  console.log(`  Yearly:  ${keywords.join(', ')}`);
}

// Check for entitlement identifiers
const subscriptionContextPath = path.join(PROJECT_ROOT, 'src/contexts/SubscriptionContext.tsx');
const subscriptionContextContent = fs.readFileSync(subscriptionContextPath, 'utf-8');

const entitlementMatches = subscriptionContextContent.match(/['"](pro|PRO-Monthly|PRO-Yearly|pro-monthly|pro-yearly)['"]/gi);
const uniqueEntitlements = [...new Set(entitlementMatches || [])];

console.log('\n🎫 Entitlement Identifiers (found in code):');
uniqueEntitlements.forEach(ent => {
  console.log(`  - ${ent.replace(/['"]/g, '')}`);
});

// Check backend webhook
const backendPath = path.join(PROJECT_ROOT, 'src/supabase/functions/server/index.tsx');
if (fs.existsSync(backendPath)) {
  const backendContent = fs.readFileSync(backendPath, 'utf-8');
  const backendEntitlements = backendContent.match(/entitlements\.active\?\.\[['"]([^'"]+)['"]\]/g);
  
  if (backendEntitlements) {
    console.log('\n🔗 Backend Webhook Entitlement Checks:');
    backendEntitlements.forEach(match => {
      const ent = match.match(/['"]([^'"]+)['"]/)?.[1];
      if (ent) console.log(`  - ${ent}`);
    });
  }
}

// Check package identifier patterns
console.log('\n📋 Expected Package Identifier Patterns:');
console.log('  Monthly: Should contain "month" or "monthly"');
console.log('  Yearly:  Should contain "year", "yearly", "annual", or "annually"');
console.log('  Common:  $rc_monthly, $rc_annual, monthly, yearly, etc.');

// Check for product ID usage
console.log('\n🔍 Product ID Usage in Code:');
const productIdUsages = [
  ...revenuecatContent.matchAll(/REVENUECAT_(MONTHLY|YEARLY)_PRODUCT_ID/g)
];
if (productIdUsages.length > 0) {
  console.log(`  Found ${productIdUsages.length} references to product ID constants`);
} else {
  console.log('  ⚠️  No direct references to product ID constants found');
}

console.log('\n' + '='.repeat(60));
console.log('\n✅ Verification Complete');
console.log('\n📝 Next Steps:');
console.log('  1. Verify Product IDs match RevenueCat Dashboard → Products');
console.log('  2. Verify Package Identifiers match RevenueCat Dashboard → Offerings');
console.log('  3. Verify Entitlement IDs match RevenueCat Dashboard → Entitlements');
console.log('  4. Check console logs when app loads to see actual identifiers from RevenueCat');
console.log('\n💡 To see actual identifiers from RevenueCat:');
console.log('  - Open browser console');
console.log('  - Look for: "🔍 Searching for monthly/yearly package"');
console.log('  - Check: "📦 RevenueCat offerings received"');

