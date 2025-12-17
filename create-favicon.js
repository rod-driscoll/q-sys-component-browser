#!/usr/bin/env node

/**
 * Convert PNG to ICO favicon
 * Generates multiple sizes for optimal browser support
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function createFavicon() {
  const inputPath = path.join(__dirname, 'public', 'A-ALPHA.png');
  const outputDir = path.join(__dirname, 'public');

  console.log('Converting A-ALPHA.png to favicon.ico...');

  try {
    // Read the original image
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    console.log(`Original image: ${metadata.width}x${metadata.height}`);

    // Generate different sizes for the ICO file
    const sizes = [16, 32, 48, 64];
    const pngBuffers = [];

    for (const size of sizes) {
      console.log(`Generating ${size}x${size}...`);
      const buffer = await sharp(inputPath)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();

      pngBuffers.push({ size, buffer });
    }

    // For .ico format, we'll use the 32x32 as the main favicon
    // and also save individual sizes
    const favicon32 = await sharp(inputPath)
      .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    // Save as PNG (most modern browsers support PNG favicons)
    const faviconPath = path.join(outputDir, 'favicon.ico');
    fs.writeFileSync(faviconPath, favicon32);

    console.log(`✓ Created favicon.ico (32x32)`);

    // Also create additional favicon sizes
    for (const { size, buffer } of pngBuffers) {
      const sizePath = path.join(outputDir, `favicon-${size}x${size}.png`);
      fs.writeFileSync(sizePath, buffer);
      console.log(`✓ Created favicon-${size}x${size}.png`);
    }

    console.log('\n✓ Favicon generation complete!');
    console.log('\nGenerated files:');
    console.log('  - public/favicon.ico (32x32)');
    console.log('  - public/favicon-16x16.png');
    console.log('  - public/favicon-32x32.png');
    console.log('  - public/favicon-48x48.png');
    console.log('  - public/favicon-64x64.png');

  } catch (error) {
    console.error('Error creating favicon:', error);
    process.exit(1);
  }
}

createFavicon();
