import React, { useState, FormEvent } from 'react';
import apiClient from '../config/api';
import {
  normalizeBusinessUnitName,
  serializeUserBusinessUnits,
  isBuHeadDesignation,
  parseUserBusinessUnits,
} from '../utils/businessUnitUtils';
import { DESIGNATION_OPTIONS, BUSINESS_UNIT_OPTIONS } from '../constants/userFormOptions';
import '../pages/signup.css';

interface UserLookupResponse {
  success: boolean;
  user?: {
    id: number;
    name: string;
    email: string;
    designation?: string;
    business_unit?: string;
  };
  error?: string;
}

interface UpdateUserResponse {
  success: boolean;
  message?: string;
  error?: string;
  user?: {
    id: number;
    name: string;
    email: string;
    designation?: string;
    business_unit?: string;
  };
}

interface UserAccountUpdateFormProps {
  title?: string;
  showPasswordFields?: boolean;
}

const UserAccountUpdateForm: React.FC<UserAccountUpdateFormProps> = ({
  title = 'Update User Account',
  showPasswordFields = true,
}) => {
  const [email, setEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [designation, setDesignation] = useState('');
  const [singleBusinessUnit, setSingleBusinessUnit] = useState('');
  const [selectedBusinessUnits, setSelectedBusinessUnits] = useState<string[]>([]);
  const [changePassword, setChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUser, setIsLoadingUser] = useState(false);

  const isBuHead = isBuHeadDesignation(designation);

  const toggleBusinessUnit = (value: string) => {
    setSelectedBusinessUnits((prev) =>
      prev.includes(value) ? prev.filter((bu) => bu !== value) : [...prev, value]
    );
  };

  const applyLoadedUser = (user: NonNullable<UserLookupResponse['user']>) => {
    setUserName(user.name || '');
    setDesignation(user.designation || '');
    const units = parseUserBusinessUnits(user.business_unit);
    if (isBuHeadDesignation(user.designation)) {
      setSelectedBusinessUnits(units);
      setSingleBusinessUnit(units[0] || '');
    } else {
      setSingleBusinessUnit(units[0] || '');
      setSelectedBusinessUnits([]);
    }
  };

  const handleLoadUser = async () => {
    if (!email.trim()) {
      setError('Enter user email to load account details.');
      return;
    }
    setIsLoadingUser(true);
    setError('');
    setMessage('');
    try {
      const response = await apiClient.get<UserLookupResponse>('/user-by-email', {
        params: { email: email.trim() },
      });
      if (response.data.success && response.data.user) {
        applyLoadedUser(response.data.user);
        setMessage(`Loaded account for ${response.data.user.name}`);
      } else {
        setError(response.data.error || 'User not found');
      }
    } catch (err: any) {
      const status = err.response?.status;
      const apiError = err.response?.data?.error;
      if (status === 403) {
        setError(apiError || 'Admin access required. Log out and log back in as Admin or Super Admin, then try again.');
      } else {
        setError(apiError || 'Failed to load user');
      }
    } finally {
      setIsLoadingUser(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!email.trim()) {
      setError('User email is required.');
      return;
    }

    if (!designation) {
      setError('Designation is required.');
      return;
    }

    const business_unit = isBuHead
      ? serializeUserBusinessUnits(selectedBusinessUnits)
      : (normalizeBusinessUnitName(singleBusinessUnit) || singleBusinessUnit);

    if (!business_unit) {
      setError(isBuHead ? 'Select at least one business unit for BU HEAD.' : 'Business unit is required.');
      return;
    }

    if (changePassword) {
      if (!newPassword) {
        setError('Enter a new password or uncheck "Change password".');
        return;
      }
      if (newPassword.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setIsLoading(true);
    try {
      const payload: Record<string, string> = {
        email: email.trim(),
        designation,
        business_unit,
      };
      if (changePassword && newPassword) {
        payload.newPassword = newPassword;
      }

      const response = await apiClient.post<UpdateUserResponse>('/reset-password', payload);
      if (response.data.success === false) {
        setError(response.data.error || response.data.message || 'Update failed');
      } else {
        const u = response.data.user;
        setMessage(
          response.data.message ||
            `Updated successfully.\nRole: ${u?.designation || designation}\nBusiness unit(s): ${u?.business_unit || business_unit}`
        );
        if (changePassword) {
          setNewPassword('');
          setConfirmPassword('');
          setChangePassword(false);
        }
      }
    } catch (err: any) {
      const status = err.response?.status;
      const apiError = err.response?.data?.error;
      if (status === 403) {
        setError(apiError || 'Admin access required. Log out and log back in as Admin or Super Admin, then try again.');
      } else {
        setError(apiError || err.response?.data?.message || 'Update failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="signup-form">
      <h2>{title}</h2>
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
            whiteSpace: 'pre-line',
          }}
        >
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} autoComplete="off">
        <div className="form-group">
          <label htmlFor="update-email">User Email</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="email"
              id="update-email"
              className="form-control"
              placeholder="Enter user email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="submit-btn"
              onClick={handleLoadUser}
              disabled={isLoading || isLoadingUser}
              style={{ width: 'auto', padding: '0.6rem 1rem', marginTop: 0 }}
            >
              {isLoadingUser ? 'Loading...' : 'Load'}
            </button>
          </div>
        </div>

        {userName && (
          <div className="form-group">
            <label>User Name</label>
            <input type="text" className="form-control" value={userName} readOnly disabled />
          </div>
        )}

        <div className="form-group">
          <label htmlFor="update-designation">Designation</label>
          <select
            id="update-designation"
            className="form-control"
            value={designation}
            onChange={(e) => {
              const next = e.target.value;
              setDesignation(next);
              if (isBuHeadDesignation(next) && singleBusinessUnit && selectedBusinessUnits.length === 0) {
                setSelectedBusinessUnits([singleBusinessUnit]);
              }
              if (!isBuHeadDesignation(next)) {
                setSelectedBusinessUnits([]);
              }
            }}
            required
            disabled={isLoading}
          >
            <option value="">Select Designation</option>
            {DESIGNATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>
            Business Unit{isBuHead ? ' (select one or more)' : ''}
          </label>
          {isBuHead ? (
            <div className="bu-checkbox-list" role="group">
              {selectedBusinessUnits.length > 0 && (
                <div className="bu-selected-summary">
                  Selected: {serializeUserBusinessUnits(selectedBusinessUnits)}
                </div>
              )}
              {BUSINESS_UNIT_OPTIONS.map((opt) => {
                const checked = selectedBusinessUnits.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={`bu-checkbox-item${checked ? ' bu-checkbox-item--selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleBusinessUnit(opt.value)}
                      disabled={isLoading}
                    />
                    <span>{opt.label}</span>
                  </label>
                );
              })}
            </div>
          ) : (
            <select
              className="form-control"
              value={singleBusinessUnit}
              onChange={(e) => setSingleBusinessUnit(e.target.value)}
              required={Boolean(designation)}
              disabled={isLoading}
            >
              <option value="">Select Business Unit</option>
              {BUSINESS_UNIT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {showPasswordFields && (
          <>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={changePassword}
                  onChange={(e) => setChangePassword(e.target.checked)}
                  disabled={isLoading}
                />
                Change password
              </label>
            </div>

            {changePassword && (
              <>
                <div className="form-group">
                  <label htmlFor="update-new-password">New Password</label>
                  <input
                    type="password"
                    id="update-new-password"
                    className="form-control"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isLoading}
                    minLength={6}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="update-confirm-password">Confirm New Password</label>
                  <input
                    type="password"
                    id="update-confirm-password"
                    className="form-control"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    minLength={6}
                  />
                </div>
              </>
            )}
          </>
        )}

        <button type="submit" className="submit-btn" disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
};

export default UserAccountUpdateForm;
