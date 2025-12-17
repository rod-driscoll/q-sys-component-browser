#!/usr/bin/env node

/**
 * Q-SYS Core Deployment Script
 *
 * Deploys the compiled Angular application to a Q-SYS Core using the Media Resources API
 *
 * API Documentation: https://q-syshelp.qsc.com/Content/Management_APIs/media_resources.htm
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Color output helpers
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function error(message) {
  log(`✗ ${message}`, colors.red);
}

function success(message) {
  log(`✓ ${message}`, colors.green);
}

function info(message) {
  log(`ℹ ${message}`, colors.cyan);
}

function warning(message) {
  log(`⚠ ${message}`, colors.yellow);
}

// Load environment variables from .env.deploy.local or .env.deploy
function loadEnv() {
  const envFiles = ['.env.deploy.local', '.env.deploy'];
  let envPath = null;

  for (const file of envFiles) {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      envPath = filePath;
      break;
    }
  }

  if (!envPath) {
    error('No environment file found. Please create .env.deploy.local or .env.deploy');
    process.exit(1);
  }

  info(`Loading configuration from ${path.basename(envPath)}`);

  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};

  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });

  // Validate required variables
  if (!env.QSYS_CORE_IP) {
    error('QSYS_CORE_IP is required in environment file');
    process.exit(1);
  }

  if (!env.BUILD_DIR) {
    error('BUILD_DIR is required in environment file');
    process.exit(1);
  }

  return env;
}

// Get all files recursively from a directory
function getFiles(dir, baseDir = dir) {
  const files = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...getFiles(fullPath, baseDir));
    } else {
      files.push({
        fullPath,
        relativePath: path.relative(baseDir, fullPath),
      });
    }
  }

  return files;
}

// Upload a file to Q-SYS Core using Media Resources API
async function uploadFile(coreIp, bearerToken, targetPath, filePath, fileName) {
  return new Promise((resolve, reject) => {
    const fileData = fs.readFileSync(filePath);
    const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2)}`;

    // Build multipart/form-data body
    const parts = [];

    // Add file part
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="media"; filename="${fileName}"\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n`
    );

    const bodyStart = Buffer.from(parts.join(''), 'utf8');
    const bodyEnd = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
    const body = Buffer.concat([bodyStart, fileData, bodyEnd]);

    // URI encode the target path
    const encodedPath = encodeURIComponent(targetPath).replace(/%2F/g, '/');
    const apiPath = `/api/v0/cores/self/media/${encodedPath}`;

    const options = {
      hostname: coreIp,
      port: 443,
      path: apiPath,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
      // Disable SSL certificate verification (Q-SYS uses self-signed certs)
      rejectUnauthorized: false,
    };

    // Add bearer token if provided
    if (bearerToken) {
      options.headers['Authorization'] = `Bearer ${bearerToken}`;
    }

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, data: responseData });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(body);
    req.end();
  });
}

// Main deployment function
async function deploy() {
  log('\n' + '='.repeat(60), colors.bright);
  log('Q-SYS Core Deployment Script', colors.bright);
  log('='.repeat(60) + '\n', colors.bright);

  // Load configuration
  const env = loadEnv();
  const coreIp = env.QSYS_CORE_IP;
  const bearerToken = env.QSYS_BEARER_TOKEN || '';
  const webRoot = env.QSYS_WEB_ROOT || 'web';
  const buildDir = path.join(__dirname, env.BUILD_DIR);

  // Validate build directory exists
  if (!fs.existsSync(buildDir)) {
    error(`Build directory not found: ${buildDir}`);
    error('Please run "npm run build" first');
    process.exit(1);
  }

  info(`Core IP: ${coreIp}`);
  info(`Target path: /media/${webRoot}`);
  info(`Build directory: ${buildDir}`);
  info(`Authentication: ${bearerToken ? 'Bearer token provided' : 'Open access mode'}\n`);

  // Get all files to upload
  const files = getFiles(buildDir);

  if (files.length === 0) {
    warning('No files found to deploy');
    process.exit(0);
  }

  log(`Found ${files.length} file(s) to deploy\n`, colors.bright);

  // Upload files
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileName = path.basename(file.relativePath);
    // Target path should be the directory only (API appends filename automatically)
    const fileDir = path.dirname(file.relativePath);
    const targetPath = fileDir === '.'
      ? webRoot
      : path.join(webRoot, fileDir).replace(/\\/g, '/');

    process.stdout.write(
      `[${i + 1}/${files.length}] Uploading ${file.relativePath}... `
    );

    try {
      await uploadFile(coreIp, bearerToken, targetPath, file.fullPath, fileName);
      success('✓');
      successCount++;
    } catch (err) {
      error(`✗ ${err.message}`);
      errorCount++;
    }
  }

  // Summary
  log('\n' + '='.repeat(60), colors.bright);
  log('Deployment Summary', colors.bright);
  log('='.repeat(60), colors.bright);
  log(`Total files: ${files.length}`);
  success(`Successful: ${successCount}`);
  if (errorCount > 0) {
    error(`Failed: ${errorCount}`);
  }
  log('');

  if (errorCount === 0) {
    success('✓ Deployment completed successfully!');
    log('');
    info(`Access your app at: https://${coreIp}/media/${webRoot}/index.html`);
  } else {
    error('✗ Deployment completed with errors');
    process.exit(1);
  }
}

// Run deployment
deploy().catch((err) => {
  error(`Deployment failed: ${err.message}`);
  process.exit(1);
});
