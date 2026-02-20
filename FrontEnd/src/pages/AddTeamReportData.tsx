import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { normalizeBusinessUnitName, compareBusinessUnits } from '../utils/businessUnitUtils';
import apiClient from '../config/api';
import './AddTeamReportData.css';

/** Compute GPM and NP from other params by business unit (same logic as import). */
function computeGpmNpFromParams(data: {
  revenue: number;
  salary_cost: number;
  rebate: number;
  passthrough: number;
  leave_encashment: number;
  team_cost: number;
  opr_cost: number;
  funding_cost: number;
  discount: number;
  vendor_cost: number;
  business_unit: string | null;
}): { gpm: number; np: number | null; gpm_percentage: number | null; np_percentage: number | null } {
  const rev = data.revenue;
  const bu = data.business_unit ? normalizeBusinessUnitName(data.business_unit) : null;
  let gpm: number;
  let np: number | null = null;
  if (compareBusinessUnits(bu, 'MS') || compareBusinessUnits(bu, 'Managed Services')) {
    gpm = rev - data.salary_cost;
  } else if (compareBusinessUnits(bu, 'USA')) {
    gpm = rev - data.salary_cost - data.rebate - data.passthrough;
  } else if (compareBusinessUnits(bu, 'Japan')) {
    gpm = rev - data.salary_cost - data.discount;
  } else if (compareBusinessUnits(bu, 'Canada') || compareBusinessUnits(bu, 'Singapore')) {
    gpm = rev - data.salary_cost;
  } else {
    gpm = rev - data.salary_cost - data.leave_encashment - data.vendor_cost - data.rebate;
    np = gpm - data.team_cost - data.opr_cost - data.funding_cost;
  }
  const gpmPct = rev !== 0 ? (gpm / rev) * 100 : null;
  const npPct = np !== null && rev !== 0 ? (np / rev) * 100 : null;
  return { gpm, np, gpm_percentage: gpmPct, np_percentage: npPct };
}

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

  // Auto-calculated GPM/NP from other params by business unit (same formulas as import)
  const computedGpmNp = useMemo(() => {
    const revenue = formData.sales ? parseFloat(formData.sales) : 0;
    const salary_cost = formData.salary_cost ? parseFloat(formData.salary_cost) : 0;
    const rebate = 0;
    const passthrough = 0;
    const leave_encashment = formData.leave_encashment ? parseFloat(formData.leave_encashment) : 0;
    const team_cost = formData.team_cost ? parseFloat(formData.team_cost) : 0;
    const opr_cost = formData.opr_cost ? parseFloat(formData.opr_cost) : 0;
    const funding_cost = formData.funding_cost ? parseFloat(formData.funding_cost) : 0;
    const bu = formData.business_unit ? normalizeBusinessUnitName(formData.business_unit) : null;
    const discount = formData.discount ? parseFloat(formData.discount) : 0;
    const vendor_cost = formData.vendor_cost ? parseFloat(formData.vendor_cost) : 0;
    return computeGpmNpFromParams({
      revenue,
      salary_cost,
      rebate,
      passthrough,
      leave_encashment,
      team_cost,
      opr_cost,
      funding_cost,
      discount,
      vendor_cost,
      business_unit: bu
    });
  }, [formData.sales, formData.salary_cost, formData.leave_encashment, formData.team_cost, formData.opr_cost, formData.funding_cost, formData.discount, formData.vendor_cost, formData.business_unit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const rev = formData.sales ? parseFloat(formData.sales) : 0;
    const salary_cost = formData.salary_cost ? parseFloat(formData.salary_cost) : 0;
    const rebate = 0;
    const passthrough = 0;
    const leave_encashment = formData.leave_encashment ? parseFloat(formData.leave_encashment) : 0;
    const team_cost = formData.team_cost ? parseFloat(formData.team_cost) : 0;
    const opr_cost = formData.opr_cost ? parseFloat(formData.opr_cost) : 0;
    const funding_cost = formData.funding_cost ? parseFloat(formData.funding_cost) : 0;
    const discount = formData.discount ? parseFloat(formData.discount) : 0;
    const vendor_cost = formData.vendor_cost ? parseFloat(formData.vendor_cost) : 0;
    const bu = formData.business_unit ? normalizeBusinessUnitName(formData.business_unit) : null;
    const computed = computeGpmNpFromParams({
      revenue: rev || 0,
      salary_cost,
      rebate,
      passthrough,
      leave_encashment,
      team_cost,
      opr_cost,
      funding_cost,
      discount,
      vendor_cost,
      business_unit: bu
    });
    // Use auto-calculated GPM/NP when we have a BU (so "other params" drive GPM/NP); otherwise use form values
    const useComputed = Boolean(bu);
    const gpm = useComputed ? computed.gpm : (formData.gpm ? parseFloat(formData.gpm) : 0);
    const np = useComputed && computed.np !== null ? computed.np : (formData.np ? parseFloat(formData.np) : 0);
    const gpm_percentage = useComputed && computed.gpm_percentage !== null ? computed.gpm_percentage : (formData.gpm_percentage ? parseFloat(formData.gpm_percentage) : 0);
    const np_percentage = useComputed && computed.np_percentage !== null ? computed.np_percentage : (formData.np_percentage ? parseFloat(formData.np_percentage) : 0);

    const formattedData = {
      ...formData,
      revenue: rev || 0,
      hc: formData.hc ? parseFloat(formData.hc) : 0,
      salary_cost,
      sales: formData.sales ? parseFloat(formData.sales) : 0,
      gpm,
      gpm_percentage,
      leave_encashment,
      team_cost,
      opr_cost,
      funding_cost,
      np,
      np_percentage,
      vendor_cost: formData.vendor_cost ? parseFloat(formData.vendor_cost) : 0,
      discount: formData.discount ? parseFloat(formData.discount) : 0,
      year: formData.year ? parseInt(formData.year) : new Date().getFullYear(),
      client_name: formData.client_name || null,
      project_name: formData.project_name || null,
      business_unit: bu,
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
              {formData.business_unit && (
                <p style={{ gridColumn: '1 / -1', fontSize: '12px', color: '#666', margin: '0 0 8px 0' }}>
                  GPM, NP and their % are auto-calculated from the above fields when you submit (based on Business Unit).
                </p>
              )}
              <div className="form-group">
                <label>GPM</label>
                <input type="number" name="gpm" value={formData.gpm || (formData.business_unit ? String(computedGpmNp.gpm) : '')} onChange={handleChange} placeholder={formData.business_unit ? String(computedGpmNp.gpm) : undefined} />
              </div>
              <div className="form-group">
                <label>GPM %</label>
                <input type="number" name="gpm_percentage" value={formData.gpm_percentage || (formData.business_unit && computedGpmNp.gpm_percentage != null ? String(computedGpmNp.gpm_percentage.toFixed(2)) : '')} onChange={handleChange} placeholder={formData.business_unit && computedGpmNp.gpm_percentage != null ? String(computedGpmNp.gpm_percentage.toFixed(2)) : undefined} />
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
                <input type="number" name="np" value={formData.np || (formData.business_unit && computedGpmNp.np !== null ? String(computedGpmNp.np) : '')} onChange={handleChange} placeholder={formData.business_unit && computedGpmNp.np !== null ? String(computedGpmNp.np) : undefined} />
              </div>
              <div className="form-group">
                <label>NP %</label>
                <input type="number" name="np_percentage" value={formData.np_percentage || (formData.business_unit && computedGpmNp.np_percentage != null ? String(computedGpmNp.np_percentage.toFixed(2)) : '')} onChange={handleChange} placeholder={formData.business_unit && computedGpmNp.np_percentage != null ? String(computedGpmNp.np_percentage.toFixed(2)) : undefined} />
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