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

  res.status(err.status || 500).json({
    success: false,
    error: isProduction ? 'Internal Server Error' : err.message,
    ...(isProduction ? {} : { stack: err.stack })
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

      const result = await executeQuery(
        'INSERT INTO users (name, designation, email, phone_number, password, business_unit) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email',
        [name, designation, email, phone_number, password, business_unit]
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
    
    res.json({ 
      success: true, 
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        designation: user.designation,
        business_unit: user.business_unit,
        email: user.email
      }
    });
  } catch (err) {
    next(err);
  }
});

// CTS Routes
app.get('/api/CTS', async (req, res, next) => {
  try {
    const result = await executeQuery('SELECT * FROM "cts" ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

app.post('/api/CTS', async (req, res, next) => {
  try {
    const data = req.body;
    
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
      
      if (!isNaN(value) && value > 1000) {
        const excelDate = new Date((value - 25569) * 86400 * 1000);
        if (!isNaN(excelDate.getTime())) {
          return excelDate.toISOString().split('T')[0];
        }
      }
      
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return null;
      }
      return value;
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
    
    const result = await executeQuery(
      `INSERT INTO cts (
        sl_no, vendor_name, booking_month, resource_name, vendor_invoice_no,
        vendor_invoice_date, atipl_invoice_base_amount, gst, total_invoice_amount,
        tds, net_receivable, payment_receive_from_client, balance_receivable_from_client, tally_book_entry_date,
        sub_vendor_invoice_date, sub_vendor_invoice_no, base_amt_as_per_tally_vendor, margin, vendor_invoice_status,
        payment_date, instrument_no, payment_mode, payment_status, receipts_status, extra, service_month
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23, $24, $25, $26
      ) RETURNING *`,
      [
        data.sl_no, data.vendor_name, validateDateField(data.booking_month), data.resource_name, data.vendor_invoice_no,
        validateDateField(data.vendor_invoice_date), validateNumericField(data.atipl_invoice_base_amount), validateNumericField(data.gst), validateNumericField(data.total_invoice_amount),
        validateNumericField(data.tds), validateNumericField(data.net_receivable), validateNumericField(data.payment_receive_from_client), validateNumericField(data.balance_receivable_from_client), validateDateField(data.tally_book_entry_date),
        validateDateField(data.sub_vendor_invoice_date), data.sub_vendor_invoice_no, validateNumericField(data.base_amt_as_per_tally_vendor), validateNumericField(data.margin),
        data.vendor_invoice_status, validateDateField(data.payment_date), data.instrument_no, data.payment_mode, data.payment_status,
        data.receipts_status, data.extra || null, validateDateField(data.service_month)
      ]
    );
    
    logger.info('CTS record created', { recordId: result.rows[0].id });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

app.put('/api/CTS/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = req.body;
    
    const result = await executeQuery(
      `UPDATE cts SET
        vendor_name = $1, booking_month = $2, resource_name = $3, vendor_invoice_no = $4,
        vendor_invoice_date = $5, atipl_invoice_base_amount = $6, gst = $7, total_invoice_amount = $8,
        tds = $9, net_receivable = $10, payment_receive_from_client = $11, balance_receivable_from_client = $12,
        tally_book_entry_date = $13, sub_vendor_invoice_date = $14, sub_vendor_invoice_no = $15,
        base_amt_as_per_tally_vendor = $16, margin = $17, vendor_invoice_status = $18, payment_date = $19,
        instrument_no = $20, payment_mode = $21, payment_status = $22, receipts_status = $23,
        extra = $24, service_month = $25
      WHERE id = $26 RETURNING *`,
      [
        data.vendor_name, data.booking_month, data.resource_name, data.vendor_invoice_no,
        data.vendor_invoice_date, data.atipl_invoice_base_amount, data.gst, data.total_invoice_amount,
        data.tds, data.net_receivable, data.payment_receive_from_client, data.balance_receivable_from_client,
        data.tally_book_entry_date, data.sub_vendor_invoice_date, data.sub_vendor_invoice_no,
        data.base_amt_as_per_tally_vendor, data.margin, data.vendor_invoice_status, data.payment_date,
        data.instrument_no, data.payment_mode, data.payment_status, data.receipts_status,
        data.extra || null, data.service_month, id
      ]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    logger.info('CTS record updated', { recordId: id });
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
            return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
          }
        }
      }
      
      // Handle dd-mm-yyyy format (e.g., "13-08-2024")
      if (typeof value === 'string' && /^\d{1,2}-\d{1,2}-\d{4}$/.test(value)) {
        const [day, month, year] = value.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
        }
      }
      
      // Handle Excel serial numbers
      if (!isNaN(value) && value > 1000) {
        const excelDate = new Date((value - 25569) * 86400 * 1000);
        if (!isNaN(excelDate.getTime())) {
          return excelDate.toISOString().split('T')[0];
        }
      }
      
      // Try standard date parsing
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
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
        validateNumericField(routingData['Funding cost']), validateNumericField(routingData['Net Margin']), routingData['Billing Month'] || null,
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
app.patch('/api/CTS/:id', async (req, res, next) => {
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
    const query = `UPDATE cts SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`;
    
    const result = await executeQuery(query, [...values, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    logger.info('CTS record patched', { recordId: id });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

app.patch('/api/Alchemy_Routing/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Build dynamic update query
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    
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
            return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
          }
        }
      }
      
      // Handle dd-mm-yyyy format (e.g., "13-08-2024")
      if (typeof value === 'string' && /^\d{1,2}-\d{1,2}-\d{4}$/.test(value)) {
        const [day, month, year] = value.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
        }
      }
      
      // Handle Excel serial numbers
      if (!isNaN(value) && value > 1000) {
        const excelDate = new Date((value - 25569) * 86400 * 1000);
        if (!isNaN(excelDate.getTime())) {
          return excelDate.toISOString().split('T')[0];
        }
      }
      
      // Try standard date parsing
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
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
      
      for (const routingData of data) {
        await client.query(insertQuery, [
          routingData['Sl.No'], validateDateField(routingData['Costing Date']), routingData['IBM / KYNDRYL'],
          routingData['Requestor'] || null, routingData['Department SPOC'] || null, routingData['SPOC E-mail ID'] || null,
          routingData['Training / Services Details'] || null, routingData['Description'] || null,
          routingData['IBM / KYNDRYL PO No'] || null, validateDateField(routingData['IBM / KYNDRYL PO Date']),
          validateNumericField(routingData['IBM / KYNDRYL PO Value']), validateNumericField(routingData['Integration %']),
          validateNumericField(routingData['Integrator Charges (Margin)']), validateNumericField(routingData['Alchemy Billing Value']),
          validateNumericField(routingData['Funding cost']), validateNumericField(routingData['Net Margin']), routingData['Billing Month'] || null,
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
    next(err);
  }
});

// Team Report Routes
app.get('/api/team-report', async (req, res, next) => {
  try {
    const { designation, business_unit } = req.query;
    let query = 'SELECT * FROM team_report';
    let params = [];

    if (designation === 'BU HEAD' && business_unit) {
      query += ' WHERE business_unit = $1';
      params.push(business_unit);
    }

    const result = await executeQuery(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

app.post('/api/team-report', async (req, res, next) => {
    try {
      const { 
        tower, client_name, project_name, business_unit, bu_head, hc, 
        salary_cost, sales, gpm, gpm_percentage, leave_encashment, 
        team_cost, opr_cost, funding_cost, np, np_percentage, month, year 
      } = req.body;
      
      const result = await executeQuery(
        `INSERT INTO team_report (
          tower, client_name, project_name, business_unit, bu_head, hc,
          salary_cost, sales, gpm, gpm_percentage, leave_encashment,
          team_cost, opr_cost, funding_cost, np, np_percentage, month, year
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING *`,
        [tower, client_name, project_name, business_unit, bu_head, hc, 
         salary_cost, sales, gpm, gpm_percentage, leave_encashment,
         team_cost, opr_cost, funding_cost, np, np_percentage, month, year]
      );
      
      logger.info('Team report created', { recordId: result.rows[0].id });
      res.status(201).json(result.rows[0]);
    } catch (err) {
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

    // Process and validate each record - allow null values for all fields
    for (let i = 0; i < data.length; i++) {
      const record = data[i];
      
      // Log only first few records for debugging to avoid log spam
      if (i < 3) {
        logger.info('Processing record', { recordIndex: i, record: record });
      }
      
      // All fields are optional - no required field validation
      
      // Convert numeric fields to numbers
      const numericFields = ['hc', 'salary_cost', 'sales', 'gpm', 'gpm_percentage', 'leave_encashment', 'team_cost', 'opr_cost', 'funding_cost', 'np', 'np_percentage', 'year'];
      for (const field of numericFields) {
        if (record[field] !== null && record[field] !== undefined && record[field] !== '') {
          if (typeof record[field] === 'string') {
            record[field] = parseFloat(record[field]) || 0;
          }
        } else {
          record[field] = 0; // Default to 0 for numeric fields
        }
      }
      
      // Convert empty strings to null for all fields
      const allFields = ['tower', 'client_name', 'project_name', 'business_unit', 'bu_head', 'month'];
      for (const field of allFields) {
        if (record[field] === '' || record[field] === undefined) {
          record[field] = null;
        }
      }
    }

    // Use transaction for bulk insert
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const insertQuery = `INSERT INTO team_report (
        tower, client_name, project_name, business_unit, bu_head, hc,
        salary_cost, sales, gpm, gpm_percentage, leave_encashment,
        team_cost, opr_cost, funding_cost, np, np_percentage, month, year
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`;
      
      for (let i = 0; i < data.length; i++) {
        const record = data[i];
        try {
        await client.query(insertQuery, [
          record.tower === '' ? null : record.tower,
          record.client_name === '' ? null : record.client_name,
          record.project_name === '' ? null : record.project_name,
          record.business_unit === '' ? null : record.business_unit,
          record.bu_head === '' ? null : record.bu_head,
            record.hc || 0,
            record.salary_cost || 0,
            record.sales || 0,
            record.gpm || 0,
            record.gpm_percentage || 0,
            record.leave_encashment || 0,
            record.team_cost || 0,
            record.opr_cost || 0,
            record.funding_cost || 0,
            record.np || 0,
            record.np_percentage || 0,
            record.month === '' ? null : record.month,
            record.year || new Date().getFullYear()
          ]);
        } catch (insertErr) {
          logger.error('Failed to insert record', { 
            recordIndex: i, 
            record: record, 
            error: insertErr.message,
            stack: insertErr.stack,
            sqlError: insertErr.code,
            detail: insertErr.detail
          });
          throw new Error(`Failed to insert record ${i + 1}: ${insertErr.message} (Code: ${insertErr.code})`);
        }
      }
      
      await client.query('COMMIT');
      
      logger.info('Team report bulk import completed', { 
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
