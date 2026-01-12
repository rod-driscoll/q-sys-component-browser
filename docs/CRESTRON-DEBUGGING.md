# Debugging Crestron Touchpanel Black Screen

When the application shows a black screen on a Crestron touchpanel, follow these debugging steps:

## 1. Access the Browser Console

Crestron touchpanels run a Chromium-based browser. You can access the developer console to see errors.

### Method A: Remote Debugging via Chrome DevTools

1. Enable remote debugging on the touchpanel:
   - Navigate to the touchpanel's web interface: `http://TOUCHPANEL_IP`
   - Go to Settings or Configuration
   - Enable "Remote Debugging" or "Developer Mode"

2. On your computer, open Chrome browser:
   - Navigate to: `chrome://inspect`
   - Under "Discover network targets", add: `TOUCHPANEL_IP:9222`
   - Wait for the device to appear
   - Click "inspect" to open DevTools for the touchpanel

3. Check the Console tab for JavaScript errors

### Method B: On-Device Console (if available)

Some Crestron touchpanels have an on-screen console:
- Look for developer settings in the touchpanel menu
- Enable "Show Console" or "Debug Mode"
- Tap with multiple fingers (varies by model) to toggle console overlay

## 2. Common Issues and Fixes

### Issue: Asset Loading Failures

**Symptoms:** Console shows 404 errors for CSS, JS, or other assets

**Causes:**
- Incorrect asset paths (absolute instead of relative)
- Missing `baseHref: "./"` configuration

**Check:**
```javascript
// In browser console on touchpanel
console.log(document.location.href);
// Should show: file:///display/index.html or http://TOUCHPANEL_IP/display/index.html
```

**Fixes:**
1. Verify `baseHref: "./"` is set in `angular.json`
2. Check HTML templates use relative paths:
   ```html
   <!-- CORRECT -->
   <img src="assets/images/logo.png" />

   <!-- WRONG -->
   <img src="/assets/images/logo.png" />
   ```

3. Rebuild and redeploy:
   ```bash
   npm run ch5-archive
   npm run ch5-deploy
   ```

### Issue: JavaScript Errors

**Symptoms:** Console shows JavaScript errors or exceptions

**Common errors:**

1. **"Cannot read property of undefined"**
   - Check if Q-SYS Core IP is accessible from touchpanel
   - Verify WebSocket connection URL

2. **"Zone.js is not defined"**
   - Angular polyfills not loading correctly
   - Check that `polyfills` are included in build

3. **Module loading errors**
   - Check that all chunks/modules are deployed
   - Verify CH5Z archive includes all files

### Issue: WebSocket Connection Failures

**Symptoms:** Can't connect to Q-SYS Core

**Debug steps:**

1. Check network connectivity:
   - Can the touchpanel ping the Q-SYS Core?
   - Is the Core IP correct?

2. Check WebSocket URL in browser console:
   ```javascript
   // Default WebSocket URL
   ws://CORE_IP/qrc
   ```

3. Verify Q-SYS Core settings:
   - Q-SYS Remote WebSocket Control is enabled
   - Guest user has External Control Protocol permissions

4. Test connection from your computer:
   - Open the app in a regular browser
   - Navigate to: `http://localhost:4200?host=CORE_IP`
   - If it works there but not on touchpanel, it's a network issue

### Issue: Blank Page with No Console Errors

**Symptoms:** No errors in console, but page is blank

**Possible causes:**

1. **Angular application not bootstrapping**
   ```javascript
   // Check in console if Angular loaded
   console.log(document.querySelector('app-root'));
   // Should show the app-root element
   ```

2. **Splash screen not hiding**
   - Check if there's a loading spinner stuck
   - Look for CSS that might be hiding content

3. **Display issue with touchpanel resolution**
   - Check CSS viewport settings
   - Verify the app is responsive to touchpanel dimensions

## 3. Verify Deployment

### Check Files Were Deployed

1. Access touchpanel via SSH:
   ```bash
   ssh crestron@TOUCHPANEL_IP
   # Password: crestron (default)
   ```

2. Navigate to display directory:
   ```bash
   cd /display
   ls -la
   ```

3. Verify files exist:
   - `index.html` should be present
   - Check for asset directories (`assets/`, etc.)
   - Verify JavaScript chunks are present

### Check File Permissions

```bash
# In SSH session
ls -la /display
# All files should be readable (r-- permissions)
```

If permissions are wrong:
```bash
chmod -R 755 /display
```

## 4. Test Build Locally First

Before deploying to touchpanel, test the build locally to ensure it works:

