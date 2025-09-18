import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AddRoutingData.css'; // Reuse styles
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import autoTable from 'jspdf-autotable';
import logo from '../assets/logo_1.png';
import { formatDateForDisplay } from '../utils/dateUtils';
import apiClient from '../config/api';

interface CTSData {
  sl_no: string;
  vendor_name: string;
  booking_month: string;
  resource_name: string;
  vendor_invoice_no: string;
  vendor_invoice_date: string;
  atipl_invoice_base_amount: string;
  gst: string;
  total_invoice_amount: string;
  tds: string;
  net_receivable: string;
  payment_receive_from_client: string;
  balance_receivable_from_client: string;
  tally_book_entry_date: string;
  sub_vendor_invoice_date: string;
  sub_vendor_invoice_no: string;
  base_amt_as_per_tally_vendor: string;
  margin: string;
  vendor_invoice_status: string;
  payment_date: string;
  instrument_no: string;
  payment_mode: string;
  payment_status: string;
  receipts_status: string;
  extra: string;
  service_month: string;
  [key: string]: string;
}

const initialFormData: CTSData = {
  sl_no: '',
  vendor_name: '',
  booking_month: '',
  resource_name: '',
  vendor_invoice_no: '',
  vendor_invoice_date: '',
  atipl_invoice_base_amount: '',
  gst: '',
  total_invoice_amount: '',
  tds: '',
  net_receivable: '',
  payment_receive_from_client: '',
  balance_receivable_from_client: '',
  tally_book_entry_date: '',
  sub_vendor_invoice_date: '',
  sub_vendor_invoice_no: '',
  base_amt_as_per_tally_vendor: '',
  margin: '',
  vendor_invoice_status: '',
  payment_date: '',
  instrument_no: '',
  payment_mode: '',
  payment_status: '',
  receipts_status: '',
  extra: '',
  service_month: '',
};

const ctsFields = [
  'sl_no', 'vendor_name', 'booking_month', 'resource_name', 'vendor_invoice_no',
  'vendor_invoice_date', 'atipl_invoice_base_amount', 'gst', 'total_invoice_amount',
  'tds', 'net_receivable', 'payment_receive_from_client', 'balance_receivable_from_client', 'tally_book_entry_date',
  'sub_vendor_invoice_date', 'sub_vendor_invoice_no', 'base_amt_as_per_tally_vendor', 'margin',
  'vendor_invoice_status', 'payment_date', 'instrument_no', 'payment_mode', 'payment_status',
  'receipts_status', 'extra', 'service_month'
];

