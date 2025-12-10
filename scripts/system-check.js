#!/usr/bin/env node

/**
 * System Check Script for TaskZM
 * Analyzes all backend functions, routes, and dependencies
 */

const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, '../src/supabase/functions/server/index.tsx');

function analyzeServerFile() {
  const content = fs.readFileSync(serverFile, 'utf-8');
  
  // Extract all routes
  const routePattern = /app\.(get|post|put|delete|patch)\(["']([^"']+)["']/g;
  const routes = [];
  let match;
  
  while ((match = routePattern.exec(content)) !== null) {
    routes.push({
      method: match[1].toUpperCase(),
      path: match[2],
      hasPrefix: match[2].includes('/taskzm-database-function/'),
    });
  }
  
  // Extract environment variables
  const envPattern = /Deno\.env\.get\(['"]([^'"]+)['"]\)/g;
  const envVars = new Set();
  while ((match = envPattern.exec(content)) !== null) {
    envVars.add(match[1]);
  }
  
  // Extract imports
  const importPattern = /import\s+.*from\s+['"]([^'"]+)['"]/g;
  const imports = new Set();
  while ((match = importPattern.exec(content)) !== null) {
    imports.add(match[1]);
  }
  
  return {
    routes,
    envVars: Array.from(envVars).sort(),
    imports: Array.from(imports).sort(),
    totalRoutes: routes.length,
  };
}

function generateReport() {
  const analysis = analyzeServerFile();
  
  console.log('\n' + '='.repeat(80));
  console.log('TaskZM Backend System Check Report');
  console.log('='.repeat(80) + '\n');
  
  console.log('📊 ROUTE ANALYSIS');
  console.log('-'.repeat(80));
  console.log(`Total Routes: ${analysis.totalRoutes}\n`);
  
  // Group routes by category
  const categories = {
    'Health & Status': [],
    'Authentication & Users': [],
    'Tasks': [],
    'Calendar': [],
    'Subscription': [],
    'Demo Users': [],
    'Team Management': [],
    'Admin': [],
    'Other': [],
  };
  
  analysis.routes.forEach(route => {
    const { method, path } = route;
    const routeInfo = `${method.padEnd(6)} ${path}`;
    
    if (path.includes('health')) {
      categories['Health & Status'].push(routeInfo);
    } else if (path.includes('signup') || path.includes('user')) {
      categories['Authentication & Users'].push(routeInfo);
    } else if (path.includes('task')) {
      categories['Tasks'].push(routeInfo);
    } else if (path.includes('calendar')) {
      categories['Calendar'].push(routeInfo);
    } else if (path.includes('subscription') || path.includes('billing') || path.includes('revenuecat')) {
      categories['Subscription'].push(routeInfo);
    } else if (path.includes('demo')) {
      categories['Demo Users'].push(routeInfo);
    } else if (path.includes('team') || path.includes('workspace') || path.includes('invitation')) {
      categories['Team Management'].push(routeInfo);
    } else if (path.includes('admin')) {
      categories['Admin'].push(routeInfo);
    } else {
      categories['Other'].push(routeInfo);
    }
  });
  
  Object.entries(categories).forEach(([category, routes]) => {
    if (routes.length > 0) {
      console.log(`\n${category} (${routes.length}):`);
      routes.forEach(route => console.log(`  ${route}`));
    }
  });
  
  // Route consistency check
  console.log('\n\n⚠️  ROUTE CONSISTENCY CHECK');
  console.log('-'.repeat(80));
  const routesWithPrefix = analysis.routes.filter(r => r.hasPrefix);
  const routesWithoutPrefix = analysis.routes.filter(r => !r.hasPrefix);
  
  console.log(`Routes WITH prefix '/taskzm-database-function/': ${routesWithPrefix.length}`);
  console.log(`Routes WITHOUT prefix: ${routesWithoutPrefix.length}`);
  
  if (routesWithPrefix.length > 0 && routesWithoutPrefix.length > 0) {
    console.log('\n⚠️  WARNING: Mixed route patterns detected!');
    console.log('   Some routes use prefix, others don\'t. This may cause routing issues.\n');
    console.log('Routes WITH prefix:');
    routesWithPrefix.forEach(r => console.log(`  ${r.method} ${r.path}`));
    console.log('\nRoutes WITHOUT prefix:');
    routesWithoutPrefix.forEach(r => console.log(`  ${r.method} ${r.path}`));
  }
  
  // Environment variables
  console.log('\n\n🔐 ENVIRONMENT VARIABLES');
  console.log('-'.repeat(80));
  console.log(`Total Required: ${analysis.envVars.length}\n`);
  analysis.envVars.forEach(env => {
    console.log(`  - ${env}`);
  });
  
  // Dependencies
  console.log('\n\n📦 DEPENDENCIES');
  console.log('-'.repeat(80));
  const externalDeps = analysis.imports.filter(i => 
    i.startsWith('npm:') || 
    i.startsWith('jsr:') || 
    i.startsWith('http') ||
    i.startsWith('https')
  );
  const internalDeps = analysis.imports.filter(i => i.startsWith('./'));
  
  console.log(`\nExternal Dependencies (${externalDeps.length}):`);
  externalDeps.forEach(dep => console.log(`  - ${dep}`));
  
  console.log(`\nInternal Modules (${internalDeps.length}):`);
  internalDeps.forEach(dep => console.log(`  - ${dep}`));
  
  // Summary
  console.log('\n\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Total Routes: ${analysis.totalRoutes}`);
  console.log(`⚠️  Environment Variables: ${analysis.envVars.length}`);
  console.log(`📦 External Dependencies: ${externalDeps.length}`);
  console.log(`📁 Internal Modules: ${internalDeps.length}`);
  
  if (routesWithPrefix.length > 0 && routesWithoutPrefix.length > 0) {
    console.log(`\n⚠️  ACTION REQUIRED: Fix route consistency (${routesWithPrefix.length} with prefix, ${routesWithoutPrefix.length} without)`);
  } else {
    console.log('\n✅ Route consistency: OK');
  }
  
  console.log('\n');
}

generateReport();

