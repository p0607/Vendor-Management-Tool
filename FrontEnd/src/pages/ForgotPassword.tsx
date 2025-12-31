import React, { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../config/api';
import './ForgotPassword.css';

interface ForgotPasswordResponse {
  message?: string;
  error?: string;
  success?: boolean;
}

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const navigate = useNavigate();

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();

    if (!email) {
      setError('Please enter your email');
      return;
    }

    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await apiClient.post<ForgotPasswordResponse>(
        '/forgot-password', 
        { email }
      );
      
      // Handle both success and error responses from backend
      if (response.data.success === false) {
        setError(response.data.error || response.data.message || 'Failed to send reset link. Please try again later.');
      } else {
        setMessage(response.data.message || 'Password reset instructions sent to your email');
      }
    } catch (err: any) {
      console.error('Forgot password error:', err);
      // Backend returns error in error field for 404/400, or message field
      const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to send reset link. Please try again later.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="forgot-password-page">
      <header className="header">
        <div className="logo">
          <img src="/Logo.jpg" alt="Alchemy Logo" />
        </div>
        <div className='back-btn'>
          <button onClick={() => navigate(-1)}>Back</button>
        </div>
      </header>
      <h2>Forgot Password</h2>
      <form onSubmit={handleForgotPassword}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
        />
        <button type="submit">Send Reset Link</button>
      </form>

      {message && <p className="success-message">{message}</p>}
      {error && <p className="error-message">{error}</p>}
    </div>
  );
};

export default ForgotPassword;