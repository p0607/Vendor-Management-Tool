import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { normalizeBusinessUnitName } from '../utils/businessUnitUtils';
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
  vendor_cost: string;
  discount: string;
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
  vendor_cost: '',
  discount: '',
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Use centralized normalizeBusinessUnitName function (imported from utils)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // All fields are optional - no required field validation

    // Convert numeric fields to numbers and handle empty strings
    const formattedData = {
      ...formData,
      // Convert numeric fields to numbers
      hc: formData.hc ? parseFloat(formData.hc) : 0,
      salary_cost: formData.salary_cost ? parseFloat(formData.salary_cost) : 0,
      sales: formData.sales ? parseFloat(formData.sales) : 0,
      gpm: formData.gpm ? parseFloat(formData.gpm) : 0,
      gpm_percentage: formData.gpm_percentage ? parseFloat(formData.gpm_percentage) : 0,
      leave_encashment: formData.leave_encashment ? parseFloat(formData.leave_encashment) : 0,
      team_cost: formData.team_cost ? parseFloat(formData.team_cost) : 0,
      opr_cost: formData.opr_cost ? parseFloat(formData.opr_cost) : 0,
      funding_cost: formData.funding_cost ? parseFloat(formData.funding_cost) : 0,
      np: formData.np ? parseFloat(formData.np) : 0,
      np_percentage: formData.np_percentage ? parseFloat(formData.np_percentage) : 0,
      vendor_cost: formData.vendor_cost ? parseFloat(formData.vendor_cost) : 0,
      discount: formData.discount ? parseFloat(formData.discount) : 0,
      year: formData.year ? parseInt(formData.year) : new Date().getFullYear(),
      // Convert empty strings to null for text fields
      client_name: formData.client_name || null,
      project_name: formData.project_name || null,
      business_unit: normalizeBusinessUnitName(formData.business_unit || null),
      bu_head: formData.bu_head || null,
      tower: formData.tower || null,
      month: formData.month || null
    };

    try {
      console.log('Sending data to backend:', formattedData);
      const response = await apiClient.post('/team-report', formattedData);
      
      // Show success message
      alert('MFS data submitted successfully!');
      
      // Reset form
      setFormData(initialFormData);
      
      // Navigate back to team report compare
      navigate('/team-report/compare');
    } catch (err: any) {
      console.error('Error adding team report data:', err);
      console.error('Error response:', err.response?.data);
      setError(err.response?.data?.error || err.message || 'Failed to submit data');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="homepage">
      <header style={{ 
        display: 'flex', 
        justifyContent: 'flex-end', 
        alignItems: 'center', 
        padding: '0.5rem 1rem', 
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e9ecef',
        minHeight: '50px'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            style={{
              padding: '6px 12px',
              backgroundColor: '#ff8c00',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '600'
            }}
            onClick={() => navigate('/HomePage')}
          >
            Home
          </button>
          <button 
            style={{
              padding: '6px 12px',
              backgroundColor: '#ff8c00',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '600'
            }}
            onClick={() => navigate(-1)}
          >
            Back
          </button>
        </div>
      </header>
      <div className="add-routing-container">
        <h2>Add MFS Data</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit} className="routing-form">
          <div className="field-group">
            <div className="field-grid">
              <div className="form-group">
                <label>Tower</label>
                <input type="text" name="tower" value={formData.tower} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Client Name</label>
                <input type="text" name="client_name" value={formData.client_name} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Project Name</label>
                <input type="text" name="project_name" value={formData.project_name} onChange={handleChange} />
              </div>
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
                <label>BU Head</label>
                <input type="text" name="bu_head" value={formData.bu_head} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>HC</label>
                <input type="number" name="hc" value={formData.hc} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Salary Cost</label>
                <input type="number" name="salary_cost" value={formData.salary_cost} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Revenue</label>
                <input type="number" name="sales" value={formData.sales} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>GPM</label>
                <input type="number" name="gpm" value={formData.gpm} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>GPM %</label>
                <input type="number" name="gpm_percentage" value={formData.gpm_percentage} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Leave Encashment</label>
                <input type="number" name="leave_encashment" value={formData.leave_encashment} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Team Cost</label>
                <input type="number" name="team_cost" value={formData.team_cost} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Opr Cost</label>
                <input type="number" name="opr_cost" value={formData.opr_cost} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Funding Cost</label>
                <input type="number" name="funding_cost" value={formData.funding_cost} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>NP</label>
                <input type="number" name="np" value={formData.np} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>NP %</label>
                <input type="number" name="np_percentage" value={formData.np_percentage} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Vendor Cost</label>
                <input type="number" name="vendor_cost" value={formData.vendor_cost} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Discount</label>
                <input type="number" name="discount" value={formData.discount} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Month</label>
                <select name="month" value={formData.month} onChange={handleChange}>
                  <option value="">Select Month</option>
                  <option value="January">January</option>
                  <option value="February">February</option>
                  <option value="March">March</option>
                  <option value="April">April</option>
                  <option value="May">May</option>
                  <option value="June">June</option>
                  <option value="July">July</option>
                  <option value="August">August</option>
                  <option value="September">September</option>
                  <option value="October">October</option>
                  <option value="November">November</option>
                  <option value="December">December</option>
                </select>
              </div>
              <div className="form-group">
                <label>Year</label>
                <input type="number" name="year" value={formData.year} onChange={handleChange} min="2020" max="2030" />
              </div>
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" disabled={isSubmitting} className="submit-btn">
              {isSubmitting ? 'Submitting...' : 'Submit Data'}
            </button>
            <button type="button" onClick={() => navigate('/team-report/compare')} className="cancel-btn">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddTeamReportData;