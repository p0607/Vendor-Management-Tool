import React, { useState, FormEvent, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../config/api';
import {
  isFinancialsAuthenticated,
  setFinancialsSession,
} from '../config/financialsAuth';
import './login.css';

const Login = () => {
  const [name, setName] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      if (isFinancialsAuthenticated()) {
        navigate('/HomePage', { replace: true });
      }
    } catch {
      /* ignore */
    }
  }, [navigate]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();

    if (!name || !password) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await apiClient.post('/login', { name, password });

      if (response.data.success && response.data.user && response.data.token) {
        setFinancialsSession(response.data.user, response.data.token);
        navigate('/HomePage', { replace: true });
      } else if (response.data.success && response.data.user) {
        setError('Login succeeded but no session token was returned. Please contact support.');
      } else {
        setError(response.data.message || 'Invalid credentials');
      }
    } catch (err: any) {
      console.error('Login error:', err);

      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.code === 'NETWORK_ERROR') {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError('An unexpected error occurred. Please try again later.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-background">
      <div className="login-logo-topright">
        <img src="/static/media/logo_1.fc31060d17d32e4105b3.png" alt="Alchemy Logo" />
      </div>
      <main className="login-center">
        <form className="glassmorphism" onSubmit={handleLogin}>
          <h2 className="login-title">FINANCIALS</h2>
          {error && <div className="login-error">{error}</div>}
          <div className="login-field">
            <label htmlFor="name">Username</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>
          <div className="login-field">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>
          <button type="submit" className="login-btn" disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Log In'}
          </button>
          <div className="login-forgot-wrap">
            <Link to="/forgot_password" className="login-forgot-link">
              Forgot Password?
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
};

export default Login;
