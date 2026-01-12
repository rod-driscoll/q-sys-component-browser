/**
 * Post-build script to enable Eruda debug console in the built index.html
 * This script is run automatically after the Crestron build to inject the Eruda initialization script
 */

const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'dist', 'q-sys-component-browser', 'browser', 'index.html');

console.log('Enabling Eruda debug console for Crestron build...');

try {
  // Read the built index.html
  let html = fs.readFileSync(indexPath, 'utf8');

  // Uncomment the Eruda script line
  html = html.replace(
    '<!-- <script src="eruda-init.js"></script> -->',
    '<script src="eruda-init.js"></script>'
  );

  // Write the modified HTML back
  fs.writeFileSync(indexPath, html, 'utf8');

  console.log('✓ Eruda debug console enabled in index.html');
} catch (error) {
  console.error('Failed to enable Eruda:', error.message);
  process.exit(1);
}
