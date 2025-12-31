import React, { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../config/api';
import './ForgotPassword.css';
import logo from '../assets/logo_1.png';

interface ResetPasswordResponse {
  message?: string;
  error?: string;
  success?: boolean;
  user?: {
    id: number;
    name: string;
    email: string;
  };
}

const ResetPassword: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const navigate = useNavigate();

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();

    // Validation
    if (!email) {
      setError('Please enter the user email');
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
    setError('');
    setMessage('');

    try {
      const response = await apiClient.post<ResetPasswordResponse>(
        '/reset-password', 
        { email, newPassword }
      );
      
      // Handle both success and error responses from backend
      if (response.data.success === false) {
        setError(response.data.error || response.data.message || 'Failed to reset password. Please try again later.');
      } else {
        setMessage(response.data.message || 'Password has been reset successfully');
        // Clear form after successful reset
        setTimeout(() => {
          setEmail('');
          setNewPassword('');
          setConfirmPassword('');
        }, 2000);
      }
    } catch (err: any) {
      console.error('Reset password error:', err);
      // Backend returns error in error field for 404/400, or message field
      const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to reset password. Please try again later.';
      setError(errorMessage);
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
          <button onClick={() => navigate(-1)}>Back</button>
        </div>
      </div>
      <div className="signup-container">
        <div className="signup-form">
          <h2>Reset User Password</h2>
          {error && <div className="error-message">{error}</div>}
          {message && <div style={{ 
            color: '#48bb78', 
            backgroundColor: '#f0fff4', 
            padding: '0.8rem 1rem', 
            borderRadius: '8px', 
            marginBottom: '1.5rem', 
            textAlign: 'center', 
            fontSize: '0.9rem', 
            border: '1px solid #9ae6b4' 
          }}>{message}</div>}
          <form onSubmit={handleResetPassword}>
            <div className="form-group">
              <label htmlFor="email">User Email</label>
              <input
                type="email"
                id="email"
                name="email"
                className="form-control"
                placeholder="Enter user email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <input
                type="password"
                id="newPassword"
                name="newPassword"
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
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
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
              {isLoading ? 'Resetting Password...' : 'Reset Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;

