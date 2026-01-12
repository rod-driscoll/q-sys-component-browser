# Eruda Debug Console for Crestron Touchpanels

This project includes [Eruda](https://github.com/liriliri/eruda), a mobile-friendly developer console that runs directly on the Crestron touchpanel. This provides an easy way to debug issues without needing remote Chrome DevTools access.

## What is Eruda?

Eruda is a lightweight JavaScript library that provides a mobile-optimized developer console. It includes:

- **Console**: View all console.log, console.warn, console.error output
- **Elements**: Inspect HTML DOM structure
- **Network**: Monitor HTTP requests and responses
- **Resources**: View scripts, stylesheets, images, fonts
- **Info**: Display device information, screen size, user agent
- **Storage**: View and edit localStorage and cookies
- **Sources**: View loaded JavaScript source files

## Automatic Inclusion

Eruda is **automatically enabled for all Crestron builds**:

```bash
npm run ch5-build    # Builds with Eruda enabled
npm run ch5-archive  # Builds and packages with Eruda enabled
```

For regular production builds (non-Crestron), Eruda is commented out and won't be loaded.

## How It Works

The implementation consists of three files:

### 1. `public/eruda.js`
The Eruda library itself (copied from `node_modules/eruda/eruda.js`).

### 2. `public/eruda-init.js`
Initialization script that:
- Loads the Eruda library
- Configures Eruda settings
- Shows the floating button in the bottom-right corner

### 3. `enable-eruda.js` (Build Script)
Post-build script that runs after `ng build --configuration=crestron`:
- Reads the built `index.html`
- Uncomments the Eruda script tag
- Writes the modified HTML back

### 4. `src/index.html`
Contains a commented-out Eruda script tag:
```html
<!-- Eruda Debug Console for Crestron Touchpanel Debugging -->
<!-- Uncomment the line below to enable the mobile debug console -->
<!-- <script src="eruda-init.js"></script> -->
```

The `enable-eruda.js` script uncomments this during Crestron builds.

## Using Eruda on the Touchpanel

1. Deploy your app to the Crestron touchpanel:
   ```bash
   npm run ch5-deploy
   ```

2. Navigate to the app on the touchpanel

3. Look for a small floating icon in the **bottom-right corner**

4. Tap the icon to open the Eruda console

5. Use the tabs at the top to switch between tools:
   - Tap **Console** to view logs
   - Tap **Network** to see HTTP requests
   - Tap **Elements** to inspect the DOM
   - Tap **Info** to see device details

6. Drag the icon to reposition it if needed

7. Tap outside the console or on the X to close it

## Manual Testing

To test Eruda locally before deploying:

1. Build with Crestron configuration:
   ```bash
   npm run ch5-build
   ```

2. Serve the build locally:
   ```bash
   npx http-server dist/q-sys-component-browser/browser -p 8080
   ```

3. Open in your browser:
   ```
   http://localhost:8080
   ```

4. You should see the Eruda icon in the bottom-right corner

## Disabling Eruda

Eruda is only enabled for Crestron builds. It's automatically disabled for:

- Production builds: `npm run build`
- GitHub Pages builds: `npm run build:gh-pages`
- Development server: `npm start`

If you want to disable it for Crestron builds, remove the `&& node enable-eruda.js` from the `ch5-build` script in [package.json](../package.json):

```json
"ch5-build": "ng build --configuration=crestron"
```

## Updating Eruda

To update Eruda to the latest version:

```bash
# Update the npm package
npm install eruda@latest --save-dev

# Copy the new version to public folder
cp node_modules/eruda/eruda.js public/eruda.js
```

## Troubleshooting

### Eruda icon doesn't appear

1. Check that the build was done with the Crestron configuration:
   ```bash
   npm run ch5-build
   ```

2. Verify the script tag is uncommented in the built HTML:
   ```bash
   grep "eruda-init.js" dist/q-sys-component-browser/browser/index.html
   ```
   Should show: `<script src="eruda-init.js"></script>` (not commented out)

3. Check browser console for loading errors

### Eruda loads but console is empty

- Eruda captures console output from the moment the page loads
- If you need to see earlier logs, refresh the page with Eruda already open
- Some errors may occur before Eruda initializes - check browser DevTools for those

## Resources

- [Eruda GitHub Repository](https://github.com/liriliri/eruda)
- [Eruda Documentation](https://eruda.liriliri.io/)
- [Crestron Debugging Guide](CRESTRON-DEBUGGING.md)