```bash
# Build the app
npm run build

# Serve the built files with a simple HTTP server
cd dist/q-sys-component-browser/browser
npx http-server -p 8080

# Test in browser
# Navigate to: http://localhost:8080
```

If it doesn't work locally, fix the build before deploying to touchpanel.

## 5. Enable Verbose Logging

Add console logging to track application startup:

```typescript
// In src/main.ts
console.log('Application starting...');

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

console.log('Bootstrapping Angular application...');

bootstrapApplication(AppComponent, appConfig)
  .then(() => console.log('Application bootstrapped successfully'))
  .catch((err) => {
    console.error('Bootstrap error:', err);
    // Show error on screen for touchpanel debugging
    document.body.innerHTML = `
      <div style="padding: 20px; color: red; font-size: 20px;">
        <h1>Application Error</h1>
        <pre>${err.message}\n${err.stack}</pre>
      </div>
    `;
  });
```

## 6. Common Angular Configuration Issues

### Check angular.json Configuration

```json
{
  "projects": {
    "q-sys-component-browser": {
      "architect": {
        "build": {
          "options": {
            "baseHref": "./",  // ✓ Must be "./"
            "outputPath": "dist/q-sys-component-browser/browser",
            "index": "src/index.html",
            "browser": "src/main.ts",
            "polyfills": ["zone.js"],  // ✓ Must include zone.js
            "tsConfig": "tsconfig.app.json",
            "assets": [
              // ✓ Ensure all assets are copied
            ]
          }
        }
      }
    }
  }
}
```

### Check index.html

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Q-SYS Component Browser</title>
  <!-- Base href should be set by build process -->
  <base href="./">  <!-- ✓ Should be relative -->
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- ... -->
</head>
<body>
  <app-root></app-root>
  <!-- Fallback error message if Angular doesn't load -->
  <noscript>
    <div style="padding: 20px;">
      JavaScript is required to run this application.
    </div>
  </noscript>
</body>
</html>
```

## 7. Network Debugging

### Check if Touchpanel Can Reach Q-SYS Core

```bash
# SSH into touchpanel
ssh crestron@TOUCHPANEL_IP

# Ping Q-SYS Core
ping CORE_IP

# Check WebSocket port
telnet CORE_IP 80

# Check DNS resolution
nslookup CORE_IP
```

## 8. Crestron Touchpanel Logs

Access system logs on the touchpanel:

```bash
# SSH into touchpanel
ssh crestron@TOUCHPANEL_IP

# View system logs
cat /var/log/messages
# or
cat /var/log/syslog

# View application logs (location varies by model)
cat /opt/crestron/logs/*.log
```

## 9. Quick Diagnostic Checklist

- [ ] Files deployed successfully (check via SSH)
- [ ] index.html exists in /display directory
- [ ] Asset files exist (CSS, JS chunks)
- [ ] baseHref is "./" in angular.json
- [ ] HTML templates use relative paths (no leading /)
- [ ] Build works locally (test with http-server)
- [ ] Browser console shows no 404 errors
- [ ] No JavaScript errors in console
- [ ] Q-SYS Core IP is accessible from touchpanel
- [ ] WebSocket connection succeeds
- [ ] Touchpanel has latest firmware

## 10. Still Not Working?

If you've tried all the above and still have a black screen:

1. **Try a minimal test page:**
   ```html
   <!-- Create test.html -->
   <!DOCTYPE html>
   <html>
   <head>
     <title>Test</title>
   </head>
   <body>
     <h1 style="color: white; font-size: 48px;">
       If you can see this, the touchpanel is working
     </h1>
     <script>
       console.log('Test page loaded successfully');
       alert('Test page loaded!');
     </script>
   </body>
   </html>
   ```

2. **Deploy test page to touchpanel:**
   - Upload test.html to /display/test.html
   - Navigate to it on touchpanel
   - If this doesn't show, it's a touchpanel configuration issue

3. **Check Crestron firmware version:**
   - Some older firmware versions have limited HTML5 support
   - Verify Angular version compatibility with Crestron firmware

4. **Contact Crestron support:**
   - Provide: touchpanel model, firmware version, console logs
   - They can help with touchpanel-specific issues

## Useful Commands Reference

```bash
# Build and test locally
npm run build
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

# Check running processes
ps aux | grep chrom

# Restart touchpanel browser (varies by model)
systemctl restart chromium
# or
reboot
```

## Additional Resources

- [Crestron HTML5 UI Documentation](https://sdkcon78221.crestron.com/sdk/Crestron_HTML5UI/)
- [Angular Deployment Documentation](https://angular.dev/tools/cli/deployment)
- [Chrome DevTools Remote Debugging](https://developer.chrome.com/docs/devtools/remote-debugging/)
