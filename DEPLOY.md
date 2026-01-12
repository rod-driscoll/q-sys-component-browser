# Deploying to Q-SYS Core

This project includes a deployment script that automatically uploads the compiled Angular application to a Q-SYS Core processor using the Media Resources API.

## Prerequisites

- Q-SYS Core with network access
- Bearer token (if Access Control is enabled on the Core)
- Sufficient storage space on the Core

## Setup

1. **Create a local environment file**

   Copy the example environment file and customize it:
   ```bash
   cp .env.deploy .env.deploy.local
   ```

2. **Configure deployment settings**

   Edit `.env.deploy.local` with your Q-SYS Core details:

   ```env
   # Q-SYS Core IP address or hostname
   QSYS_CORE_IP=192.168.1.100

   # Bearer token for API authentication (leave empty for open access cores)
   QSYS_BEARER_TOKEN=your-bearer-token-here

   # Target directory path on the Q-SYS Core
   # This is the path within the Core's media folder structure
   # Example: "web" for /media/web, "web/apps" for /media/web/apps
   QSYS_WEB_ROOT=web

   # Local build directory (relative to project root)
   BUILD_DIR=dist/q-sys-component-browser/browser
   ```

   > **Note:** The `.env.deploy.local` file is gitignored to protect your credentials.

3. **Get a Bearer Token (if needed)**

   If your Q-SYS Core has Access Control enabled:

   - Log into the Core's web interface
   - Navigate to the Access Control settings
   - Generate an API bearer token with appropriate permissions
   - Copy the token to your `.env.deploy.local` file

## Deployment

### Option 1: Build and Deploy Separately

```bash
# Build the project
npm run build

# Deploy to Q-SYS Core
npm run deploy
```

### Option 2: Build and Deploy in One Command

```bash
npm run build:deploy
```

## What Happens During Deployment

The deployment script:

1. Loads configuration from `.env.deploy.local` or `.env.deploy`
2. Validates the build directory exists
3. Recursively finds all files in the build directory
4. Uploads each file to the Q-SYS Core using the Media Resources API
5. Reports progress and displays a summary

## Accessing Your Application

After successful deployment, access your application at:

```
https://<QSYS_CORE_IP>/media/<QSYS_WEB_ROOT>/index.html
```

For example, if:
- Core IP: `192.168.1.100`
- Web root: `web`

Access at: `https://192.168.1.100/media/web/index.html`

## Troubleshooting

### Authentication Errors

If you get 401 Unauthorized errors:
- Verify your bearer token is correct
- Check that the token has appropriate permissions
- For open access Cores, try leaving `QSYS_BEARER_TOKEN` empty

### SSL Certificate Errors

The script automatically accepts self-signed certificates (common with Q-SYS Cores). If you still have issues, check your network connection.

### File Upload Failures

- Ensure the Core has sufficient disk space
- Verify the target path exists or can be created
- Check that special characters in file paths are handled correctly

### Build Directory Not Found

Make sure you've run `npm run build` before deploying, or use `npm run build:deploy` to do both at once.

## API Documentation

