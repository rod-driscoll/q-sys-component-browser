# Crestron Touchpanel Deployment

This document covers deploying and debugging the Q-SYS Component Browser on Crestron touchpanels.

## Overview

Crestron touchpanels load web applications from the local file system using the `file://` protocol. This creates unique constraints that differ from standard web hosting.

## Quick Start

```bash
# Build, package, and deploy to touchpanel
npm run ch5-deploy
```

## Build Commands

| Command | Description |
|---------|-------------|
| `npm run ch5-build` | Build for Crestron with Eruda debug console |
| `npm run ch5-archive` | Build and create CH5Z archive |
| `npm run ch5-deploy` | Build, archive, deploy, and reload touchpanel |
| `npm run ch5-deploy-no-reload` | Deploy without reloading |
| `npm run ch5-reload` | Reload touchpanel display |

## Requirements

### 1. Base Href Configuration

All resource paths must be relative with `./` prefix.

```html
<!-- index.html -->
<base href="./">
```

The `file://` protocol doesn't support absolute paths like `/`. The `crestron` build configuration and `fix-basehref.js` script handle this automatically.

### 2. No URL-Based Routing

**CRITICAL:** Do NOT use Angular Router or any URL-based routing on Crestron touchpanels.

When using `file://` protocol, changing the URL path causes the browser to attempt loading different files that don't exist. This project uses in-memory state-based navigation instead.

### 3. Dependencies

Required packages in `package.json`:

```json
{
  "devDependencies": {
    "@crestron/ch5-utilities-cli": "^2.0.0",
    "eruda": "^3.4.1"
  },
  "overrides": {
    "ssh2": "1.16.0"
  }
}
```

The `ssh2` override fixes "isDate is not a function" deployment errors.

### 4. Touchpanel Configuration

**Default SSH Credentials:**
- Username: `crestron`
- Password: `crestron`
- IP: Configure in package.json scripts (e.g., `192.168.8.191`)

Update the IP address in `package.json` scripts to match your touchpanel.

## Debugging

### Method A: Eruda On-Device Console (Recommended)

Eruda is automatically enabled for all Crestron builds. It provides a mobile-friendly debug console directly on the touchpanel.

1. After deploying, look for a small icon in the **bottom-right corner**
2. Tap the icon to open the Eruda console
3. Use the tabs to access:
   - **Console**: View console.log, errors, warnings
   - **Elements**: Inspect HTML elements
   - **Network**: Monitor network requests
   - **Resources**: View localStorage, cookies, scripts
   - **Info**: Device and browser information

**Features:**
- No remote connection required - works directly on the device
- Drag the icon to reposition it
- Persists across page reloads
- Captures all console output from page load

**Disabling Eruda:** Remove `&& node enable-eruda.js` from the `ch5-build` script.

**Updating Eruda:**
```bash
npm install eruda@latest --save-dev
cp node_modules/eruda/eruda.js public/eruda.js
```

### Method B: Remote Debugging via Chrome DevTools

1. Enable remote debugging on the touchpanel:
   - Navigate to `http://TOUCHPANEL_IP`
   - Go to Settings > Enable "Remote Debugging"

2. On your computer, open Chrome:
   - Navigate to `chrome://inspect`
   - Add: `TOUCHPANEL_IP:9222`
   - Click "inspect" to open DevTools

## Troubleshooting

### Blank Screen

**Causes:**
- Missing `./` prefix on script/link paths
- Using Angular Router (URL changes)
- Incorrect base href

**Solution:** Verify `fix-basehref.js` ran and all paths start with `./`

### Navigation Doesn't Work

**Cause:** Using URL-based routing (Angular Router)

**Solution:** This project uses NavigationService with direct rendering instead of Router.

### Deployment Errors

**Error:** `isDate is not a function`
**Solution:** Add `"overrides": { "ssh2": "1.16.0" }` to package.json

**Error:** `No response from server` during reload
**Solution:** This is normal - the deploy succeeded. Use `-s` flag and separate `ch5-reload` script.

### Asset Loading Failures (404 errors)

**Check:**
```javascript
// In Eruda console
console.log(document.location.href);
// Should show: file:///display/index.html
```

**Fixes:**
1. Verify `baseHref: "./"` is set in `angular.json` crestron configuration
2. Check HTML templates use relative paths (no leading `/`)
3. Rebuild: `npm run ch5-archive`

### WebSocket Connection Failures

1. Check network connectivity from touchpanel to Q-SYS Core
2. Verify Core IP is correct
3. Ensure Q-SYS Remote WebSocket Control is enabled
4. Test connection from your computer first

### Blank Page with No Console Errors

```javascript
// Check in Eruda console if Angular loaded
console.log(document.querySelector('app-root'));
// Should show the app-root element
```

## Verify Deployment

### Check Files via SSH

```bash
ssh crestron@TOUCHPANEL_IP
# Password: crestron

cd /display
ls -la
# Verify index.html and asset files exist
```

### Check Permissions

```bash
ls -la /display
# All files should be readable (r-- permissions)

# Fix if needed:
chmod -R 755 /display
```

## Test Build Locally

Before deploying, test the build locally:

```bash
npm run ch5-build
cd dist/q-sys-component-browser/browser
npx http-server -p 8080
# Navigate to http://localhost:8080
```

## Build Configuration

The `crestron` configuration in `angular.json`:

```json
{
  "crestron": {
    "baseHref": "./",
    "outputHashing": "all",
    "serviceWorker": false,
    "optimization": {
      "scripts": true,
      "styles": { "minify": true, "inlineCritical": true },
      "fonts": true
    }
  }
}
```

## Post-Build Scripts

### fix-basehref.js

Ensures all script and link paths have `./` prefix for `file://` protocol compatibility.

### enable-eruda.js

Uncomments the Eruda debug console script in index.html for Crestron builds.

## Diagnostic Checklist

- [ ] Files deployed successfully (check via SSH)
- [ ] index.html exists in /display directory
- [ ] Asset files exist (CSS, JS chunks)
- [ ] baseHref is "./" in angular.json crestron config
- [ ] HTML templates use relative paths (no leading /)
- [ ] Build works locally (test with http-server)
- [ ] No 404 errors in Eruda console
- [ ] No JavaScript errors in console
- [ ] Q-SYS Core IP is accessible from touchpanel
- [ ] WebSocket connection succeeds

## Useful Commands

```bash
# Build and test locally
npm run ch5-build
cd dist/q-sys-component-browser/browser
npx http-server -p 8080

# Create CH5Z archive
npm run ch5-archive

# Deploy to touchpanel
npm run ch5-deploy

# SSH into touchpanel
ssh crestron@TOUCHPANEL_IP

# View deployed files
ls -la /display

# Restart touchpanel browser
systemctl restart chromium
# or
reboot
```

## Additional Resources

- [Crestron HTML5 UI Documentation](https://sdkcon78221.crestron.com/sdk/Crestron_HTML5UI/)
- [Angular Deployment Documentation](https://angular.dev/tools/cli/deployment)
- [Chrome DevTools Remote Debugging](https://developer.chrome.com/docs/devtools/remote-debugging/)
