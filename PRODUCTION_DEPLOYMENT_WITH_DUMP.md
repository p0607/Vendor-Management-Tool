# 🚀 Production Deployment with Database Dump

## 📦 **Files to Send to Production Team**

### **1. Application Files**
```
Vendor Management Tool/
├── client/                    # React frontend
├── server/                    # Node.js backend
├── docker-compose.yml         # Docker orchestration
├── PRODUCTION_DEPLOYMENT_CHECKLIST.md
└── PRODUCTION_TESTING_GUIDE.md
```

### **2. Database Dump File**
```
vendor_management_dump_YYYYMMDD_HHMMSS.sql
```

## 🗄️ **Database Setup Instructions**

### **Option A: Using Database Dump (Recommended)**

#### **Step 1: Create Database**
```sql
-- Connect to PostgreSQL as superuser
psql -U postgres

-- Create database
CREATE DATABASE "Vendor_Management";

-- Create user (if needed)
CREATE USER postgres WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE "Vendor_Management" TO postgres;

-- Exit psql
\q
```

#### **Step 2: Restore Database from Dump**
```bash
# Restore the database from dump file
psql -h localhost -U postgres -d Vendor_Management -f vendor_management_dump_YYYYMMDD_HHMMSS.sql
```

### **Option B: Using Docker (Alternative)**

#### **Step 1: Start PostgreSQL Container**
```bash
docker run --name vendor-management-db \
  -e POSTGRES_DB=Vendor_Management \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=your_secure_password \
  -p 5432:5432 \
  -d postgres:15-alpine
```

#### **Step 2: Restore Database**
```bash
# Copy dump file to container
docker cp vendor_management_dump_YYYYMMDD_HHMMSS.sql vendor-management-db:/tmp/

# Restore database
docker exec -it vendor-management-db psql -U postgres -d Vendor_Management -f /tmp/vendor_management_dump_YYYYMMDD_HHMMSS.sql
```

## 🔧 **Production Environment Setup**

### **1. Update Environment Variables**

#### **Backend (.env)**
```env
NODE_ENV=production
PORT=5001
DB_USER=postgres
DB_HOST=localhost
DB_NAME=Vendor_Management
DB_PASSWORD=your_secure_password
DB_PORT=5432
JWT_SECRET=your_very_secure_jwt_secret
FRONTEND_URL=https://your-domain.com
```

#### **Frontend (.env)**
```env
REACT_APP_API_URL=https://your-domain.com
REACT_APP_ENV=production
```

### **2. Deploy with Docker**
```bash
# Navigate to project directory
cd "Vendor Management Tool"

# Start all services
docker-compose up -d

# Check if all services are running
docker-compose ps

# View logs
docker-compose logs -f
```

## 📋 **Production Checklist**

### **✅ Database**
- [ ] Database dump file provided
- [ ] Database created on production server
- [ ] Database restored from dump file
- [ ] Database connection tested
- [ ] All tables and data present

### **✅ Application**
- [ ] Environment variables configured
- [ ] Docker containers running
- [ ] Frontend accessible
- [ ] Backend API responding
- [ ] Health check endpoint working

### **✅ Security**
- [ ] Strong passwords set
- [ ] JWT secret configured
- [ ] CORS settings correct
- [ ] Rate limiting active
- [ ] SSL certificate installed

## 🚀 **Verification Steps**

### **1. Test Database Connection**
```bash
# Test connection
psql -h localhost -U postgres -d Vendor_Management -c "SELECT COUNT(*) FROM users;"
```

### **2. Test API Endpoints**
```bash
# Health check
curl http://your-domain.com/health

# API health check
curl http://your-domain.com/api/health
```

### **3. Test Frontend**
- Open https://your-domain.com
- Test login functionality
- Test data operations
- Test file uploads

## 🔄 **Database Migration (Future Updates)**

### **Creating New Dumps**
```bash
# Create new dump with timestamp
pg_dump -h localhost -U postgres -d Vendor_Management -f "vendor_management_dump_$(date +%Y%m%d_%H%M%S).sql"
```

### **Applying Updates**
```bash
# Apply new dump (this will overwrite existing data)
psql -h localhost -U postgres -d Vendor_Management -f new_dump_file.sql
```

## 📞 **Support**

### **Common Issues**

#### **Database Connection Failed**
```bash
# Check if PostgreSQL is running
systemctl status postgresql

# Check connection
pg_isready -h localhost -p 5432
```

#### **Permission Denied**
```bash
# Check PostgreSQL logs
tail -f /var/log/postgresql/postgresql-*.log

# Check user permissions
psql -U postgres -c "\du"
```

#### **Docker Issues**
```bash
# Check container status
docker ps

# Check container logs
docker logs vendor-management-db
docker logs vendor-management-api
docker logs vendor-management-frontend
```

## 🎯 **Success Criteria**

Your application is successfully deployed when:
- ✅ Database dump restored successfully
- ✅ All containers running without errors
- ✅ Frontend accessible at your domain
- ✅ Backend API responding correctly
- ✅ All functionality working as expected
- ✅ No error messages in logs

## 📝 **Notes**

1. **Backup Strategy**: Always keep multiple copies of your database dump
2. **Security**: Use strong, unique passwords for production
3. **Monitoring**: Set up log monitoring for production
4. **Updates**: Plan regular database backups and application updates
5. **Testing**: Test the restored database thoroughly before going live
