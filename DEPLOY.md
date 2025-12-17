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
   BUILD_DIR=dist/q-sys-angular-components/browser
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
