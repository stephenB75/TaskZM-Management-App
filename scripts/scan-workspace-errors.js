/**
 * Workspace Implementation Error Scanner
 * 
 * This script scans the workspace implementation for potential errors,
 * including:
 * - Missing error handling
 * - Race conditions
 * - Invalid data structures
 * - Missing validations
 * - Potential null/undefined issues
 * 
 * Usage:
 *   node scripts/scan-workspace-errors.js
 */

const fs = require('fs');
const path = require('path');

const errors = [];
const warnings = [];
const info = [];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function logError(file, line, message, code) {
  errors.push({ file, line, message, code });
  console.log(`${colors.red}❌ ERROR${colors.reset} [${file}:${line}] ${message}`);
  if (code) {
    console.log(`   Code: ${code.substring(0, 100)}${code.length > 100 ? '...' : ''}`);
  }
}

function logWarning(file, line, message, code) {
  warnings.push({ file, line, message, code });
  console.log(`${colors.yellow}⚠️  WARNING${colors.reset} [${file}:${line}] ${message}`);
  if (code) {
    console.log(`   Code: ${code.substring(0, 100)}${code.length > 100 ? '...' : ''}`);
  }
}

function logInfo(file, line, message) {
  info.push({ file, line, message });
  console.log(`${colors.blue}ℹ️  INFO${colors.reset} [${file}:${line}] ${message}`);
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    logError(filePath, 0, `Cannot read file: ${error.message}`);
    return null;
  }
}

function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}

