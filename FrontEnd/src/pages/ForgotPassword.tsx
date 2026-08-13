import React, { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../config/api';
import './ForgotPassword.css';
import './signup.css';
import logo from '../assets/logo_1.png';

interface ResetPasswordResponse {
  message?: string;
  error?: string;
  success?: boolean;
}

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }
    if (!newPassword) {
      setError('Please enter a new password');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiClient.post<ResetPasswordResponse>('/reset-password', {
        email: email.trim(),
        newPassword,
      });

      if (response.data.success === false) {
        setError(response.data.error || response.data.message || 'Failed to reset password.');
      } else {
        setMessage(response.data.message || 'Password has been reset successfully. You can log in now.');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          'Failed to reset password. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="forgot-password-page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2rem 2rem 0 2rem' }}>
        <div className="signup-logo-top-left">
          <img src={logo} alt="Company Logo" />
        </div>
        <div className="back-btn">
          <button type="button" onClick={() => navigate('/')}>Back to Login</button>
        </div>
      </div>

      <div className="signup-container">
        <div className="signup-form">
          <h2>Forgot Password</h2>
          <p className="signup-form-hint">
            Enter your registered email and choose a new password.
          </p>

          {error && <div className="error-message">{error}</div>}
          {message && (
            <div
              style={{
                color: '#48bb78',
                backgroundColor: '#f0fff4',
                padding: '0.8rem 1rem',
                borderRadius: '8px',
                marginBottom: '1.5rem',
                textAlign: 'center',
                fontSize: '0.9rem',
                border: '1px solid #9ae6b4',
              }}
            >
              {message}
            </div>
          )}

          <form onSubmit={handleResetPassword} autoComplete="off">
            <div className="form-group">
              <label htmlFor="forgot-email">Email</label>
              <input
                type="email"
                id="forgot-email"
                className="form-control"
                placeholder="Your registered email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="forgot-new-password">New Password</label>
              <input
                type="password"
                id="forgot-new-password"
                className="form-control"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isLoading}
                required
                minLength={6}
              />
            </div>

            <div className="form-group">
              <label htmlFor="forgot-confirm-password">Confirm New Password</label>
              <input
                type="password"
                id="forgot-confirm-password"
                className="form-control"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                required
                minLength={6}
              />
            </div>

            <button type="submit" className="submit-btn" disabled={isLoading}>
              {isLoading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>

          <p className="form-footer">
            Remember your password? <Link to="/">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
