import axios from 'axios';
import {
  clearFinancialsSession,
  getFinancialsToken,
} from './financialsAuth';

// Environment-based API configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? 'http://40.67.147.19' : 'http://localhost:5001');

// Handle the case where the server might already have /api prefix
const baseURL = API_BASE_URL.includes('/api') ? API_BASE_URL : `${API_BASE_URL}/api`;

console.log('🔧 API Configuration:', {
  NODE_ENV: process.env.NODE_ENV,
  REACT_APP_API_URL: process.env.REACT_APP_API_URL,
  API_BASE_URL: API_BASE_URL,
  Final_BaseURL: baseURL
});

const apiClient = axios.create({
  baseURL: baseURL,
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — Financials JWT only (not VMS authToken)
apiClient.interceptors.request.use(
  (config) => {
    const token = getFinancialsToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearFinancialsSession();
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
