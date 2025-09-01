# Vendor Management API - Production Ready

A production-ready Node.js/Express API for the Vendor Management Tool with comprehensive security, monitoring, and deployment configurations.

## 🚀 Features

- **Security**: Helmet, CORS, Rate Limiting, Input Validation
- **Performance**: Compression, Connection Pooling, Caching
- **Monitoring**: Winston Logging, Health Checks, Error Tracking
- **Deployment**: Docker, Docker Compose, PM2, Nginx
- **Database**: PostgreSQL with connection pooling
- **File Upload**: Secure file handling with validation

## 📋 Prerequisites

- Node.js 16+ 
- Docker & Docker Compose
- PostgreSQL 12+
- Redis (optional, for caching)

## 🛠️ Installation

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

### Production Setup

#### Option 1: Docker Deployment (Recommended)

1. **Build and start services**
   ```bash
   docker-compose up -d
   ```

2. **Deploy using script**
   ```bash
   # Windows
   deploy.bat
   
   # Linux/Mac
   ./deploy.sh
   ```

#### Option 2: PM2 Deployment

1. **Install PM2 globally**
   ```bash
   npm install -g pm2
   ```

2. **Start with PM2**
   ```bash
   pm2 start ecosystem.config.js --env production
   ```

3. **Monitor the application**
   ```bash
   pm2 monit
   ```

## 🔧 Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# Environment
NODE_ENV=production
PORT=5001

# Database
DB_USER=postgres
DB_HOST=localhost
DB_NAME=Vendor_Management
DB_PASSWORD=your_secure_password
DB_PORT=5432

# Security
JWT_SECRET=your_jwt_secret_here
BCRYPT_ROUNDS=12

# Frontend URL (for CORS)
FRONTEND_URL=https://yourdomain.com

# Redis (optional)
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Production Configuration

The application uses different configurations for different environments:

- **Development**: `NODE_ENV=development`
- **Production**: `NODE_ENV=production`

## 🔒 Security Features

### Implemented Security Measures

1. **Helmet.js**: Security headers
2. **CORS**: Cross-origin resource sharing protection
3. **Rate Limiting**: API rate limiting (100 req/15min in production)
4. **Input Validation**: Request validation middleware
5. **SQL Injection Protection**: Parameterized queries
6. **File Upload Security**: File type and size validation
7. **Password Hashing**: bcrypt with 12 rounds
8. **HTTPS**: SSL/TLS encryption (via Nginx)

### Security Headers

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Referrer-Policy: strict-origin-when-cross-origin`

## 📊 Monitoring & Logging

### Logging

- **Winston Logger**: Structured logging with different levels
- **Log Files**: Separate error and combined logs
- **Log Rotation**: Automatic log rotation and cleanup

### Health Checks

- **Health Endpoint**: `GET /health`
- **Database Connection**: Automatic connection monitoring
- **Service Status**: PM2/Docker health checks

### Monitoring Endpoints

```bash
# Health check
curl http://localhost:5001/health

# Service status (PM2)
pm2 status

# Docker status
docker-compose ps
```

## 🚀 Deployment

### Docker Deployment

1. **Build and start**
   ```bash
   docker-compose up -d
   ```

2. **View logs**
   ```bash
   docker-compose logs -f api
   ```

3. **Stop services**
   ```bash
   docker-compose down
   ```

### PM2 Deployment

1. **Start application**
   ```bash
   pm2 start ecosystem.config.js --env production
   ```

2. **Monitor**
   ```bash
   pm2 monit
   ```

3. **Restart**
   ```bash
   pm2 restart vendor-management-api
   ```

### Nginx Configuration

The included `nginx.conf` provides:

- SSL/TLS termination
- Load balancing
- Rate limiting
- Gzip compression
- Security headers
- Static file serving

## 📁 Project Structure

```
server/
├── index.js                 # Main application file
├── package.json            # Dependencies and scripts
├── ecosystem.config.js     # PM2 configuration
├── Dockerfile             # Docker configuration
├── docker-compose.yml     # Docker services
├── nginx.conf            # Nginx configuration
├── deploy.sh             # Linux deployment script
├── deploy.bat            # Windows deployment script
├── config/
│   └── production.js     # Production configuration
├── logs/                 # Application logs
├── uploads/              # File uploads
└── backups/              # Deployment backups
```

## 🔧 API Endpoints

### Authentication
- `POST /api/signup` - User registration
- `POST /api/login` - User authentication

### CTS (Cost to Serve)
- `GET /api/CTS` - Get all CTS records
- `POST /api/CTS` - Create new CTS record
- `PUT /api/CTS/:id` - Update CTS record
- `PATCH /api/CTS/:id` - Partial update

### Alchemy Routing
- `GET /api/Alchemy_Routing` - Get all routing records
- `POST /api/Alchemy_Routing` - Create new routing record
- `PUT /api/Alchemy_Routing/:id` - Update routing record
- `PATCH /api/Alchemy_Routing/:id` - Partial update

### Team Reports
- `GET /api/team-report` - Get team reports
- `POST /api/team-report` - Create team report
- `POST /api/team-report/bulk` - Bulk import

### HRMS Data
- `POST /api/hrms_data` - Create HRMS record

### File Upload
- `POST /api/upload` - Upload files

### Health Check
- `GET /health` - Application health status

## 🛡️ Security Best Practices

### Before Production Deployment

1. **Change Default Passwords**
   - Update database password
   - Change JWT secret
   - Update any hardcoded credentials

2. **SSL Certificate**
   - Obtain valid SSL certificate
   - Update Nginx configuration
   - Enable HTTPS redirect

3. **Environment Variables**
   - Use strong, unique passwords
   - Store secrets securely
   - Never commit `.env` files

4. **Database Security**
   - Use dedicated database user
   - Limit database permissions
   - Enable SSL connections

5. **Network Security**
   - Configure firewall rules
   - Use VPN for database access
   - Implement IP whitelisting

## 📈 Performance Optimization

### Database Optimization

1. **Connection Pooling**: Configured with max 20 connections
2. **Query Optimization**: Use indexes on frequently queried columns
3. **Connection Timeout**: 30 seconds idle timeout

### Application Optimization

1. **Compression**: Gzip compression enabled
2. **Caching**: Redis integration for caching
3. **Rate Limiting**: Prevents abuse
4. **File Upload Limits**: 10MB max file size

## 🔍 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   # Check database status
   docker-compose ps postgres
   
   # Check logs
   docker-compose logs postgres
   ```

2. **API Not Responding**
   ```bash
   # Check API logs
   docker-compose logs api
   
   # Test health endpoint
   curl http://localhost:5001/health
   ```

3. **File Upload Issues**
   ```bash
   # Check upload directory permissions
   ls -la uploads/
   
   # Check file size limits
   # Default: 10MB
   ```

### Log Analysis

```bash
# View application logs
tail -f logs/combined.log

# View error logs
tail -f logs/error.log

# Search for specific errors
grep "ERROR" logs/combined.log
```

## 📞 Support

For issues and questions:

1. Check the logs in `./logs/`
2. Review the troubleshooting section
3. Check Docker container status
4. Verify environment configuration

## 📄 License

This project is licensed under the ISC License.

## 🔄 Updates

To update the application:

1. **Pull latest changes**
   ```bash
   git pull origin main
   ```

2. **Rebuild and restart**
   ```bash
   # Docker
   docker-compose down
   docker-compose up -d --build
   
   # PM2
   pm2 reload vendor-management-api
   ```

3. **Verify deployment**
   ```bash
   curl http://localhost:5001/health
   ```