const AddCTSData: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<CTSData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPOSummary, setShowPOSummary] = useState(false);

  // For table/list logic (scaffold)
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [ctsList, setCTSList] = useState<CTSData[]>([]);

  // For action dropdown
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importLoading, setImportLoading] = useState<boolean>(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  // Handle dropdown click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };



  
  // Export summary fields
  const poTableColumns = [
    { header: "Field", dataKey: "field" },
    { header: "Value", dataKey: "value" }
  ];
  const poTableRows = [
    { field: "Vendor Name", value: formData.vendor_name },
    { field: "PO No", value: formData.vendor_invoice_no },
    { field: "PO Date", value: formData.vendor_invoice_date },
    { field: "PO Value", value: formData.atipl_invoice_base_amount },
    { field: "Total Amount", value: formData.total_invoice_amount },
    { field: "Net Receivable", value: formData.net_receivable }
  ];

  // Excel Export
  const exportPOToExcel = () => {
    const excelRows = [
      ["Field", "Value"],
      ...poTableRows.map(row => [row.field, row.value])
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'PO Summary');
    XLSX.writeFile(workbook, `CTS_PO_Summary_${formData.vendor_name || 'Vendor'}.xlsx`);
  };

  // PDF Export
  const exportPOToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('CTS PO Summary', 105, 20, { align: 'center' });
    autoTable(doc, {
      startY: 30,
      head: [poTableColumns.map(col => col.header)],
      body: poTableRows.map(row => [row.field, row.value]),
      theme: 'grid',
      headStyles: { fillColor: [32, 145, 211] },
      styles: { cellPadding: 3, fontSize: 12 },
      margin: { left: 20, right: 20 }
    });
    doc.save(`CTS_PO_Summary_${formData.vendor_name || 'Vendor'}.pdf`);
  };

  // Download Excel format template
  const downloadExcelFormat = () => {
    const workbook = XLSX.utils.book_new();
    
    // Create headers for the template
    const headers = [
      'sl_no', 'vendor_name', 'booking_month', 'resource_name', 'vendor_invoice_no',
      'vendor_invoice_date', 'atipl_invoice_base_amount', 'gst', 'total_invoice_amount',
      'tds', 'net_receivable', 'payment_receive_from_client', 'balance_receivable_from_client', 
      'tally_book_entry_date', 'sub_vendor_invoice_date', 'sub_vendor_invoice_no', 
      'base_amt_as_per_tally_vendor', 'margin', 'vendor_invoice_status', 'payment_date', 
      'instrument_no', 'payment_mode', 'payment_status', 'receipts_status', 'extra', 'service_month'
    ];

    // Create sample data row (empty values)
    const sampleData = headers.map(() => '');
    
    const worksheet = XLSX.utils.aoa_to_sheet([headers, sampleData]);
    
    // Set column widths
    const columnWidths = headers.map(() => ({ wch: 20 }));
    worksheet['!cols'] = columnWidths;
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'CTS Template');
    
    const currentDate = new Date().toISOString().split('T')[0];
    const filename = `CTS_Import_Template_${currentDate}.xlsx`;
    
    XLSX.writeFile(workbook, filename);
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
      setIsDropdownOpen(false);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Failed to import data');
    } finally {
      setImportLoading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
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
      // Excel dates are number of days since 1900-01-01
      // But Excel incorrectly treats 1900 as a leap year, so we need to adjust
      const excelEpoch = new Date(1900, 0, 1); // January 1, 1900
      const date = new Date(excelEpoch.getTime() + (value - 2) * 24 * 60 * 60 * 1000);
      
      // Format as YYYY-MM-DD
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
  const readExcelFile = (file: File): Promise<CTSData[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          // Use XLSX.utils.sheet_to_json with dateNF option to get proper dates
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1,
            dateNF: 'yyyy-mm-dd' // Format dates as YYYY-MM-DD
          });

          if (jsonData.length < 2) {
            throw new Error('Excel file must have at least a header row and one data row');
          }

          const headers = jsonData[0] as string[];
          const rows = jsonData.slice(1) as any[][];

          // Validate headers
          const expectedHeaders = [
            'sl_no', 'vendor_name', 'booking_month', 'resource_name', 'vendor_invoice_no',
            'vendor_invoice_date', 'atipl_invoice_base_amount', 'gst', 'total_invoice_amount',
            'tds', 'net_receivable', 'payment_receive_from_client', 'balance_receivable_from_client', 
            'tally_book_entry_date', 'sub_vendor_invoice_date', 'sub_vendor_invoice_no', 
            'base_amt_as_per_tally_vendor', 'margin', 'vendor_invoice_status', 'payment_date', 
            'instrument_no', 'payment_mode', 'payment_status', 'receipts_status', 'extra', 'service_month'
          ];

          const missingHeaders = expectedHeaders.filter(header => !headers.includes(header));
          if (missingHeaders.length > 0) {
            throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
          }

          // Define date fields that need special handling
          const dateFields = [
            'booking_month', 'vendor_invoice_date', 'tally_book_entry_date', 
            'sub_vendor_invoice_date', 'payment_date', 'service_month'
          ];

          // Convert rows to CTSData objects
          const ctsDataArray: CTSData[] = rows.map((row, index) => {
            const ctsData: CTSData = { ...initialFormData };
            headers.forEach((header, colIndex) => {
              if (ctsData.hasOwnProperty(header)) {
                const value = row[colIndex];
                
                // Handle date fields specially
                if (dateFields.includes(header)) {
                  ctsData[header] = convertExcelDate(value);
                } else {
                  ctsData[header] = value ? String(value) : '';
                }
              }
            });
            return ctsData;
          });

          resolve(ctsDataArray);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  };

  const importData = async (data: any[]) => {
    const validData = data.filter(item => item.vendor_name && item.sl_no);
    
    if (validData.length === 0) {
      throw new Error('No valid data found. Please ensure vendor_name and sl_no are provided.');
    }

    // Import each record
    const importPromises = validData.map(async (item) => {
      try {
        const response = await apiClient.post('/CTS', item);
        return response.data;
      } catch (error: any) {
        throw new Error(`Failed to import record with sl_no ${item.sl_no}: ${error.response?.data?.error || error.message || 'Unknown error'}`);
      }
    });

    await Promise.all(importPromises);
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Validate required fields (customize as needed)
    if (!formData.sl_no || !formData.vendor_name) {
      setError('Please fill in the required fields: sl_no, vendor_name');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await apiClient.post('/CTS', formData);
      
      // Show success message
      alert('CTS data submitted successfully!');
      
      // Optionally update CTS list
      // const newCTS = response.data;
      // setCTSList(prev => [newCTS, ...prev]);
      navigate('/CTSDataTable');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to submit data');
    } finally {
      setIsSubmitting(false);
    }
  };

  

  // Render fields
  const renderFieldGroup = (fields: string[]) => (
    <div className="field-group">
      <div className="field-grid">
        {fields.map(field => (
          <div key={field} className="form-group">
            <label>{field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</label>
            <input
              type={field.includes('date') || field === 'service_month' ? 'date' : 'text'}
              name={field}
              value={field.includes('date') || field === 'service_month' ? formData[field] : formData[field]}
              onChange={handleChange}
            />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="homepage">
      <div className="routing-header-bar" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '1rem 2rem 0 2rem' }}>
        <div className="homepage-logo-top-left">
          <img src={logo} alt="Alchemy Logo" />
        </div>
        <h2 style={{ 
          position: 'absolute', 
          left: '50%', 
          transform: 'translateX(-50%)', 
          color: 'white', 
          fontWeight: 700, 
          fontSize: '2rem', 
          fontFamily: 'Montserrat, sans-serif', 
          margin: 0, 
          zIndex: 1 
        }}>Add New CTS Data</h2>
        <div className="auth-buttons-container">
          <button className="auth-button" onClick={() => navigate(-1)}>Back</button>
          
          <div className="action-dropdown-container" ref={dropdownRef}>
            <button
              className="auth-button action-button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              Actions ▼
            </button>
            {isDropdownOpen && (
              <div className="dropdown-menu">
                <div className="dropdown-item" onClick={() => { fileInputRef.current?.click(); setIsDropdownOpen(false); }}>
                  Import Excel
                </div>
                <div className="dropdown-item" onClick={() => { downloadExcelFormat(); setIsDropdownOpen(false); }}>
                  Download Excel Format
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="add-routing-container" style={{ marginTop: '2rem' }}>
        {/* Hidden file input for Excel import */}
        <input
          type="file"
          ref={fileInputRef}
          accept=".xlsx,.xls"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
        
        {/* Import status messages */}
        {importError && (
          <div className="error-message" style={{ 
            backgroundColor: '#ffebee', 
            color: '#c62828', 
            padding: '12px', 
            borderRadius: '4px', 
            marginBottom: '16px',
            border: '1px solid #ffcdd2'
          }}>
            {importError}
          </div>
        )}
        {importSuccess && (
          <div className="success-message" style={{ 
            backgroundColor: '#e8f5e8', 
            color: '#2e7d32', 
            padding: '12px', 
            borderRadius: '4px', 
            marginBottom: '16px',
            border: '1px solid #c8e6c9'
          }}>
            {importSuccess}
          </div>
        )}
        {importLoading && (
          <div className="loading-message" style={{ 
            backgroundColor: '#e3f2fd', 
            color: '#1565c0', 
            padding: '12px', 
            borderRadius: '4px', 
            marginBottom: '16px',
            border: '1px solid #bbdefb'
          }}>
            Importing data... Please wait.
          </div>
        )}
        
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit} className="routing-form">
          {renderFieldGroup(ctsFields)}
          <div className="form-actions">
            <button type="submit" disabled={isSubmitting} className="submit-btn">
              {isSubmitting ? 'Submitting...' : 'Submit Data'}
            </button>
            
            <button type="button" onClick={() => navigate('/CTSDataTable')} className="cancel-btn">
              Cancel
            </button>
          </div>
        </form>
        {showPOSummary && (
          <div className="po-summary-modal">
            <div className="po-summary-content">
              <h3>CTS PO Summary</h3>
              <table>
                <tbody>
                  {poTableRows.map(row => (
                    <tr key={row.field}>
                      <td><strong>{row.field}</strong></td>
                      <td>{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: '1rem' }}>
                <button className="export-btn" onClick={exportPOToExcel}>Export as Excel</button>
                <button className="export-btn" onClick={exportPOToPDF} style={{ marginLeft: '1rem' }}>Export as PDF</button>
                <button className="cancel-btn" onClick={() => setShowPOSummary(false)} style={{ marginLeft: '1rem' }}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddCTSData;