module.exports = {
  // Environment
  NODE_ENV: 'production',
  PORT: process.env.PORT || 5001,
  
  // Database
  database: {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'Vendor_Management',
    password: process.env.DB_PASSWORD || 'Postgres0607@',
    port: process.env.DB_PORT || 5432,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    ssl: { rejectUnauthorized: false }
  },
  
  // Security
  security: {
    bcryptRounds: 12,
    jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    corsOrigins: [process.env.FRONTEND_URL || 'https://yourdomain.com'],
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    }
  },
  
  // File Upload
  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    uploadPath: './uploads'
  },
  
  // Logging
  logging: {
    level: 'info',
    logDir: './logs',
    maxFiles: 5,
    maxSize: '10m'
  },
  
  // Performance
  performance: {
    compression: true,
    trustProxy: true
  }
};
