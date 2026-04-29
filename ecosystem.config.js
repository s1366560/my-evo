// ============================================================
// EvoMap Hub - PM2 Ecosystem Configuration
// ============================================================
// Usage:
//   Development: pm2 start ecosystem.config.js
//   Production:   pm2 start ecosystem.config.js --env production
// ============================================================

module.exports = {
  apps: [
    // ---- Backend API Server ----
    {
      name: 'evomap-backend',
      script: 'dist/index.js',
      instances: 'max', // Use all CPU cores in cluster mode
      exec_mode: 'cluster',
      cwd: '/app',
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOST: '0.0.0.0',
        LOG_LEVEL: 'info',
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3001,
        HOST: '0.0.0.0',
        LOG_LEVEL: 'debug',
      },
      // Error/Output logging
      error_file: '/var/log/evomap/backend-error.log',
      out_file: '/var/log/evomap/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      // Auto-restart
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      // Watch (development only)
      watch: false,
      // Source map support
      source_map_support: true,
    },
  ],
};
