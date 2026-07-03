#!/usr/bin/env node
/**
 * Suppress WKProcessPool deprecation warnings in Capacitor Cordova (Capacitor 6).
 * Patches node_modules after npm install; also invoked from ios Podfile post_install.
 * Full fix: upgrade to Capacitor 8+ when ready.
 */

const fs = require('fs');
const path = require('path');

const MARKER = 'TASKZM_SUPPRESS_WKPROCESSPOOL_DEPRECATION';

function resolveCapacitorCordovaPublicDir(startDir) {
  const candidates = [
    path.join(startDir, 'node_modules/@capacitor/ios/CapacitorCordova/CapacitorCordova/Classes/Public'),
    path.join(startDir, 'src/node_modules/@capacitor/ios/CapacitorCordova/CapacitorCordova/Classes/Public'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'CDVWebViewProcessPoolFactory.h'))) {
      return candidate;
    }
  }
  return null;
}

function ensureDiagnosticPop(content) {
  if (!content.includes('#pragma clang diagnostic push')) return content;
  if (content.includes('#pragma clang diagnostic pop')) return content;
  return `${content.trimEnd()}\n\n#pragma clang diagnostic pop\n`;
}

function patchHeader(filePath) {
  if (!fs.existsSync(filePath)) return false;
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes(MARKER)) {
    const fixed = ensureDiagnosticPop(content);
    if (fixed !== content) {
      fs.writeFileSync(filePath, fixed);
      return true;
    }
    return false;
  }

  let patched = content
    .replace(
      '#import <WebKit/WebKit.h>\n\n@interface',
      `#import <WebKit/WebKit.h>\n\n#pragma clang diagnostic push\n#pragma clang diagnostic ignored "-Wdeprecated-declarations"\n/* ${MARKER} */\n\n@interface`,
    );
  patched = ensureDiagnosticPop(patched);

  if (patched === content) return false;
  fs.writeFileSync(filePath, patched);
  return true;
}

function patchImplementation(filePath) {
  if (!fs.existsSync(filePath)) return false;
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes(MARKER)) {
    const fixed = ensureDiagnosticPop(content);
    if (fixed !== content) {
      fs.writeFileSync(filePath, fixed);
      return true;
    }
    return false;
  }

  let patched = content
    .replace(
      /(#import <Cordova\/CDVWebViewProcessPoolFactory\.h>\n\n)/,
      `$1#pragma clang diagnostic push\n#pragma clang diagnostic ignored "-Wdeprecated-declarations"\n/* ${MARKER} */\n\n`,
    );
  patched = ensureDiagnosticPop(patched);

  if (patched === content) return false;
  fs.writeFileSync(filePath, patched);
  return true;
}

function main() {
  const startDir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..');
  const publicDir = resolveCapacitorCordovaPublicDir(startDir);
  if (!publicDir) {
    console.log('patch-capacitor-wkprocesspool: Capacitor Cordova sources not found, skipping');
    process.exit(0);
  }

  const headerPatched = patchHeader(path.join(publicDir, 'CDVWebViewProcessPoolFactory.h'));
  const implPatched = patchImplementation(path.join(publicDir, 'CDVWebViewProcessPoolFactory.m'));

  if (headerPatched || implPatched) {
    console.log('patch-capacitor-wkprocesspool: applied WKProcessPool deprecation suppressions');
  }
}

main();
