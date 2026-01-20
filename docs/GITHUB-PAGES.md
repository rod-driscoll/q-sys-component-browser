# Deploying to GitHub Pages

This project is configured to automatically deploy to GitHub Pages when changes are pushed to the master branch.

## Live URL

Once deployed, the application will be available at:
```
https://rod-driscoll.github.io/q-sys-component-browser/
```

## Automatic Deployment

### How It Works

The project uses GitHub Actions to automatically build and deploy the application:

1. When you push to the `master` branch, a GitHub Actions workflow is triggered
2. The workflow builds the Angular app with the GitHub Pages configuration
3. The built files are uploaded to GitHub Pages
4. Your site is automatically updated

### First-Time Setup

To enable GitHub Pages for the first time:

1. **Ensure the repository is public** (required for free GitHub Pages)
2. **Push your changes** to the master branch
3. **Enable GitHub Pages**:
   - Go to your repository on GitHub: `https://github.com/rod-driscoll/q-sys-component-browser`
   - Navigate to **Settings → Pages**
   - Under **Source**, select **GitHub Actions**
4. **Wait for deployment**: Check the Actions tab to monitor the deployment progress

### Monitoring Deployments

View deployment status at:
```
https://github.com/rod-driscoll/q-sys-component-browser/actions
```

## Manual Deployment

If you prefer to deploy manually or need to test the build locally:

### Local Build Test

```bash
# Build with GitHub Pages configuration
npm run build:gh-pages

# Built files will be in: dist/q-sys-component-browser/browser
```

### Manual Push to gh-pages Branch

```bash
# Build the project
npm run build:gh-pages

# Install gh-pages package (one-time)
npm install -g angular-cli-ghpages

# Deploy to gh-pages branch
npx angular-cli-ghpages --dir=dist/q-sys-component-browser/browser
```

## Configuration Details

### Base Href

The application is configured with `baseHref: "/q-sys-component-browser/"` to ensure assets load correctly from the GitHub Pages subdirectory.

### Build Configuration

The `github-pages` configuration in `angular.json` includes:
- Production optimizations
- Output hashing for cache busting
- **Service worker disabled** (GitHub Pages subdirectory path causes conflicts)
- Correct base href for GitHub Pages

> [!NOTE]
> The service worker is disabled for GitHub Pages builds because Angular's service worker doesn't properly handle the subdirectory base href. The service worker will still function correctly when deploying to Q-SYS Core.

## Cross-Origin Limitations (CORS)

> [!IMPORTANT]
> When hosted on an external website (like GitHub Pages), the browser enforces **same-origin policy** which blocks direct API requests to the Q-SYS Core.

### What Works

- **WebSocket connections**: The QRWC WebSocket connection to the Core typically works because WebSockets have different CORS rules
- **Component browsing**: Reading component data via WebSocket works normally

### What Doesn't Work

- **Management API authentication**: The `/api/v0/logon` endpoint for obtaining Bearer tokens is blocked by CORS
- **Media Resources API**: File uploads, playlist management, and other REST API calls are blocked
- **Any HTTP/HTTPS fetch requests**: Direct API calls to `https://<core-ip>/api/...` will fail

### Error Symptoms

In the browser console, you'll see errors like:

```text
Access to fetch at 'https://192.168.x.x/api/v0/logon' from origin 'https://rod-driscoll.github.io'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
```

Or the authentication may fail with HTTP 405 if the request doesn't reach the Core at all.

### Solutions

1. **Deploy to Q-SYS Core** (Recommended): Host the app directly on the Core using the deploy script. This eliminates CORS issues entirely.
2. **Use a CORS proxy**: Set up a server-side proxy that forwards requests to the Q-SYS Core and adds CORS headers.
3. **Browser extension**: For development only, use a CORS-unblocking browser extension (not for production).
4. **Configure Q-SYS Core**: If QSC adds CORS header support in future firmware, enable it on the Core.

### Recommended Workflow

Use GitHub Pages for:

- Demonstrating the UI without a live Core
- Development and testing with mock data
- Documentation and screenshots

Use Q-SYS Core deployment for:

- Production control systems
- Full functionality including authentication and file management
- Any feature requiring the Management API

## Troubleshooting

### Assets Not Loading (404 Errors)

**Symptom**: CSS, JavaScript, or other assets fail to load with 404 errors.

**Solution**: Ensure the `baseHref` in `angular.json` is set to `/q-sys-component-browser/` (matching your repository name).

### Workflow Fails

**Common causes**:

1. **Repository is private**: GitHub Pages requires a public repository on the free tier
   - Solution: Make the repository public in Settings → General → Danger Zone

2. **Pages not enabled**: 
   - Solution: Go to Settings → Pages and select "GitHub Actions" as the source

3. **Build errors**: Check the Actions tab for specific error messages
   - Solution: Run `npm run build:gh-pages` locally to debug

### Routing Issues (404 on refresh)

**Symptom**: Direct navigation to routes (e.g., `/settings`) returns 404.

**Solution**: For Angular routing to work with GitHub Pages, you may need to configure a 404 fallback or use hash-based routing. GitHub Pages doesn't support Angular's HTML5 routing by default for SPAs.

To fix, consider:
1. Add a custom 404.html that redirects to index.html
2. Or switch to hash-based routing (not recommended)

### Deployment Takes Too Long

The initial deployment may take 2-3 minutes. Subsequent deployments are usually faster due to caching.

## Related Documentation

- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Angular Deployment Guide](https://angular.io/guide/deployment)

## Comparing with Q-SYS Core Deployment

This project supports two deployment targets:

| Feature | GitHub Pages | Q-SYS Core |
|---------|-------------|------------|
| Access | Public internet | Local network only |
| Setup | Automatic via GitHub Actions | Manual via deploy script |
| Configuration | `build:gh-pages` | `build:deploy` |
| URL | `https://rod-driscoll.github.io/...` | `https://<core-ip>/media/...` |
| Use Case | Demos, documentation | Production Q-SYS systems |

Both deployments can coexist - use GitHub Pages for public demos and Q-SYS Core for actual control systems.
