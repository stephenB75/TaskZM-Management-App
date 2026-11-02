#!/usr/bin/env node
/**
 * Renders App Store creative assets from the raw screenshot captures:
 * universal 16:9 (5244 × 2950, PNG only), header 21:9 (3840 × 1646) and search results 3:2 (3840 × 2560).
 * The universal asset is cropped to 21:9 and 3:2 by the App Store, so its content stays in the shared centre.
 * Usage: node scripts/generate-product-page-art.mjs
 */
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import { mkdirSync, readFileSync, rmSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'src/package.json'));
const { chromium } = require('playwright');

const rawDir = path.join(root, 'docs/app-store-screenshots/source/raw');
const outDir = path.join(root, 'docs/app-store-screenshots/product-page');
const scale = 2;
const srgbProfile = '/System/Library/ColorSync/Profiles/sRGB Profile.icc';

const dataUrl = (file) => `data:image/png;base64,${readFileSync(file).toString('base64')}`;
const img = {
  wordmark: dataUrl(path.join(root, 'src/assets/taskzm-wordmark-black.png')),
  ipadHome: dataUrl(path.join(rawDir, 'ipad/01-home.png')),
  phoneTimeline: dataUrl(path.join(rawDir, 'iphone/01-timeline.png')),
  phoneCalendar: dataUrl(path.join(rawDir, 'iphone/02-calendar.png')),
  phoneSchedule: dataUrl(path.join(rawDir, 'iphone/03-schedule.png')),
};

const baseCss = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif;
    color: #111;
    background: radial-gradient(120% 140% at 0% 0%, #f1efff 0%, #f7f5fb 45%, #fbeef6 100%);
    overflow: hidden;
  }
  .stage { position: relative; width: 100vw; height: 100vh; display: flex; align-items: center; }
  .copy { position: relative; z-index: 2; }
  .wordmark { display: block; height: auto; }
  h1 { font-weight: 800; letter-spacing: -0.035em; line-height: 1.02; }
  p.sub { color: #55556a; font-weight: 500; letter-spacing: -0.01em; line-height: 1.35; }
  .device { position: absolute; background: #111; box-shadow: 0 40px 90px rgba(40, 30, 80, 0.22); }
  .device img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top; }
`;

const phone = (src, style) => `
  <div class="device" style="padding: 0.6%; border-radius: 9% / 4.3%; ${style}">
    <img src="${src}" style="border-radius: 8.2% / 3.8%;" />
  </div>`;

// 16:9 universal: headline left, iPad with an overlapping iPhone right, inset from every edge for cropping.
const universalHtml = `<!doctype html><html><head><style>${baseCss}
  .copy { margin-left: 11%; width: 31%; }
  .wordmark { width: 44%; margin-bottom: 9%; }
  h1 { font-size: 5vw; }
  p.sub { font-size: 1.7vw; margin-top: 6%; }
</style></head><body><div class="stage">
  <div class="copy">
    <img class="wordmark" src="${img.wordmark}" />
    <h1>Type it.<br/>TaskZM<br/>schedules it.</h1>
    <p class="sub">Your tasks, meetings and focus time on one timeline.</p>
  </div>
  <div class="device" style="left: 46%; top: 22%; width: 42%; aspect-ratio: 2752 / 2064; padding: 1.1%; border-radius: 4.2%;">
    <img src="${img.ipadHome}" style="border-radius: 3.2%;" />
  </div>
  ${phone(img.phoneTimeline, 'left: 42%; top: 33%; width: 12.5%; aspect-ratio: 1320 / 2868; z-index: 3;')}
</div></body></html>`;

// 21:9 header: headline left, three phones fanned right.
const headerHtml = `<!doctype html><html><head><style>${baseCss}
  .copy { margin-left: 6%; width: 40%; }
  .wordmark { width: 36%; margin-bottom: 7%; }
  h1 { font-size: 5.6vw; }
  p.sub { font-size: 1.75vw; margin-top: 5%; }
</style></head><body><div class="stage">
  <div class="copy">
    <img class="wordmark" src="${img.wordmark}" />
    <h1>Plan your day<br/>in seconds.</h1>
    <p class="sub">The auto scheduler fits every task around your calendar.</p>
  </div>
  ${phone(img.phoneCalendar, 'left: 50%; top: 14%; width: 14.5%; aspect-ratio: 1320 / 2868; transform: rotate(-6deg);')}
  ${phone(img.phoneTimeline, 'left: 64%; top: 7%; width: 15.5%; aspect-ratio: 1320 / 2868; z-index: 3;')}
  ${phone(img.phoneSchedule, 'left: 79%; top: 14%; width: 14.5%; aspect-ratio: 1320 / 2868; transform: rotate(6deg);')}
</div></body></html>`;

// 3:2 search results: headline left, two phones right.
const searchHtml = `<!doctype html><html><head><style>${baseCss}
  .copy { margin-left: 7%; width: 42%; }
  .wordmark { width: 42%; margin-bottom: 8%; }
  h1 { font-size: 6.4vw; }
  p.sub { font-size: 2.1vw; margin-top: 6%; }
</style></head><body><div class="stage">
  <div class="copy">
    <img class="wordmark" src="${img.wordmark}" />
    <h1>Type it.<br/>TaskZM<br/>schedules it.</h1>
    <p class="sub">Tasks and meetings on one timeline.</p>
  </div>
  ${phone(img.phoneSchedule, 'left: 53%; top: 15%; width: 21%; aspect-ratio: 1320 / 2868; transform: rotate(-5deg);')}
  ${phone(img.phoneTimeline, 'left: 72%; top: 9%; width: 22%; aspect-ratio: 1320 / 2868; z-index: 3;')}
</div></body></html>`;

const targets = [
  { name: 'universal-5244x2950', width: 5244, height: 2950, html: universalHtml, format: 'png' },
  { name: 'header-3840x1646', width: 3840, height: 1646, html: headerHtml, format: 'jpeg' },
  { name: 'search-results-3840x2560', width: 3840, height: 2560, html: searchHtml, format: 'jpeg' },
];

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
for (const target of targets) {
  const page = await browser.newPage({
    viewport: { width: target.width / scale, height: target.height / scale },
    deviceScaleFactor: scale,
  });
  await page.setContent(target.html, { waitUntil: 'load' });
  const capturePath = path.join(outDir, `${target.name}.capture.png`);
  const jpgPath = path.join(outDir, `${target.name}.jpg`);
  const outPath = path.join(outDir, `${target.name}.${target.format === 'png' ? 'png' : 'jpg'}`);
  await page.screenshot({ path: capturePath, type: 'png' });
  // Round-trip through JPEG so the PNG has no alpha channel, which App Store Connect rejects.
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '92', '-m', srgbProfile, capturePath, '--out', jpgPath], { stdio: 'ignore' });
  rmSync(capturePath);
  if (target.format === 'png') {
    execFileSync('sips', ['-s', 'format', 'png', jpgPath, '--out', outPath], { stdio: 'ignore' });
    rmSync(jpgPath);
  }
  await page.close();
  console.log(`✓ ${path.relative(root, outPath)}`);
}
await browser.close();
