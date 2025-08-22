# 🚀 Production Testing Guide

## Complete Step-by-Step Local Production Setup

### **Step 1: Environment Setup ✅**
Environment files have been created:
- `client/.env` - Frontend configuration
- `server/.env` - Backend configuration

### **Step 2: Database Setup**

#### **Option A: Using Docker (Recommended)**
```bash
# Start PostgreSQL with Docker
docker run --name vendor-management-db \
  -e POSTGRES_DB=Vendor_Management \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=Postgres0607@ \
  -p 5432:5432 \
  -d postgres:15-alpine

# Verify database is running
docker ps
```

#### **Option B: Local PostgreSQL Installation**
1. Install PostgreSQL on your system
2. Create database:
   ```sql
   CREATE DATABASE "Vendor_Management";
   CREATE USER postgres WITH PASSWORD 'Postgres0607@';
   GRANT ALL PRIVILEGES ON DATABASE "Vendor_Management" TO postgres;
   ```

### **Step 3: Install Dependencies**

#### **Backend Dependencies**
```bash
cd server
npm install
```

#### **Frontend Dependencies**
```bash
cd client
npm install
```

### **Step 4: Database Schema Setup**

Create the database tables by running these SQL commands in your PostgreSQL database:

```sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    designation VARCHAR(100),
    business_unit VARCHAR(100),
    phone_number VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CTS (Cost to Serve) table
CREATE TABLE IF NOT EXISTS cts (
    id SERIAL PRIMARY KEY,
    sl_no VARCHAR(50),
    vendor_name VARCHAR(255),
    service_month DATE,
    resource_name VARCHAR(255),
    total_invoice_amount DECIMAL(15,2),
    atipl_invoice_base_amount DECIMAL(15,2),
    net_receivable DECIMAL(15,2),
    payment_receive_from_client DECIMAL(15,2),
    base_amt_as_per_tally_vendor DECIMAL(15,2),
    margin DECIMAL(15,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alchemy Routing table
CREATE TABLE IF NOT EXISTS alchemy_routing (
    id SERIAL PRIMARY KEY,
    "Sl.No" VARCHAR(50),
    "Costing Date" DATE,
    "IBM / KYNDRYL" VARCHAR(255),
    "Requestor" VARCHAR(255),
    "Department SPOC" VARCHAR(255),
    "SPOC E-mail ID" VARCHAR(255),
    "Training / Services Details" TEXT,
    "Description" TEXT,
    "IBM / KYNDRYL PO No" VARCHAR(100),
    "IBM / KYNDRYL PO Date" DATE,
    "IBM / KYNDRYL PO Value" DECIMAL(15,2),
    "Integration %" DECIMAL(5,2),
    "Integrator Charges (Margin)" DECIMAL(15,2),
    "Alchemy Billing Value" DECIMAL(15,2),
    "Funding cost" DECIMAL(15,2),
    "Net Margin" DECIMAL(15,2),
    "Billing Month" VARCHAR(50),
    "Payment Day's" VARCHAR(50),
    "Vendor Details" VARCHAR(255),
    "Vendor SPOC" VARCHAR(255),
    "Vendor SPOC Contact No" VARCHAR(50),
    "Vendor SPOC E-mail ID" VARCHAR(255),
    "Training Dates" DATE,
    "Vendor Inv. No." VARCHAR(100),
    "Vendor Inv. Date" DATE,
    "Vendor Inv. Amount" DECIMAL(15,2),
    "GST @ 18%" DECIMAL(15,2),
    "Total Invoice" DECIMAL(15,2),
    "Vendor Amount After TDS 10%" DECIMAL(15,2),
    "Net Payment to Vendor" DECIMAL(15,2),
    "Payment Due Date" DATE,
    "Alchemy Techsol Invoive No" VARCHAR(100),
    "Alchemy Techsol Invoice Date" DATE,
    "Alchemy Techsol Invoice Amount" DECIMAL(15,2),
    "Payment Expected Date (IBM)" DATE,
    "Cheque Issued Name" VARCHAR(255),
    "Cheque Date" DATE,
    "Cheque No" VARCHAR(100),
    "REMARK" TEXT,
    "Vendor_PO_No" VARCHAR(100),
    "Vendor_PO_Date" DATE,
    "Address" TEXT,
    "domain" VARCHAR(100),
    "Alchemy PO" VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Team Report table
CREATE TABLE IF NOT EXISTS team_report (
    id SERIAL PRIMARY KEY,
    business_unit VARCHAR(100),
    particulars VARCHAR(255),
    amount DECIMAL(15,2),
    month DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- HRMS Data table
CREATE TABLE IF NOT EXISTS hrms_data (
    id SERIAL PRIMARY KEY,
    sl_no VARCHAR(50),
    category VARCHAR(100),
    category_daily_report VARCHAR(100),
    account_manager VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Step 5: Start the Backend Server**

#### **Option A: Direct Node.js Start**
```bash
cd server
npm start
```

#### **Option B: Using PM2 (Production-like)**
```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
cd server
pm2 start ecosystem.config.js --env production