For more information about the Q-SYS Media Resources API, see:
- [Q-SYS Media Resources API Documentation](https://q-syshelp.qsc.com/Content/Management_APIs/media_resources.htm)
- [Q-SYS Management APIs Overview](https://help.qsys.com/q-sys_10.0/#Management_APIs/Management_APIs_Overview.htm)

## Security Notes

- **Never commit `.env.deploy.local`** - It contains sensitive credentials
- Store bearer tokens securely
- Use appropriate Access Control settings on your Core
- Consider using HTTPS and bearer tokens for production deployments

---

# Deploying to Crestron Touchpanels

This application can be deployed to Crestron touchpanels as a CH5Z (Crestron HTML5 Zip) archive file.

## Prerequisites

- Crestron touchpanel with CH5 support
- Network access to the touchpanel
- SSH credentials for the touchpanel (default: `crestron` / `crestron`)
- `@crestron/ch5-utilities-cli` installed (already included in devDependencies)

## Build Configuration

The Angular build is pre-configured for Crestron deployment with `baseHref: "./"` in [angular.json](angular.json), which ensures relative paths work correctly when deployed to Crestron's `/display/` directory.

### Asset Path Requirements

**HTML Templates**: Use relative paths without leading `/`
```html
<!-- Correct -->
<img src="assets/images/logo.png" />

<!-- Incorrect -->
<img src="/assets/images/logo.png" />
```

**CSS Files**: Leading slash is acceptable - Angular build with `baseHref: "./"` handles it
```css
/* Both work correctly */
background-image: url(/assets/fonts/font.ttf);
background-image: url(../assets/fonts/font.ttf);
```

The `baseHref: "./"` configuration ensures all resources load correctly relative to the HTML file location when deployed to Crestron touchpanels.

## Deployment Commands

### Build CH5Z Archive

Create a CH5Z archive file for deployment:

```bash
npm run ch5-archive
```

This will:
1. Build the Angular app (`ng build`)
2. Package the build output as a CH5Z file
3. Output to `dist/q-sys-component-browser.ch5z`

### Deploy to Touchpanel

Deploy the CH5Z file to a Crestron touchpanel:

```bash
npm run ch5-deploy
```

This deploys to the touchpanel at `192.168.104.109` (configured in [package.json](package.json#L19)).

### Deploy to Different IP

To deploy to a different touchpanel:

```bash
npx ch5-cli deploy -H <TOUCHPANEL_IP> -t touchscreen -p dist/q-sys-component-browser.ch5z
```

Example:
```bash
npx ch5-cli deploy -H 192.168.1.50 -t touchscreen -p dist/q-sys-component-browser.ch5z
```

## CH5 CLI Options

The Crestron CH5 utilities CLI provides these commands:

### Archive Command

```bash
npx ch5-cli archive -p <project-name> -d <dist-dir> -o <output-dir>
```

- `-p` - Project name (becomes the CH5Z filename)
- `-d` - Distribution directory (Angular build output)
- `-o` - Output directory (where CH5Z file is created)

### Deploy Command

```bash
npx ch5-cli deploy -H <host> -t <type> -p <path>
```

- `-H` - Touchpanel IP address or hostname
- `-t` - Device type (`touchscreen`, `server`, etc.)
- `-p` - Path to CH5Z file to deploy
- `-u` - Username (default: `crestron`)
- `-w` - Password (default: `crestron`)

## Accessing the Application

After successful deployment, the application will be accessible on the Crestron touchpanel at:

```
/display/index.html
```

Or via the touchpanel's web interface (if enabled):

```
http://<TOUCHPANEL_IP>/display/index.html
```

## Troubleshooting

### Connection Errors

If deployment fails with connection errors:
- Verify the touchpanel IP address is correct
- Ensure SSH is enabled on the touchpanel
- Check network connectivity
- Verify firewall rules allow SSH (port 22)

### Authentication Errors

If you get authentication errors:
- Default credentials: `crestron` / `crestron`
- Check if default credentials have been changed
- Use `-u` and `-w` flags to specify custom credentials:
  ```bash
  npx ch5-cli deploy -H 192.168.1.50 -t touchscreen -u admin -w password -p dist/q-sys-component-browser.ch5z
  ```

### Build Errors

If the archive creation fails:
- Ensure `ng build` completes successfully first
- Check that the dist directory exists and contains build output
- Verify the path in the `ch5-archive` script matches your Angular output path

### Display Issues

If the app doesn't display correctly on the touchpanel:
- Verify `baseHref: "./"` is set in angular.json
- Check that all asset paths in HTML use relative paths (no leading `/`)
- Review browser console on touchpanel for asset loading errors
- Ensure the touchpanel firmware supports your Angular version

## CH5 Documentation

For more information about Crestron CH5 development:
- [Crestron CH5 Archives Documentation](https://sdkcon78221.crestron.com/sdk/Crestron_HTML5UI/Content/Topics/UI-CH5-Archives.htm)
- [CH5 Utilities CLI](https://www.npmjs.com/package/@crestron/ch5-utilities-cli)

## Updating Deployment Configuration

To change the default deployment IP, edit [package.json](package.json#L19):

```json
"ch5-deploy": "npx ch5-cli deploy -H YOUR_IP_HERE -t touchscreen -p dist/q-sys-component-browser.ch5z"
```