function scanFile(filePath, content) {
  const fileName = path.basename(filePath);
  const lines = content.split('\n');
  
  console.log(`\n${colors.cyan}Scanning: ${filePath}${colors.reset}`);
  
  // Check for workspace-related patterns
  const workspacePatterns = [
    { pattern: /getUserWorkspaces|createWorkspace|ensureWorkspace/g, name: 'Workspace function' },
    { pattern: /workspaceId|workspace_/g, name: 'Workspace reference' },
    { pattern: /user_\$\{userId\}_workspace|user_.*_workspace/g, name: 'Workspace key pattern' },
  ];
  
  // Check for missing error handling
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    
    // Check for getUserWorkspaces without try-catch
    if (line.includes('getUserWorkspaces') && !line.includes('//')) {
      // Check if there's a try-catch in the surrounding context
      const contextStart = Math.max(0, index - 10);
      const contextEnd = Math.min(lines.length, index + 10);
      const context = lines.slice(contextStart, contextEnd).join('\n');
      
      if (!context.includes('try') && !context.includes('catch')) {
        logWarning(fileName, lineNum, 'getUserWorkspaces call without try-catch', line.trim());
      }
    }
    
    // Check for createWorkspace without error handling
    if (line.includes('createWorkspace') && !line.includes('//')) {
      const contextStart = Math.max(0, index - 10);
      const contextEnd = Math.min(lines.length, index + 10);
      const context = lines.slice(contextStart, contextEnd).join('\n');
      
      if (!context.includes('try') && !context.includes('catch')) {
        logWarning(fileName, lineNum, 'createWorkspace call without try-catch', line.trim());
      }
    }
    
    // Check for workspaceId usage without null check
    if (line.includes('workspaceId') && !line.includes('//')) {
      // Check if it's used without optional chaining or null check
      if (line.includes('workspaceId.') && !line.includes('workspaceId?.') && !line.includes('workspaceId &&')) {
        logWarning(fileName, lineNum, 'workspaceId used without null check', line.trim());
      }
    }
    
    // Check for missing await on async workspace operations
    if ((line.includes('getUserWorkspaces') || line.includes('createWorkspace')) && 
        !line.includes('await') && 
        !line.includes('//') &&
        !line.includes('const') &&
        !line.includes('function')) {
      logWarning(fileName, lineNum, 'Async workspace operation without await', line.trim());
    }
    
    // Check for race conditions - multiple workspace creations
    if (line.includes('createWorkspace') && !line.includes('//')) {
      // Count how many times createWorkspace appears in the file
      const createWorkspaceCount = content.match(/createWorkspace/g)?.length || 0;
      if (createWorkspaceCount > 3) {
        logWarning(fileName, lineNum, 'Multiple createWorkspace calls - potential race condition', line.trim());
      }
    }
    
    // Check for missing validation
    if (line.includes('workspaceId') && line.includes('=') && !line.includes('//')) {
      // Check if there's validation after assignment
      const afterIndex = content.indexOf(line, content.indexOf(line) + line.length);
      const afterContext = content.substring(afterIndex, afterIndex + 200);
      if (!afterContext.includes('if') && !afterContext.includes('?.')) {
        // This is a weak check, but worth noting
        if (line.includes('const') || line.includes('let')) {
          // Check if used immediately after
          const nextLines = lines.slice(index, index + 5).join('\n');
          if (nextLines.includes('workspaceId') && !nextLines.includes('if') && !nextLines.includes('?')) {
            logWarning(fileName, lineNum, 'workspaceId assigned but may not be validated before use', line.trim());
          }
        }
      }
    }
    
    // Check for hardcoded workspace IDs
    if (line.includes('workspace_') && line.includes('workspace_') && !line.includes('template') && !line.includes('//')) {
      if (line.match(/workspace_[a-f0-9]{8}-[a-f0-9]{4}/)) {
        logWarning(fileName, lineNum, 'Potential hardcoded workspace ID', line.trim());
      }
    }
    
    // Check for missing error messages
    if (line.includes('throw new Error') && !line.includes('message') && !line.includes('//')) {
      const errorMatch = line.match(/throw new Error\(['"](.*?)['"]\)/);
      if (errorMatch && errorMatch[1].length < 10) {
        logWarning(fileName, lineNum, 'Error message may be too generic', line.trim());
      }
    }
  });
  
  // Check for missing return statements in async functions
  const asyncFunctionPattern = /async\s+(function|\([^)]*\))\s*\{/g;
  let match;
  while ((match = asyncFunctionPattern.exec(content)) !== null) {
    const funcStart = match.index;
    const funcEnd = content.indexOf('}', funcStart);
    if (funcEnd === -1) continue;
    
    const funcContent = content.substring(funcStart, funcEnd);
    if (funcContent.includes('getUserWorkspaces') || funcContent.includes('createWorkspace')) {
      // Check if function has return statement
      if (!funcContent.includes('return') && !funcContent.includes('throw')) {
        const lineNum = getLineNumber(content, funcStart);
        logWarning(fileName, lineNum, 'Async workspace function may be missing return statement', funcContent.substring(0, 100));
      }
    }
  }
  
  // Check for Promise.all without error handling
  const promiseAllPattern = /Promise\.all\(/g;
  while ((match = promiseAllPattern.exec(content)) !== null) {
    const start = match.index;
    const contextStart = Math.max(0, start - 50);
    const contextEnd = Math.min(content.length, start + 200);
    const context = content.substring(contextStart, contextEnd);
    
    if (context.includes('workspace') && !context.includes('catch') && !context.includes('try')) {
      const lineNum = getLineNumber(content, start);
      logWarning(fileName, lineNum, 'Promise.all with workspace operations without error handling', context.substring(0, 100));
    }
  }
}

// Main scanning function
function scanWorkspaceImplementation() {
  console.log(`${colors.cyan}${'='.repeat(70)}${colors.reset}`);
  console.log(`${colors.cyan}Workspace Implementation Error Scanner${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(70)}${colors.reset}\n`);
  
  const filesToScan = [
    'src/contexts/TaskContext.tsx',
    'src/lib/api.ts',
    'src/supabase/functions/server/index.tsx',
    'src/components/TeamPanel.tsx',
  ];
  
  filesToScan.forEach(filePath => {
    const fullPath = path.join(process.cwd(), filePath);
    if (fs.existsSync(fullPath)) {
      const content = readFile(fullPath);
      if (content) {
        scanFile(filePath, content);
      }
    } else {
      logError(filePath, 0, 'File not found', '');
    }
  });
  
  // Summary
  console.log(`\n${colors.cyan}${'='.repeat(70)}${colors.reset}`);
  console.log(`${colors.cyan}Scan Summary${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(70)}${colors.reset}\n`);
  
  console.log(`${colors.red}Errors: ${errors.length}${colors.reset}`);
  console.log(`${colors.yellow}Warnings: ${warnings.length}${colors.reset}`);
  console.log(`${colors.blue}Info: ${info.length}${colors.reset}\n`);
  
  if (errors.length === 0 && warnings.length === 0) {
    console.log(`${colors.green}✅ No critical issues found!${colors.reset}\n`);
  } else {
    if (errors.length > 0) {
      console.log(`${colors.red}Critical Issues Found:${colors.reset}`);
      errors.forEach(err => {
        console.log(`  - ${err.file}:${err.line} - ${err.message}`);
      });
      console.log('');
    }
    
    if (warnings.length > 0) {
      console.log(`${colors.yellow}Warnings (should be reviewed):${colors.reset}`);
      warnings.slice(0, 10).forEach(warn => {
        console.log(`  - ${warn.file}:${warn.line} - ${warn.message}`);
      });
      if (warnings.length > 10) {
        console.log(`  ... and ${warnings.length - 10} more warnings`);
      }
      console.log('');
    }
  }
  
  // Specific checks
  console.log(`${colors.cyan}Specific Checks:${colors.reset}\n`);
  
  // Check for retry logic
  const taskContext = readFile(path.join(process.cwd(), 'src/contexts/TaskContext.tsx'));
  if (taskContext && taskContext.includes('maxRetries')) {
    console.log(`${colors.green}✅ Retry logic found in TaskContext${colors.reset}`);
  } else {
    logWarning('TaskContext.tsx', 0, 'No retry logic found for workspace loading');
  }
  
  // Check for atomic operations
  const serverIndex = readFile(path.join(process.cwd(), 'src/supabase/functions/server/index.tsx'));
  if (serverIndex && serverIndex.includes('Promise.all') && serverIndex.includes('workspace_')) {
    console.log(`${colors.green}✅ Atomic workspace creation found${colors.reset}`);
  } else {
    logWarning('server/index.tsx', 0, 'Workspace creation may not be atomic');
  }
  
  // Check for response validation
  const apiFile = readFile(path.join(process.cwd(), 'src/lib/api.ts'));
  if (apiFile && apiFile.includes('workspaces') && apiFile.includes('Array.isArray')) {
    console.log(`${colors.green}✅ Response validation found${colors.reset}`);
  } else {
    logWarning('api.ts', 0, 'Response validation may be missing');
  }
  
  // Check for error logging
  let hasErrorLogging = false;
  [taskContext, serverIndex, apiFile].forEach((content, index) => {
    if (content && (content.includes('logger.error') || content.includes('console.error'))) {
      hasErrorLogging = true;
    }
  });
  
  if (hasErrorLogging) {
    console.log(`${colors.green}✅ Error logging found${colors.reset}`);
  } else {
    logWarning('All files', 0, 'Error logging may be insufficient');
  }
  
  console.log(`\n${colors.cyan}${'='.repeat(70)}${colors.reset}\n`);
  
  // Return exit code
  process.exit(errors.length > 0 ? 1 : 0);
}

// Run the scan
scanWorkspaceImplementation();

