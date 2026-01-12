/**
 * Eruda Debug Console Initializer for Crestron Touchpanels
 *
 * Eruda provides a mobile-friendly developer console that can be used
 * for debugging on Crestron touchpanels where Chrome DevTools is not available.
 *
 * Features:
 * - Console log viewer (console.log, warn, error, etc.)
 * - Network request inspector
 * - Element inspector
 * - Local storage viewer
 * - Resource viewer
 * - Info panel (user agent, screen size, etc.)
 *
 * Usage:
 * - Tap the Eruda icon in the bottom-right corner to open the console
 * - Swipe or drag the icon to reposition it
 * - Use the tabs to switch between different debugging tools
 */

(function() {
  // Load and initialize Eruda
  const script = document.createElement('script');
  script.src = 'eruda.js';
  script.onload = function() {
    if (typeof eruda !== 'undefined') {
      eruda.init({
        // Automatically show console on errors
        autoScale: true,
        // Default tool to show when opened
        tool: 'console',
        // Position of the entry button
        defaults: {
          displaySize: 50,
          transparency: 0.9
        }
      });

      console.log('✓ Eruda debug console initialized');
      console.log('Tap the icon in the bottom-right corner to open the debug console');
    }
  };
  script.onerror = function() {
    console.error('Failed to load Eruda debug console');
  };
  document.head.appendChild(script);
})();
