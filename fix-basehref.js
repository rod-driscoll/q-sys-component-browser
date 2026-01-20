/**
 * Post-build script to fix base href paths for Crestron touchpanels
 *
 * Crestron touchpanels load web apps from the file:// protocol, which doesn't
 * support absolute paths like "/". This script ensures all script src and link
 * href paths have the "./" prefix required for file:// protocol compatibility.
 *
 * Run this after building for Crestron: node fix-basehref.js
 */

const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'dist', 'q-sys-component-browser', 'browser', 'index.html');

console.log('Fixing base href paths for Crestron deployment...');

try {
  // Read the built index.html
  let html = fs.readFileSync(indexPath, 'utf8');

  // Fix script src paths - add ./ prefix if not already present
  // Matches src="something" but not src="./...", src="https://...", src="http://..."
  html = html.replace(/src="(?!\.\/|https?:\/\/)([^"]+)"/g, 'src="./$1"');

  // Fix link href paths - add ./ prefix if not already present
  // Matches href="something" but not href="./...", href="https://...", href="http://...", href="data:...", href="#..."
  html = html.replace(/href="(?!\.\/|https?:\/\/|data:|#)([^"]+)"/g, 'href="./$1"');

  // Write the modified HTML back
  fs.writeFileSync(indexPath, html, 'utf8');

  console.log('✓ Base href paths fixed for Crestron deployment');
} catch (error) {
  console.error('Failed to fix base href paths:', error.message);
  process.exit(1);
}
