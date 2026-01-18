const PROXY_CONFIG = {
  // Proxy all API calls to the Q-SYS Core to avoid CORS in dev
  '/api': {
    // Use HTTPS to prevent HTTP->HTTPS redirects from the Core
    target: 'https://192.168.104.220', // Fallback default
    secure: false, // Allow self-signed certs on the Core
    changeOrigin: true,
    logLevel: 'debug',
    // Dynamically route based on X-Qsys-Host header when provided
    router: function (req) {
      const qsysHost = req.headers['x-qsys-host'];
      if (qsysHost) {
        const target = 'https://' + qsysHost;
        console.log('[PROXY] Routing /api to Core:', target);
        return target;
      }
      console.log('[PROXY] Using default target (no X-Qsys-Host header)');
      return undefined; // Use the default target
    }
  }
};

module.exports = PROXY_CONFIG;
