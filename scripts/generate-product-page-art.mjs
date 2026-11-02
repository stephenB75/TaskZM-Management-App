#!/usr/bin/env node
/**
 * Renders the App Store product page header (5244 × 2950) and search results
 * (3840 × 1646) artwork from the raw screenshot captures.
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

// 16:9 header: headline left, iPad with an overlapping iPhone right.
const headerHtml = `<!doctype html><html><head><style>${baseCss}
  .copy { margin-left: 7%; width: 33%; }
  .wordmark { width: 44%; margin-bottom: 9%; }
  h1 { font-size: 5.6vw; }
  p.sub { font-size: 1.9vw; margin-top: 6%; }
</style></head><body><div class="stage">
  <div class="copy">
    <img class="wordmark" src="${img.wordmark}" />
    <h1>Type it.<br/>TaskZM<br/>schedules it.</h1>
    <p class="sub">Your tasks, meetings and focus time on one timeline.</p>
  </div>
  <div class="device" style="left: 47%; top: 16%; width: 49%; aspect-ratio: 2752 / 2064; padding: 1.1%; border-radius: 4.2%;">
    <img src="${img.ipadHome}" style="border-radius: 3.2%;" />
  </div>
  ${phone(img.phoneTimeline, 'left: 43%; top: 31%; width: 15%; aspect-ratio: 1320 / 2868; z-index: 3;')}
</div></body></html>`;

// Wide search results banner: headline left, three phones fanned right.
const searchHtml = `<!doctype html><html><head><style>${baseCss}
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

const targets = [
  { name: 'header-5244x2950', width: 5244, height: 2950, html: headerHtml },
  { name: 'search-results-3840x1646', width: 3840, height: 1646, html: searchHtml },
];

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
for (const target of targets) {
  const page = await browser.newPage({
    viewport: { width: target.width / scale, height: target.height / scale },
    deviceScaleFactor: scale,
  });
  await page.setContent(target.html, { waitUntil: 'load' });
  const pngPath = path.join(outDir, `${target.name}.png`);
  const jpgPath = path.join(outDir, `${target.name}.jpg`);
  await page.screenshot({ path: pngPath, type: 'png' });
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '92', '-m', '/System/Library/ColorSync/Profiles/sRGB Profile.icc', pngPath, '--out', jpgPath], { stdio: 'ignore' });
  rmSync(pngPath);
  await page.close();
  console.log(`✓ ${path.relative(root, jpgPath)}`);
}
await browser.close();
