#!/usr/bin/env node

/**
 * Generate PWA icons from source image
 * Creates icons optimized for various devices and platforms
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const FAVICON_SIZES = [16, 32, 48, 64];
const APPLE_SIZES = [120, 152, 167, 180];

async function generateIcons() {
  const inputPath = path.join(__dirname, 'public', 'images', 'A-ALPHA.png');
  const outputDir = path.join(__dirname, 'public', 'images');

  console.log('Generating PWA icons from A-ALPHA.png...\n');

  // Generate standard PWA icons
  for (const size of ICON_SIZES) {
    await generateIcon(inputPath, outputDir, size, `icon-${size}x${size}.png`);
  }

  // Generate Apple Touch icons
  for (const size of APPLE_SIZES) {
    await generateIcon(inputPath, outputDir, size, `apple-touch-icon-${size}x${size}.png`);
  }

  // Generate default Apple Touch icon (180x180)
  await generateIcon(inputPath, outputDir, 180, 'apple-touch-icon.png');

  // Generate favicons
  for (const size of FAVICON_SIZES) {
    await generateIcon(inputPath, outputDir, size, `favicon-${size}x${size}.png`);
  }

  // Generate favicon.ico (32x32)
  const favicon32 = await sharp(inputPath)
    .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(outputDir, 'favicon.ico'), favicon32);
  console.log('✓ Created favicon.ico (32x32)');

  console.log('\n✓ Icon generation complete!');
  console.log(`\nGenerated ${ICON_SIZES.length + APPLE_SIZES.length + FAVICON_SIZES.length + 2} icons`);
}

async function generateIcon(inputPath, outputDir, size, filename) {
  const buffer = await sharp(inputPath)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .png()
    .toBuffer();

  const outputPath = path.join(outputDir, filename);
  fs.writeFileSync(outputPath, buffer);
  console.log(`✓ Created ${filename}`);
}

generateIcons().catch(console.error);
