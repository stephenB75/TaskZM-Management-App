/**
 * Process user profile images into clean square PNG avatars.
 * Uses sharp (already a project dependency).
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const AVATAR_SIZE = 300;
const SOURCE_DIR = 'src/assets/user_profiles';
const OUTPUT_DIR = 'public/avatars';

const filenamePattern = /^(female|male)[_\s]*(\d+)/i;

async function processImage(inputPath, outputPath) {
  const image = sharp(inputPath).ensureAlpha();
  const meta = await image.metadata();
  const cropSize = Math.min(meta.width ?? AVATAR_SIZE, meta.height ?? AVATAR_SIZE);
  const left = Math.floor(((meta.width ?? cropSize) - cropSize) / 2);
  const top = Math.floor(((meta.height ?? cropSize) - cropSize) / 2);

  await image
    .extract({ left, top, width: cropSize, height: cropSize })
    .resize(AVATAR_SIZE, AVATAR_SIZE)
    .grayscale()
    .normalize()
    .png({ compressionLevel: 9 })
    .toFile(outputPath);
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const files = fs
    .readdirSync(SOURCE_DIR)
    .filter((file) => /\.(jpe?g|png)$/i.test(file))
    .sort();

  let successCount = 0;

  for (const file of files) {
    const match = file.match(filenamePattern);
    if (!match) continue;

    const gender = match[1].toLowerCase();
    const number = match[2];
    const outputPath = path.join(OUTPUT_DIR, `${gender}-${number}.png`);

    await processImage(path.join(SOURCE_DIR, file), outputPath);
    successCount += 1;
  }

  console.log(`Processed ${successCount} avatar(s) into ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