# Monitor the application
pm2 monit
```

#### **Option C: Using Docker**
```bash
# Build and start backend
cd server
docker build -t vendor-management-api .
docker run -p 5001:5001 --env-file .env vendor-management-api
```

### **Step 6: Start the Frontend**

```bash
cd client
npm start
```

### **Step 7: Testing Checklist**

#### **🔍 Backend API Testing**

1. **Health Check**
   ```bash
   curl http://localhost:5001/health
   ```
   Expected: `{"status":"ok","timestamp":"..."}`

2. **Database Connection**
   ```bash
   curl http://localhost:5001/api/health
   ```
   Expected: `{"status":"ok","database":"connected"}`

3. **Authentication Endpoints**
   ```bash
   # Test signup
   curl -X POST http://localhost:5001/api/signup \
     -H "Content-Type: application/json" \
     -d '{"name":"Test User","email":"test@example.com","password":"password123","designation":"ADMIN"}'
   
   # Test login
   curl -X POST http://localhost:5001/api/login \
     -H "Content-Type: application/json" \
     -d '{"name":"Test User","password":"password123"}'
   ```

#### **🔍 Frontend Testing**

1. **Access the application**: http://localhost:3000
2. **Test login functionality**
3. **Test navigation between pages**
4. **Test data submission forms**
5. **Test file uploads**
6. **Test data tables and filtering**

#### **🔍 Integration Testing**

1. **Login Flow**
   - Navigate to http://localhost:3000
   - Login with test credentials
   - Verify redirect to HomePage

2. **Data Operations**
   - Add new CTS data
   - Add new routing data
   - Add new team report data
   - Verify data appears in tables

3. **File Operations**
   - Upload Excel files
   - Export data to Excel
   - Generate PDF reports

### **Step 8: Performance Testing**

#### **Load Testing with Artillery**
```bash
# Install Artillery
npm install -g artillery

# Create load test
cat > load-test.yml << EOF
config:
  target: 'http://localhost:5001'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: "API Health Check"
    requests:
      - get:
          url: "/health"
EOF

# Run load test
artillery run load-test.yml
```

### **Step 9: Security Testing**

1. **SQL Injection Test**
   ```bash
   curl "http://localhost:5001/api/CTS?vendor_name='; DROP TABLE cts; --"
   ```

2. **XSS Test**
   ```bash
   curl -X POST http://localhost:5001/api/signup \
     -H "Content-Type: application/json" \
     -d '{"name":"<script>alert(\"XSS\")</script>","email":"test@example.com","password":"password123"}'
   ```

3. **Rate Limiting Test**
   ```bash
   # Make multiple rapid requests
   for i in {1..20}; do
     curl http://localhost:5001/api/CTS
   done
   ```

### **Step 10: Monitoring and Logs**

#### **Check Application Logs**
```bash
# Backend logs
cd server
tail -f logs/combined.log
tail -f logs/error.log

# PM2 logs (if using PM2)
pm2 logs vendor-management-api
```

#### **Database Monitoring**
```bash
# Connect to PostgreSQL
psql -h localhost -U postgres -d Vendor_Management

# Check table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### **Step 11: Production Readiness Checklist**

#### **✅ Backend Checklist**
- [ ] Environment variables configured
- [ ] Database connection working
- [ ] All API endpoints responding
- [ ] Error handling working
- [ ] Logging configured
- [ ] Security headers set
- [ ] Rate limiting working
- [ ] File upload working
- [ ] Authentication working

#### **✅ Frontend Checklist**
- [ ] Environment variables configured
- [ ] API client working
- [ ] All pages loading
- [ ] Navigation working
- [ ] Forms submitting correctly
- [ ] Error messages displaying
- [ ] Loading states working
- [ ] File uploads working

#### **✅ Database Checklist**
- [ ] All tables created
- [ ] Indexes on frequently queried columns
- [ ] Foreign key constraints (if needed)
- [ ] Data types appropriate
- [ ] Backup strategy in place

#### **✅ Security Checklist**
- [ ] Passwords hashed with bcrypt
- [ ] JWT tokens working
- [ ] CORS configured
- [ ] Input validation working
- [ ] SQL injection protection
- [ ] XSS protection
- [ ] Rate limiting active

### **Step 12: Troubleshooting Common Issues**

#### **Database Connection Issues**
```bash
# Check if PostgreSQL is running
docker ps | grep postgres
# or
pg_isready -h localhost -p 5432

# Check connection from Node.js
cd server
node -e "
const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'Vendor_Management',
  password: 'Postgres0607@',
  port: 5432,
});
pool.query('SELECT NOW()', (err, res) => {
  console.log(err ? 'Error:' + err.message : 'Connected:', res.rows[0]);
  pool.end();
});
"
```

#### **Port Conflicts**
```bash
# Check what's using port 5001
netstat -ano | findstr :5001
# or
lsof -i :5001

# Kill process if needed
taskkill /PID <PID> /F
```

#### **Frontend Build Issues**
```bash
cd client
npm run build
# Check for any build errors
```

### **Step 13: Production Deployment Test**

#### **Docker Compose Test**
```bash
# Test full stack with Docker Compose
docker-compose up -d

# Check all services
docker-compose ps

# Check logs
docker-compose logs -f

# Test application
curl http://localhost:80
```

### **Step 14: Final Verification**

1. **Run all tests**: `npm test` (if tests exist)
2. **Check all endpoints**: Verify all API routes work
3. **Test user flows**: Complete end-to-end user journeys
4. **Performance test**: Verify response times
5. **Security scan**: Run security checks
6. **Documentation**: Update README files

## 🎯 **Success Criteria**

Your application is production-ready when:
- ✅ All tests pass
- ✅ No console errors
- ✅ All API endpoints respond correctly
- ✅ Database operations work
- ✅ File uploads/downloads work
- ✅ Authentication works
- ✅ Error handling works
- ✅ Logging works
- ✅ Performance is acceptable
- ✅ Security measures are active

## 📞 **Support**

If you encounter issues:
1. Check the logs in `server/logs/`
2. Verify environment variables
3. Check database connection
4. Review the troubleshooting section above
5. Check browser console for frontend errors
