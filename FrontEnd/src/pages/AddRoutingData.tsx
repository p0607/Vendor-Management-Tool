import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './AddRoutingData.css';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import apiClient from '../config/api';
import logo from '../assets/logo_1.png';
import { formatExcelDate } from '../utils/dateUtils';

interface RoutingData {
  'Sl.No': string;
  'Costing Date': string;
  'IBM / KYNDRYL': string;
  'Requestor': string;
  'Department SPOC': string;
  'SPOC E-mail ID': string;
  'Training / Services Details': string;
  'Description': string;
  'IBM / KYNDRYL PO No': string;
  'IBM / KYNDRYL PO Date': string;
  'IBM / KYNDRYL PO Value': string;
  'Integration %': string;
  'Integrator Charges (Margin)': string;
  'Alchemy Billing Value': string;
  'Funding cost': string;
  'Net Margin': string;
  'Billing Month': string;
  "Payment Day's": string;
  'Vendor Details': string;
  'Vendor SPOC': string;
  'Vendor SPOC Contact No': string;
  'Vendor SPOC E-mail ID': string;
  'Training Dates': string;
  'Vendor Inv. No.': string;
  'Vendor Inv. Date': string;
  'Vendor Inv. Amount': string;
  'GST @ 18%': string;
  'Total Invoice': string;
  'Vendor Amount After TDS 10%': string;
  'Net Payment to Vendor': string;
  'Payment Due Date': string;
  'Alchemy Techsol Invoive No': string;
  'Alchemy Techsol Invoice Date': string;
  'Alchemy Techsol Invoice Amount': string;
  'Payment Expected Date (IBM)': string;
  'Cheque Issued Name': string;
  'Cheque Date': string;
  'Cheque No': string;
  'REMARK': string;
  'Vendor_PO_No': string;
  'Vendor_PO_Date': string;
  'Address': string;
  'domain': string;
  'Alchemy PO': string;
  [key: string]: string; 
}

interface DescriptionItem {
  id?: number;
  description: string;
  vendor_payout: string;
}

