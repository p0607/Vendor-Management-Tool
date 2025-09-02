# Production Deployment Guide

This guide covers deploying the Vendor Management Tool to production using Docker on Ubuntu servers.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Nginx (SSL)   │    │  React Frontend │    │  Node.js API    │
│   Port 80/443   │    │   Port 3000     │    │   Port 5001     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │   Port 5432     │
                    └─────────────────┘
```

## 📋 Prerequisites

- Ubuntu 20.04+ server
- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 4GB RAM
- At least 20GB disk space
- Domain name (for SSL)

## 🚀 Quick Start

### 1. Clone and Setup

```bash
# Clone your repository
git clone <your-repo-url>
cd vendor-management-tool

# Copy environment file
cp env.example .env

# Edit environment variables
nano .env
```

### 2. Update Environment Variables

Edit `.env` file with your production values:

```bash
# Database Configuration
POSTGRES_DB=vendor_management
POSTGRES_USER=vmt_user
POSTGRES_PASSWORD=your_secure_password_here

# Backend API Configuration
JWT_SECRET=your_super_secret_jwt_key_here
FRONTEND_URL=https://yourdomain.com

# Frontend Configuration
REACT_APP_API_URL=https://yourdomain.com/api
```

### 3. Deploy

```bash
# Make deployment script executable
chmod +x deploy-production.sh

# Deploy without SSL
./deploy-production.sh

# Deploy with SSL (requires SSL certificates)
./deploy-production.sh --with-ssl
```

## 🔒 SSL Configuration

### 1. Generate SSL Certificates

```bash
# Create SSL directory
mkdir -p nginx/ssl

# Generate self-signed certificate (for testing)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem

# For production, use Let's Encrypt or your CA
```

### 2. Update Environment Variables

```bash
ENABLE_HTTPS=true
SSL_CERT_PATH=/etc/nginx/ssl/cert.pem
SSL_KEY_PATH=/etc/nginx/ssl/key.pem
```

### 3. Deploy with SSL

```bash
./deploy-production.sh --with-ssl
```

## 📊 Monitoring and Health Checks

### Health Check Endpoints

- **Frontend**: `http://localhost:3000/health`
- **API**: `http://localhost:5001/api/health`
- **Database**: Built-in PostgreSQL health check

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f client
docker-compose logs -f postgres
```

### Resource Usage

```bash
# Container stats
docker stats

# Disk usage
docker system df
```

## 🔧 Maintenance

### Update Application

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose up -d --build
```

### Database Backup

```bash
# Create backup
docker-compose exec postgres pg_dump -U vmt_user vendor_management > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
docker-compose exec -T postgres psql -U vmt_user vendor_management < backup_file.sql
```

### Cleanup

```bash
# Remove unused containers, networks, and images
docker system prune -a

# Remove unused volumes
docker volume prune
```

## 🚨 Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Check what's using the port
   sudo netstat -tulpn | grep :5001
   
   # Kill the process
   sudo kill -9 <PID>
   ```

2. **Database Connection Issues**
   ```bash
   # Check database logs
   docker-compose logs postgres
   
   # Check database connectivity
   docker-compose exec postgres pg_isready -U vmt_user
   ```

3. **Memory Issues**
   ```bash
   # Check memory usage
   docker stats
   
   # Increase swap if needed
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```

### Performance Tuning

1. **Database Optimization**
   ```bash
   # Add to postgres service in docker-compose.yml
   environment:
     POSTGRES_SHARED_BUFFERS: 256MB
     POSTGRES_EFFECTIVE_CACHE_SIZE: 1GB
   ```

2. **Nginx Optimization**
   ```bash
   # Update nginx.conf with worker_processes auto;
   # and worker_connections 1024;
   ```

## 📈 Scaling

### Horizontal Scaling

```bash
# Scale API service
docker-compose up -d --scale api=3

# Scale with load balancer
# Add nginx load balancer configuration
```

### Vertical Scaling

- Increase server resources
- Optimize Docker resource limits
- Use resource constraints in docker-compose.yml

## 🔐 Security Best Practices

1. **Change Default Passwords**
   - Update all default passwords in `.env`
   - Use strong, unique passwords

2. **Network Security**
   - Use custom Docker networks
   - Restrict port exposure
   - Use firewall rules

3. **Container Security**
   - Run containers as non-root users
   - Keep base images updated
   - Scan images for vulnerabilities

4. **SSL/TLS**
   - Use strong ciphers
   - Enable HSTS
   - Regular certificate renewal

## 📞 Support

For issues and questions:

1. Check logs: `docker-compose logs -f`
2. Verify configuration: `docker-compose config`
3. Check service status: `docker-compose ps`
4. Review this documentation

## 📝 Changelog

- **v1.0.0**: Initial production deployment setup
- Multi-stage Docker builds
- Health checks and monitoring
- SSL support
- Production-grade Nginx configuration
