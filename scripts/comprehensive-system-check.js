#!/usr/bin/env node

/**
 * Comprehensive System Check for TaskZM
 * Analyzes all functions, components, contexts, and API endpoints
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SRC_DIR = path.join(__dirname, '../src');
const SUPABASE_DIR = path.join(__dirname, '../supabase');

let errors = [];
let warnings = [];
let info = [];

console.log('\n' + '='.repeat(80));
console.log('TaskZM Comprehensive System Check');
console.log('='.repeat(80) + '\n');

// Helper function to find all TypeScript/TSX files
function findTSFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      findTSFiles(filePath, fileList);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

// Check for TypeScript compilation errors
function checkTypeScriptErrors() {
  console.log('🔍 Checking TypeScript compilation...');
  try {
    const result = execSync('cd src && npx tsc --noEmit --skipLibCheck 2>&1', { 
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024 
    });
    if (result.trim()) {
      warnings.push('TypeScript warnings detected (check output above)');
      console.log('⚠️  TypeScript warnings found');
    } else {
      info.push('TypeScript compilation: OK');
      console.log('✅ TypeScript compilation: OK');
    }
  } catch (error) {
    const output = error.stdout?.toString() || error.message;
    if (output.includes('error TS')) {
      errors.push('TypeScript compilation errors detected');
      console.log('❌ TypeScript compilation errors found');
      console.log(output.split('\n').slice(0, 20).join('\n'));
    } else {
      warnings.push('TypeScript check failed (may be due to missing dependencies)');
      console.log('⚠️  TypeScript check could not complete');
    }
  }
}

// Check all context files
function checkContexts() {
  console.log('\n📦 Checking Context Providers...');
  const contextsDir = path.join(SRC_DIR, 'contexts');
  if (!fs.existsSync(contextsDir)) {
    errors.push('Contexts directory not found');
    return;
  }

  const contextFiles = fs.readdirSync(contextsDir).filter(f => f.endsWith('.tsx'));
  const expectedContexts = [
    'AuthContext.tsx',
    'TaskContext.tsx',
    'TeamContext.tsx',
    'CalendarContext.tsx',
    'SubscriptionContext.tsx',
    'ThemeContext.tsx',
    'PomodoroContext.tsx',
    'AIContext.tsx',
    'DragDropContext.tsx',
  ];

  expectedContexts.forEach(ctx => {
    const filePath = path.join(contextsDir, ctx);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      // Check if it exports a Provider
      if (content.includes('Provider') && content.includes('export')) {
        info.push(`Context: ${ctx} - OK`);
      } else {
        warnings.push(`Context: ${ctx} - May be missing Provider export`);
      }
    } else {
      warnings.push(`Context: ${ctx} - Not found`);
    }
  });

  console.log(`✅ Found ${contextFiles.length} context files`);
}

// Check API functions
function checkAPIFunctions() {
  console.log('\n🌐 Checking API Functions...');
  const apiFile = path.join(SRC_DIR, 'lib/api.ts');
  if (!fs.existsSync(apiFile)) {
    errors.push('API file not found');
    return;
  }

  const content = fs.readFileSync(apiFile, 'utf-8');
  
  // Extract function definitions
  const functionPattern = /(export\s+(async\s+)?function\s+\w+|export\s+const\s+\w+\s*=\s*(async\s*)?\([^)]*\)\s*=>)/g;
  const functions = [];
  let match;
  while ((match = functionPattern.exec(content)) !== null) {
    functions.push(match[0].split('(')[0].replace(/export\s+(async\s+)?(function|const)\s+/, '').trim());
  }

  // Check for critical API functions
  const criticalFunctions = [
    'createTask',
    'updateTask',
    'deleteTask',
    'getTasks',
    'signUp',
    'signIn',
    'signOut',
    'getUser',
    'createTeam',
    'getTeams',
    'syncCalendar',
    'getCalendarEvents',
  ];

  criticalFunctions.forEach(func => {
    if (content.includes(func)) {
      info.push(`API Function: ${func} - Found`);
    } else {
      warnings.push(`API Function: ${func} - Not found`);
    }
  });

  console.log(`✅ Found ${functions.length} API functions`);
}

// Check component exports
function checkComponents() {
  console.log('\n🧩 Checking Components...');
  const componentsDir = path.join(SRC_DIR, 'components');
  if (!fs.existsSync(componentsDir)) {
    errors.push('Components directory not found');
    return;
  }

  const componentFiles = fs.readdirSync(componentsDir).filter(f => f.endsWith('.tsx'));
  const criticalComponents = [
    'App.tsx',
    'DashboardView.tsx',
    'AuthScreen.tsx',
    'TaskDialog.tsx',
    'TaskCard.tsx',
    'CalendarEventCard.tsx',
    'PomodoroTimer.tsx',
    'SettingsPanel.tsx',
    'TeamPanel.tsx',
  ];

  criticalComponents.forEach(comp => {
    const filePath = path.join(componentsDir, comp);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes('export') && (content.includes('function') || content.includes('const'))) {
        info.push(`Component: ${comp} - OK`);
      } else {
        warnings.push(`Component: ${comp} - May be missing export`);
      }
    } else {
      warnings.push(`Component: ${comp} - Not found`);
    }
  });

  console.log(`✅ Found ${componentFiles.length} component files`);
}

// Check constants files
function checkConstants() {
  console.log('\n📋 Checking Constants Files...');
  const libDir = path.join(SRC_DIR, 'lib');
  if (!fs.existsSync(libDir)) {
    errors.push('Lib directory not found');
    return;
  }

  const constantsFiles = fs.readdirSync(libDir).filter(f => f.includes('constants') || f.includes('constant'));
  const expectedConstants = [
    'task-dialog-constants.ts',
    'task-card-constants.ts',
    'calendar-event-constants.ts',
    'layout-constants.ts',
    'team-panel-constants.ts',
    'settings-panel-constants.ts',
    'kanban-constants.ts',
  ];

  expectedConstants.forEach(constFile => {
    const filePath = path.join(libDir, constFile);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes('export const') || content.includes('export')) {
        info.push(`Constants: ${constFile} - OK`);
      } else {
        warnings.push(`Constants: ${constFile} - May be missing exports`);
      }
    } else {
      warnings.push(`Constants: ${constFile} - Not found`);
    }
  });

  console.log(`✅ Found ${constantsFiles.length} constants files`);
}

// Check for broken imports
function checkImports() {
  console.log('\n🔗 Checking for Broken Imports...');
  const tsFiles = findTSFiles(SRC_DIR);
  let brokenImports = 0;
  let totalImports = 0;

  tsFiles.forEach(file => {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const importPattern = /import\s+.*from\s+['"]([^'"]+)['"]/g;
      let match;
      
      while ((match = importPattern.exec(content)) !== null) {
        totalImports++;
        const importPath = match[1];
        
        // Skip external packages and special imports
        if (importPath.startsWith('.') || importPath.startsWith('/')) {
          const dir = path.dirname(file);
          let resolvedPath;
          
          if (importPath.startsWith('.')) {
            resolvedPath = path.resolve(dir, importPath);
          } else {
            resolvedPath = path.resolve(SRC_DIR, importPath);
          }
          
          // Try different extensions
          const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'];
          const found = extensions.some(ext => {
            const testPath = resolvedPath + ext;
            return fs.existsSync(testPath) || fs.existsSync(resolvedPath);
          });
          
          if (!found && !importPath.includes('@') && !importPath.startsWith('http')) {
            brokenImports++;
            warnings.push(`Broken import in ${path.relative(SRC_DIR, file)}: ${importPath}`);
          }
        }
      }
    } catch (error) {
      // Skip files that can't be read
    }
  });

  if (brokenImports === 0) {
    info.push(`Imports: ${totalImports} checked, all OK`);
    console.log(`✅ Checked ${totalImports} imports, all OK`);
  } else {
    console.log(`⚠️  Found ${brokenImports} potentially broken imports`);
  }
}

// Check backend functions
function checkBackendFunctions() {
  console.log('\n⚙️  Checking Backend Functions...');
  const serverFile = path.join(__dirname, '../supabase/functions/taskzm-database-function/index.ts');
  
  if (!fs.existsSync(serverFile)) {
    warnings.push('Backend server file not found at expected location');
    return;
  }

  try {
    const content = fs.readFileSync(serverFile, 'utf-8');
    
    // Extract routes
    const routePattern = /app\.(get|post|put|delete|patch)\(["']([^"']+)["']/g;
    const routes = [];
    let match;
    
    while ((match = routePattern.exec(content)) !== null) {
      routes.push({
        method: match[1].toUpperCase(),
        path: match[2],
      });
    }

    info.push(`Backend Routes: ${routes.length} found`);
    console.log(`✅ Found ${routes.length} backend routes`);
    
    // Check for critical routes
    const criticalRoutes = ['health', 'task', 'user', 'calendar', 'subscription', 'team'];
    const foundRoutes = routes.map(r => r.path.toLowerCase()).join(' ');
    
    criticalRoutes.forEach(route => {
      if (foundRoutes.includes(route)) {
        info.push(`Backend Route: ${route} - Found`);
      } else {
        warnings.push(`Backend Route: ${route} - Not found`);
      }
    });
  } catch (error) {
    warnings.push(`Could not read backend server file: ${error.message}`);
  }
}

// Check for hardcoded values (basic check)
function checkHardcodedValues() {
  console.log('\n🔍 Checking for Hardcoded Values...');
  const tsFiles = findTSFiles(SRC_DIR);
  let hardcodedCount = 0;
  const suspiciousPatterns = [
    /text-\[(\d+)px\]/g,
    /width:\s*['"](\d+)px['"]/g,
    /height:\s*['"](\d+)px['"]/g,
    /fontSize:\s*['"](\d+)px['"]/g,
  ];

  tsFiles.forEach(file => {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      // Skip constants files
      if (file.includes('constants') || file.includes('constant')) {
        return;
      }
      
      suspiciousPatterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
          hardcodedCount += matches.length;
        }
      });
    } catch (error) {
      // Skip files that can't be read
    }
  });

  if (hardcodedCount === 0) {
    info.push('Hardcoded values: None detected');
    console.log('✅ No hardcoded values detected');
  } else {
    warnings.push(`Found ${hardcodedCount} potentially hardcoded values (may be intentional)`);
    console.log(`⚠️  Found ${hardcodedCount} potentially hardcoded values`);
  }
}

// Run all checks
async function runAllChecks() {
  try {
    checkTypeScriptErrors();
    checkContexts();
    checkAPIFunctions();
    checkComponents();
    checkConstants();
    checkImports();
    checkBackendFunctions();
    checkHardcodedValues();
  } catch (error) {
    errors.push(`System check failed: ${error.message}`);
  }

  // Generate report
  console.log('\n' + '='.repeat(80));
  console.log('SYSTEM CHECK SUMMARY');
  console.log('='.repeat(80) + '\n');

  if (info.length > 0) {
    console.log(`✅ Information (${info.length}):`);
    info.slice(0, 20).forEach(item => console.log(`   ${item}`));
    if (info.length > 20) {
      console.log(`   ... and ${info.length - 20} more`);
    }
    console.log('');
  }

  if (warnings.length > 0) {
    console.log(`⚠️  Warnings (${warnings.length}):`);
    warnings.slice(0, 20).forEach(warn => console.log(`   ${warn}`));
    if (warnings.length > 20) {
      console.log(`   ... and ${warnings.length - 20} more`);
    }
    console.log('');
  }

  if (errors.length > 0) {
    console.log(`❌ Errors (${errors.length}):`);
    errors.forEach(err => console.log(`   ${err}`));
    console.log('');
  }

  console.log('='.repeat(80));
  console.log(`Total: ${info.length} OK, ${warnings.length} Warnings, ${errors.length} Errors`);
  console.log('='.repeat(80) + '\n');

  if (errors.length > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllChecks();
