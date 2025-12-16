/**
 * Demo script to load Q-SYS components into the browser
 *
 * Usage:
 * 1. Run `ng serve` and open http://localhost:4200
 * 2. Wait for "Browser component exposed on window.qsysBrowser" message in console
 * 3. Copy and paste this entire file into the browser console
 * 4. Or run individual functions as needed
 */

// Sample component data (from MCP get_components tool)
const sampleComponents = [
  { name: "Motion Test Enable", controlCount: 1 },
  { name: "Room Controls DEV", controlCount: 57 },
  { name: "UCI Text Helper", controlCount: 52 },
  { name: "Room 1 controller", controlCount: 61 },
  { name: "dev", controlCount: 18 },
  { name: "Occupancy-01", controlCount: 40 },
  { name: "Snapshot_Controller_Overflow", controlCount: 51 },
  { name: "Radio", controlCount: 62 },
  { name: "TCC2 Call Sync", controlCount: 22 },
  { name: "Gain_BGM", controlCount: 9 },
  { name: "Mono Suimmer", controlCount: 13 },
  { name: "PGM", controlCount: 9 },
  { name: "Runtime changelog", controlCount: 1 },
  { name: "Interface_2", controlCount: 28 },
  { name: "UCI Script 03", controlCount: 28 },
  { name: "Interface_3", controlCount: 167 }
];

// Sample control data for "Room Controls DEV" component
// (You would get this from MCP get_controls tool)
const sampleRoomControlsDevControls = [
  { name: "SystemOnOff", type: "Boolean", direction: "Read/Write", value: 0 },
  { name: "SystemPower", type: "Boolean", direction: "Read Only", value: 0 },
  { name: "VolumeFader", type: "Float", direction: "Read/Write", value: 75.5, position: 0.755, string: "75.5 dB" },
  { name: "VolumeMute", type: "Boolean", direction: "Read/Write", value: 0 },
  { name: "MotionMode", type: "Text", direction: "Read/Write", value: "Auto", string: "Auto" },
  { name: "SourceSelect", type: "Integer", direction: "Read/Write", value: 1 },
  { name: "DisplayBrightness", type: "Float", direction: "Read/Write", value: 50, position: 0.5, string: "50%" },
  { name: "MicGain", type: "Float", direction: "Read/Write", value: 0, position: 0, string: "0 dB" },
  { name: "PresetRecall", type: "Trigger", direction: "Write Only" },
  { name: "RoomTemp", type: "Text", direction: "Read Only", value: "72", string: "72°F" }
];

/**
 * Load components into the browser
 */
function loadComponents() {
  if (!window.qsysBrowser) {
    console.error('Browser component not ready. Wait for "Browser component exposed on window.qsysBrowser" message.');
    return;
  }

  console.log('Loading', sampleComponents.length, 'components...');
  window.qsysBrowser.setComponentsFromMCP(sampleComponents);
  console.log('✓ Components loaded successfully!');
  console.log('Click on a component to view its controls.');
}

/**
 * Load controls for "Room Controls DEV" component
 * Call this after selecting "Room Controls DEV" in the UI
 */
function loadRoomControlsDevControls() {
  if (!window.qsysBrowser) {
    console.error('Browser component not ready.');
    return;
  }

  console.log('Loading controls for "Room Controls DEV"...');
  window.qsysBrowser.setControlsFromMCP(sampleRoomControlsDevControls);
  console.log('✓ Controls loaded successfully!');
  console.log('Click on a control to edit it.');
}

/**
 * Load controls from MCP tool result
 * @param {string} componentName - Name of the component
 * @param {Array} controls - Array of control objects from MCP tool
 */
function loadControlsForComponent(componentName, controls) {
  if (!window.qsysBrowser) {
    console.error('Browser component not ready.');
    return;
  }

  console.log(`Loading ${controls.length} controls for "${componentName}"...`);
  window.qsysBrowser.setControlsFromMCP(controls);
  console.log('✓ Controls loaded successfully!');
}

// Auto-load components when script runs
console.log('=== Q-SYS Component Browser Demo ===');
console.log('Available functions:');
console.log('  loadComponents() - Load all components');
console.log('  loadRoomControlsDevControls() - Load sample controls');
console.log('  loadControlsForComponent(name, controls) - Load controls for any component');
console.log('');

// Try to auto-load if browser is ready
if (window.qsysBrowser) {
  loadComponents();
} else {
  console.log('Waiting for browser component to be ready...');
  console.log('Run loadComponents() when ready.');
}