const AddRoutingData: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('summary');
    const initialFormData: RoutingData = {
    'Sl.No': '',
    'Costing Date': '',
    'IBM / KYNDRYL': '',
    'Requestor': '',
    'Department SPOC': '',
    'SPOC E-mail ID': '',
    'Training / Services Details': '',
    'Description': '',
    'IBM / KYNDRYL PO No': '',
    'IBM / KYNDRYL PO Date': '',
    'IBM / KYNDRYL PO Value': '',
    'Integration %': '',
    'Integrator Charges (Margin)': '',
    'Alchemy Billing Value': '',
    'Funding cost': '',
    'Net Margin': '',
    'Billing Month': '',
    "Payment Day's": '',
    'Vendor Details': '',
    'Vendor SPOC': '',
    'Vendor SPOC Contact No': '',
    'Vendor SPOC E-mail ID': '',
    'Training Dates': '',
    'Vendor Inv. No.': '',
    'Vendor Inv. Date': '',
    'Vendor Inv. Amount': '',
    'GST @ 18%': '',
    'Total Invoice': '',
    'Vendor Amount After TDS 10%': '',
    'Net Payment to Vendor': '',
    'Payment Due Date': '',
    'Alchemy Techsol Invoive No': '',
    'Alchemy Techsol Invoice Date': '',
    'Alchemy Techsol Invoice Amount': '',
    'Payment Expected Date (IBM)': '',
    'Cheque Issued Name': '',
    'Cheque Date': '',
    'Cheque No': '',
    'REMARK': '',
    'Vendor_PO_No': '',
    'Vendor_PO_Date': '',
    'Address': '',
    'domain': '',
    'Alchemy PO': '',
  };

  const [descriptions, setDescriptions] = useState<DescriptionItem[]>([
    { description: '', vendor_payout: '' }
  ]);


  const [formData, setFormData] = useState<RoutingData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPOSummary, setShowPOSummary] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper function to read Excel file
  const readExcelFile = async (file: File): Promise<RoutingData[]> => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json<RoutingData>(worksheet);
    return jsonData;
  };

  // Helper function to validate data
  const validateData = (data: RoutingData[]): RoutingData[] => {
    if (data.length === 0) {
      alert('No data found in the Excel file');
      return [];
    }

    return data.map(item => {
      const validatedItem: RoutingData = { ...initialFormData };
      for (const key in item) {
        if (key in validatedItem) {
          let value = item[key];
          
                     // Handle Excel date serial numbers for date fields
           if ((key === 'Costing Date' || key === 'Vendor_PO_Date') && !isNaN(Number(value)) && Number(value) > 1000) {
             // Convert Excel serial number to date
             value = formatExcelDate(Number(value));
           }
          
          validatedItem[key] = value?.toString() || '';
        }
      }
      return validatedItem;
    });
  };

  

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Download Excel format with column headers
  const downloadExcelFormat = () => {
    const headers = Object.keys(initialFormData);
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Format');
    XLSX.writeFile(workbook, 'Routing_Data_Format.xlsx');
  };

  // Handle Excel file import
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await readExcelFile(file);
      const validatedData = validateData(data);
      
      if (validatedData.length === 0) {
        alert('No valid data found in the file');
        return;
      }

      if (window.confirm(`Are you sure you want to import ${validatedData.length} records?`)) {
        setIsSubmitting(true);
        
        const response = await apiClient.post('/Alchemy_Routing/bulk', { data: validatedData });

        alert(`${validatedData.length} records imported successfully!`);
        navigate('/RoutingTable');
      }
    } catch (err: any) {
      console.error('Error importing data:', err);
      alert(`Error importing data: ${err.response?.data?.error || err.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const poTableColumns = [
    { header: "Field", dataKey: "field" },
    { header: "Value", dataKey: "value" }
  ];
  
  const poTableRows = [
    { field: "Vendor Name", value: formData['Vendor Details'] },
    { field: "PO Date", value: formData['IBM / KYNDRYL PO Date'] },
    { field: "PO Value", value: formData['IBM / KYNDRYL PO Value'] },
    { field: "Total Invoice", value: formData['Total Invoice'] }
  ];

  // Helper function to convert number to words (Indian numbering system)
  const numberToWords = (amount: number): string => {
    if (amount === 0) return 'Zero Rupees Only';
    
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    
    const convertLessThanOneThousand = (num: number): string => {
      if (num === 0) return '';
      
      if (num < 10) return ones[num];
      if (num < 20) return teens[num - 10];
      if (num < 100) {
        return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + ones[num % 10] : '');
      }
      if (num < 1000) {
        return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 !== 0 ? ' and ' + convertLessThanOneThousand(num % 100) : '');
      }
      return '';
    };
    
    const convertToWords = (num: number): string => {
      if (num === 0) return 'Zero';
      
      const crore = Math.floor(num / 10000000);
      const lakh = Math.floor((num % 10000000) / 100000);
      const thousand = Math.floor((num % 100000) / 1000);
      const remainder = num % 1000;
      
      let result = '';
      
      if (crore > 0) {
        result += convertLessThanOneThousand(crore) + ' Crore ';
      }
      if (lakh > 0) {
        result += convertLessThanOneThousand(lakh) + ' Lakh ';
      }
      if (thousand > 0) {
        result += convertLessThanOneThousand(thousand) + ' Thousand ';
      }
      if (remainder > 0) {
        result += convertLessThanOneThousand(remainder);
      }
      
      return result.trim();
    };
    
    let integerPart = Math.floor(amount);
    const decimalPart = Math.round((amount - integerPart) * 100);
    
    let result = convertToWords(integerPart) + ' Rupees';
    
    if (decimalPart > 0) {
      result += ' and ' + convertToWords(decimalPart) + ' Paise';
    }
    
    result += ' Only';
    return result;
  };

  // Excel Export
  const exportPOToExcel = () => {
    const excelRows = [
      ["Field", "Value"],
      ...poTableRows.map(row => [row.field, row.value])
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'PO Summary');
    XLSX.writeFile(workbook, 'PO_Summary.xlsx');
  };

  // PDF Export
  const exportPOToPDF = () => {
    const doc = new jsPDF();
    // Add Alchemy logo in top-left corner (smaller size)
    const logoImg = new Image();
    logoImg.src = logo;
    logoImg.onload = () => {
      doc.addImage(logoImg, 'PNG', 15, 15, 15, 15);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Getting IT Done', 22, 40);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('ALCHEMY TECHSOL INDIA PVT LTD', 105, 25, { align: 'center' });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('CIN NO : U72200KA2015PTC081787', 105, 32, { align: 'center' });
      doc.setDrawColor(0, 0, 0);
      doc.line(20, 45, 190, 45);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`PO: ${formData['Vendor Inv. No.'] || 'N/A'}`, 20, 20);
      doc.text(`PO Date: ${formData['Vendor Inv. Date'] || 'N/A'}`, 20, 25);
      
      doc.text(`${formData['Vendor Details'] || 'N/A'}`, 20, 30);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const address = formData['Address'] || 'N/A';
      const addressLines = address.length > 60 ? 
        [address.substring(0, 60), address.substring(60, 120), address.substring(120, 180)] : 
        [address];
      addressLines.forEach((line, index) => {
        if (line && line.trim()) {
          doc.text(line, 20, 23 + (index * 1));
        }
      });
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(`Kind Attn: ${formData['Vendor SPOC'] || 'N/A'}`, 20, 35);
      doc.text(`Sub: ${formData['Description'] || 'N/A'}`, 20, 36);
      
      // Vendor Details Table with proper table structure
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Vendor Details', 20, 30);
      doc.text('Amount (in Rs)', 150, 30);
      doc.setDrawColor(0, 0, 0);
      doc.line(20, 28, 190, 28); // Top border
      doc.line(20, 28, 20, 45);  // Left border
      doc.line(150, 28, 150, 45); // Middle border
      doc.line(190, 28, 190, 45); // Right border
      doc.line(20, 32, 190, 32);  // Header separator
      
      // Table content - handle multiple descriptions
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      
      // Split description by commas or semicolons to handle multiple items
      const descriptions = (formData['Description'] || 'N/A').split(/[,;]/).map(d => d.trim()).filter(d => d);
      const alchemyPOValue = parseFloat(formData['IBM / KYNDRYL PO Value'] || '0') || 0;
      
      let currentY = 35;
      let totalAmount = 0;
      
      if (descriptions.length > 1) {
        // Multiple descriptions - split amount equally or use individual amounts
        const amountPerItem = alchemyPOValue / descriptions.length;
        
        descriptions.forEach((desc, index) => {
          if (currentY > 170) {
            // Add new page if needed
            doc.addPage();
            currentY = 30;
          }
          
          doc.text(desc, 25, currentY);
          doc.text(amountPerItem.toFixed(2), 155, currentY);
          totalAmount += amountPerItem;
          
          // Draw row separator
          doc.line(20, currentY + 1, 190, currentY + 1);
          currentY += 2;
        });
      } else {
        // Single description
        doc.text(formData['Description'] || 'N/A', 25, currentY);
        doc.text(alchemyPOValue.toFixed(2), 155, currentY);
        totalAmount = alchemyPOValue;
        currentY += 2;
      }
      
      // Total row
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Total', 25, currentY + 1);
      doc.text(totalAmount.toFixed(2), 155, currentY + 1);
      
      // Draw bottom border
      doc.line(20, currentY + 2, 190, currentY + 2);
      
      // Amount in Words
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const amountInWords = numberToWords(totalAmount);
      doc.text(`Amount in Words: ${amountInWords}`, 20, currentY + 3);
      
      // Payment Terms
      doc.text(`Payment Terms: ${formData["Payment Day's"] || 'N/A'}`, 20, currentY + 4);
      
      // Taxes
      doc.text('Taxes - As Applicable. (Alchemy Techsol GST No. 29AANCA7675B1ZC)', 20, currentY + 5);
      
      // Service Start date
      doc.text(`Service Start date: ${formData['Training Dates'] || 'N/A'}`, 20, currentY + 6);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('For Alchemy Techsol India Pvt Ltd', 20, currentY + 7);
      doc.text('Date & Signature:', 20, currentY + 8);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Reg. Office Address :', 20, currentY + 9);
      doc.text('Padmavathi Complex, No.81/1, 4th Floor 80 Feet Road, 8th Block Koramangala.', 20, currentY + 10);
      doc.text('Bangalore, Karnataka, India – 560095', 20, currentY + 11);
      
      doc.save('Purchase_Order.pdf');
    };
    logoImg.onerror = () => {
      // Fallback without logo
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('ALCHEMY TECHSOL INDIA PVT LTD', 105, 25, { align: 'center' });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('CIN NO : U72200KA2015PTC081787', 105, 32, { align: 'center' });
      doc.setDrawColor(0, 0, 0);
      doc.line(20, 45, 190, 45);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`PO: ${formData['Vendor Inv. No.'] || 'N/A'}`, 20, 60);
      doc.text(`PO Date: ${formData['Vendor Inv. Date'] || 'N/A'}`, 20, 61);
      
      doc.text(`${formData['Vendor Details'] || 'N/A'}`, 20, 62);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const address = formData['Address'] || 'N/A';
      const addressLines = address.length > 60 ? 
        [address.substring(0, 60), address.substring(60, 120), address.substring(120, 180)] : 
        [address];
      addressLines.forEach((line, index) => {
        if (line && line.trim()) {
          doc.text(line, 20, 63 + (index * 1));
        }
      });
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(`Kind Attn: ${formData['Vendor SPOC'] || 'N/A'}`, 20, 65);
      doc.text(`Sub: ${formData['Description'] || 'N/A'}`, 20, 66);
      
      // Vendor Details Table with proper table structure
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Vendor Details', 20, 70);
      doc.text('Amount (in Rs)', 150, 70);
      doc.setDrawColor(0, 0, 0);
      doc.line(20, 68, 190, 68); // Top border
      doc.line(20, 68, 20, 85);  // Left border
      doc.line(150, 68, 150, 85); // Middle border
      doc.line(190, 68, 190, 85); // Right border
      doc.line(20, 72, 190, 72);  // Header separator
      
      // Table content - handle multiple descriptions
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      
      // Split description by commas or semicolons to handle multiple items
      const descriptions = (formData['Description'] || 'N/A').split(/[,;]/).map(d => d.trim()).filter(d => d);
      const alchemyPOValue = parseFloat(formData['IBM / KYNDRYL PO Value'] || '0') || 0;
      
      let currentY = 75;
      let totalAmount = 0;
      
      if (descriptions.length > 1) {
        // Multiple descriptions - split amount equally or use individual amounts
        const amountPerItem = alchemyPOValue / descriptions.length;
        
        descriptions.forEach((desc, index) => {
          if (currentY > 170) {
            // Add new page if needed
            doc.addPage();
            currentY = 30;
          }
          
          doc.text(desc, 25, currentY);
          doc.text(amountPerItem.toFixed(2), 155, currentY);
          totalAmount += amountPerItem;
          
          // Draw row separator
          doc.line(20, currentY + 3, 190, currentY + 3);
          currentY += 8;
        });
      } else {
        // Single description
        doc.text(formData['Description'] || 'N/A', 25, currentY);
        doc.text(alchemyPOValue.toFixed(2), 155, currentY);
        totalAmount = alchemyPOValue;
        currentY += 8;
      }
      
      // Total row
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Total', 25, currentY + 5);
      doc.text(totalAmount.toFixed(2), 155, currentY + 5);
      
      // Draw bottom border
      doc.line(20, currentY + 8, 190, currentY + 8);
      
      // Amount in Words
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const amountInWords = numberToWords(totalAmount);
      doc.text(`Amount in Words: ${amountInWords}`, 20, currentY + 15);
      
      // Payment Terms
      doc.text(`Payment Terms: ${formData["Payment Day's"] || 'N/A'}`, 20, currentY + 28);
      
      // Taxes
      doc.text('Taxes - As Applicable. (Alchemy Techsol GST No. 29AANCA7675B1ZC)', 20, currentY + 41);
      
      // Service Start date
      doc.text(`Service Start date: ${formData['Training Dates'] || 'N/A'}`, 20, currentY + 54);
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('For Alchemy Techsol India Pvt Ltd', 20, currentY + 70);
      doc.text('Date & Signature:', 20, currentY + 82);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Reg. Office Address :', 20, currentY + 98);
      doc.text('Padmavathi Complex, No.81/1, 4th Floor 80 Feet Road, 8th Block Koramangala.', 20, currentY + 102);
      doc.text('Bangalore, Karnataka, India – 560095', 20, currentY + 106);
      
      doc.save('Purchase_Order.pdf');
    };
  };

  const calculateNetMargin = () => {
    const alchemyBilling = parseFloat(formData['Alchemy Billing Value']) || 0;
    const integratorCharges = parseFloat(formData['Integrator Charges (Margin)']) || 0;
    const fundingCost = parseFloat(formData['Funding cost']) || 0;
    
    const netMargin = alchemyBilling - integratorCharges - fundingCost;
    setFormData(prev => ({
      ...prev,
      'Net Margin': netMargin.toFixed(2)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
  
    const requiredFields = ['Sl.No', 'Costing Date', 'IBM / KYNDRYL'];
    for (const field of requiredFields) {
      if (!formData[field]) {
        setError(`Please fill in the required field: ${field}`);
        setIsSubmitting(false);
        return;
      }
    }
  
    try {
      if (!formData['Net Margin']) {
        calculateNetMargin();
      }
  
      console.log('Form data being sent:', formData);
      console.log('Form data keys:', Object.keys(formData));
      
      // Filter out any unwanted fields (like the old IGST field)
      const cleanFormData = { ...formData };
      delete cleanFormData['IGST @ 18%'];
      
      console.log('Clean form data being sent:', cleanFormData);
      console.log('Clean form data keys:', Object.keys(cleanFormData));
  
      const response = await apiClient.post('/Alchemy_Routing', cleanFormData);

      alert('Routing data submitted successfully!');
      navigate('/RoutingTable');
    } catch (err: any) {
      console.error('Error submitting data:', err);
      setError(err.response?.data?.error || err.message || 'Failed to submit data');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Action Dropdown Component
  const ActionDropdown = () => (
    <div className="dropdown">
      <button className="auth-button dropdown-toggle">
        Actions
      </button>
      <div className="dropdown-content">
        <button 
          className="dropdown-item" 
          onClick={() => fileInputRef.current?.click()}
        >
          Import Excel
        </button>
        <button 
          className="dropdown-item" 
          onClick={exportPOToExcel}
        >
          Export Excel
        </button>
        <button 
          className="dropdown-item" 
          onClick={downloadExcelFormat}
        >
          Download Format
        </button>
      </div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileImport}
        accept=".xlsx, .xls"
        style={{ display: 'none' }}
      />
    </div>
  );

  // Field groups remain the same
  const basicInfoFields = [
    'Sl.No', 'Costing Date', 'IBM / KYNDRYL', 'Requestor', 
    'Department SPOC', 'SPOC E-mail ID', 'domain'
  ];

  const trainingInfoFields = [
    'Training / Services Details', 'Description', 'Training Dates'
  ];

  const poInfoFields = [
    'IBM / KYNDRYL PO No', 'IBM / KYNDRYL PO Date', 'IBM / KYNDRYL PO Value'
  ];

  const financialFields = [
    'Integration %', 'Integrator Charges (Margin)',
    'Alchemy Billing Value', 'Funding cost', 'Net Margin'
  ];

  const vendorInfoFields = [
    'Vendor Details', 'Vendor SPOC', 'Vendor SPOC Contact No',
    'Vendor SPOC E-mail ID', 'Vendor Inv. No.', 'Vendor Inv. Date',
    'Vendor Inv. Amount', 'Vendor_PO_No', 'Vendor_PO_Date', 'Address', 'Alchemy PO',
  ];

  const taxFields = [
    'GST @ 18%', 'Total Invoice',
    'Vendor Amount After TDS 10%', 'Net Payment to Vendor'
  ];

  const paymentFields = [
    'Payment Due Date', 'Payment Expected Date (IBM)',
    'Cheque Issued Name', 'Cheque Date', 'Cheque No'
  ];

  const otherFields = [
    'Billing Month', "Payment Day's", 'Alchemy Techsol Invoive No',
    'Alchemy Techsol Invoice Date', 'Alchemy Techsol Invoice Amount', 'REMARK'
  ];

  const renderFieldGroup = (title: string, fields: string[]) => (
    <div className="field-group">
      <h3>{title}</h3>
      <div className="field-grid">
        {fields.map(field => (
          <div key={field} className="form-group">
            <label>{field}</label>
            {field.includes('Date') ? (
              <input
                type="date"
                name={field}
                value={formData[field]}
                onChange={handleChange}
              />
            ) : field.includes('@') || field.includes('%') || 
               field === 'Integration %' || 
               field === 'Alchemy Billing Value' || field === 'Integrator Charges (Margin)' || 
               field === 'Funding cost' || field === 'Net Margin' ? (
              <input
                type="number"
                name={field}
                value={formData[field]}
                onChange={handleChange}
                step="0.01"
                onBlur={field === 'Alchemy Billing Value' || 
                        field === 'Integrator Charges (Margin)' || field === 'Funding cost' ? 
                        calculateNetMargin : undefined}
              />
            ) : field === 'IBM / KYNDRYL' ? (
              <select
                name={field}
                value={formData[field]}
                onChange={handleChange}
              >
                <option value="">Select</option>
                <option value="IBM">IBM</option>
                <option value="KYNDRYL">KYNDRYL</option>
              </select>
                         ) : field === 'domain' ? (
               <select
                 name={field}
                 value={formData[field]}
                 onChange={handleChange}
               >
                 <option value="">Select Domain</option>
                 <option value="IT Hiring/ MS/ Implementation">IT Hiring/ MS/ Implementation</option>
                 <option value="Non-IT Hiring/MS/Implementation">Non-IT Hiring/MS/Implementation</option>
                 <option value="Non Aligned">Non Aligned</option>
               </select>
            ) : field === 'REMARK' || field === 'Description' || 
               field === 'Training / Services Details' ? (
              <input
                type="text"
                name={field}
                value={formData[field]}
                onChange={handleChange}
                className="wide-input"
              />
            ) : (
              <input
                type="text"
                name={field}
                value={formData[field]}
                onChange={handleChange}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="homepage">
      <div className="routing-header-bar" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '2rem 2rem 0 2rem' }}>
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
        }}>Add New Routing Data</h2>
        <div className="auth-buttons-container">
          <button
            className="auth-button"
            onClick={() => navigate('/RoutingDashboard')}
          >
            Routing Dashboard
          </button>
          <button
            className="auth-button"
            onClick={() => navigate('/RoutingTable')}
          >
            Home
          </button>
          <ActionDropdown />
          <button
            type="button"
            className="auth-button"
            onClick={() => setShowPOSummary(true)}
          >
            Export PO
          </button>
        </div>
      </div>
      <div className="add-routing-container" style={{ marginTop: '4rem' }}>
        
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="routing-form">
          {renderFieldGroup("Basic Information", basicInfoFields)}
          {renderFieldGroup("Training Information", trainingInfoFields)}
          {renderFieldGroup("PO Information", poInfoFields)}
          {renderFieldGroup("Financial Information", financialFields)}
          {renderFieldGroup("Vendor Information", vendorInfoFields)}
          {renderFieldGroup("Tax Information", taxFields)}
          {renderFieldGroup("Payment Information", paymentFields)}
          {renderFieldGroup("Other Information", otherFields)}

          <div className="form-actions">
            <button
              type="submit"
              disabled={isSubmitting}
              className="submit-btn"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Data'}
            </button>
            <button
              type="button"
              className="export-btn"
              onClick={() => setShowPOSummary(true)}
              style={{ marginBottom: '1rem' }}
            >
              Export PO
            </button>
            <button
              type="button"
              onClick={() => navigate('/RoutingTable')}
              className="cancel-btn"
            >
              Cancel
            </button>
          </div>
        </form>

        {showPOSummary && (
          <div className="po-summary-modal">
            <div className="po-summary-content">
              <h3>PO Summary</h3>
              <table>
                <tbody>
                  <tr>
                    <td><strong>Vendor Name</strong></td>
                    <td>{formData['Vendor Details']}</td>
                  </tr>
                  <tr>
                    <td><strong>PO No</strong></td>
                    <td>{formData['IBM / KYNDRYL PO No']}</td>
                  </tr>
                  <tr>
                    <td><strong>PO Date</strong></td>
                    <td>{formData['IBM / KYNDRYL PO Date']}</td>
                  </tr>
                  <tr>
                    <td><strong>PO Value</strong></td>
                    <td>{formData['IBM / KYNDRYL PO Value']}</td>
                  </tr>

                  <tr>
                    <td><strong>Total Invoice</strong></td>
                    <td>{formData['Total Invoice']}</td>
                  </tr>
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

export default AddRoutingData;