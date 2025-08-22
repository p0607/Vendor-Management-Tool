// Environment configuration for the frontend
export const config = {
  // API Configuration
  API_URL: process.env.REACT_APP_API_URL || 'http://localhost:5001',
  
  // Environment
  ENV: process.env.REACT_APP_ENV || 'development',
  IS_PRODUCTION: process.env.REACT_APP_ENV === 'production',
  IS_DEVELOPMENT: process.env.REACT_APP_ENV === 'development',
  
  // Feature Flags
  ENABLE_ANALYTICS: process.env.REACT_APP_ENABLE_ANALYTICS === 'true',
  ENABLE_DEBUG_MODE: process.env.REACT_APP_ENABLE_DEBUG_MODE === 'true',
  
  // External Services
  GOOGLE_ANALYTICS_ID: process.env.REACT_APP_GOOGLE_ANALYTICS_ID || '',
  SENTRY_DSN: process.env.REACT_APP_SENTRY_DSN || '',
  
  // App Configuration
  APP_NAME: 'Vendor Management Tool',
  APP_VERSION: '1.0.0',
  
  // Timeouts
  API_TIMEOUT: 30000,
  SESSION_TIMEOUT: 3600000, // 1 hour
  
  // Pagination
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
} as const;

export default config;
