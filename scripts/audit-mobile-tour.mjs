#!/usr/bin/env node
/**
 * Static audit: mobile app tour step targets must exist in source with matching data-tour attributes.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function extractTourTargetsFromSource() {
  const srcDir = path.join(root, 'src');
  const targets = new Set();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        walk(full);
        continue;
      }
      if (!/\.(tsx|ts|jsx|js)$/.test(entry.name)) continue;
      const content = fs.readFileSync(full, 'utf8');
      for (const match of content.matchAll(/data-tour(?:Id)?=(?:"([^"]+)"|'([^']+)'|\{`([^`]+)`\}|\{"([^"]+)"\})/g)) {
        const value = match[1] || match[2] || match[3] || match[4];
        if (value) targets.add(value);
      }
      for (const match of content.matchAll(/dataTour=(?:"([^"]+)"|'([^']+)'|\{`([^`]+)`\})/g)) {
        const value = match[1] || match[2] || match[3];
        if (value) targets.add(value);
      }
    }
  };
  walk(srcDir);
  return targets;
}

const mobileSteps = [
  { step: 'welcome', target: 'body' },
  { step: 'navIntro', target: 'bottom-nav' },
  { step: 'navIcon:today', target: 'bottom-nav-today' },
  { step: 'navIcon:week', target: 'bottom-nav-week' },
  { step: 'navIcon:inbox', target: 'bottom-nav-inbox' },
  { step: 'navIcon:settings', target: 'bottom-nav-settings' },
  { step: 'weekView', target: 'kanban' },
  { step: 'aiSchedulerButton', target: 'ai-scheduler-section' },
  { step: 'aiSchedulePreview', target: 'ai-schedule-preview-dialog' },
  { step: 'monthView', target: 'month-calendar-view' },
  { step: 'aiReschedulerButton', target: 'ai-reschedule-section' },
  { step: 'rescheduleDialog', target: 'reschedule-dialog' },
  { step: 'settingsIntro', target: 'settings-panel' },
  ...[
    'user-profile', 'calendar', 'notifications', 'tags', 'ai-settings',
    'hours', 'rollover', 'datetime', 'app-tour',
  ].map((id) => ({ step: `settingsSection:${id}`, target: `settings-${id}` })),
  { step: 'complete', target: 'body' },
];

const found = extractTourTargetsFromSource();
const missing = mobileSteps.filter(({ target }) => target !== 'body' && !found.has(target));

console.log(`Mobile tour steps audited: ${mobileSteps.length}`);
console.log(`Unique data-tour markers in src/: ${found.size}`);

if (missing.length === 0) {
  console.log('OK — all mobile tour targets have matching data-tour attributes in source.');
  process.exit(0);
}

console.error('Missing mobile tour targets in source:');
for (const item of missing) {
  console.error(`  - ${item.step}: ${item.target}`);
}
process.exit(1);
