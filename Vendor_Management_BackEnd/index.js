require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const xlsx = require('xlsx');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const winston = require('winston');

// Initialize Express app
const app = express();

// Environment configuration
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 5001;
const isProduction = NODE_ENV === 'production';

// Configure Winston logger
const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'vendor-management-api' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
    format: winston.format.simple()
})
  ]
});

// Create logs directory if it doesn't exist
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs');
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 100 : 1000, // limit each IP to 100 requests per windowMs in production
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// app.use('/api/', limiter);

// Compression middleware
app.use(compression());
app.set('trust proxy',1);

// CORS configuration
const corsOptions = {
  origin: isProduction 
    ? [process.env.FRONTEND_URL || 'http://40.67.147.19', 'http://localhost:3000']
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Request logging
app.use(morgan(isProduction ? 'combined' : 'dev', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Database configuration
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'postgres',
  database: process.env.DB_NAME || 'Vendor_Management',
  password: process.env.DB_PASSWORD || 'Postgres0607@',
  port: process.env.DB_PORT || 5432,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
  ssl: false
});

// Database connection event handlers
pool.on('connect', () => {
  logger.info('Connected to the database');
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large',
        message: 'File size must be less than 10MB'
      });
    }
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: err.message
    });
  }

  // For database errors, provide more context
  if (err.code && err.code.startsWith('23')) {
    // PostgreSQL constraint violation errors
    return res.status(400).json({
      success: false,
      error: 'Database Constraint Error',
      message: err.message || 'Invalid data provided'
    });
  }
  
  res.status(err.status || 500).json({
    success: false,
    error: isProduction ? 'Internal Server Error' : err.message,
    message: isProduction ? 'An error occurred while processing your request' : err.message,
    ...(isProduction ? {} : { stack: err.stack, code: err.code })
  });
};

// Input validation middleware
const validateRequiredFields = (fields) => {
  return (req, res, next) => {
    for (const field of fields) {
      if (!req.body[field]) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: `${field} is required`
        });
      }
    }
    next();
  };
};

// Authentication middleware (basic implementation)
const authenticateUser = async (req, res, next) => {
  try {
    // This is a basic implementation - in production, use JWT tokens
    const { name, password } = req.body;
    if (!name || !password) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    next();
  } catch (error) {
    next(error);
  }
};

// Database query wrapper with error handling
const executeQuery = async (query, params = []) => {
  const client = await pool.connect();
  try {
    const result = await client.query(query, params);
    return result;
  } catch (error) {
    logger.error('Database query error:', {
      query: query.substring(0, 100) + '...',
      error: error.message,
      code: error.code
    });
    throw error;
  } finally {
    client.release();
  }
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV
  });
});

// Format Date to YYYY-MM-DD using local date components (avoids UTC shifting the day/month)
function toLocalYYYYMMDD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// API Routes
const ALLOWED_DESIGNATIONS = [
  'ASSOCIATE_VENDOR_MANAGEMENT',
  'ADMIN',
  'SUPER ADMIN',
  'BU HEAD',
  'FINANCE EXECUTIVE'
];

// Signup endpoint
app.post('/api/signup', 
  validateRequiredFields(['name', 'designation', 'email', 'phone_number', 'password', 'business_unit']),
  async (req, res, next) => {
    try {
      const { name, designation, email, phone_number, password, business_unit } = req.body;

      // Validate designation
      if (!ALLOWED_DESIGNATIONS.includes(designation)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid designation'
        });
      }

      // Normalize business unit to ensure case-insensitive consistency
      // This ensures "BPO|HTD", "bpo|htd", "Bpo|Htd" all become "BPO|HTD"
      let normalizedBusinessUnit = business_unit;
      if (business_unit) {
        const buTrimmed = String(business_unit).trim();
        const buLower = buTrimmed.toLowerCase();
        
        // Handle BPO|HTD variations (case-insensitive, with or without spaces)
        // Remove spaces around pipe/slash/dash for comparison
        const normalizedForComparison = buLower.replace(/\s*\|\s*/g, '|').replace(/\s*\/\s*/g, '/').replace(/\s*-\s*/g, '-');
        if (normalizedForComparison === 'bpo|htd' || normalizedForComparison === 'bpo/htd' || normalizedForComparison === 'bpo-htd') {
          normalizedBusinessUnit = 'BPO|HTD';
        }
        // Handle other common variations
        else if (buLower === 'captive') {
          normalizedBusinessUnit = 'Captive';
        }
        else if (buLower === 'canada') {
          normalizedBusinessUnit = 'Canada';
        }
        else if (buLower === 'japan') {
          normalizedBusinessUnit = 'Japan';
        }
        else if (buLower === 'singapore') {
          normalizedBusinessUnit = 'Singapore';
        }
        else if (buLower === 'si' || buLower === 'si tech' || buLower === 'si bpo') {
          normalizedBusinessUnit = 'SI';
        }
        else if (buLower === 'usa') {
          normalizedBusinessUnit = 'USA';
        }
        else if (buLower === 'ms' || buLower === 'managed services' || buLower === 'managed  services') {
          normalizedBusinessUnit = 'MS';
        }
        else if (buLower === 'egg' || buLower === 'engg' || buLower === 'engineering') {
          normalizedBusinessUnit = 'Egg';
        }
        else if (buLower === 'all' || buLower === 'finance') {
          normalizedBusinessUnit = 'Finance';
        }
        // For BPO|HTD, ensure it's stored in uppercase format (handle any case variation, including spaces)
        // Normalize spaces around pipe before checking
        const buNormalizedForCheck = buTrimmed.replace(/\s*\|\s*/g, '|');
        if (buNormalizedForCheck.toUpperCase() === 'BPO|HTD' || buNormalizedForCheck === 'BPO|HTD') {
          normalizedBusinessUnit = 'BPO|HTD';
        }
        // If already normalized by frontend, keep as is
        else {
          normalizedBusinessUnit = buTrimmed;
        }
      }

      const result = await executeQuery(
        'INSERT INTO users (name, designation, email, phone_number, password, business_unit) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email',
        [name, designation, email, phone_number, password, normalizedBusinessUnit]
      );
      
      logger.info('User created successfully', { userId: result.rows[0].id, email });
      
      res.status(201).json({
        success: true,
        message: 'User created successfully',
        user: result.rows[0]
      });
    } catch (err) {
      next(err);
    }
  }
);

// Login endpoint
app.post('/api/login', async (req, res, next) => {
  try {
    const { name, password } = req.body;
    
    if (!name || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    const result = await executeQuery('SELECT * FROM users WHERE name = $1', [name]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }

    const user = result.rows[0];
    const isPasswordValid = (password === user.password);
    
    if (!isPasswordValid) {
      logger.warn('Failed login attempt', { username: name, ip: req.ip });
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }

    logger.info('User logged in successfully', { userId: user.id, name: user.name });
    
    // Normalize business unit to ensure consistency
    let normalizedBusinessUnit = user.business_unit;
    if (user.business_unit) {
      const buTrimmed = String(user.business_unit).trim();
      const buLower = buTrimmed.toLowerCase();
      
      // Handle BPO|HTD variations (case-insensitive, with or without spaces)
      // Remove spaces around pipe/slash/dash for comparison
      const normalizedForComparison = buLower.replace(/\s*\|\s*/g, '|').replace(/\s*\/\s*/g, '/').replace(/\s*-\s*/g, '-');
      if (normalizedForComparison === 'bpo|htd' || normalizedForComparison === 'bpo/htd' || normalizedForComparison === 'bpo-htd') {
        normalizedBusinessUnit = 'BPO|HTD';
      }
      // Handle other common variations
      else if (buLower === 'captive') {
        normalizedBusinessUnit = 'Captive';
      }
      else if (buLower === 'canada') {
        normalizedBusinessUnit = 'Canada';
      }
      else if (buLower === 'japan') {
        normalizedBusinessUnit = 'Japan';
      }
      else if (buLower === 'singapore') {
        normalizedBusinessUnit = 'Singapore';
      }
      else if (buLower === 'si' || buLower === 'si tech' || buLower === 'si bpo') {
        normalizedBusinessUnit = 'SI';
      }
      else if (buLower === 'usa') {
        normalizedBusinessUnit = 'USA';
      }
      else if (buLower === 'ms' || buLower === 'managed services' || buLower === 'managed  services') {
        normalizedBusinessUnit = 'MS';
      }
      else if (buLower === 'egg' || buLower === 'engg' || buLower === 'engineering') {
        normalizedBusinessUnit = 'Egg';
      }
      else if (buLower === 'all' || buLower === 'finance') {
        normalizedBusinessUnit = 'Finance';
      }
      // For BPO|HTD, ensure it's stored in uppercase format (handle any case variation, including spaces)
      // Normalize spaces around pipe before checking
      const buNormalizedForCheck = buTrimmed.replace(/\s*\|\s*/g, '|');
      if (buNormalizedForCheck.toUpperCase() === 'BPO|HTD' || buNormalizedForCheck === 'BPO|HTD') {
        normalizedBusinessUnit = 'BPO|HTD';
      }
    }
    
    res.json({ 
      success: true, 
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        designation: user.designation,
        business_unit: normalizedBusinessUnit,
        email: user.email
      }
    });
  } catch (err) {
    next(err);
  }
});

