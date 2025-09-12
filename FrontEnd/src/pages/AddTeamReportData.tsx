import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../config/api';
import './AddTeamReportData.css';

interface TeamReportData {
  tower: string;
  client_name: string;
  project_name: string;
  business_unit: string;
  bu_head: string;
  hc: string;
  salary_cost: string;
  sales: string;
  gpm: string;
  gpm_percentage: string;
  leave_encashment: string;
  team_cost: string;
  opr_cost: string;
  funding_cost: string;
  np: string;
  np_percentage: string;
  month: string;
  year: string;
}

const initialFormData: TeamReportData = {
  tower: '',
  client_name: '',
  project_name: '',
  business_unit: '',
  bu_head: '',
  hc: '',
  salary_cost: '',
  sales: '',
  gpm: '',
  gpm_percentage: '',
  leave_encashment: '',
  team_cost: '',
  opr_cost: '',
  funding_cost: '',
  np: '',
  np_percentage: '',
  month: '',
  year: '',
};

const AddTeamReportData: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<TeamReportData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

const BUSINESS_UNIT_OPTIONS = [
  "BPO | HTD",
  "Canada",
  "Captive",
  "Egg",
  "Japan",
  "MS",
  "SI",
  "Singapore",
  "USA"
];

const PARTICULARS_OPTIONS = [
  "GPM",
  "HC",
  "Net Margin",
  "Revenue",
  "Team Cost"
];
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (!formData.tower || !formData.client_name || !formData.project_name || !formData.business_unit || !formData.month || !formData.year) {
      setError('Please fill in all required fields (Tower, Client Name, Project Name, Business Unit, Month, Year)');
      setIsSubmitting(false);
      return;
    }

    // Convert month value (YYYY-MM) to a proper date format (YYYY-MM-01)
    const formattedData = {
      ...formData,
      month: formData.month ? `${formData.month}-01` : formData.month
    };

    try {
      const response = await apiClient.post('/team-report', formattedData);
      
      // Show success message
      alert('MFS data submitted successfully!');
      
      navigate('/AddTeamReportData'); // Change to your desired route after submit
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to submit data');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="homepage">
      <header className="header">
        <div className="logo">
          <img src="/Logo.jpg" alt="Alchemy Logo" />
        </div>
        <div className="tabs">
          <button className="tab-button" onClick={() => navigate('/HomePage')}>Home</button>
          <button className="tab-button" onClick={() => navigate(-1)}>Back</button>
        </div>
      </header>
      <div className="add-routing-container">
        <h2>Add MFS Data</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit} className="routing-form">
          <div className="field-group">
            <div className="field-grid">
              <div className="form-group">
  <label>Business Unit</label>
  <select name="business_unit" value={formData.business_unit} onChange={handleChange}>
    <option value="">Select Business Unit</option>
    {BUSINESS_UNIT_OPTIONS.map(opt => (
      <option key={opt} value={opt}>{opt}</option>
    ))}
  </select>
</div>
<div className="form-group">
  <label>Particulars</label>
  <select name="particulars" value={formData.particulars} onChange={handleChange}>
    <option value="">Select Particulars</option>
    {PARTICULARS_OPTIONS.map(opt => (
      <option key={opt} value={opt}>{opt}</option>
    ))}
  </select>
</div>
              <div className="form-group">
                <label>Amount</label>
                <input type="number" name="amount" value={formData.amount} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Month</label>
                <input type="month" name="month" value={formData.month} onChange={handleChange} />
              </div>
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" disabled={isSubmitting} className="submit-btn">
              {isSubmitting ? 'Submitting...' : 'Submit Data'}
            </button>
            <button type="button" onClick={() => navigate('/TeamReportDashboard')} className="cancel-btn">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddTeamReportData;