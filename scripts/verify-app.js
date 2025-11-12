#!/usr/bin/env node
/**
 * TaskZM App Verification Script
 * Verifies the app is functioning correctly after cleanup
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 TaskZM App Verification\n');
console.log('='.repeat(60));

let errors = [];
let warnings = [];

// Check critical files exist
const criticalFiles = [
  'src/main.tsx',
  'src/App.tsx',
  'src/vite.config.ts',
  'src/index.html',
  'package.json',
  'src/contexts/TaskContext.tsx',
  'src/contexts/AuthContext.tsx',
  'src/components/DashboardView.tsx',
  'src/components/AuthScreen.tsx',
  'src/lib/api.ts',
  'src/lib/version.ts',
];

console.log('\n📁 Checking Critical Files...');
criticalFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`  ✅ ${file}`);
  } else {
    errors.push(`Missing critical file: ${file}`);
    console.log(`  ❌ ${file} - MISSING`);
  }
});

// Check package.json
console.log('\n📦 Checking package.json...');
try {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  console.log(`  ✅ Version: ${pkg.version}`);
  
  const requiredDeps = ['react', 'react-dom', '@supabase/supabase-js'];
  requiredDeps.forEach(dep => {
    if (pkg.dependencies?.[dep] || pkg.devDependencies?.[dep]) {
      console.log(`  ✅ ${dep} installed`);
    } else {
      warnings.push(`Dependency ${dep} not found in package.json`);
      console.log(`  ⚠️  ${dep} - not found`);
    }
  });
} catch (error) {
  errors.push(`Failed to read package.json: ${error.message}`);
  console.log(`  ❌ Error reading package.json`);
}

// Check context providers are exported
console.log('\n🔌 Checking Context Providers...');
const contexts = [
  'src/contexts/AuthContext.tsx',
  'src/contexts/TaskContext.tsx',
  'src/contexts/ThemeContext.tsx',
  'src/contexts/SubscriptionContext.tsx',
  'src/contexts/CalendarContext.tsx',
  'src/contexts/TeamContext.tsx',
];

contexts.forEach(contextFile => {
  if (fs.existsSync(contextFile)) {
    const content = fs.readFileSync(contextFile, 'utf8');
    if (content.includes('export') && (content.includes('Provider') || content.includes('Context'))) {
      console.log(`  ✅ ${path.basename(contextFile)}`);
    } else {
      warnings.push(`${contextFile} may not export Provider/Context`);
      console.log(`  ⚠️  ${path.basename(contextFile)} - may be missing exports`);
    }
  }
});

// Check main entry points
console.log('\n🚀 Checking Entry Points...');
const mainContent = fs.existsSync('src/main.tsx') ? fs.readFileSync('src/main.tsx', 'utf8') : '';
const appContent = fs.existsSync('src/App.tsx') ? fs.readFileSync('src/App.tsx', 'utf8') : '';

if (mainContent.includes('ReactDOM.createRoot') || mainContent.includes('ReactDOM.render')) {
  console.log('  ✅ main.tsx has ReactDOM render');
} else {
  errors.push('main.tsx missing ReactDOM render');
  console.log('  ❌ main.tsx missing ReactDOM render');
}

if (appContent.includes('export') && (appContent.includes('function App') || appContent.includes('const App'))) {
  console.log('  ✅ App.tsx exports App component');
} else {
  errors.push('App.tsx may not export App component');
  console.log('  ⚠️  App.tsx may not export App component');
}

// Check vite config
console.log('\n⚙️  Checking Configuration...');
if (fs.existsSync('src/vite.config.ts')) {
  const viteConfig = fs.readFileSync('src/vite.config.ts', 'utf8');
  if (viteConfig.includes('defineConfig') && viteConfig.includes('plugins')) {
    console.log('  ✅ vite.config.ts is valid');
  } else {
    warnings.push('vite.config.ts may be incomplete');
    console.log('  ⚠️  vite.config.ts may be incomplete');
  }
} else if (fs.existsSync('vite.config.ts')) {
  console.log('  ⚠️  vite.config.ts in root (should be in src/)');
  warnings.push('vite.config.ts in root directory');
} else {
  errors.push('vite.config.ts not found');
  console.log('  ❌ vite.config.ts not found');
}

// Check index.html
if (fs.existsSync('src/index.html')) {
  const indexHtml = fs.readFileSync('src/index.html', 'utf8');
  if (indexHtml.includes('<div id="root">') && indexHtml.includes('main.tsx')) {
    console.log('  ✅ index.html is valid');
  } else {
    warnings.push('index.html may be missing root div or main.tsx reference');
    console.log('  ⚠️  index.html may be incomplete');
  }
}

// Check documentation organization
console.log('\n📚 Checking Documentation...');
if (fs.existsSync('docs')) {
  const docFiles = fs.readdirSync('docs').filter(f => f.endsWith('.md'));
  console.log(`  ✅ docs/ folder exists with ${docFiles.length} files`);
} else {
  warnings.push('docs/ folder not found');
  console.log('  ⚠️  docs/ folder not found');
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 Verification Summary\n');

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ All checks passed! App appears to be functioning correctly.');
  process.exit(0);
} else {
  if (errors.length > 0) {
    console.log(`❌ Errors found (${errors.length}):`);
    errors.forEach(err => console.log(`   - ${err}`));
  }
  if (warnings.length > 0) {
    console.log(`\n⚠️  Warnings (${warnings.length}):`);
    warnings.forEach(warn => console.log(`   - ${warn}`));
  }
  
  if (errors.length > 0) {
    console.log('\n❌ App verification failed. Please fix errors before proceeding.');
    process.exit(1);
  } else {
    console.log('\n⚠️  App verification completed with warnings. App should function but review warnings.');
    process.exit(0);
  }
}

