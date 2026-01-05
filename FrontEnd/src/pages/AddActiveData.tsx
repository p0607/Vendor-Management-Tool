import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './AddRoutingData.css';
import * as XLSX from 'xlsx';
import apiClient from '../config/api';
import logo from '../assets/logo_1.png';

interface ActiveData {
  active_employee_name: string;
  active_vendor: string;
  active_skill: string;
  active_ob_month: string;
  active_doj: string;
  active_employment_status: string;
  active_po_value: string;
  active_vendor_value: string;
  active_alchemy_routing: string;
  active_gross_margin: string;
  active_gm_percentage: string;
  [key: string]: string;
}

const AddActiveData: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('manual');
  const [formData, setFormData] = useState<ActiveData>({
    active_employee_name: '',
    active_vendor: '',
    active_skill: '',
    active_ob_month: '',
    active_doj: '',
    active_employment_status: '',
    active_po_value: '',
    active_vendor_value: '',
    active_alchemy_routing: '',
    active_gross_margin: '',
    active_gm_percentage: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Convert Excel date serial number to proper date string
  const convertExcelDate = (value: any): string => {
    if (!value) return '';
    
    // If it's already a string, return as is
    if (typeof value === 'string') {
      return value;
    }
    
    // If it's a number (Excel date serial), convert it
    if (typeof value === 'number') {
      const excelEpoch = new Date(1900, 0, 1);
      const date = new Date(excelEpoch.getTime() + (value - 2) * 24 * 60 * 60 * 1000);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    // If it's a Date object, format it
    if (value instanceof Date) {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    return String(value);
  };

  // Read Excel file and convert to JSON
  const readExcelFile = (file: File): Promise<ActiveData[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1,
            dateNF: 'yyyy-mm-dd'
          });

          if (jsonData.length < 2) {
            throw new Error('Excel file must have at least a header row and one data row');
          }

          const headers = jsonData[0] as string[];
          const rows = jsonData.slice(1) as any[][];

          // Map headers to match database field names (case-insensitive)
          const headerMap: { [key: string]: string } = {
            'employee name': 'active_employee_name',
            'employee_name': 'active_employee_name',
            'vendor': 'active_vendor',
            'skill': 'active_skill',
            'ob month': 'active_ob_month',
            'ob_month': 'active_ob_month',
            'onboarding month': 'active_ob_month',
            'doj': 'active_doj',
            'date of joining': 'active_doj',
            'employment status': 'active_employment_status',
            'employment_status': 'active_employment_status',
            'po value': 'active_po_value',
            'po_value': 'active_po_value',
            'vendor value': 'active_vendor_value',
            'vendor_value': 'active_vendor_value',
            'alchemy routing': 'active_alchemy_routing',
            'alchemy_routing': 'active_alchemy_routing',
            'gross margin': 'active_gross_margin',
            'gross_margin': 'active_gross_margin',
            'gm percentage': 'active_gm_percentage',
            'gm_percentage': 'active_gm_percentage'
          };

          // Define date fields
          const dateFields = ['active_ob_month', 'active_doj'];

          // Convert rows to ActiveData objects
          const activeDataArray: ActiveData[] = rows
            .filter(row => row.some(cell => cell !== null && cell !== undefined && cell !== ''))
            .map((row) => {
              const activeData: ActiveData = {
                active_employee_name: '',
                active_vendor: '',
                active_skill: '',
                active_ob_month: '',
                active_doj: '',
                active_employment_status: '',
                active_po_value: '',
                active_vendor_value: '',
                active_alchemy_routing: '',
                active_gross_margin: '',
                active_gm_percentage: ''
              };

              headers.forEach((header, colIndex) => {
                const normalizedHeader = String(header || '').toLowerCase().trim();
                const fieldName = headerMap[normalizedHeader];
                
                if (fieldName) {
                  const value = row[colIndex];
                  
                  // Handle date fields specially
                  if (dateFields.includes(fieldName)) {
                    activeData[fieldName] = convertExcelDate(value);
                  } else {
                    activeData[fieldName] = value ? String(value) : '';
                  }
                }
              });

              return activeData;
            })
            .filter(item => item.active_employee_name || item.active_vendor); // Filter out completely empty rows

          resolve(activeDataArray);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  };

  const importData = async (data: ActiveData[]) => {
    const validData = data.filter(item => item.active_employee_name || item.active_vendor);
    
    if (validData.length === 0) {
      throw new Error('No valid data found. Please ensure at least employee name or vendor is provided.');
    }

    // Import each record
    const importPromises = validData.map(async (item) => {
      try {
        const formattedData = {
          active_employee_name: item.active_employee_name || null,
          active_vendor: item.active_vendor || null,
          active_skill: item.active_skill || null,
          active_ob_month: item.active_ob_month || null,
          active_doj: item.active_doj || null,
          active_employment_status: item.active_employment_status || null,
          active_po_value: item.active_po_value ? parseFloat(item.active_po_value) : null,
          active_vendor_value: item.active_vendor_value ? parseFloat(item.active_vendor_value) : null,
          active_alchemy_routing: item.active_alchemy_routing || null,
          active_gross_margin: item.active_gross_margin ? parseFloat(item.active_gross_margin) : null,
          active_gm_percentage: item.active_gm_percentage ? parseFloat(item.active_gm_percentage) : null
        };
        
        const response = await apiClient.post('/Active', formattedData);
        return response.data;
      } catch (error: any) {
        throw new Error(`Failed to import record: ${error.response?.data?.error || error.message || 'Unknown error'}`);
      }
    });

    await Promise.all(importPromises);
  };

  // Handle file input change for Excel import
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      const data = await readExcelFile(file);
      await importData(data);
      setImportSuccess(`Successfully imported ${data.length} records!`);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Failed to import data');
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const formattedData = {
        active_employee_name: formData.active_employee_name || null,
        active_vendor: formData.active_vendor || null,
        active_skill: formData.active_skill || null,
        active_ob_month: formData.active_ob_month || null,
        active_doj: formData.active_doj || null,
        active_employment_status: formData.active_employment_status || null,
        active_po_value: formData.active_po_value ? parseFloat(formData.active_po_value) : null,
        active_vendor_value: formData.active_vendor_value ? parseFloat(formData.active_vendor_value) : null,
        active_alchemy_routing: formData.active_alchemy_routing || null,
        active_gross_margin: formData.active_gross_margin ? parseFloat(formData.active_gross_margin) : null,
        active_gm_percentage: formData.active_gm_percentage ? parseFloat(formData.active_gm_percentage) : null
      };

      await apiClient.post('/Active', formattedData);
      setSuccess('Active data added successfully!');
      setFormData({
        active_employee_name: '',
        active_vendor: '',
        active_skill: '',
        active_ob_month: '',
        active_doj: '',
        active_employment_status: '',
        active_po_value: '',
        active_vendor_value: '',
        active_alchemy_routing: '',
        active_gross_margin: '',
        active_gm_percentage: ''
      });
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to add active data');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="homepage">
      <div className="routing-header-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 2rem' }}>
        <div className="homepage-logo-top-left">
          <img src={logo} alt="Alchemy Logo" style={{ width: '120px', height: 'auto' }} />
        </div>
        <h2 style={{ color: 'white', fontWeight: 700, fontSize: '2rem', fontFamily: 'Montserrat, sans-serif', margin: 0 }}>
          Add Active Data
        </h2>
        <div className="auth-buttons-container">
          <button className="auth-button" onClick={() => navigate('/CTSDataTable')}>Back</button>
          <button className="auth-button" onClick={() => navigate('/HomePage')}>Home</button>
        </div>
      </div>

      <div className="routing-container" style={{ marginTop: '2rem', padding: '0 2rem 2rem 2rem' }}>
        <div className="tabs" style={{ marginBottom: '2rem' }}>
          <button
            className={activeTab === 'manual' ? 'tab-button active' : 'tab-button'}
            onClick={() => setActiveTab('manual')}
          >
            Manual Entry
          </button>
          <button
            className={activeTab === 'import' ? 'tab-button active' : 'tab-button'}
            onClick={() => setActiveTab('import')}
          >
            Import Excel
          </button>
        </div>

        {activeTab === 'manual' && (
          <form onSubmit={handleSubmit} className="routing-form">
            <div className="form-grid">
              <div className="form-group">
                <label>Employee Name</label>
                <input
                  type="text"
                  name="active_employee_name"
                  value={formData.active_employee_name}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Vendor</label>
                <input
                  type="text"
                  name="active_vendor"
                  value={formData.active_vendor}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Skill</label>
                <input
                  type="text"
                  name="active_skill"
                  value={formData.active_skill}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>OB Month (YYYY-MM-DD)</label>
                <input
                  type="date"
                  name="active_ob_month"
                  value={formData.active_ob_month}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Date of Joining (YYYY-MM-DD)</label>
                <input
                  type="date"
                  name="active_doj"
                  value={formData.active_doj}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Employment Status</label>
                <input
                  type="text"
                  name="active_employment_status"
                  value={formData.active_employment_status}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>PO Value</label>
                <input
                  type="number"
                  step="0.01"
                  name="active_po_value"
                  value={formData.active_po_value}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Vendor Value</label>
                <input
                  type="number"
                  step="0.01"
                  name="active_vendor_value"
                  value={formData.active_vendor_value}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Alchemy Routing</label>
                <input
                  type="text"
                  name="active_alchemy_routing"
                  value={formData.active_alchemy_routing}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Gross Margin</label>
                <input
                  type="number"
                  step="0.01"
                  name="active_gross_margin"
                  value={formData.active_gross_margin}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>GM Percentage</label>
                <input
                  type="number"
                  step="0.01"
                  name="active_gm_percentage"
                  value={formData.active_gm_percentage}
                  onChange={handleChange}
                />
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <div className="form-actions">
              <button type="submit" className="submit-button" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </form>
        )}

        {activeTab === 'import' && (
          <div className="import-section">
            <div style={{ marginBottom: '1rem' }}>
              <h3>Import Active Data from Excel</h3>
              <p>Please ensure your Excel file has the following columns (case-insensitive):</p>
              <ul style={{ textAlign: 'left', display: 'inline-block' }}>
                <li>Employee Name / Employee_Name</li>
                <li>Vendor</li>
                <li>Skill</li>
                <li>OB Month / OB_Month / Onboarding Month</li>
                <li>DOJ / Date of Joining</li>
                <li>Employment Status / Employment_Status</li>
                <li>PO Value / PO_Value</li>
                <li>Vendor Value / Vendor_Value</li>
                <li>Alchemy Routing / Alchemy_Routing</li>
                <li>Gross Margin / Gross_Margin</li>
                <li>GM Percentage / GM_Percentage</li>
              </ul>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                disabled={importLoading}
                style={{ padding: '10px', fontSize: '16px' }}
              />
            </div>

            {importLoading && <div className="loading-message">Importing data...</div>}
            {importError && <div className="error-message">{importError}</div>}
            {importSuccess && <div className="success-message">{importSuccess}</div>}
          </div>
        )}
      </div>
    </div>
  );
};

export default AddActiveData;

