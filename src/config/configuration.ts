export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Cron job configuration
  cron: {
    schedule: process.env.CRON_SCHEDULE, // Every 25 hours
    timezone: process.env.CRON_TIMEZONE,
  },

  // Clasificados configuration
  clasificados: {
    baseUrl: process.env.CLASIFICADOS_BASE_URL,
    adminPath: process.env.CLASIFICADOS_ADMIN_PATH,
    republishPath: process.env.CLASIFICADOS_REPUBLISH_PATH,
    cookies: process.env.CLASIFICADOS_COOKIES,
  },

  // Request headers
  headers: {
    userAgent: process.env.USER_AGENT,
    acceptLanguage: process.env.ACCEPT_LANGUAGE,
  },

  // Logging configuration
  log: {
    level: process.env.LOG_LEVEL,
    filePath: process.env.LOG_FILE_PATH,
  },

  // Rate limiting
  rateLimit: {
    maxConcurrentRequests:
      parseInt(process.env.MAX_CONCURRENT_REQUESTS, 10) || 20,
    requestDelayMs: parseInt(process.env.REQUEST_DELAY_MS, 10) || 300,
  },

  // Retry configuration
  retry: {
    maxRetries: parseInt(process.env.MAX_RETRIES, 10),
    retryDelayMs: parseInt(process.env.RETRY_DELAY_MS, 10),
  },
});
