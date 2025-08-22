# Vendor Management Tool - Frontend

A production-ready React TypeScript frontend for the Vendor Management Tool with modern UI/UX and comprehensive features.

## 🚀 Features

- **Modern React**: Built with React 19 and TypeScript
- **UI Framework**: Ant Design for consistent and beautiful components
- **Routing**: React Router for seamless navigation
- **State Management**: React hooks for efficient state management
- **API Integration**: Centralized API client with error handling
- **Responsive Design**: Mobile-first responsive design
- **Security**: JWT authentication and secure API calls
- **Performance**: Optimized builds with code splitting

## 📋 Prerequisites

- Node.js 16+
- npm or yarn
- Modern web browser

## 🛠️ Installation

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd client
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   # Create .env file
   cp .env.example .env
   # Edit .env with your API URL
   REACT_APP_API_URL=http://localhost:5001
   ```

4. **Start development server**
   ```bash
   npm start
   ```

### Production Setup

#### Option 1: Docker Deployment (Recommended)

1. **Build and start all services**
   ```bash
   docker-compose up -d
   ```

2. **Access the application**
   - Frontend: http://localhost:3000
   - API: http://localhost:5001

#### Option 2: Manual Build

1. **Build for production**
   ```bash
   npm run build:prod
   ```

2. **Serve the build**
   ```bash
   npx serve -s build -l 3000
   ```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the client directory:

```env
# API Configuration
REACT_APP_API_URL=http://localhost:5001

# Environment
REACT_APP_ENV=development

# Feature Flags
REACT_APP_ENABLE_ANALYTICS=false
REACT_APP_ENABLE_DEBUG_MODE=true

# External Services (optional)
REACT_APP_GOOGLE_ANALYTICS_ID=
REACT_APP_SENTRY_DSN=
```

### API Configuration

The frontend uses a centralized API client (`src/config/api.ts`) that:

- Automatically handles authentication tokens
- Provides consistent error handling
- Supports request/response interceptors
- Manages API timeouts and retries

## 📁 Project Structure

```
client/
├── public/                 # Static files
├── src/
│   ├── assets/            # Images, fonts, etc.
│   ├── components/        # Reusable components
│   ├── config/           # Configuration files
│   │   ├── api.ts        # API client configuration
│   │   └── environment.ts # Environment settings
│   ├── pages/            # Page components
│   ├── App.tsx           # Main app component
│   └── index.tsx         # Entry point
├── Dockerfile            # Docker configuration
├── nginx.conf           # Nginx configuration
├── package.json         # Dependencies and scripts
└── tsconfig.json        # TypeScript configuration
```

## 🚀 Available Scripts

- `npm start` - Start development server
- `npm run build` - Build for production
- `npm run build:prod` - Build with production API URL
- `npm test` - Run tests
- `npm run test:coverage` - Run tests with coverage
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run type-check` - Check TypeScript types

## 🔒 Security Features

### Implemented Security Measures

1. **JWT Authentication**: Secure token-based authentication
2. **API Security**: All API calls use HTTPS in production
3. **Input Validation**: Client-side validation for all forms
4. **XSS Protection**: React's built-in XSS protection
5. **CSRF Protection**: Token-based CSRF protection
6. **Secure Headers**: Security headers via Nginx

### Security Best Practices

- Never store sensitive data in localStorage (except tokens)
- Always validate user input
- Use HTTPS in production
- Implement proper error handling
- Regular dependency updates

## 📊 Performance Optimization

### Build Optimization

- **Code Splitting**: Automatic code splitting by routes
- **Tree Shaking**: Unused code elimination
- **Minification**: JavaScript and CSS minification
- **Compression**: Gzip compression for assets
- **Caching**: Optimized caching strategies

### Runtime Optimization

- **Lazy Loading**: Components loaded on demand
- **Memoization**: React.memo for expensive components
- **Virtual Scrolling**: For large data tables
- **Image Optimization**: Optimized image loading

## 🎨 UI/UX Features

### Design System

- **Ant Design**: Consistent component library
- **Responsive Design**: Mobile-first approach
- **Accessibility**: WCAG 2.1 compliance
- **Dark/Light Mode**: Theme support (if implemented)

### User Experience

- **Loading States**: Proper loading indicators
- **Error Handling**: User-friendly error messages
- **Form Validation**: Real-time validation feedback
- **Navigation**: Intuitive navigation structure

## 🔍 Testing

### Testing Strategy

- **Unit Tests**: Component and utility testing
- **Integration Tests**: API integration testing
- **E2E Tests**: End-to-end user flow testing

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- --testPathPattern=Login
```

## 🚀 Deployment

### Docker Deployment

1. **Build the image**
   ```bash
   docker build -t vendor-management-frontend .
   ```

2. **Run the container**
   ```bash
   docker run -p 3000:80 vendor-management-frontend
   ```

### Production Deployment

1. **Build for production**
   ```bash
   npm run build:prod
   ```

2. **Deploy to web server**
   - Copy `build/` folder to web server
   - Configure Nginx/Apache
   - Set up SSL certificates

### CI/CD Pipeline

Example GitHub Actions workflow:

```yaml
name: Deploy Frontend
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - run: npm run test
      - name: Deploy to server
        run: |
          # Deployment commands
```

## 🔧 Troubleshooting

### Common Issues

1. **API Connection Failed**
   - Check `REACT_APP_API_URL` in `.env`
   - Verify backend server is running
   - Check network connectivity

2. **Build Errors**
   - Clear `node_modules` and reinstall
   - Check TypeScript errors
   - Verify all dependencies are installed

3. **Runtime Errors**
   - Check browser console for errors
   - Verify API responses
   - Check authentication status

### Debug Mode

Enable debug mode in `.env`:
```env
REACT_APP_ENABLE_DEBUG_MODE=true
```

## 📞 Support

For issues and questions:

1. Check the browser console for errors
2. Review the API documentation
3. Check the backend server logs
4. Verify environment configuration

## 📄 License

This project is licensed under the ISC License.

## 🔄 Updates

To update the frontend:

1. **Pull latest changes**
   ```bash
   git pull origin main
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build and deploy**
   ```bash
   npm run build:prod
   ```

4. **Restart services**
   ```bash
   docker-compose restart frontend
   ```
