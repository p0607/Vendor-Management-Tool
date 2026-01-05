import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './AddRoutingData.css';
import * as XLSX from 'xlsx';
import apiClient from '../config/api';

interface AttritionData {
  attrition_employee_name: string;
  attrition_vendor: string;
  attrition_skill: string;
  attrition_b_month: string;
  attrition_doj: string;
  attrition_employment_status: string;
  attrition_month: string;
  attrition_date: string;
  attrition_po_value: string;
  attrition_vendor_value: string;
  attrition_alchemy_routing: string;
  attrition_gross_margin: string;
  attrition_gm_percentage: string;
  [key: string]: string;
}

const AddAttritionData: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('manual');
  const [formData, setFormData] = useState<AttritionData>({
    attrition_employee_name: '',
    attrition_vendor: '',
    attrition_skill: '',
    attrition_b_month: '',
    attrition_doj: '',
    attrition_employment_status: '',
    attrition_month: '',
    attrition_date: '',
    attrition_po_value: '',
    attrition_vendor_value: '',
    attrition_alchemy_routing: '',
    attrition_gross_margin: '',
    attrition_gm_percentage: ''
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
    if (!value || value === '' || value === null || value === undefined) return '';
    
    // If it's already a string, trim and return
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') {
        return '';
      }
      return trimmed;
    }
    
    // If it's a number (Excel date serial), convert it
    if (typeof value === 'number') {
      // Check if it's a valid date serial number (not NaN, not 0, not negative)
      if (isNaN(value) || value <= 0) return '';
      
      const excelEpoch = new Date(1900, 0, 1);
      const date = new Date(excelEpoch.getTime() + (value - 2) * 24 * 60 * 60 * 1000);
      
      // Check if date is valid
      if (isNaN(date.getTime())) return '';
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    // If it's a Date object, format it
    if (value instanceof Date) {
      if (isNaN(value.getTime())) return '';
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    return String(value).trim();
  };

  // Read Excel file and convert to JSON
  const readExcelFile = (file: File): Promise<AttritionData[]> => {
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
            'employee name': 'attrition_employee_name',
            'employee_name': 'attrition_employee_name',
            'vendor': 'attrition_vendor',
            'skill': 'attrition_skill',
            'b month': 'attrition_b_month',
            'b_month': 'attrition_b_month',
            'onboarding month': 'attrition_b_month',
            'doj': 'attrition_doj',
            'date of joining': 'attrition_doj',
            'employment status': 'attrition_employment_status',
            'employment_status': 'attrition_employment_status',
            'attrition month': 'attrition_month',
            'attrition_month': 'attrition_month',
            'attrition date': 'attrition_date',
            'attrition_date': 'attrition_date',
            'po value': 'attrition_po_value',
            'po_value': 'attrition_po_value',
            'vendor value': 'attrition_vendor_value',
            'vendor_value': 'attrition_vendor_value',
            'alchemy routing': 'attrition_alchemy_routing',
            'alchemy_routing': 'attrition_alchemy_routing',
            'gross margin': 'attrition_gross_margin',
            'gross_margin': 'attrition_gross_margin',
            'gm percentage': 'attrition_gm_percentage',
            'gm_percentage': 'attrition_gm_percentage'
          };

          // Define date fields
          const dateFields = ['attrition_b_month', 'attrition_doj', 'attrition_month', 'attrition_date'];

          // Convert rows to AttritionData objects
          const attritionDataArray: AttritionData[] = rows
            .filter(row => row.some(cell => cell !== null && cell !== undefined && cell !== ''))
            .map((row) => {
              const attritionData: AttritionData = {
                attrition_employee_name: '',
                attrition_vendor: '',
                attrition_skill: '',
                attrition_b_month: '',
                attrition_doj: '',
                attrition_employment_status: '',
                attrition_month: '',
                attrition_date: '',
                attrition_po_value: '',
                attrition_vendor_value: '',
                attrition_alchemy_routing: '',
                attrition_gross_margin: '',
                attrition_gm_percentage: ''
              };

              headers.forEach((header, colIndex) => {
                const normalizedHeader = String(header || '').toLowerCase().trim();
                const fieldName = headerMap[normalizedHeader];
                
                if (fieldName) {
                  const value = row[colIndex];
                  
                  // Handle date fields specially
                  if (dateFields.includes(fieldName)) {
                    attritionData[fieldName] = convertExcelDate(value);
                  } else {
                    attritionData[fieldName] = value ? String(value) : '';
                  }
                }
              });

              return attritionData;
            })
            .filter(item => item.attrition_employee_name || item.attrition_vendor); // Filter out completely empty rows

          resolve(attritionDataArray);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  };

  // Helper function to safely parse numeric values
  const parseNumericValue = (value: string | null | undefined): number | null => {
    if (!value || value.trim() === '') return null;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  };

  const importData = async (data: AttritionData[]) => {
    const validData = data.filter(item => item.attrition_employee_name || item.attrition_vendor);
    
    if (validData.length === 0) {
      throw new Error('No valid data found. Please ensure at least employee name or vendor is provided.');
    }

    // Import each record
    const importPromises = validData.map(async (item) => {
      try {
        // Helper to convert empty strings to null
        const nullIfEmpty = (value: string | null | undefined): string | null => {
          if (!value || typeof value !== 'string') return null;
          const trimmed = value.trim();
          return trimmed === '' ? null : trimmed;
        };
        
        const formattedData = {
          attrition_employee_name: nullIfEmpty(item.attrition_employee_name),
          attrition_vendor: nullIfEmpty(item.attrition_vendor),
          attrition_skill: nullIfEmpty(item.attrition_skill),
          attrition_b_month: nullIfEmpty(item.attrition_b_month),
          attrition_doj: nullIfEmpty(item.attrition_doj),
          attrition_employment_status: nullIfEmpty(item.attrition_employment_status),
          attrition_month: nullIfEmpty(item.attrition_month),
          attrition_date: nullIfEmpty(item.attrition_date),
          attrition_po_value: parseNumericValue(item.attrition_po_value),
          attrition_vendor_value: parseNumericValue(item.attrition_vendor_value),
          attrition_alchemy_routing: nullIfEmpty(item.attrition_alchemy_routing),
          attrition_gross_margin: parseNumericValue(item.attrition_gross_margin),
          attrition_gm_percentage: parseNumericValue(item.attrition_gm_percentage)
        };
        
        const response = await apiClient.post('/Attrition', formattedData);
        return response.data;
      } catch (error: any) {
        const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
        const recordInfo = `Employee: ${item.attrition_employee_name || 'N/A'}, Vendor: ${item.attrition_vendor || 'N/A'}`;
        throw new Error(`Failed to import record (${recordInfo}): ${errorMessage}`);
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
        attrition_employee_name: formData.attrition_employee_name || null,
        attrition_vendor: formData.attrition_vendor || null,
        attrition_skill: formData.attrition_skill || null,
        attrition_b_month: formData.attrition_b_month || null,
        attrition_doj: formData.attrition_doj || null,
        attrition_employment_status: formData.attrition_employment_status || null,
        attrition_month: formData.attrition_month || null,
        attrition_date: formData.attrition_date || null,
        attrition_po_value: formData.attrition_po_value ? parseFloat(formData.attrition_po_value) : null,
        attrition_vendor_value: formData.attrition_vendor_value ? parseFloat(formData.attrition_vendor_value) : null,
        attrition_alchemy_routing: formData.attrition_alchemy_routing || null,
        attrition_gross_margin: formData.attrition_gross_margin ? parseFloat(formData.attrition_gross_margin) : null,
        attrition_gm_percentage: formData.attrition_gm_percentage ? parseFloat(formData.attrition_gm_percentage) : null
      };

      await apiClient.post('/Attrition', formattedData);
      setSuccess('Attrition data added successfully!');
      setFormData({
        attrition_employee_name: '',
        attrition_vendor: '',
        attrition_skill: '',
        attrition_b_month: '',
        attrition_doj: '',
        attrition_employment_status: '',
        attrition_month: '',
        attrition_date: '',
        attrition_po_value: '',
        attrition_vendor_value: '',
        attrition_alchemy_routing: '',
        attrition_gross_margin: '',
        attrition_gm_percentage: ''
      });
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to add attrition data');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="homepage">
      <div className="routing-header-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 2rem' }}>
        <h2 style={{ color: 'white', fontWeight: 700, fontSize: '2rem', fontFamily: 'Montserrat, sans-serif', margin: 0 }}>
          Add Attrition Data
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
            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div className="form-group">
                <label>Employee Name</label>
                <input
                  type="text"
                  name="attrition_employee_name"
                  value={formData.attrition_employee_name}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Vendor</label>
                <input
                  type="text"
                  name="attrition_vendor"
                  value={formData.attrition_vendor}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Skill</label>
                <input
                  type="text"
                  name="attrition_skill"
                  value={formData.attrition_skill}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>B Month (Onboarding Month) (YYYY-MM-DD)</label>
                <input
                  type="date"
                  name="attrition_b_month"
                  value={formData.attrition_b_month}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Date of Joining (YYYY-MM-DD)</label>
                <input
                  type="date"
                  name="attrition_doj"
                  value={formData.attrition_doj}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Employment Status</label>
                <input
                  type="text"
                  name="attrition_employment_status"
                  value={formData.attrition_employment_status}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Attrition Month (YYYY-MM-DD)</label>
                <input
                  type="date"
                  name="attrition_month"
                  value={formData.attrition_month}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Attrition Date (YYYY-MM-DD)</label>
                <input
                  type="date"
                  name="attrition_date"
                  value={formData.attrition_date}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>PO Value</label>
                <input
                  type="number"
                  step="0.01"
                  name="attrition_po_value"
                  value={formData.attrition_po_value}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Vendor Value</label>
                <input
                  type="number"
                  step="0.01"
                  name="attrition_vendor_value"
                  value={formData.attrition_vendor_value}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Alchemy Routing</label>
                <input
                  type="text"
                  name="attrition_alchemy_routing"
                  value={formData.attrition_alchemy_routing}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Gross Margin</label>
                <input
                  type="number"
                  step="0.01"
                  name="attrition_gross_margin"
                  value={formData.attrition_gross_margin}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>GM Percentage</label>
                <input
                  type="number"
                  step="0.01"
                  name="attrition_gm_percentage"
                  value={formData.attrition_gm_percentage}
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
              <h3>Import Attrition Data from Excel</h3>
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

export default AddAttritionData;

