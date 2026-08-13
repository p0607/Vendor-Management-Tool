import React from 'react';
import { useNavigate } from 'react-router-dom';
import UserAccountUpdateForm from '../components/UserAccountUpdateForm';
import './ForgotPassword.css';
import logo from '../assets/logo_1.png';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();

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
        <UserAccountUpdateForm title="Manage User Account (Admin)" />
      </div>
    </div>
  );
};

export default ResetPassword;