// Helper functions for Active/Attrition validation
const validateDateField = (value) => {
  // Return null for empty, null, undefined, or invalid values
  if (!value || value === '' || value === 'null' || value === 'undefined' || value === '1' || value === null || value === undefined) {
    return null;
  }
  
  // Convert to string and trim
  const strValue = String(value).trim();
  if (strValue === '' || strValue.toLowerCase() === 'null' || strValue.toLowerCase() === 'undefined') {
    return null;
  }
  
  // Handle date ranges (e.g., "10-09-2025 to 15-09-2025" -> use start date)
  if (strValue.includes(' to ')) {
    const startDate = strValue.split(' to ')[0].trim();
    const date = new Date(startDate);
    if (!isNaN(date.getTime())) {
      return startDate;
    }
  }
  
  // Already YYYY-MM-DD (frontend sends this)
  if (/^\d{4}-\d{2}-\d{2}$/.test(strValue)) return strValue;
  
  // Handle Excel date serial numbers
  if (!isNaN(value) && typeof value === 'number' && value > 1000) {
    const excelDate = new Date((value - 25569) * 86400 * 1000);
    if (!isNaN(excelDate.getTime())) {
      return toLocalYYYYMMDD(excelDate);
    }
  }
  
  // Try to parse as date
  const date = new Date(strValue);
  if (isNaN(date.getTime())) {
    return null;
  }
  
  // Return date in YYYY-MM-DD format
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const validateNumericField = (value) => {
  if (!value || value === '' || value === 'null' || value === 'undefined') {
    return null;
  }
  
  // Handle percentage values (e.g., "10%" -> 10)
  if (typeof value === 'string' && value.includes('%')) {
    const numericValue = parseFloat(value.replace('%', ''));
    return isNaN(numericValue) ? null : numericValue;
  }
  
  // If it's a string that's not a valid number, return null
  if (typeof value === 'string' && isNaN(parseFloat(value))) {
    return null;
  }
  return parseFloat(value);
};

// Active Routes
app.get('/api/Active', async (req, res, next) => {
  try {
    const result = await executeQuery('SELECT * FROM active ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

app.get('/api/Active/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await executeQuery('SELECT * FROM active WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

app.post('/api/Active', async (req, res, next) => {
  try {
    const data = req.body;
    
    const result = await executeQuery(
      `INSERT INTO active (
        active_employee_name, active_vendor, active_skill, active_ob_month, active_doj,
        active_employment_status, active_po_value, active_vendor_value, active_alchemy_routing,
        active_gross_margin, active_gm_percentage
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      ) RETURNING *`,
      [
        data.active_employee_name || null,
        data.active_vendor || null,
        data.active_skill || null,
        validateDateField(data.active_ob_month),
        validateDateField(data.active_doj),
        data.active_employment_status || null,
        validateNumericField(data.active_po_value),
        validateNumericField(data.active_vendor_value),
        data.active_alchemy_routing || null,
        validateNumericField(data.active_gross_margin),
        validateNumericField(data.active_gm_percentage)
      ]
    );
    
    logger.info('Active record created', { recordId: result.rows[0].id });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

app.put('/api/Active/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = req.body;
    
    const result = await executeQuery(
      `UPDATE active SET
        active_employee_name = $1, active_vendor = $2, active_skill = $3, active_ob_month = $4, active_doj = $5,
        active_employment_status = $6, active_po_value = $7, active_vendor_value = $8, active_alchemy_routing = $9,
        active_gross_margin = $10, active_gm_percentage = $11
      WHERE id = $12 RETURNING *`,
      [
        data.active_employee_name || null,
        data.active_vendor || null,
        data.active_skill || null,
        validateDateField(data.active_ob_month),
        validateDateField(data.active_doj),
        data.active_employment_status || null,
        validateNumericField(data.active_po_value),
        validateNumericField(data.active_vendor_value),
        data.active_alchemy_routing || null,
        validateNumericField(data.active_gross_margin),
        validateNumericField(data.active_gm_percentage),
        id
      ]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    logger.info('Active record updated', { recordId: id });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Attrition Routes
app.get('/api/Attrition', async (req, res, next) => {
  try {
    const result = await executeQuery('SELECT * FROM attrition ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

app.get('/api/Attrition/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await executeQuery('SELECT * FROM attrition WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

app.post('/api/Attrition', async (req, res, next) => {
  try {
    const data = req.body;
    
    // Prepare values with proper validation
    const values = [
      data.attrition_employee_name && String(data.attrition_employee_name).trim() ? String(data.attrition_employee_name).trim() : null,
      data.attrition_vendor && String(data.attrition_vendor).trim() ? String(data.attrition_vendor).trim() : null,
      data.attrition_skill && String(data.attrition_skill).trim() ? String(data.attrition_skill).trim() : null,
      validateDateField(data.attrition_b_month),
      validateDateField(data.attrition_doj),
      data.attrition_employment_status && String(data.attrition_employment_status).trim() ? String(data.attrition_employment_status).trim() : null,
      validateDateField(data.attrition_month),
      validateDateField(data.attrition_date),
      validateNumericField(data.attrition_po_value),
      validateNumericField(data.attrition_vendor_value),
      data.attrition_alchemy_routing && String(data.attrition_alchemy_routing).trim() ? String(data.attrition_alchemy_routing).trim() : null,
      validateNumericField(data.attrition_gross_margin),
      validateNumericField(data.attrition_gm_percentage)
    ];
    
    logger.info('Creating Attrition record', { 
      employee: values[0], 
      vendor: values[1],
      dateFields: {
        b_month: values[3],
        doj: values[4],
        month: values[6],
        date: values[7]
      }
    });
    
    const result = await executeQuery(
      `INSERT INTO attrition (
        attrition_employee_name, attrition_vendor, attrition_skill, attrition_b_month, attrition_doj,
        attrition_employment_status, attrition_month, attrition_date, attrition_po_value, attrition_vendor_value,
        attrition_alchemy_routing, attrition_gross_margin, attrition_gm_percentage
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
      ) RETURNING *`,
      values
    );
    
    logger.info('Attrition record created', { recordId: result.rows[0].id });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    logger.error('Error creating Attrition record', {
      error: err.message,
      stack: err.stack,
      body: req.body,
      code: err.code
    });
    next(err);
  }
});

app.put('/api/Attrition/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = req.body;
    
    const result = await executeQuery(
      `UPDATE attrition SET
        attrition_employee_name = $1, attrition_vendor = $2, attrition_skill = $3, attrition_b_month = $4, attrition_doj = $5,
        attrition_employment_status = $6, attrition_month = $7, attrition_date = $8, attrition_po_value = $9, attrition_vendor_value = $10,
        attrition_alchemy_routing = $11, attrition_gross_margin = $12, attrition_gm_percentage = $13
      WHERE id = $14 RETURNING *`,
      [
        data.attrition_employee_name || null,
        data.attrition_vendor || null,
        data.attrition_skill || null,
        validateDateField(data.attrition_b_month),
        validateDateField(data.attrition_doj),
        data.attrition_employment_status || null,
        validateDateField(data.attrition_month),
        validateDateField(data.attrition_date),
        validateNumericField(data.attrition_po_value),
        validateNumericField(data.attrition_vendor_value),
        data.attrition_alchemy_routing || null,
        validateNumericField(data.attrition_gross_margin),
        validateNumericField(data.attrition_gm_percentage),
        id
      ]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    logger.info('Attrition record updated', { recordId: id });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Alchemy Routing Routes
app.get('/api/Alchemy_Routing', async (req, res, next) => {
  try {
    const result = await executeQuery('SELECT * FROM "Alchemy_Routing" ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

app.post('/api/Alchemy_Routing', async (req, res, next) => {
  try {
    const routingData = req.body;

    if (!routingData['Sl.No'] || !routingData['Costing Date'] || !routingData['IBM / KYNDRYL']) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const validateDateField = (value) => {
      if (!value || value === '' || value === 'null' || value === 'undefined' || value === '1') {
        return null;
      }
      
      // Handle date ranges (e.g., "10-09-2025 to 15-09-2025" -> use start date)
      if (typeof value === 'string' && value.includes(' to ')) {
        const startDate = value.split(' to ')[0].trim();
        const date = new Date(startDate);
        if (!isNaN(date.getTime())) {
          return startDate;
        }
      }
      
      // Handle dd-mmm-yy format (e.g., "13-Aug-24")
      if (typeof value === 'string' && /^\d{1,2}-[A-Za-z]{3}-\d{2}$/.test(value)) {
        const [day, month, year] = value.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthIndex = monthNames.findIndex(m => m.toLowerCase() === month.toLowerCase());
        
        if (monthIndex !== -1) {
          // Convert 2-digit year to 4-digit year
          const fullYear = parseInt(year) < 50 ? 2000 + parseInt(year) : 1900 + parseInt(year);
          const date = new Date(fullYear, monthIndex, parseInt(day));
          if (!isNaN(date.getTime())) {
            return toLocalYYYYMMDD(date); // Return YYYY-MM-DD format
          }
        }
      }
      
      // Handle dd-mm-yyyy format (e.g., "13-08-2024")
      if (typeof value === 'string' && /^\d{1,2}-\d{1,2}-\d{4}$/.test(value)) {
        const [day, month, year] = value.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(date.getTime())) {
          return toLocalYYYYMMDD(date); // Return YYYY-MM-DD format
        }
      }
      
      // Handle Excel serial numbers
      if (!isNaN(value) && value > 1000) {
        const excelDate = new Date((value - 25569) * 86400 * 1000);
        if (!isNaN(excelDate.getTime())) {
          return toLocalYYYYMMDD(excelDate);
        }
      }
      
      // Try standard date parsing
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return toLocalYYYYMMDD(date); // Return YYYY-MM-DD format
      }
      
      return null;
    };

    const validateNumericField = (value) => {
      if (!value || value === '' || value === 'null' || value === 'undefined') {
        return null;
      }
      
      // Handle percentage values (e.g., "10%" -> 10)
      if (typeof value === 'string' && value.includes('%')) {
        const numericValue = parseFloat(value.replace('%', ''));
        return isNaN(numericValue) ? null : numericValue;
      }
      
      // If it's a string that's not a valid number, return null
      if (typeof value === 'string' && isNaN(parseFloat(value))) {
        return null;
      }
      return parseFloat(value);
    };

    // Specialized function to validate and convert billing month
    const validateBillingMonth = (value) => {
      if (!value || value === '' || value === 'null' || value === 'undefined') {
        return null;
      }
      
      // Handle MMM-YY format (e.g., "Sep-24", "Jan-25")
      if (typeof value === 'string' && /^[A-Za-z]{3}-\d{2}$/.test(value)) {
        const [monthStr, yearStr] = value.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthIndex = monthNames.findIndex(m => m.toLowerCase() === monthStr.toLowerCase());
        
        if (monthIndex !== -1) {
          // Convert 2-digit year to 4-digit year
          const fullYear = 2000 + parseInt(yearStr);
          const date = new Date(fullYear, monthIndex, 1); // First day of the month
          return toLocalYYYYMMDD(date); // Return YYYY-MM-DD format
        }
      }
      
      // Handle Excel serial numbers (5-digit numbers like 45532, 45565)
      if (!isNaN(value) && value > 1000 && value < 100000) {
        // Excel serial number conversion
        const excelEpoch = new Date(1899, 11, 30); // December 30, 1899
        const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
        
        if (!isNaN(date.getTime())) {
          // Return the first day of the month in YYYY-MM-DD format
          const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
          return toLocalYYYYMMDD(firstDayOfMonth);
        }
      }
      
      // Try standard date parsing and convert to first day of month
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        return toLocalYYYYMMDD(firstDayOfMonth);
      }
      
      return null;
    };
    
    const result = await executeQuery(
      `INSERT INTO "Alchemy_Routing" (
        "Sl.No", "Costing Date", "IBM / KYNDRYL", "Requestor", "Department SPOC",
        "SPOC E-mail ID", "Training / Services Details", "Description",
        "IBM / KYNDRYL PO No", "IBM / KYNDRYL PO Date", "IBM / KYNDRYL PO Value",
        "Integration %", "Integrator Charges (Margin)",
        "Alchemy Billing Value", "Funding cost", "Net Margin", "Billing Month", "Payment Day's",
        "Vendor Details", "Vendor SPOC", "Vendor SPOC Contact No", "Vendor SPOC E-mail ID",
        "Training Dates", "Vendor Inv. No.", "Vendor Inv. Date", "Vendor Inv. Amount",
        "GST @ 18%", "Total Invoice", "Vendor Amount After TDS 10%",
        "Net Payment to Vendor", "Payment Due Date", "Alchemy Techsol Invoive No",
        "Alchemy Techsol Invoice Date", "Alchemy Techsol Invoice Amount", "Payment Expected Date (IBM)",
        "Cheque Issued Name", "Cheque Date", "Cheque No", "REMARK", "domain", "Vendor_PO_No", "Vendor_PO_Date", "Address", "Alchemy PO"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44
      ) RETURNING *`,
      [
        routingData['Sl.No'], validateDateField(routingData['Costing Date']), routingData['IBM / KYNDRYL'],
        routingData['Requestor'] || null, routingData['Department SPOC'] || null, routingData['SPOC E-mail ID'] || null,
        routingData['Training / Services Details'] || null, routingData['Description'] || null,
        routingData['IBM / KYNDRYL PO No'] || null, validateDateField(routingData['IBM / KYNDRYL PO Date']),
        validateNumericField(routingData['IBM / KYNDRYL PO Value']), validateNumericField(routingData['Integration %']),
        validateNumericField(routingData['Integrator Charges (Margin)']), validateNumericField(routingData['Alchemy Billing Value']),
        validateNumericField(routingData['Funding cost']), validateNumericField(routingData['Net Margin']), validateBillingMonth(routingData['Billing Month']),
        routingData["Payment Day's"] || null, routingData['Vendor Details'] || null, routingData['Vendor SPOC'] || null,
        routingData['Vendor SPOC Contact No'] || null, routingData['Vendor SPOC E-mail ID'] || null,
        validateDateField(routingData['Training Dates']), routingData['Vendor Inv. No.'] || null, validateDateField(routingData['Vendor Inv. Date']),
        validateNumericField(routingData['Vendor Inv. Amount']), validateNumericField(routingData['GST @ 18%']), validateNumericField(routingData['Total Invoice']),
        validateNumericField(routingData['Vendor Amount After TDS 10%']), validateNumericField(routingData['Net Payment to Vendor']),
        validateDateField(routingData['Payment Due Date']), routingData['Alchemy Techsol Invoive No'] || null,
        validateDateField(routingData['Alchemy Techsol Invoice Date']), validateNumericField(routingData['Alchemy Techsol Invoice Amount']),
        validateDateField(routingData['Payment Expected Date (IBM)']), routingData['Cheque Issued Name'] || null,
        validateDateField(routingData['Cheque Date']), routingData['Cheque No'] || null, routingData['REMARK'] || null,
        routingData['domain'] || null, routingData['Vendor_PO_No'] || null, validateDateField(routingData['Vendor_PO_Date']),
        routingData['Address'] || null, routingData['Alchemy PO'] || null
      ]
    );

    logger.info('Routing record created', { recordId: result.rows[0].id });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PATCH routes for updating records
app.patch('/api/Active/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    // Define date and numeric fields for validation
    const dateFields = ['active_ob_month', 'active_doj'];
    const numericFields = ['active_po_value', 'active_vendor_value', 'active_gross_margin', 'active_gm_percentage'];
    
    // Process updates with validation
    const fields = Object.keys(updates);
    const values = fields.map(field => {
      const value = updates[field];
      
      if (dateFields.includes(field)) {
        return validateDateField(value);
      } else if (numericFields.includes(field)) {
        return validateNumericField(value);
      }
      return value || null;
    });
    
    const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
    const query = `UPDATE active SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`;
    
    const result = await executeQuery(query, [...values, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    logger.info('Active record patched', { recordId: id });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

app.patch('/api/Attrition/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    // Define date and numeric fields for validation
    const dateFields = ['attrition_b_month', 'attrition_doj', 'attrition_month', 'attrition_date'];
    const numericFields = ['attrition_po_value', 'attrition_vendor_value', 'attrition_gross_margin', 'attrition_gm_percentage'];
    
    // Process updates with validation
    const fields = Object.keys(updates);
    const values = fields.map(field => {
      const value = updates[field];
      
      if (dateFields.includes(field)) {
        return validateDateField(value);
      } else if (numericFields.includes(field)) {
        return validateNumericField(value);
      }
      return value || null;
    });
    
    const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
    const query = `UPDATE attrition SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`;
    
    const result = await executeQuery(query, [...values, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    logger.info('Attrition record patched', { recordId: id });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE endpoints
app.delete('/api/Active/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await executeQuery('DELETE FROM active WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    logger.info('Active record deleted', { recordId: id });
    res.json({ message: 'Record deleted successfully', deletedRecord: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/Attrition/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await executeQuery('DELETE FROM attrition WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    logger.info('Attrition record deleted', { recordId: id });
    res.json({ message: 'Record deleted successfully', deletedRecord: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// CTS Summary Report Route - Aggregates data from Active and Attrition tables
app.get('/api/CTS-Summary', async (req, res, next) => {
  try {
    // First, let's check if tables exist and have data
    const checkActive = await executeQuery('SELECT COUNT(*) as count FROM active');
    const checkAttrition = await executeQuery('SELECT COUNT(*) as count FROM attrition');
    const checkAttritionWithMonth = await executeQuery('SELECT COUNT(*) as count FROM attrition WHERE attrition_month IS NOT NULL');
    const checkAttritionWithoutMonth = await executeQuery('SELECT COUNT(*) as count FROM attrition WHERE attrition_month IS NULL');
    
    // Check sample attrition records to see what fields are populated
    const sampleAttrition = await executeQuery(`
      SELECT 
        id, 
        attrition_employee_name, 
        attrition_month, 
        attrition_b_month,
        attrition_po_value,
        attrition_vendor_value,
        attrition_gross_margin
      FROM attrition 
      ORDER BY id DESC 
      LIMIT 5
    `);
    
    logger.info('CTS Summary - Table check', {
      activeCount: checkActive.rows[0]?.count || 0,
      attritionCount: checkAttrition.rows[0]?.count || 0,
      attritionWithMonth: checkAttritionWithMonth.rows[0]?.count || 0,
      attritionWithoutMonth: checkAttritionWithoutMonth.rows[0]?.count || 0,
      sampleAttritionRecords: sampleAttrition.rows
    });
    
    // Warn if attrition records exist but don't have attrition_month populated
    if (checkAttrition.rows[0]?.count > 0 && checkAttritionWithMonth.rows[0]?.count === 0) {
      logger.warn('CTS Summary - WARNING: Attrition records exist but none have attrition_month populated. These records will not appear in the summary report.');
    }

    // Query to aggregate data from Active and Attrition tables grouped by Month & Year
    const query = `
      WITH active_summary AS (
        SELECT 
          TO_CHAR(active_ob_month, 'YYYY-MM') as month_year,
          EXTRACT(YEAR FROM active_ob_month)::INTEGER as year,
          EXTRACT(MONTH FROM active_ob_month)::INTEGER as month,
          COUNT(DISTINCT CASE WHEN active_employee_name IS NOT NULL AND active_employee_name != '' THEN active_employee_name END) as ob_hc,
          COALESCE(SUM(active_po_value), 0) as ob_po_value,
          COALESCE(SUM(active_vendor_value), 0) as ob_vendor_po_value,
          COALESCE(SUM(active_gross_margin), 0) as active_gross_margin
        FROM active
        WHERE active_ob_month IS NOT NULL
        GROUP BY TO_CHAR(active_ob_month, 'YYYY-MM'), EXTRACT(YEAR FROM active_ob_month), EXTRACT(MONTH FROM active_ob_month)
      ),
      attrition_summary AS (
        SELECT 
          TO_CHAR(attrition_month, 'YYYY-MM') as month_year,
          EXTRACT(YEAR FROM attrition_month)::INTEGER as year,
          EXTRACT(MONTH FROM attrition_month)::INTEGER as month,
          COUNT(DISTINCT CASE WHEN attrition_employee_name IS NOT NULL AND attrition_employee_name != '' THEN attrition_employee_name END) as attrition_hc,
          COALESCE(SUM(attrition_po_value), 0) as attrition_po_value,
          COALESCE(SUM(attrition_vendor_value), 0) as attrition_vendor_po_value,
          COALESCE(SUM(attrition_gross_margin), 0) as attrition_gross_margin
        FROM attrition
        WHERE attrition_month IS NOT NULL
        GROUP BY TO_CHAR(attrition_month, 'YYYY-MM'), EXTRACT(YEAR FROM attrition_month), EXTRACT(MONTH FROM attrition_month)
      ),
      historical_summary AS (
        SELECT 
          month_year,
          year,
          month,
          "OB - HC" as ob_hc,
          "Attrition - HC" as attrition_hc,
          "Net - HC" as net_hc,
          "OB - PO Value" as ob_po_value,
          "Attrition PO Value" as attrition_po_value,
          "Net - OB PO Value" as net_ob_po_value,
          "OB - Vendor PO Value" as ob_vendor_po_value,
          "Attrition Vendor PO Value" as attrition_vendor_po_value,
          "Net Vendor Po Value" as net_vendor_po_value,
          "Month OB Margin (Month)" as active_gross_margin,
          "Month Net Margin (Month)" as attrition_gross_margin,
          -- Cumulative columns (stored directly)
          "Current HC" as current_hc,
          "Current PO Value" as current_po_value,
          "Current Vendor Cost" as current_vendor_cost,
          "Current Margin" as current_margin,
          "%- Margin" as margin_percentage
        FROM cts_summary_historical
      ),
      all_months AS (
        SELECT month_year, year, month FROM active_summary
        UNION
        SELECT month_year, year, month FROM attrition_summary
        UNION
        SELECT month_year, year, month FROM historical_summary
      ),
      monthly_data AS (
        SELECT 
          am.month_year as "Month & Year",
          am.year,
          am.month,
          -- Use historical data if available, otherwise use active/attrition data
          -- OB-HC: Prefer historical, then active summary
          COALESCE(h.ob_hc, a.ob_hc, 0) as "OB - HC",
          -- Attrition HC: Prefer historical, then attrition summary
          COALESCE(h.attrition_hc, attr.attrition_hc, 0) as "Attrition - HC",
          -- Net-HC: Use historical if available, otherwise calculate from active/attrition
          COALESCE(h.net_hc, COALESCE(a.ob_hc, 0) - COALESCE(attr.attrition_hc, 0), 0) as "Net - HC",
          -- OB-PO Value: Prefer historical, then active summary
          COALESCE(h.ob_po_value, a.ob_po_value, 0) as "OB - PO Value",
          -- Attrition PO Value: Prefer historical, then attrition summary
          COALESCE(h.attrition_po_value, attr.attrition_po_value, 0) as "Attrition PO Value",
          -- Net OB PO Value: Use historical if available, otherwise calculate
          COALESCE(h.net_ob_po_value, COALESCE(a.ob_po_value, 0) - COALESCE(attr.attrition_po_value, 0), 0) as "Net - OB PO Value",
          -- OB-Vendor PO Value: Prefer historical, then active summary
          COALESCE(h.ob_vendor_po_value, a.ob_vendor_po_value, 0) as "OB - Vendor PO Value",
          -- Attrition Vendor PO Value: Prefer historical, then attrition summary
          COALESCE(h.attrition_vendor_po_value, attr.attrition_vendor_po_value, 0) as "Attrition Vendor PO Value",
          -- Net Vendor PO Value: Use historical if available, otherwise calculate
          COALESCE(h.net_vendor_po_value, COALESCE(a.ob_vendor_po_value, 0) - COALESCE(attr.attrition_vendor_po_value, 0), 0) as "Net Vendor Po Value",
          -- Month OB Margin (Month): Prefer historical, then active summary
          COALESCE(h.active_gross_margin, a.active_gross_margin, 0) as "Month OB Margin (Month)",
          -- Month Net Margin (Month): Prefer historical, then attrition summary
          COALESCE(h.attrition_gross_margin, attr.attrition_gross_margin, 0) as "Month Net Margin (Month)"
        FROM all_months am
        LEFT JOIN active_summary a ON am.month_year = a.month_year
        LEFT JOIN attrition_summary attr ON am.month_year = attr.month_year
        LEFT JOIN historical_summary h ON am.month_year = h.month_year
      ),
      monthly_with_historical AS (
        SELECT 
          md.*,
          -- Get historical cumulative values for current row
          h.current_hc as hist_current_hc,
          h.current_po_value as hist_current_po_value,
          h.current_vendor_cost as hist_current_vendor_cost,
          h.current_margin as hist_current_margin,
          h.margin_percentage as hist_margin_percentage
        FROM monthly_data md
        LEFT JOIN historical_summary h ON md."Month & Year" = h.month_year
        ORDER BY md.year ASC, md.month ASC
      ),
      cumulative_step1 AS (
        SELECT 
          mwh.*,
          -- Step 1: Calculate cumulative values row by row
          -- For historical rows: use historical value
          -- For first non-historical row: use last historical + current net
          -- For subsequent rows: we'll build on this in step 2
          CASE 
            WHEN mwh.hist_current_hc IS NOT NULL THEN mwh.hist_current_hc
            ELSE COALESCE(
              MAX(mwh.hist_current_hc) OVER (
                ORDER BY mwh.year ASC, mwh.month ASC 
                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
              ),
              0
            ) + mwh."Net - HC"
          END as step1_current_hc,
          CASE 
            WHEN mwh.hist_current_po_value IS NOT NULL THEN mwh.hist_current_po_value
            ELSE COALESCE(
              MAX(mwh.hist_current_po_value) OVER (
                ORDER BY mwh.year ASC, mwh.month ASC 
                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
              ),
              0
            ) + mwh."Net - OB PO Value"
          END as step1_current_po_value,
          CASE 
            WHEN mwh.hist_current_vendor_cost IS NOT NULL THEN mwh.hist_current_vendor_cost
            ELSE COALESCE(
              MAX(mwh.hist_current_vendor_cost) OVER (
                ORDER BY mwh.year ASC, mwh.month ASC 
                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
              ),
              0
            ) + mwh."Net Vendor Po Value"
          END as step1_current_vendor_cost,
          CASE 
            WHEN mwh.hist_current_margin IS NOT NULL THEN mwh.hist_current_margin
            ELSE COALESCE(
              MAX(mwh.hist_current_margin) OVER (
                ORDER BY mwh.year ASC, mwh.month ASC 
                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
              ),
              0
            ) + mwh."Month Net Margin (Month)"
          END as step1_current_margin
        FROM monthly_with_historical mwh
      ),
      cumulative_calculated AS (
        SELECT 
          cs1.*,
          -- Step 2: Use previous row's calculated cumulative + current net
          -- Current HC = Previous month's Current HC + Current month's Net HC
          CASE 
            WHEN cs1.hist_current_hc IS NOT NULL THEN cs1.hist_current_hc
            ELSE COALESCE(
              -- Get previous row's cumulative value (from step1, which has historical or calculated)
              LAG(cs1.step1_current_hc) OVER (ORDER BY cs1.year ASC, cs1.month ASC),
              -- If no previous row, use last historical value
              MAX(cs1.hist_current_hc) OVER (
                ORDER BY cs1.year ASC, cs1.month ASC 
                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
              ),
              0
            ) + cs1."Net - HC"
          END as "Current HC",
          -- Current PO Value = Previous month's Current PO Value + Current month's Net OB PO Value
          CASE 
            WHEN cs1.hist_current_po_value IS NOT NULL THEN cs1.hist_current_po_value
            ELSE COALESCE(
              LAG(cs1.step1_current_po_value) OVER (ORDER BY cs1.year ASC, cs1.month ASC),
              MAX(cs1.hist_current_po_value) OVER (
                ORDER BY cs1.year ASC, cs1.month ASC 
                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
              ),
              0
            ) + cs1."Net - OB PO Value"
          END as "Current PO Value",
          -- Current Vendor Cost = Previous month's Current Vendor Cost + Current month's Net Vendor PO Value
          CASE 
            WHEN cs1.hist_current_vendor_cost IS NOT NULL THEN cs1.hist_current_vendor_cost
            ELSE COALESCE(
              LAG(cs1.step1_current_vendor_cost) OVER (ORDER BY cs1.year ASC, cs1.month ASC),
              MAX(cs1.hist_current_vendor_cost) OVER (
                ORDER BY cs1.year ASC, cs1.month ASC 
                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
              ),
              0
            ) + cs1."Net Vendor Po Value"
          END as "Current Vendor Cost",
          -- Current Margin = Previous month's Current Margin + Current month's Month Net Margin
          CASE 
            WHEN cs1.hist_current_margin IS NOT NULL THEN cs1.hist_current_margin
            ELSE COALESCE(
              LAG(cs1.step1_current_margin) OVER (ORDER BY cs1.year ASC, cs1.month ASC),
              MAX(cs1.hist_current_margin) OVER (
                ORDER BY cs1.year ASC, cs1.month ASC 
                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
              ),
              0
            ) + cs1."Month Net Margin (Month)"
          END as "Current Margin"
        FROM cumulative_step1 cs1
      )
      SELECT 
        cc.*,
        -- Calculate % Margin: Current Margin / Current PO Value * 100
        COALESCE(
          cc.hist_margin_percentage,
          CASE 
            WHEN cc."Current PO Value" != 0
            THEN (cc."Current Margin" / cc."Current PO Value") * 100
            ELSE 0
          END
        ) as "%- Margin"
      FROM cumulative_calculated cc
      ORDER BY cc.year DESC, cc.month DESC
    `;
    
    // Debug: Check attrition_summary CTE separately
    try {
      const attritionSummaryCheck = await executeQuery(`
        SELECT 
          TO_CHAR(attrition_month, 'YYYY-MM') as month_year,
          EXTRACT(YEAR FROM attrition_month)::INTEGER as year,
          EXTRACT(MONTH FROM attrition_month)::INTEGER as month,
          COUNT(DISTINCT CASE WHEN attrition_employee_name IS NOT NULL AND attrition_employee_name != '' THEN attrition_employee_name END) as attrition_hc,
          COALESCE(SUM(attrition_po_value), 0) as attrition_po_value,
          COALESCE(SUM(attrition_vendor_value), 0) as attrition_vendor_po_value,
          COALESCE(SUM(attrition_gross_margin), 0) as attrition_gross_margin
        FROM attrition
        WHERE attrition_month IS NOT NULL
        GROUP BY TO_CHAR(attrition_month, 'YYYY-MM'), EXTRACT(YEAR FROM attrition_month), EXTRACT(MONTH FROM attrition_month)
        ORDER BY month_year DESC
      `);
      
      const activeSummaryCheck = await executeQuery(`
        SELECT 
          TO_CHAR(active_ob_month, 'YYYY-MM') as month_year,
          EXTRACT(YEAR FROM active_ob_month)::INTEGER as year,
          EXTRACT(MONTH FROM active_ob_month)::INTEGER as month,
          COUNT(DISTINCT CASE WHEN active_employee_name IS NOT NULL AND active_employee_name != '' THEN active_employee_name END) as ob_hc,
          COALESCE(SUM(active_po_value), 0) as ob_po_value
        FROM active
        WHERE active_ob_month IS NOT NULL
        GROUP BY TO_CHAR(active_ob_month, 'YYYY-MM'), EXTRACT(YEAR FROM active_ob_month), EXTRACT(MONTH FROM active_ob_month)
        ORDER BY month_year DESC
      `);
      
      logger.info('CTS Summary - Debug CTE check', {
        attritionSummaryRows: attritionSummaryCheck.rows.length,
        attritionSummaryData: attritionSummaryCheck.rows,
        activeSummaryRows: activeSummaryCheck.rows.length,
        activeSummaryData: activeSummaryCheck.rows,
        attritionTotalRecords: await executeQuery('SELECT COUNT(*) as count FROM attrition').then(r => r.rows[0].count),
        attritionWithMonth: await executeQuery('SELECT COUNT(*) as count FROM attrition WHERE attrition_month IS NOT NULL').then(r => r.rows[0].count),
        activeTotalRecords: await executeQuery('SELECT COUNT(*) as count FROM active').then(r => r.rows[0].count),
        activeWithMonth: await executeQuery('SELECT COUNT(*) as count FROM active WHERE active_ob_month IS NOT NULL').then(r => r.rows[0].count)
      });
    } catch (debugErr) {
      logger.error('CTS Summary - CTE debug query failed', { error: debugErr.message, stack: debugErr.stack });
    }
    
    logger.info('CTS Summary - Executing query');
    const result = await executeQuery(query);
    
    logger.info('CTS Summary report fetched', { 
      recordCount: result.rows.length,
      sampleRecord: result.rows.length > 0 ? result.rows[0] : null,
      sampleAttritionFields: result.rows.length > 0 ? {
        'Attrition - HC': result.rows[0]['Attrition - HC'],
        'Attrition PO Value': result.rows[0]['Attrition PO Value'],
        'Attrition Vendor PO Value': result.rows[0]['Attrition Vendor PO Value'],
        'Month Net Margin (Month)': result.rows[0]['Month Net Margin (Month)']
      } : null
    });
    
    if (result.rows.length === 0) {
      logger.warn('CTS Summary - No data returned. Checking raw data...');
      try {
        const activeData = await executeQuery(`
          SELECT 
            active_ob_month, 
            COUNT(*) as count,
            COUNT(DISTINCT active_employee_name) as distinct_employees,
            SUM(active_po_value) as total_po
          FROM active 
          GROUP BY active_ob_month 
          ORDER BY active_ob_month DESC 
          LIMIT 5
        `);
        const attritionData = await executeQuery(`
          SELECT 
            attrition_month, 
            COUNT(*) as count,
            COUNT(DISTINCT attrition_employee_name) as distinct_employees,
            SUM(attrition_po_value) as total_po
          FROM attrition 
          GROUP BY attrition_month 
          ORDER BY attrition_month DESC 
          LIMIT 5
        `);
        logger.info('CTS Summary - Raw data check', {
          activeRecords: activeData.rows,
          attritionRecords: attritionData.rows,
          activeTotal: await executeQuery('SELECT COUNT(*) as count FROM active').then(r => r.rows[0].count),
          attritionTotal: await executeQuery('SELECT COUNT(*) as count FROM attrition').then(r => r.rows[0].count)
        });
      } catch (debugErr) {
        logger.error('CTS Summary - Debug query failed', { error: debugErr.message });
      }
    }
    
    res.json(result.rows);
  } catch (err) {
    logger.error('Error fetching CTS Summary report', { error: err.message, stack: err.stack });
    next(err);
  }
});

// CTS Summary Historical - GET all historical records (for display in summary sheet)
app.get('/api/CTS-Summary-Historical', async (req, res, next) => {
  try {
    const query = `
      SELECT * FROM cts_summary_historical
      ORDER BY year ASC, month ASC
    `;
    const result = await executeQuery(query);
    logger.info('CTS Summary Historical records fetched', { recordCount: result.rows.length });
    res.json(result.rows);
  } catch (err) {
    logger.error('Error fetching CTS Summary Historical records', { error: err.message, stack: err.stack });
    next(err);
  }
});

app.patch('/api/Alchemy_Routing/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Normalize date fields to YYYY-MM-DD (table edit sends DD-MM-YYYY)
    const dateFields = [
      'Costing Date', 'IBM / KYNDRYL PO Date', 'Training Dates', 'Vendor Inv. Date',
      'Payment Due Date', 'Alchemy Techsol Invoice Date', 'Payment Expected Date (IBM)',
      'Cheque Date', 'Vendor_PO_Date'
    ];
    const toISODate = (value) => {
      if (!value || value === '' || value === 'null' || value === 'undefined') return null;
      const s = String(value).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(s)) {
        const [d, m, y] = s.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        if (!isNaN(date.getTime())) return toLocalYYYYMMDD(date);
      }
      const date = new Date(value);
      if (!isNaN(date.getTime())) return toLocalYYYYMMDD(date);
      return null;
    };
    
    // Specialized function to validate and convert billing month
    const validateBillingMonth = (value) => {
      if (!value || value === '' || value === 'null' || value === 'undefined') {
        return null;
      }
      
      // Handle MMM-YY format (e.g., "Sep-24", "Jan-25")
      if (typeof value === 'string' && /^[A-Za-z]{3}-\d{2}$/.test(value)) {
        const [monthStr, yearStr] = value.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthIndex = monthNames.findIndex(m => m.toLowerCase() === monthStr.toLowerCase());
        
        if (monthIndex !== -1) {
          // Convert 2-digit year to 4-digit year
          const fullYear = 2000 + parseInt(yearStr);
          const date = new Date(fullYear, monthIndex, 1); // First day of the month
          return toLocalYYYYMMDD(date); // Return YYYY-MM-DD format
        }
      }
      
      // Handle Excel serial numbers (5-digit numbers like 45532, 45565)
      if (!isNaN(value) && value > 1000 && value < 100000) {
        // Excel serial number conversion
        const excelEpoch = new Date(1899, 11, 30); // December 30, 1899
        const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
        
        if (!isNaN(date.getTime())) {
          // Return the first day of the month in YYYY-MM-DD format
          const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
          return toLocalYYYYMMDD(firstDayOfMonth);
        }
      }
      
      // Try standard date parsing and convert to first day of month
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        return toLocalYYYYMMDD(firstDayOfMonth);
      }
      
      return null;
    };
    
    // Numeric fields: strip commas (e.g. "2,99,295") and send number so DB does not 500
    const numericFields = [
      'IBM / KYNDRYL PO Value', 'Integration %', 'Integrator Charges (Margin)', 'Alchemy Billing Value',
      'Funding cost', 'Net Margin', 'Vendor Inv. Amount', 'GST @ 18%', 'Total Invoice',
      'Vendor Amount After TDS 10%', 'Net Payment to Vendor', 'Alchemy Techsol Invoice Amount'
    ];
    const toNumeric = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const s = String(value).trim().replace(/,/g, '');
      if (s === '' || s.toLowerCase() === 'null') return null;
      const n = parseFloat(s);
      return isNaN(n) ? null : n;
    };

    // Process updates: normalize date, numeric, and billing month
    const processedUpdates = { ...updates };
    for (const field of dateFields) {
      if (processedUpdates[field] !== undefined) {
        processedUpdates[field] = toISODate(processedUpdates[field]);
      }
    }
    for (const field of numericFields) {
      if (processedUpdates[field] !== undefined) {
        processedUpdates[field] = toNumeric(processedUpdates[field]);
      }
    }
    if (processedUpdates['Billing Month']) {
      processedUpdates['Billing Month'] = validateBillingMonth(processedUpdates['Billing Month']);
    }
    
    // Build dynamic update query
    const fields = Object.keys(processedUpdates);
    const values = Object.values(processedUpdates);
    
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    const setClause = fields.map((field, index) => `"${field}" = $${index + 1}`).join(', ');
    const query = `UPDATE "Alchemy_Routing" SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`;
    
    const result = await executeQuery(query, [...values, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    logger.info('Routing record patched', { recordId: id });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

app.delete('/api/Alchemy_Routing/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await executeQuery('DELETE FROM "Alchemy_Routing" WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    logger.info('Alchemy Routing record deleted', { recordId: id });
    res.status(200).json({ message: 'Record deleted', id: Number(id) });
  } catch (err) {
    next(err);
  }
});

app.patch('/api/team-report/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Build dynamic update query
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
    const query = `UPDATE team_report SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`;
    
    const result = await executeQuery(query, [...values, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    logger.info('Team report record patched', { recordId: id });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Forgot Password endpoint
app.post('/api/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Check if user exists
    const result = await executeQuery('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // In a real application, you would send a password reset email here
    // For now, we'll just return a success message
    logger.info('Password reset requested', { email });
    
    res.json({
      success: true,
      message: 'Password reset instructions sent to your email'
    });
  } catch (err) {
    next(err);
  }
});

// Reset Password endpoint - allows admin to change user password by email
app.post('/api/reset-password', async (req, res, next) => {
  try {
    const { email, newPassword } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        error: 'New password is required'
      });
    }

    // Check if user exists
    const userResult = await executeQuery('SELECT * FROM users WHERE email = $1', [email]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found with the provided email'
      });
    }

    // Update password
    const updateResult = await executeQuery(
      'UPDATE users SET password = $1 WHERE email = $2 RETURNING id, name, email',
      [newPassword, email]
    );

    if (updateResult.rows.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update password'
      });
    }

    logger.info('Password reset successfully', { email, userId: updateResult.rows[0].id });
    
    res.json({
      success: true,
      message: 'Password has been reset successfully',
      user: {
        id: updateResult.rows[0].id,
        name: updateResult.rows[0].name,
        email: updateResult.rows[0].email
      }
    });
  } catch (err) {
    logger.error('Password reset error', { error: err.message, stack: err.stack });
    next(err);
  }
});

// Bulk Alchemy Routing endpoint
app.post('/api/Alchemy_Routing/bulk', async (req, res, next) => {
  try {
    const { data } = req.body;
    
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid data format. Expected non-empty array.'
      });
    }

    const validateDateField = (value) => {
      if (!value || value === '' || value === 'null' || value === 'undefined' || value === '1') {
        return null;
      }
      const str = String(value).trim();
      // Frontend sends YYYY-MM-DD; accept as-is
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
      // Treat text "NA" (not a date) as null
      if (str.toUpperCase() === 'NA') return null;
      // Reject numeric strings that are clearly not dates (e.g. "00", "1800" in PO Date column)
      const numVal = typeof value === 'string' ? parseFloat(value) : value;
      if (!isNaN(numVal) && (numVal < 1000 || numVal === 0)) {
        return null;
      }

      // Handle date ranges (e.g., "08-11-2024 to 12-11-2024" -> use start date, return YYYY-MM-DD)
      if (typeof value === 'string' && value.includes(' to ')) {
        const startDateStr = value.split(' to ')[0].trim();
        if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(startDateStr)) {
          const [d, m, y] = startDateStr.split('-').map(Number);
          const date = new Date(y, m - 1, d);
          if (!isNaN(date.getTime())) {
            return toLocalYYYYMMDD(date);
          }
        }
        const date = new Date(startDateStr);
        if (!isNaN(date.getTime())) {
          return toLocalYYYYMMDD(date);
        }
      }

      // Handle dd-mmm-yy format (e.g., "13-Aug-24")
      if (typeof value === 'string' && /^\d{1,2}-[A-Za-z]{3}-\d{2}$/.test(value)) {
        const [day, month, year] = value.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthIndex = monthNames.findIndex(m => m.toLowerCase() === month.toLowerCase());
        
        if (monthIndex !== -1) {
          // Convert 2-digit year to 4-digit year
          const fullYear = parseInt(year) < 50 ? 2000 + parseInt(year) : 1900 + parseInt(year);
          const date = new Date(fullYear, monthIndex, parseInt(day));
          if (!isNaN(date.getTime())) {
            return toLocalYYYYMMDD(date); // Return YYYY-MM-DD format
          }
        }
      }
      
      // Handle dd-mm-yyyy format (e.g., "13-08-2024")
      if (typeof value === 'string' && /^\d{1,2}-\d{1,2}-\d{4}$/.test(value)) {
        const [day, month, year] = value.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(date.getTime())) {
          return toLocalYYYYMMDD(date); // Return YYYY-MM-DD format
        }
      }
      
      // Handle Excel serial numbers (only accept if result is reasonable date year 1990-2030)
      if (!isNaN(value) && value > 1000 && value < 100000) {
        const excelDate = new Date((value - 25569) * 86400 * 1000);
        if (!isNaN(excelDate.getTime())) {
          const year = excelDate.getFullYear();
          if (year >= 1990 && year <= 2030) {
            return toLocalYYYYMMDD(excelDate);
          }
        }
      }
      
      // Try standard date parsing
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return toLocalYYYYMMDD(date); // Return YYYY-MM-DD format
      }
      
      return null;
    };

    const validateNumericField = (value) => {
      if (!value || value === '' || value === 'null' || value === 'undefined') {
        return null;
      }
      
      // Handle percentage values (e.g., "10%" -> 10)
      if (typeof value === 'string' && value.includes('%')) {
        const numericValue = parseFloat(value.replace('%', ''));
        return isNaN(numericValue) ? null : numericValue;
      }
      
      // If it's a string that's not a valid number, return null
      if (typeof value === 'string' && isNaN(parseFloat(value))) {
        return null;
      }
      return parseFloat(value);
    };

    // Billing Month: frontend sends YYYY-MM-DD; fallbacks for legacy/Excel
    const validateBillingMonth = (value) => {
      if (!value || value === '' || value === 'null' || value === 'undefined') return null;
      const str = String(value).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
      // Handle MMM-YY format (e.g., "Sep-24", "Jan-25")
      if (typeof value === 'string' && /^[A-Za-z]{3}-\d{2}$/.test(value)) {
        const [monthStr, yearStr] = value.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthIndex = monthNames.findIndex(m => m.toLowerCase() === monthStr.toLowerCase());
        if (monthIndex !== -1) {
          const fullYear = 2000 + parseInt(yearStr, 10);
          const date = new Date(fullYear, monthIndex, 1);
          return toLocalYYYYMMDD(date);
        }
      }
      // Handle Excel serial numbers (e.g. "45992" from Excel)
      const num = typeof value === 'string' ? parseFloat(value) : value;
      if (!isNaN(num) && num > 1000 && num < 100000) {
        const excelEpoch = new Date(1899, 11, 30);
        const date = new Date(excelEpoch.getTime() + num * 24 * 60 * 60 * 1000);
        if (!isNaN(date.getTime())) {
          const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
          return toLocalYYYYMMDD(firstDayOfMonth);
        }
      }
      // Handle dd-mm-yyyy
      if (typeof value === 'string' && /^\d{1,2}-\d{1,2}-\d{4}$/.test(value)) {
        const [day, month, year] = value.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) {
          const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
          return toLocalYYYYMMDD(firstDayOfMonth);
        }
      }
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        return toLocalYYYYMMDD(firstDayOfMonth);
      }
      return null;
    };

    // Use transaction for bulk insert
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const insertQuery = `INSERT INTO "Alchemy_Routing" (
        "Sl.No", "Costing Date", "IBM / KYNDRYL", "Requestor", "Department SPOC",
        "SPOC E-mail ID", "Training / Services Details", "Description",
        "IBM / KYNDRYL PO No", "IBM / KYNDRYL PO Date", "IBM / KYNDRYL PO Value",
        "Integration %", "Integrator Charges (Margin)",
        "Alchemy Billing Value", "Funding cost", "Net Margin", "Billing Month", "Payment Day's",
        "Vendor Details", "Vendor SPOC", "Vendor SPOC Contact No", "Vendor SPOC E-mail ID",
        "Training Dates", "Vendor Inv. No.", "Vendor Inv. Date", "Vendor Inv. Amount",
        "GST @ 18%", "Total Invoice", "Vendor Amount After TDS 10%",
        "Net Payment to Vendor", "Payment Due Date", "Alchemy Techsol Invoive No",
        "Alchemy Techsol Invoice Date", "Alchemy Techsol Invoice Amount", "Payment Expected Date (IBM)",
        "Cheque Issued Name", "Cheque Date", "Cheque No", "REMARK", "domain", "Vendor_PO_No", "Vendor_PO_Date", "Address", "Alchemy PO"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44
      )`;
      
      const toVal = (v) => (v === undefined ? null : v);

      for (let i = 0; i < data.length; i++) {
        const routingData = data[i];
        try {
          await client.query(insertQuery, [
            toVal(routingData['Sl.No']), validateDateField(routingData['Costing Date']), toVal(routingData['IBM / KYNDRYL']),
            routingData['Requestor'] || null, routingData['Department SPOC'] || null, routingData['SPOC E-mail ID'] || null,
            routingData['Training / Services Details'] || null, routingData['Description'] || null,
            routingData['IBM / KYNDRYL PO No'] || null, validateDateField(routingData['IBM / KYNDRYL PO Date']),
            validateNumericField(routingData['IBM / KYNDRYL PO Value']), validateNumericField(routingData['Integration %']),
            validateNumericField(routingData['Integrator Charges (Margin)']), validateNumericField(routingData['Alchemy Billing Value']),
            validateNumericField(routingData['Funding cost']), validateNumericField(routingData['Net Margin']), validateBillingMonth(routingData['Billing Month']),
            routingData["Payment Day's"] || null, routingData['Vendor Details'] || null, routingData['Vendor SPOC'] || null,
            routingData['Vendor SPOC Contact No'] || null, routingData['Vendor SPOC E-mail ID'] || null,
            validateDateField(routingData['Training Dates']), routingData['Vendor Inv. No.'] || null, validateDateField(routingData['Vendor Inv. Date']),
            validateNumericField(routingData['Vendor Inv. Amount']), validateNumericField(routingData['GST @ 18%']), validateNumericField(routingData['Total Invoice']),
            validateNumericField(routingData['Vendor Amount After TDS 10%']), validateNumericField(routingData['Net Payment to Vendor']),
            validateDateField(routingData['Payment Due Date']), routingData['Alchemy Techsol Invoive No'] || null,
            validateDateField(routingData['Alchemy Techsol Invoice Date']), validateNumericField(routingData['Alchemy Techsol Invoice Amount']),
            validateDateField(routingData['Payment Expected Date (IBM)']), routingData['Cheque Issued Name'] || null,
            validateDateField(routingData['Cheque Date']), routingData['Cheque No'] || null, routingData['REMARK'] || null,
            routingData['domain'] || null, routingData['Vendor_PO_No'] || null, validateDateField(routingData['Vendor_PO_Date']),
            routingData['Address'] || null, routingData['Alchemy PO'] || null
          ]);
        } catch (rowErr) {
          const detail = rowErr.detail || rowErr.message;
          throw new Error(`Row ${i + 1}: ${detail}`);
        }
      }
      
      await client.query('COMMIT');
      
      logger.info('Alchemy Routing bulk import completed', { 
        recordCount: data.length
      });
      
      res.status(201).json({
        success: true,
        message: `Successfully imported ${data.length} records`,
        insertedCount: data.length
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error('Alchemy Routing bulk import failed', {
      error: err.message,
      stack: err.stack,
      code: err.code,
      detail: err.detail
    });
    const message = err.detail || err.message || 'Unknown error';
    return res.status(500).json({
      success: false,
      error: 'Import failed',
      message: message
    });
  }
});

// Bulk-update dates only for existing Alchemy_Routing rows. Frontend sends YYYY-MM-DD; backend just passes through.
app.post('/api/Alchemy_Routing/bulk-update-dates', async (req, res, next) => {
  try {
    const { data } = req.body;
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid data format. Expected non-empty array.' });
    }
    const toDate = (v) => (v && String(v).trim() && /^\d{4}-\d{2}-\d{2}$/.test(String(v).trim()) ? String(v).trim() : null);
    const client = await pool.connect();
    let updatedCount = 0;
    try {
      for (const row of data) {
        const slNo = row['Sl.No'] != null ? String(row['Sl.No']).trim() : null;
        const ibmKyndryl = row['IBM / KYNDRYL'] != null ? String(row['IBM / KYNDRYL']).trim() : null;
        if (!slNo || !ibmKyndryl) continue;
        const findResult = await client.query(
          'SELECT id FROM "Alchemy_Routing" WHERE "Sl.No" = $1 AND "IBM / KYNDRYL" = $2 ORDER BY id DESC LIMIT 1',
          [slNo, ibmKyndryl]
        );
        if (findResult.rows.length === 0) continue;
        const id = findResult.rows[0].id;
        await client.query(
          `UPDATE "Alchemy_Routing" SET
            "Costing Date" = COALESCE($2, "Costing Date"),
            "Billing Month" = COALESCE($3, "Billing Month"),
            "IBM / KYNDRYL PO Date" = COALESCE($4, "IBM / KYNDRYL PO Date"),
            "Training Dates" = COALESCE($5, "Training Dates"),
            "Vendor Inv. Date" = COALESCE($6, "Vendor Inv. Date"),
            "Payment Due Date" = COALESCE($7, "Payment Due Date"),
            "Alchemy Techsol Invoice Date" = COALESCE($8, "Alchemy Techsol Invoice Date"),
            "Payment Expected Date (IBM)" = COALESCE($9, "Payment Expected Date (IBM)"),
            "Cheque Date" = COALESCE($10, "Cheque Date"),
            "Vendor_PO_Date" = COALESCE($11, "Vendor_PO_Date")
          WHERE id = $1`,
          [
            id,
            toDate(row['Costing Date']),
            toDate(row['Billing Month']),
            toDate(row['IBM / KYNDRYL PO Date']),
            toDate(row['Training Dates']),
            toDate(row['Vendor Inv. Date']),
            toDate(row['Payment Due Date']),
            toDate(row['Alchemy Techsol Invoice Date']),
            toDate(row['Payment Expected Date (IBM)']),
            toDate(row['Cheque Date']),
            toDate(row['Vendor_PO_Date'])
          ]
        );
        updatedCount += 1;
      }
    } finally {
      client.release();
    }
    logger.info('Alchemy Routing bulk-update-dates completed', { updatedCount, totalRows: data.length });
    return res.status(200).json({
      success: true,
      message: `Updated dates for ${updatedCount} existing record(s).`,
      updatedCount,
      totalInFile: data.length
    });
  } catch (err) {
    logger.error('Alchemy Routing bulk-update-dates failed', { error: err.message });
    return res.status(500).json({ success: false, error: 'Update failed', message: err.message || 'Unknown error' });
  }
});

// Team Report Routes

// Column formulas for GPM, NP (and %) by business unit - single source of truth for Client MFS / Team Report
const COLUMN_FORMULAS_BY_BU = [
  { businessUnits: ['MS', 'Managed Services'], gpmFormula: 'GPM = Revenue − Salary Cost', npFormula: null, description: 'NP is not calculated for MS / Managed Services.' },
  { businessUnits: ['USA'], gpmFormula: 'GPM = Revenue − Salary Cost − Rebate − Passthrough', npFormula: null, description: 'NP is not calculated for USA.' },
  { businessUnits: ['Japan'], gpmFormula: 'GPM = Revenue − Salary Cost − Discount', npFormula: null, description: 'NP is not calculated for Japan.' },
  { businessUnits: ['Canada', 'Singapore'], gpmFormula: 'GPM = Revenue − Salary Cost', npFormula: null, description: 'NP is not calculated for Canada, Singapore.' },
  { businessUnits: ['BPO|HTD', 'Captive', 'SI', 'Egg', 'Other'], gpmFormula: 'GPM = Revenue − Salary Cost − Leave Encashment', npFormula: 'NP = GPM − Team Cost − Opr Cost − Funding Cost', description: 'All other business units use this GPM and NP calculation.' }
];
const PERCENTAGE_FORMULAS = { gpm_percentage: 'GPM % = (GPM / Revenue) × 100', np_percentage: 'NP % = (NP / Revenue) × 100' };

app.get('/api/team-report/column-formulas', (req, res) => {
  try {
    const { business_unit: businessUnit } = req.query;
    let entries = COLUMN_FORMULAS_BY_BU;
    if (businessUnit && String(businessUnit).trim()) {
      const bu = String(businessUnit).trim().toLowerCase();
      if (['ms', 'managed services'].includes(bu)) entries = COLUMN_FORMULAS_BY_BU.filter(e => e.businessUnits.some(u => u.toLowerCase() === 'ms'));
      else if (bu === 'usa') entries = COLUMN_FORMULAS_BY_BU.filter(e => e.businessUnits.some(u => u.toLowerCase() === 'usa'));
      else if (bu === 'japan') entries = COLUMN_FORMULAS_BY_BU.filter(e => e.businessUnits.some(u => u.toLowerCase() === 'japan'));
      else if (['canada', 'singapore'].includes(bu)) entries = COLUMN_FORMULAS_BY_BU.filter(e => e.businessUnits.some(u => ['canada', 'singapore'].includes(u.toLowerCase())));
      else entries = COLUMN_FORMULAS_BY_BU.slice(-1).map(e => ({ ...e, businessUnits: [businessUnit.trim(), ...e.businessUnits] }));
    }
    const list = entries.map(e => ({
      businessUnit: e.businessUnits.join(', '),
      gpmFormula: e.gpmFormula,
      npFormula: e.npFormula ?? '—',
      gpmPctFormula: PERCENTAGE_FORMULAS.gpm_percentage,
      npPctFormula: PERCENTAGE_FORMULAS.np_percentage,
      description: e.description
    }));
    res.json({ success: true, data: list, percentageFormulas: PERCENTAGE_FORMULAS });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/team-report', async (req, res, next) => {
  try {
    const { designation, business_unit } = req.query;
    let query = 'SELECT * FROM team_report';
    let params = [];

    if (designation === 'BU HEAD' && business_unit) {
      // Normalize business unit for case-insensitive matching
      let normalizedBU = business_unit;
      const buTrimmed = String(business_unit).trim();
      const buLower = buTrimmed.toLowerCase();
      
      // Handle BPO|HTD variations (case-insensitive, with or without spaces)
      // Remove spaces around pipe/slash/dash for comparison
      const normalizedForComparison = buLower.replace(/\s*\|\s*/g, '|').replace(/\s*\/\s*/g, '/').replace(/\s*-\s*/g, '-');
      if (normalizedForComparison === 'bpo|htd' || normalizedForComparison === 'bpo/htd' || normalizedForComparison === 'bpo-htd') {
        normalizedBU = 'BPO|HTD';
      }
      // Handle other common variations
      else if (buLower === 'captive') {
        normalizedBU = 'Captive';
      }
      else if (buLower === 'canada') {
        normalizedBU = 'Canada';
      }
      else if (buLower === 'japan') {
        normalizedBU = 'Japan';
      }
      else if (buLower === 'singapore') {
        normalizedBU = 'Singapore';
      }
      else if (buLower === 'si' || buLower === 'si tech' || buLower === 'si bpo') {
        normalizedBU = 'SI';
      }
      else if (buLower === 'usa') {
        normalizedBU = 'USA';
      }
      else if (buLower === 'ms' || buLower === 'managed services' || buLower === 'managed  services') {
        normalizedBU = 'MS';
      }
      else if (buLower === 'egg' || buLower === 'engg' || buLower === 'engineering') {
        normalizedBU = 'Egg';
      }
      else if (buLower === 'all' || buLower === 'finance') {
        normalizedBU = 'Finance';
      }
      // For BPO|HTD, ensure it's stored in uppercase format (handle any case variation, including spaces)
      // Normalize spaces around pipe before checking
      const buNormalizedForCheck = buTrimmed.replace(/\s*\|\s*/g, '|');
      if (buNormalizedForCheck.toUpperCase() === 'BPO|HTD' || buNormalizedForCheck === 'BPO|HTD') {
        normalizedBU = 'BPO|HTD';
      }
      
      // Use case-insensitive comparison in SQL, also normalize spaces around pipe
      // Replace spaces around pipe for comparison (handles "BPO | HTD", "BPO|HTD", etc.)
      query += " WHERE LOWER(REGEXP_REPLACE(TRIM(business_unit), '\\s*\\|\\s*', '|', 'g')) = LOWER(REGEXP_REPLACE(TRIM($1), '\\s*\\|\\s*', '|', 'g'))";
      params.push(normalizedBU);
    }

    const result = await executeQuery(query, params);
    
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

app.post('/api/team-report', async (req, res, next) => {
    try {
      // Handle backward compatibility: if 'sales' is provided, use it as 'revenue'
      if (req.body.sales !== undefined && req.body.revenue === undefined) {
        req.body.revenue = req.body.sales;
      }
      
      const { 
        client_name, project_name, business_unit, bu_head, hc, 
        salary_cost, revenue, gpm, gpm_percentage, leave_encashment, 
        team_cost, opr_cost, funding_cost, np, np_percentage, 
        rebate, passthrough, vendor_cost, discount, month, year 
      } = req.body;
      
      // Validate required fields: month and year are compulsory
      if (!month || month === '') {
        return res.status(400).json({
          success: false,
          error: 'Month is missing or empty. Month is required.'
        });
      }
      
      // Handle year - can be 2-digit (23) or 4-digit (2023)
      let yearValue = typeof year === 'string' ? parseFloat(year) : year;
      if (yearValue && yearValue < 100) {
        // Convert 2-digit year to 4-digit (assume 2000s for years < 50, 1900s for years >= 50)
        yearValue = yearValue < 50 ? 2000 + yearValue : 1900 + yearValue;
        year = yearValue;
      }

      if (!year || year === 0) {
        return res.status(400).json({
          success: false,
          error: `Year is missing or invalid. Year is required. Month: ${month}, Year: ${year}`
        });
      }
      
      // Convert numeric fields to numbers (handle parentheses, commas, percentages)
      const numericFields = ['hc', 'salary_cost', 'revenue', 'gpm', 'gpm_percentage', 'leave_encashment', 'team_cost', 'opr_cost', 'funding_cost', 'np', 'np_percentage', 'rebate', 'passthrough', 'vendor_cost', 'discount'];
      const processedFields = {};
      for (const field of numericFields) {
        const value = req.body[field];
        if (value !== null && value !== undefined && value !== '') {
          if (typeof value === 'string') {
            // Handle negative numbers in parentheses, commas, percentages
            let strValue = value.trim();
            if (strValue === '-' || strValue === '########' || strValue === '') {
              processedFields[field] = 0;
            } else {
              if (strValue.startsWith('(') && strValue.endsWith(')')) {
                strValue = '-' + strValue.slice(1, -1);
              }
              if (strValue.endsWith('%')) {
                strValue = strValue.replace('%', '');
              }
              strValue = strValue.replace(/,/g, '');
              processedFields[field] = parseFloat(strValue) || 0;
            }
          } else {
            processedFields[field] = value || 0;
          }
        } else {
          processedFields[field] = 0;
        }
      }
      
      // Normalize month name to full name (e.g., "January", "April") - matching team_summary_report format
      const monthNames = {
        'January': 'January', 'February': 'February', 'March': 'March', 'April': 'April',
        'May': 'May', 'June': 'June', 'July': 'July', 'August': 'August',
        'September': 'September', 'October': 'October', 'November': 'November', 'December': 'December',
        'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April',
        'May': 'May', 'Jun': 'June', 'Jul': 'July', 'Aug': 'August',
        'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December'
      };
      
      // Full month names array for numeric conversion
      const fullMonthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      
      // Normalize month name (handle case variations and numeric values)
      let normalizedMonth = monthNames[month] || monthNames[month.charAt(0).toUpperCase() + month.slice(1).toLowerCase()];
      
      // Handle numeric month values (1-12 or 01-12)
      if (!normalizedMonth) {
        const monthStr = String(month).trim();
        const monthNum = parseInt(monthStr, 10);
        if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
          normalizedMonth = fullMonthNames[monthNum - 1]; // Convert 1-12 to 0-11 index
        }
      }
      
      if (!normalizedMonth) {
        return res.status(400).json({
          success: false,
          error: `Invalid month name "${month}". Valid months: January, February, March, April, May, June, July, August, September, October, November, December or numeric values 1-12`
        });
      }

      // Log the incoming data for debugging
      logger.info('Creating team report', { 
        client_name, project_name, business_unit, bu_head, hc, 
        salary_cost, revenue, gpm, gpm_percentage, leave_encashment, 
        team_cost, opr_cost, funding_cost, np, np_percentage, 
        rebate, passthrough, month, normalizedMonth, year 
      });
      
      // Check for exact duplicate (all columns match)
      const duplicateCheck = await executeQuery(
        `SELECT id FROM team_report WHERE 
         client_name = $1 AND project_name = $2 AND business_unit = $3 AND bu_head = $4 AND 
         hc = $5 AND salary_cost = $6 AND revenue = $7 AND gpm = $8 AND gpm_percentage = $9 AND 
         leave_encashment = $10 AND team_cost = $11 AND opr_cost = $12 AND funding_cost = $13 AND 
         np = $14 AND np_percentage = $15 AND rebate = $16 AND passthrough = $17 AND month = $18 AND year = $19`,
        [
          client_name === '' ? null : client_name,
          project_name === '' ? null : project_name,
          business_unit === '' ? null : business_unit,
          bu_head === '' ? null : bu_head,
          processedFields.hc,
          processedFields.salary_cost,
          processedFields.revenue,
          processedFields.gpm,
          processedFields.gpm_percentage,
          processedFields.leave_encashment,
          processedFields.team_cost,
          processedFields.opr_cost,
          processedFields.funding_cost,
          processedFields.np,
          processedFields.np_percentage,
          processedFields.rebate,
          processedFields.passthrough,
          normalizedMonth,
          year
        ]
      );

      if (duplicateCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Duplicate record detected. A record with identical data already exists.',
          duplicateId: duplicateCheck.rows[0].id
        });
      }

      const result = await executeQuery(
        `INSERT INTO team_report (
          client_name, project_name, business_unit, bu_head, hc,
          salary_cost, revenue, gpm, gpm_percentage, leave_encashment,
          team_cost, opr_cost, funding_cost, np, np_percentage, 
          rebate, passthrough, vendor_cost, discount, month, year
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21) RETURNING *`,
        [
          client_name === '' ? null : client_name,
          project_name === '' ? null : project_name,
          business_unit === '' ? null : business_unit,
          bu_head === '' ? null : bu_head,
          processedFields.hc,
          processedFields.salary_cost,
          processedFields.revenue,
          processedFields.gpm,
          processedFields.gpm_percentage,
          processedFields.leave_encashment,
          processedFields.team_cost,
          processedFields.opr_cost,
          processedFields.funding_cost,
          processedFields.np,
          processedFields.np_percentage,
          processedFields.rebate,
          processedFields.passthrough,
          processedFields.vendor_cost ?? 0,
          processedFields.discount ?? 0,
          normalizedMonth,
          year
        ]
      );
      
      logger.info('Team report created', { recordId: result.rows[0].id });
      res.status(201).json(result.rows[0]);
    } catch (err) {
      logger.error('Failed to create team report', { 
        error: err.message, 
        stack: err.stack,
        sqlError: err.code,
        detail: err.detail,
        body: req.body 
      });
      next(err);
    }
  }
);

// Bulk import endpoint for team report
app.post('/api/team-report/bulk', async (req, res, next) => {
  try {
    const { data } = req.body;
    
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid data format. Expected non-empty array.'
      });
    }

    // Limit batch size to prevent server overload
    if (data.length > 1000) {
      return res.status(400).json({
        success: false,
        error: `Batch size too large. Maximum 1000 records per batch. Received ${data.length} records. Please split your data into smaller batches.`
      });
    }

    // Helper function to normalize business unit name (title case)
    const normalizeBusinessUnitName = (name) => {
      if (!name || name === '') return null;
      const trimmed = String(name).trim();
      if (trimmed === '') return null;
      // Convert to title case: first letter uppercase, rest lowercase
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
    };

    // Process and validate each record - allow null values for all fields
    for (let i = 0; i < data.length; i++) {
      const record = data[i];
      
      // Normalize business unit name to title case
      if (record.business_unit) {
        record.business_unit = normalizeBusinessUnitName(record.business_unit);
      }
      
      // Handle backward compatibility: if 'sales' is provided, use it as 'revenue'
      if (record.sales !== undefined && record.revenue === undefined) {
        record.revenue = record.sales;
      }
      
      // Log only first few records for debugging to avoid log spam
      if (i < 3) {
        logger.info('Processing record', { recordIndex: i, record: record });
      }
      
      // Validate required fields: month and year are compulsory
      if (!record.month || record.month === '') {
        throw new Error(`Record ${i + 1}: Month is missing or empty. Month is required.`);
      }
      
      // Handle year - can be 2-digit (23) or 4-digit (2023)
      if (record.year) {
        let yearValue = typeof record.year === 'string' ? parseFloat(record.year) : record.year;
        if (yearValue && yearValue < 100) {
          // Convert 2-digit year to 4-digit (assume 2000s for years < 50, 1900s for years >= 50)
          yearValue = yearValue < 50 ? 2000 + yearValue : 1900 + yearValue;
          record.year = yearValue;
        }
      }

      if (!record.year || record.year === 0) {
        throw new Error(`Record ${i + 1}: Year is missing or invalid. Year is required. Month: ${record.month}, Year: ${record.year}`);
      }
      
      // Convert numeric fields to numbers
      const numericFields = ['hc', 'salary_cost', 'revenue', 'gpm', 'gpm_percentage', 'leave_encashment', 'team_cost', 'opr_cost', 'funding_cost', 'np', 'np_percentage', 'rebate', 'passthrough', 'vendor_cost', 'discount'];
      for (const field of numericFields) {
        if (record[field] !== null && record[field] !== undefined && record[field] !== '') {
          if (typeof record[field] === 'string') {
            // Handle negative numbers in parentheses, commas, percentages
            let strValue = record[field].trim();
            if (strValue === '-' || strValue === '########' || strValue === '') {
              record[field] = 0;
            } else {
              if (strValue.startsWith('(') && strValue.endsWith(')')) {
                strValue = '-' + strValue.slice(1, -1);
              }
              if (strValue.endsWith('%')) {
                strValue = strValue.replace('%', '');
              }
              strValue = strValue.replace(/,/g, '');
              record[field] = parseFloat(strValue) || 0;
            }
          }
        } else {
          record[field] = 0; // Default to 0 for numeric fields
        }
      }

      // Normalize month name to full name (e.g., "January", "April") - matching team_summary_report format
      const monthNames = {
        'January': 'January', 'February': 'February', 'March': 'March', 'April': 'April',
        'May': 'May', 'June': 'June', 'July': 'July', 'August': 'August',
        'September': 'September', 'October': 'October', 'November': 'November', 'December': 'December',
        'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April',
        'May': 'May', 'Jun': 'June', 'Jul': 'July', 'Aug': 'August',
        'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December'
      };
      
      // Full month names array for numeric conversion
      const fullMonthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      
      // Handle different month formats - normalize to full month name
      let normalizedMonth = monthNames[record.month];
      if (!normalizedMonth) {
        // Try case-insensitive match
        const monthStr = String(record.month).trim();
        const capitalized = monthStr.charAt(0).toUpperCase() + monthStr.slice(1).toLowerCase();
        normalizedMonth = monthNames[capitalized];
        
        // Handle numeric month values (1-12 or 01-12)
        if (!normalizedMonth) {
          const monthNum = parseInt(monthStr, 10);
          if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
            normalizedMonth = fullMonthNames[monthNum - 1]; // Convert 1-12 to 0-11 index
          }
        }
        
        // Try to extract month from date strings like "2023-07-01" or "July 2023"
        if (!normalizedMonth) {
          const lowerMonthStr = monthStr.toLowerCase();
          if (lowerMonthStr.includes('jan')) normalizedMonth = 'January';
          else if (lowerMonthStr.includes('feb')) normalizedMonth = 'February';
          else if (lowerMonthStr.includes('mar')) normalizedMonth = 'March';
          else if (lowerMonthStr.includes('apr')) normalizedMonth = 'April';
          else if (lowerMonthStr.includes('may')) normalizedMonth = 'May';
          else if (lowerMonthStr.includes('jun')) normalizedMonth = 'June';
          else if (lowerMonthStr.includes('jul')) normalizedMonth = 'July';
          else if (lowerMonthStr.includes('aug')) normalizedMonth = 'August';
          else if (lowerMonthStr.includes('sep')) normalizedMonth = 'September';
          else if (lowerMonthStr.includes('oct')) normalizedMonth = 'October';
          else if (lowerMonthStr.includes('nov')) normalizedMonth = 'November';
          else if (lowerMonthStr.includes('dec')) normalizedMonth = 'December';
          else if (monthStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // Handle DATE format from database - extract month name
            const date = new Date(monthStr);
            if (!isNaN(date.getTime())) {
              const monthIndex = date.getMonth(); // 0-11
              normalizedMonth = fullMonthNames[monthIndex];
            }
          }
        }
      }
      
      if (!normalizedMonth) {
        logger.error('Invalid month format', { recordIndex: i, month: record.month, monthType: typeof record.month, record: record });
        throw new Error(`Record ${i + 1}: Invalid month format "${record.month}" (type: ${typeof record.month}). Expected month names like "January", "July", etc., or numeric values 1-12.`);
      }
      record.month = normalizedMonth;
      
      // Convert empty strings to null for all fields
      const allFields = ['client_name', 'project_name', 'business_unit', 'bu_head', 'month'];
      for (const field of allFields) {
        if (record[field] === '' || record[field] === undefined) {
          record[field] = null;
        }
      }
    }

    // Use transaction for bulk insert with optimized batch processing
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const insertQuery = `INSERT INTO team_report (
        client_name, project_name, business_unit, bu_head, hc,
        salary_cost, revenue, gpm, gpm_percentage, leave_encashment,
        team_cost, opr_cost, funding_cost, np, np_percentage, 
        rebate, passthrough, vendor_cost, discount, month, year
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`;
      
      let insertedCount = 0;
      let failedCount = 0;
      const errors = [];
      
      for (let i = 0; i < data.length; i++) {
        const record = data[i];
        try {
          // Validate month before insert
          if (!record.month || record.month === '' || record.month === null) {
            throw new Error(`Record ${i + 1}: Month is missing or empty`);
          }
          
          // Validate year before insert
          if (!record.year || record.year === 0) {
            throw new Error(`Record ${i + 1}: Year is missing or invalid`);
          }
          
          await client.query(insertQuery, [
            record.client_name === '' ? null : record.client_name,
            record.project_name === '' ? null : record.project_name,
            record.business_unit === '' ? null : record.business_unit,
            record.bu_head === '' ? null : record.bu_head,
            record.hc || 0,
            record.salary_cost || 0,
            record.revenue || 0,
            record.gpm || 0,
            record.gpm_percentage || 0,
            record.leave_encashment || 0,
            record.team_cost || 0,
            record.opr_cost || 0,
            record.funding_cost || 0,
            record.np || 0,
            record.np_percentage || 0,
            record.rebate || 0,
            record.passthrough || 0,
            record.vendor_cost ?? 0,
            record.discount ?? 0,
            record.month,
            record.year
          ]);
          insertedCount++;
        } catch (insertErr) {
          failedCount++;
          const errorMsg = `Record ${i + 1}: ${insertErr.message || insertErr.detail || insertErr.code || 'Unknown error'}`;
          errors.push(errorMsg);
          logger.error('Failed to insert record', { 
            recordIndex: i, 
            record: { 
              month: record.month, 
              year: record.year, 
              business_unit: record.business_unit,
              client_name: record.client_name,
              project_name: record.project_name
            },
            error: insertErr.message,
            sqlError: insertErr.code,
            detail: insertErr.detail,
            constraint: insertErr.constraint,
            table: insertErr.table
          });
          // Continue with next record instead of stopping
        }
      }
      
      await client.query('COMMIT');
      
      logger.info('Team report bulk import completed', { 
        totalRecords: data.length,
        insertedCount: insertedCount,
        failedCount: failedCount
      });
      
      if (insertedCount === 0) {
        res.status(400).json({
          success: false,
          message: `Failed to import all ${data.length} records`,
          errors: errors.slice(0, 10) // Return first 10 errors
        });
      } else if (failedCount > 0) {
        res.status(207).json({ // 207 Multi-Status
          success: true,
          message: `Imported ${insertedCount} records successfully, ${failedCount} records failed`,
          insertedCount: insertedCount,
          failedCount: failedCount,
          errors: errors.slice(0, 10) // Return first 10 errors
        });
      } else {
        res.status(201).json({
          success: true,
          message: `Successfully imported ${insertedCount} records`,
          insertedCount: insertedCount
        });
      }
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        logger.error('Failed to rollback transaction', { error: rollbackErr });
      }
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error('Bulk import error', { 
      error: err.message, 
      stack: err.stack,
      dataLength: data ? data.length : 0
    });
    next(err);
  }
});

// One-time: normalize GPM% and NP% for all existing Client MFS (team_report) data
// Total GPM% = (Total GPM / Total Revenue) * 100, Total NP% = (Total NP / Total Revenue) * 100
// This updates each row so stored gpm_percentage = (gpm/revenue)*100 and np_percentage = (np/revenue)*100
app.post('/api/team-report/normalize-percentages', async (req, res, next) => {
  try {
    const client = await pool.connect();
    try {
      const updateQuery = `
        UPDATE team_report
        SET
          gpm_percentage = CASE WHEN revenue IS NOT NULL AND revenue <> 0 THEN (COALESCE(gpm, 0)::numeric / revenue) * 100 ELSE gpm_percentage END,
          np_percentage = CASE WHEN revenue IS NOT NULL AND revenue <> 0 THEN (COALESCE(np, 0)::numeric / revenue) * 100 ELSE np_percentage END
        WHERE revenue IS NOT NULL AND revenue <> 0
      `;
      const result = await client.query(updateQuery);
      const rowCount = result.rowCount != null ? result.rowCount : 0;
      logger.info('Team report normalize-percentages completed', { updatedRows: rowCount });
      res.status(200).json({
        success: true,
        message: `Updated GPM% and NP% for ${rowCount} existing records (from GPM/Revenue and NP/Revenue).`,
        updatedRows: rowCount
      });
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error('Normalize percentages error', { error: err.message, stack: err.stack });
    next(err);
  }
});

// Team Summary Report Routes (New simplified structure)
app.get('/api/team-summary-report', async (req, res, next) => {
  try {
    const { business_unit } = req.query;
    let query = 'SELECT * FROM team_summary_report';
    let params = [];

    if (business_unit) {
      // Normalize business unit for case-insensitive matching
      let normalizedBU = business_unit;
      const buTrimmed = String(business_unit).trim();
      const buLower = buTrimmed.toLowerCase();
      
      // Handle BPO|HTD variations (case-insensitive, with or without spaces)
      // Remove spaces around pipe/slash/dash for comparison
      const normalizedForComparison = buLower.replace(/\s*\|\s*/g, '|').replace(/\s*\/\s*/g, '/').replace(/\s*-\s*/g, '-');
      if (normalizedForComparison === 'bpo|htd' || normalizedForComparison === 'bpo/htd' || normalizedForComparison === 'bpo-htd') {
        normalizedBU = 'BPO|HTD';
      }
      // Handle other common variations
      else if (buLower === 'captive') {
        normalizedBU = 'Captive';
      }
      else if (buLower === 'canada') {
        normalizedBU = 'Canada';
      }
      else if (buLower === 'japan') {
        normalizedBU = 'Japan';
      }
      else if (buLower === 'singapore') {
        normalizedBU = 'Singapore';
      }
      else if (buLower === 'si' || buLower === 'si tech' || buLower === 'si bpo') {
        normalizedBU = 'SI';
      }
      else if (buLower === 'usa') {
        normalizedBU = 'USA';
      }
      else if (buLower === 'ms' || buLower === 'managed services' || buLower === 'managed  services') {
        normalizedBU = 'MS';
      }
      else if (buLower === 'egg' || buLower === 'engg' || buLower === 'engineering') {
        normalizedBU = 'Egg';
      }
      else if (buLower === 'all' || buLower === 'finance') {
        normalizedBU = 'Finance';
      }
      // For BPO|HTD, ensure it's stored in uppercase format (handle any case variation, including spaces)
      // Normalize spaces around pipe before checking
      const buNormalizedForCheck = buTrimmed.replace(/\s*\|\s*/g, '|');
      if (buNormalizedForCheck.toUpperCase() === 'BPO|HTD' || buNormalizedForCheck === 'BPO|HTD') {
        normalizedBU = 'BPO|HTD';
      }
      
      // Use case-insensitive comparison in SQL, also normalize spaces around pipe
      // Replace spaces around pipe for comparison (handles "BPO | HTD", "BPO|HTD", etc.)
      query += " WHERE LOWER(REGEXP_REPLACE(TRIM(business_unit), '\\s*\\|\\s*', '|', 'g')) = LOWER(REGEXP_REPLACE(TRIM($1), '\\s*\\|\\s*', '|', 'g'))";
      params.push(normalizedBU);
    }

    query += ' ORDER BY year DESC, month, business_unit';

    const result = await executeQuery(query, params);
    
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

app.post('/api/team-summary-report', async (req, res, next) => {
  try {
    const { 
      business_unit, month, year, hc, revenue, gpm, team_cost, net_margin
    } = req.body;
    
    // Validate required fields
    if (!business_unit || business_unit === '') {
      return res.status(400).json({
        success: false,
        error: 'Business Unit is required.'
      });
    }
    
    if (!month || month === '') {
      return res.status(400).json({
        success: false,
        error: 'Month is required.'
      });
    }
    
    if (!year || year === 0) {
      return res.status(400).json({
        success: false,
        error: 'Year is required.'
      });
    }

    // Check for duplicate
    const duplicateCheck = await executeQuery(
      `SELECT id FROM team_summary_report WHERE business_unit = $1 AND month = $2 AND year = $3`,
      [business_unit, month, year]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Duplicate record detected. A record with identical business unit, month, and year already exists.',
        duplicateId: duplicateCheck.rows[0].id
      });
    }

    const result = await executeQuery(
      `INSERT INTO team_summary_report (
        business_unit, month, year, hc, revenue, gpm, team_cost, net_margin
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        business_unit,
        month,
        year,
        hc || 0,
        revenue || 0,
        gpm || 0,
        team_cost || 0,
        net_margin || 0
      ]
    );
    
    logger.info('Team summary report created', { recordId: result.rows[0].id });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    logger.error('Failed to create team summary report', { 
      error: err.message, 
      stack: err.stack,
      body: req.body 
    });
    next(err);
  }
});

// Bulk import endpoint for team summary report
app.post('/api/team-summary-report/bulk', async (req, res, next) => {
  try {
    const { data } = req.body;
    
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid data format. Expected non-empty array.'
      });
    }

    // Limit batch size to prevent server overload
    if (data.length > 1000) {
      return res.status(400).json({
        success: false,
        error: `Batch size too large. Maximum 1000 records per batch. Received ${data.length} records.`
      });
    }

    // Helper function to normalize business unit name (title case)
    const normalizeBusinessUnitName = (name) => {
      if (!name || name === '') return null;
      const trimmed = String(name).trim();
      if (trimmed === '') return null;
      // Convert to title case: first letter uppercase, rest lowercase
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
    };

    // Process and validate each record
    for (let i = 0; i < data.length; i++) {
      const record = data[i];
      
      // Normalize business unit name to title case
      if (record.business_unit) {
        record.business_unit = normalizeBusinessUnitName(record.business_unit);
      }
      
      // Validate required fields
      if (!record.business_unit || record.business_unit === '') {
        throw new Error(`Record ${i + 1}: Business Unit is required.`);
      }
      
      if (!record.month || record.month === '') {
        throw new Error(`Record ${i + 1}: Month is required.`);
      }
      
      if (!record.year || record.year === 0) {
        throw new Error(`Record ${i + 1}: Year is required.`);
      }
      
      // Convert numeric fields to numbers
      const numericFields = ['hc', 'revenue', 'gpm', 'team_cost', 'net_margin', 'year'];
      for (const field of numericFields) {
        if (record[field] !== null && record[field] !== undefined && record[field] !== '') {
          if (typeof record[field] === 'string') {
            record[field] = parseFloat(record[field]) || 0;
          }
        } else {
          record[field] = 0; // Default to 0 for numeric fields
        }
      }
      
      // Handle 2-digit year conversion (e.g., 24 -> 2024, 25 -> 2025)
      if (record.year && record.year < 100) {
        if (record.year >= 0 && record.year <= 99) {
          // Assume years 0-99 map to 2000-2099
          record.year = 2000 + record.year;
        }
      }
    }

    // Use transaction for bulk insert
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      let insertedCount = 0;
      
      for (const record of data) {
        // Check for duplicates and insert or update
        const existingRecord = await client.query(
          `SELECT id FROM team_summary_report WHERE business_unit = $1 AND month = $2 AND year = $3`,
          [record.business_unit, record.month, record.year]
        );
        
        if (existingRecord.rows.length > 0) {
          // Update existing record
          await client.query(
            `UPDATE team_summary_report SET 
             hc = $4, revenue = $5, gpm = $6, team_cost = $7, net_margin = $8, updated_at = CURRENT_TIMESTAMP
             WHERE id = $9`,
            [
              record.hc, record.revenue, record.gpm, record.team_cost, record.net_margin,
              existingRecord.rows[0].id
            ]
          );
        } else {
          // Insert new record
          await client.query(
            `INSERT INTO team_summary_report (
              business_unit, month, year, hc, revenue, gpm, team_cost, net_margin
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              record.business_unit, record.month, record.year,
              record.hc, record.revenue, record.gpm, record.team_cost, record.net_margin
            ]
          );
        }
        
        insertedCount++;
      }
      
      await client.query('COMMIT');
      
      logger.info('Team summary report bulk import completed', { 
        totalRecords: data.length,
        insertedCount: insertedCount
      });
      
      res.json({
        success: true,
        message: `Successfully imported ${insertedCount} records.`,
        insertedCount: insertedCount,
        totalRecords: data.length
      });
      
    } catch (transactionError) {
      await client.query('ROLLBACK');
      throw transactionError;
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error('Team summary report bulk import error', { 
      error: err.message, 
      stack: err.stack,
      dataLength: data ? data.length : 0
    });
    next(err);
  }
});

// PATCH endpoint for team summary report (for editing)
app.patch('/api/team-summary-report/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Build dynamic update query
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
    const query = `UPDATE team_summary_report SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`;
    
    const result = await executeQuery(query, [...values, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    logger.info('Team summary report record patched', { recordId: id });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// HRMS Data Routes
app.post('/api/hrms_data', async (req, res, next) => {
  try {
    const formData = req.body;
    const columns = Object.keys(formData).map(col => `"${col}"`).join(', ');
    const values = Object.values(formData);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    const query = `INSERT INTO hrms_data (${columns}) VALUES (${placeholders}) RETURNING *`;
    const result = await executeQuery(query, values);
    
    logger.info('HRMS record created', { recordId: result.rows[0].id });
    res.status(201).json({
      success: true,
      message: 'HRMS record added successfully',
      data: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// File upload endpoint
app.post('/api/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    logger.info('File uploaded successfully', {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });

    res.json({
      success: true,
      message: 'File uploaded successfully',
      filename: req.file.filename
    });
  } catch (err) {
    next(err);
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  server.close(() => {
    logger.info('HTTP server closed');
    pool.end(() => {
      logger.info('Database pool closed');
      process.exit(0);
    });
  });
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running on port ${PORT} in ${NODE_ENV} mode`);
});

// Handle server errors
server.on('error', (error) => {
  logger.error('Server error:', error);
});

module.exports = app;
