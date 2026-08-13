import React, { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './signup.css';
import { normalizeBusinessUnitName, serializeUserBusinessUnits, isBuHeadDesignation } from '../utils/businessUnitUtils';
import { DESIGNATION_OPTIONS, BUSINESS_UNIT_OPTIONS } from '../constants/userFormOptions';
import apiClient from '../config/api';
import logo from '../assets/logo_1.png';

type Designation = 'ASSOCIATE_VENDOR_MANAGEMENT' |'ADMIN'|'SUPER ADMIN' | 'BU HEAD' | 'FINANCE EXECUTIVE';
type BusinessUnit =  'CAPTIVE' | 'SI Tech' | 'SI BPO' | 'MANAGED  SERVICES' | 'ENGINEERING' | 'ALL';

const SIGNUP_BUSINESS_UNIT_OPTIONS = BUSINESS_UNIT_OPTIONS;

interface SignUpResponse {
  success: boolean;
  message?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    designation?: string;
    business_unit?: string;
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
  const [selectedBusinessUnits, setSelectedBusinessUnits] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const navigate = useNavigate();

  const isBuHeadSignup = formData.designation === 'BU HEAD';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'designation' && value !== 'BU HEAD' ? {} : {}),
    }));
    if (name === 'designation' && value !== 'BU HEAD') {
      setSelectedBusinessUnits([]);
    }
  };

  const toggleBusinessUnit = (value: string) => {
    setSelectedBusinessUnits((prev) =>
      prev.includes(value) ? prev.filter((bu) => bu !== value) : [...prev, value]
    );
  };

 const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();
  setError(null);

  // Read designation from DOM at submit time (avoids autofill / stale React state)
  const designationSelect = document.getElementById('designation') as HTMLSelectElement | null;
  const designation = (designationSelect?.value || formData.designation || '').trim();
  const signingUpAsBuHead = isBuHeadDesignation(designation);

  if (signingUpAsBuHead && selectedBusinessUnits.length === 0) {
    setError('Please select at least one business unit for BU HEAD.');
    return;
  }

  if (!signingUpAsBuHead && !formData.business_unit) {
    setError('Please select a business unit.');
    return;
  }

  setIsLoading(true);

  try {
    const business_unit = signingUpAsBuHead
      ? serializeUserBusinessUnits(selectedBusinessUnits)
      : (normalizeBusinessUnitName(formData.business_unit) || formData.business_unit);

    if (!business_unit) {
      setError('Business unit is required.');
      setIsLoading(false);
      return;
    }

    const payload = {
      name: formData.name.trim(),
      designation,
      email: formData.email.trim(),
      phone_number: formData.phone_number.trim(),
      password: formData.password,
      business_unit,
    };

    const response = await apiClient.post<SignUpResponse>('/signup', payload);
    
    if (response.data.success) {
      const created = response.data.user as { designation?: string; business_unit?: string } | undefined;
      const buSummary = created?.business_unit || business_unit;
      const roleSummary = created?.designation || designation;
      alert(`User signed up successfully!\nRole: ${roleSummary}\nBusiness unit(s): ${buSummary}`);
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
          <form onSubmit={handleSubmit} autoComplete="off">
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
  autoComplete="off"
  required
>
  <option value="">Select Designation</option>
  {DESIGNATION_OPTIONS.map((opt) => (
    <option key={opt.value} value={opt.value}>{opt.label}</option>
  ))}
</select>
            </div>

            <div className="form-group">
              <label id="business_units_multi_label" htmlFor={isBuHeadSignup ? undefined : 'business_unit'}>
                Business Unit{isBuHeadSignup ? ' (select one or more)' : ''}
              </label>
              {isBuHeadSignup ? (
                <div className="bu-checkbox-list" role="group" aria-labelledby="business_units_multi_label">
                  {selectedBusinessUnits.length > 0 && (
                    <div className="bu-selected-summary">
                      Selected: {serializeUserBusinessUnits(selectedBusinessUnits)}
                    </div>
                  )}
                  {SIGNUP_BUSINESS_UNIT_OPTIONS.map((opt) => {
                    const checked = selectedBusinessUnits.includes(opt.value);
                    return (
                      <label key={opt.value} className={`bu-checkbox-item${checked ? ' bu-checkbox-item--selected' : ''}`}>
                        <input
                          type="checkbox"
                          name="business_units_multi"
                          value={opt.value}
                          checked={checked}
                          onChange={() => toggleBusinessUnit(opt.value)}
                        />
                        <span>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <select
                  id="business_unit"
                  name="business_unit"
                  className="form-control"
                  value={formData.business_unit}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Business Unit</option>
                  {SIGNUP_BUSINESS_UNIT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )}
            </div>

            <button type="submit" className="submit-btn" disabled={isLoading}>Sign Up</button>
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
