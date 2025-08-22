import React, { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './signup.css';
import apiClient from '../config/api';
import logo from '../assets/logo_1.png';

type Designation = 'ASSOCIATE_VENDOR_MANAGEMENT' |'ADMIN'|'SUPER ADMIN' | 'BU HEAD' | 'FINANCE EXECUTIVE';
type BusinessUnit =  'CAPTIVE' | 'SI Tech' | 'SI BPO' | 'MANAGED  SERVICES' | 'ENGINEERING' | 'ALL';
interface SignUpResponse {
  success: boolean;
  message?: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  error?: string;
}

const SignUp = () => {
  const [formData, setFormData] = useState({
    name: '',
    designation: '' as Designation,
    email: '',
    phone_number: '',
    password: '',
    business_unit: '' as BusinessUnit,
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

 const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();
  setError(null);
  setIsLoading(true);

  try {
    const response = await apiClient.post<SignUpResponse>('/signup', formData);
    
    if (response.data.success) {
      alert('User signed up successfully!');
      navigate('/');
    } else {
      setError(response.data.message || 'Signup completed but with unexpected response');
    }
  } catch (error: any) {
    console.error('Signup error:', error);
    
    let errorMessage = 'Error signing up. Please try again.';
    if (error.response?.data?.error) {
      errorMessage = error.response.data.error;
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error.code === 'NETWORK_ERROR') {
      errorMessage = 'Network error. Please check your connection and try again.';
    }
    setError(errorMessage);
  } finally {
    setIsLoading(false);
  }
};
  return (
    <div className="signup-page">
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
          <h2>Create Your New Account</h2>
          {error && <div className="error-message">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name">Name</label>
              <input
                type="text"
                id="name"
                name="name"
                className="form-control"
                placeholder="Your full name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                className="form-control"
                placeholder="Email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="phone_number">Phone Number</label>
              <input
                type="text"
                id="phone_number"
                name="phone_number"
                className="form-control"
                placeholder="Phone Number"
                value={formData.phone_number}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                className="form-control"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="designation">Designation</label>
             <select
  id="designation"
  name="designation"
  className="form-control"
  value={formData.designation}
  onChange={handleChange}
  required
>
  <option value="">Select Designation</option>
  <option value="ADMIN">ADMIN</option>
  <option value="SUPER ADMIN">SUPER ADMIN</option>
  <option value="BU HEAD">BU HEAD</option>
  <option value="FINANCE EXECUTIVE">FINANCE EXECUTIVE</option>
</select>
            </div>

            <div className="form-group">
              <label htmlFor="business_unit">Business Unit</label>
              <select
                id="business_unit"
                name="business_unit"
                className="form-control"
                value={formData.business_unit}
                onChange={handleChange}
                required
              >
                <option value="">Select Business Unit</option>
                <option value="CAPTIVE">CAPTIVE</option>
                <option value="BPO|HTD">BPO|HTD</option>
                <option value="Canada">Canada</option>
                <option value="Japan">Japan</option>
                <option value="Singapore">Singapore</option>
                <option value="SI">SI</option>
                <option value="USA">USA</option>
                <option value="MS">MS</option>
                <option value="Egg">Egg</option>
                <option value="ALL">FINANCE</option>

              </select>
            </div>

            <button type="submit" className="submit-btn">Sign Up</button>
          </form>

          <p className="form-footer">
            Already have an account? <Link to="/">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignUp;