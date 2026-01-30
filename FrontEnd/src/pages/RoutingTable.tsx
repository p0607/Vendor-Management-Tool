import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './RoutingTable.css';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import autoTable from 'jspdf-autotable';
import JSZip from 'jszip';
import logo from '../assets/logo_1.png';
import apiClient from '../config/api';
import { formatDateOnly } from '../utils/dateUtils';

// Helper function to parse billing month from various formats including Excel serial numbers
const parseBillingMonth = (billingMonthStr: string): Date | null => {
  if (!billingMonthStr || billingMonthStr === 'N/A' || billingMonthStr === '') {
    return null;
  }
  
  // Handle DD-MM-YYYY format (e.g., "01-09-2024") - NEW CONVERTED DATA
  if (/^\d{2}-\d{2}-\d{4}$/.test(billingMonthStr.trim())) {
    const [day, month, year] = billingMonthStr.split('-').map(Number);
    return new Date(year, month - 1, day); // month is 0-indexed in JavaScript
  }
  
  // Handle Excel serial numbers (5-digit numbers like 45532, 45535) - for existing data
  if (/^\d{5}$/.test(billingMonthStr.trim())) {
    const serialNumber = parseInt(billingMonthStr, 10);
    
    // Proper Excel serial number to JavaScript Date conversion
    // Excel's date system: January 1, 1900 = serial number 1
    // Excel has a leap year bug - it thinks 1900 is a leap year
    // So we need to adjust for serial numbers > 59 (after Feb 29, 1900)
    
    // Excel epoch is December 30, 1899 (serial number 0)
    const excelEpoch = new Date(1899, 11, 30); // December 30, 1899
    
    // Calculate the date by adding the serial number days
    // For serial numbers > 59, subtract 1 to account for Excel's leap year bug
    let daysToAdd = serialNumber;
    if (serialNumber > 59) {
      daysToAdd = serialNumber - 1;
    }
    
    const date = new Date(excelEpoch.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    
    // Validate the date is reasonable (between 1900 and 2100)
    if (date.getFullYear() >= 1900 && date.getFullYear() <= 2100) {
      return date;
    }
    
    // If the date is invalid, try alternative conversion
    // Sometimes Excel serial numbers might be using a different epoch
    const alternativeDate = new Date(1900, 0, serialNumber - 1); // January 1, 1900 + serialNumber days
    if (alternativeDate.getFullYear() >= 1900 && alternativeDate.getFullYear() <= 2100) {
      return alternativeDate;
    }
  }
  
  // Handle MMM-YY format (e.g., "Sep-24", "Aug-24") - for existing data
  if (billingMonthStr.includes('-') && billingMonthStr.length === 6) {
    const [monthStr, yearStr] = billingMonthStr.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIndex = monthNames.indexOf(monthStr);
    
    if (monthIndex !== -1 && yearStr) {
      const year = 2000 + parseInt(yearStr, 10);
      return new Date(year, monthIndex, 1);
    }
  }
  
  // Handle YYYY-MM-DD format (for new data from backend)
  if (billingMonthStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const date = new Date(billingMonthStr);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  // Handle other date formats as fallback
  try {
    const date = new Date(billingMonthStr);
    if (!isNaN(date.getTime())) {
      return date;
    }
  } catch (error) {
    // Ignore parsing errors
  }
  
  return null;
};

// Helper function to format billing month for display
const formatBillingMonth = (billingMonthStr: string): string => {
  const date = parseBillingMonth(billingMonthStr);
  if (!date) return billingMonthStr || 'N/A';
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  
  return `${month} ${year}`;
};

interface RoutingTableItem {
  id: number;
  "Sl.No": string;
  "Costing Date": string;
  "IBM / KYNDRYL": string;
  "Requestor": string;
  "Department SPOC": string;
  "SPOC E-mail ID": string;
  "Training / Services Details": string;
  "Description": string;

  "IBM / KYNDRYL PO No": string;
  "IBM / KYNDRYL PO Date": string;
  "IBM / KYNDRYL PO Value": string;


  "Integration %": string;
  "Integrator Charges (Margin)": string;
  "Alchemy Billing Value": string;
  "Funding cost": string;
  "Net Margin": string;
  "Billing Month": string;
  "Payment Day's": string;
  "Vendor Details": string;
  "Vendor SPOC": string;
  "Vendor SPOC Contact No": string;
  "Vendor SPOC E-mail ID": string;
  "Training Dates": string;
  "Vendor Inv. No.": string;
  "Vendor Inv. Date": string;
  "Vendor Inv. Amount": string;
  "GST @ 18%": string;
  "Total Invoice": string;
  "Vendor Amount After TDS 10%": string;
  "Net Payment to Vendor": string;
  "Payment Due Date": string;
  "Alchemy Techsol Invoive No": string;
  "Alchemy Techsol Invoice Date": string;
  "Alchemy Techsol Invoice Amount": string;
  "Payment Expected Date (IBM)": string;
  "Cheque Issued Name": string;
  "Cheque Date": string;
  "Cheque No": string;
  "REMARK": string;
  "Vendor_PO_No": string;
  "Vendor_PO_Date": string;
  "Address": string;
  "domain": string;
  "Alchemy PO": string;
  [key: string]: any;
}

const RoutingTable: React.FC = () => {
  const [routingTable, setRoutingTable] = useState<RoutingTableItem[]>([]);
  const [visibleRoutingTable, setVisibleRoutingTable] = useState<RoutingTableItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [itemsToShow, setItemsToShow] = useState<number>(100);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [billingDateFilter, setBillingDateFilter] = useState<string>('');
  const [vendorDetailsFilter, setVendorDetailsFilter] = useState<string>('');
  const [editingMode, setEditingMode] = useState<boolean>(false);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editedValue, setEditedValue] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
 const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [showPOSummary, setShowPOSummary] = useState(false);
  const [poRow, setPoRow] = useState<RoutingTableItem | null>(null);
  const [showActionDropdown, setShowActionDropdown] = useState<boolean>(false);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const navigate = useNavigate();

  // Function to convert number to words
  const numberToWords = (num: number): string => {
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
    
    if (num === 0) return 'Zero';
    
    let integerPart = Math.floor(num);
    const decimalPart = Math.round((num - integerPart) * 100);
    
    let result = '';
    
    if (integerPart >= 10000000) {
      const crores = Math.floor(integerPart / 10000000);
      result += convertLessThanOneThousand(crores) + ' Crore ';
      integerPart = integerPart % 10000000;
    }
    
    if (integerPart >= 100000) {
      const lakhs = Math.floor(integerPart / 100000);
      result += convertLessThanOneThousand(lakhs) + ' Lakh ';
      integerPart = integerPart % 100000;
    }
    
    if (integerPart >= 1000) {
      const thousands = Math.floor(integerPart / 1000);
      result += convertLessThanOneThousand(thousands) + ' Thousand ';
      integerPart = integerPart % 1000;
    }
    
    if (integerPart > 0) {
      result += convertLessThanOneThousand(integerPart);
    }
    
    if (decimalPart > 0) {
      result += ' and ' + convertLessThanOneThousand(decimalPart) + ' Paise';
    }
    
    return result.trim() + ' Rupees';
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.action-dropdown-container')) {
        setShowActionDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Define default visible fields (first 7 fields, excluding id)
  const defaultVisibleFields: (keyof RoutingTableItem)[] = [
    'Sl.No',
    'Costing Date',
    'Vendor Details',
    'Alchemy Billing Value',
    'Integrator Charges (Margin)',
    'Funding cost',
    'Net Margin',
  ];

  // PO Table columns and rows generator
  const getPoTableRows = (row: RoutingTableItem) => [
    { field: "Vendor PO Number", value: row['Vendor Inv. No.'] || 'N/A' },
    { field: "Vendor PO Date", value: row['Vendor Inv. Date'] || 'N/A' },
    { field: "Vendor Details", value: row['Vendor Details'] || 'N/A' },
    { field: "Training Dates", value: row['Training Dates'] || 'N/A' },
    { field: "Address", value: row['Address'] || 'N/A' },
    { field: "Vendor SPOC", value: row['Vendor SPOC'] || 'N/A' },
    { field: "Description", value: row['Description'] || 'N/A' },
    { field: "Alchemy PO", value: row['IBM / KYNDRYL PO No'] || 'N/A' },
    { field: "Payment Days", value: row["Payment Day's"] || 'N/A' }
  ];

  // Excel Export
  const exportPOToExcel = () => {
    if (!poRow) return;
    const excelRows = [
      ["Field", "Value"],
      ...getPoTableRows(poRow).map(row => [row.field, row.value])
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'PO Summary');
    XLSX.writeFile(workbook, 'PO_Summary.xlsx');
  };

  // PDF Export
  const exportPOToPDF = () => {
    if (!poRow) return;
    const doc = new jsPDF();
    
    // Add Alchemy logo in top-left corner
    const logoImg = new Image();
    logoImg.src = logo;
    
    // Wait for logo to load before adding to PDF
    logoImg.onload = () => {
      // Add logo in top-left corner (20, 20 position, 30x30 size)
      doc.addImage(logoImg, 'PNG', 15, 15, 20, 20);
      
      // Add "Getting IT Done" tagline below logo
      doc.setFontSize(8);
      doc.setFont('montserrat', 'normal');
      doc.text('Getting IT Done', 25, 25);
      
      // Add company name on the right side
      doc.setFontSize(8);
      doc.setFont('montserrat', 'bold');
      doc.text('ALCHEMY TECHSOL INDIA PVT LTD', 105, 20, { align: 'right' });
      
      // Add CIN number below company name
      doc.setFontSize(8);
      doc.setFont('montserrat', 'normal');
      doc.text('CIN NO : U72200KA2015PTC081787', 105, 21, { align: 'right' });
      
      // Add horizontal line separator
      doc.setDrawColor(0, 0, 0);
      doc.line(20, 22, 190, 22);
      
      // PO Details section (left-aligned)
      doc.setFontSize(8);
      doc.setFont('montserrat', 'normal');
      doc.text(`PO: ${poRow['Vendor Inv. No.'] || 'N/A'}`, 20, 23);
      doc.text(`PO Date: ${poRow['Vendor Inv. Date'] || 'N/A'}`, 20, 24);
      
      // Vendor Details
      doc.text(`${poRow['Vendor Details'] || 'N/A'}`, 20, 25);
      
      // Address formatted in 3 lines
      doc.setFontSize(8);
      doc.setFont('montserrat', 'normal');
      const address = poRow['Address'] || 'N/A';
      const addressLines = address.length > 60 ? 
        [address.substring(0, 60), address.substring(60, 120), address.substring(120, 180)] : 
        [address];
      
      addressLines.forEach((line, index) => {
        if (line && line.trim()) {
          doc.text(line, 20, 26 + (index * 1));
        }
      });
      
      // Kind Attn
      doc.setFontSize(8);
      doc.setFont('montserrat', 'bold');
      doc.text(`Kind Attn: ${poRow['Vendor SPOC'] || 'N/A'}`, 20, 28);
      doc.text(`Sub: ${poRow['Description'] || 'N/A'}`, 20, 29);
      
      // Vendor Details Table with proper table structure
      doc.setFontSize(8);
      doc.setFont('montserrat', 'bold');
      
      // Table headers
      doc.text('Vendor Details', 20, 32);
      doc.text('Amount (in Rs)', 150, 32);
      
      // Draw table borders
      doc.setDrawColor(0, 0, 0);
      doc.line(20, 30, 190, 30); // Top border
      doc.line(20, 30, 20, 44);  // Left border
      doc.line(150, 30, 150, 44); // Middle border
      doc.line(190, 30, 190, 44); // Right border
      doc.line(20, 34, 190, 34);  // Header separator
      
      // Table content - handle multiple descriptions
      doc.setFontSize(8);
      doc.setFont('montserrat', 'normal');
      
      // Split description by commas or semicolons to handle multiple items
      const descriptions = (poRow['Description'] || 'N/A').split(/[,;]/).map(d => d.trim()).filter(d => d);
      const alchemyPOValue = parseFloat(poRow['IBM / KYNDRYL PO Value'] || '0') || 0;
      
      let currentY = 37;
      let totalAmount = 0;
      
      if (descriptions.length > 1) {
        // Multiple descriptions - split amount equally or use individual amounts
        const amountPerItem = alchemyPOValue / descriptions.length;
        
        descriptions.forEach((desc, index) => {
          if (currentY > 190) {
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
        doc.text(poRow['Description'] || 'N/A', 25, currentY);
        doc.text(alchemyPOValue.toFixed(2), 155, currentY);
        totalAmount = alchemyPOValue;
        currentY += 2;
      }
      
      // Total row
      doc.setFontSize(8);
      doc.setFont('montserrat', 'bold');
      doc.text('Total', 25, currentY + 1);
      doc.text(totalAmount.toFixed(2), 155, currentY + 1);
      
      // Draw bottom border
      doc.line(20, currentY + 2, 190, currentY + 2);
      
      // Extend vertical borders to meet bottom border
      doc.line(20, 30, 20, currentY + 2);  // Left border
      doc.line(150, 30, 150, currentY + 2); // Middle border  
      doc.line(190, 30, 190, currentY + 2); // Right border
      
      // Amount in Words
      doc.setFontSize(8);
      doc.setFont('montserrat', 'normal');
      const amountInWords = numberToWords(totalAmount);
      doc.text(`Amount in Words: ${amountInWords}`, 20, currentY + 3);
      
      // Payment Terms
      doc.text(`Payment Terms: ${poRow["Payment Day's"] || 'N/A'}`, 20, currentY + 4);
      
      // Taxes
      doc.text('Taxes - As Applicable. (Alchemy Techsol GST No. 29AANCA7675B1ZC)', 20, currentY + 5);
      
      // Service Start date
      doc.text(`Service Start date: ${poRow['Training Dates'] || 'N/A'}`, 20, currentY + 6);
      
      doc.setFontSize(8);
      doc.setFont('montserrat', 'bold');
      doc.text('For Alchemy Techsol India Pvt Ltd', 20, currentY + 7);
      doc.text('Date & Signature:', 20, currentY + 8);
      
      doc.setFontSize(8);
      doc.setFont('montserrat', 'normal');
      doc.text('Reg. Office Address :', 20, currentY + 9);
      doc.text('Padmavathi Complex, No.81/1, 4th Floor 80 Feet Road, 8th Block Koramangala.', 20, currentY + 10);
      doc.text('Bangalore, Karnataka, India – 560095', 20, currentY + 11);
      
      doc.save('Purchase_Order.pdf');
    };
    
    // Fallback if logo doesn't load
    logoImg.onerror = () => {
      // Continue without logo if it fails to load
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Getting IT Done', 25, 25);
      
      // Rest of the content without logo
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('ALCHEMY TECHSOL INDIA PVT LTD', 105, 20, { align: 'center' });
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('CIN NO : U72200KA2015PTC081787', 105, 21, { align: 'center' });
      
      // Add horizontal line separator
      doc.setDrawColor(0, 0, 0);
      doc.line(20, 22, 190, 22);
      
      // Continue with rest of content...
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(`PO: ${poRow['Vendor Inv. No.'] || 'N/A'}`, 20, 23);
      doc.text(`PO Date: ${poRow['Vendor Inv. Date'] || 'N/A'}`, 20, 24);
      
      doc.text(`${poRow['Vendor Details'] || 'N/A'}`, 20, 25);
      
      // Address formatted in 3 lines
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const address = poRow['Address'] || 'N/A';
      const addressLines = address.length > 60 ? 
        [address.substring(0, 60), address.substring(60, 120), address.substring(120, 180)] : 
        [address];
      
      addressLines.forEach((line, index) => {
        if (line && line.trim()) {
          doc.text(line, 20, 26 + (index * 1));
        }
      });
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(`Kind Attn : ${poRow['Vendor SPOC'] || 'N/A'}`, 20, 28);
      doc.text(`Sub: ${poRow['Description'] || 'N/A'}`, 20, 29);
      
      // Vendor Details Table with proper table structure
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      
      // Table headers
      doc.text('Vendor Details', 20, 165);
      doc.text('Amount (in Rs)', 150, 165);
      
      // Draw table borders
      doc.setDrawColor(0, 0, 0);
      doc.line(20, 160, 190, 160); // Top border
      doc.line(20, 160, 20, 175);  // Left border
      doc.line(150, 160, 150, 175); // Middle border
      doc.line(190, 160, 190, 175); // Right border
      doc.line(20, 170, 190, 170);  // Header separator
      
      // Table content - handle multiple descriptions
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      // Split description by commas or semicolons to handle multiple items
      const descriptions = (poRow['Description'] || 'N/A').split(/[,;]/).map(d => d.trim()).filter(d => d);
      const alchemyPOValue = parseFloat(poRow['Alchemy PO'] || '0') || 0;
      
      let currentY = 178;
      let totalAmount = 0;
      
      if (descriptions.length > 1) {
        // Multiple descriptions - split amount equally or use individual amounts
        const amountPerItem = alchemyPOValue / descriptions.length;
        
        descriptions.forEach((desc, index) => {
          if (currentY > 190) {
            // Add new page if needed
            doc.addPage();
            currentY = 30;
          }
          
          doc.text(desc, 25, currentY);
          doc.text(amountPerItem.toFixed(2), 155, currentY);
          totalAmount += amountPerItem;
          
          // Draw row separator
          doc.line(20, currentY + 3, 190, currentY + 3);
          currentY += 10;
        });
      } else {
        // Single description
        doc.text(poRow['Description'] || 'N/A', 25, currentY);
        doc.text(alchemyPOValue.toFixed(2), 155, currentY);
        totalAmount = alchemyPOValue;
        currentY += 10;
      }
      
      // Total row
      doc.setFontSize(12);
      doc.setFont('montserrat', 'bold');
      doc.text('Total', 25, currentY + 5);
      doc.text(totalAmount.toFixed(2), 155, currentY + 5);
      
      // Draw bottom border
      doc.line(20, currentY + 8, 190, currentY + 8);
      
      // Amount in Words
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const amountInWords = numberToWords(totalAmount);
      doc.text(`Amount in Words: ${amountInWords}`, 20, currentY + 20);
      
      // Payment Terms
      doc.text(`Payment Terms: ${poRow["Payment Day's"] || 'N/A'}`, 20, currentY + 25);
      
      // Taxes
      doc.text('Taxes - As Applicable. (Alchemy Techsol GST No. 29AANCA7675B1ZC)', 20, currentY + 30);
      
      // Service Start date
      doc.text(`Service Start date: ${poRow['Training Dates'] || 'N/A'}`, 20, currentY + 35);
      
      // For Alchemy Techsol
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('For Alchemy Techsol India Pvt Ltd', 20, currentY + 85);
      
      // Date & Signature
      doc.text('Date & Signature:', 20, currentY + 100);
      
      // Footer - Reg. Office Address
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Reg. Office Address :', 20, currentY + 120);
      doc.text('Padmavathi Complex, No.81/1, 4th Floor 80 Feet Road, 8th Block Koramangala.', 20, currentY + 122);
      doc.text('Bangalore, Karnataka, India – 560095', 20, currentY + 124);
      
      doc.save('Purchase_Order.pdf');
    };
  };

  // Export selected POs as ZIP (PDFs and Excels)
  // (Removed duplicate handleExportPOClick definition to fix redeclaration error)

  // Checkbox handler – allow multiple selection
  const handleCheckboxChange = (index: number) => {
    setSelectedRows(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  // Delete selected rows
  const handleDeleteSelected = async () => {
    if (selectedRows.length === 0) {
      alert('Please select at least one row to delete.');
      return;
    }
    const ids = selectedRows.map(idx => visibleRoutingTable[idx]?.id).filter((id): id is number => id != null);
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} selected record(s)? This cannot be undone.`)) return;
    try {
      setLoading(true);
      for (const id of ids) {
        await apiClient.delete(`/Alchemy_Routing/${id}`);
      }
      setSelectedRows([]);
      setRefreshCounter(c => c + 1);
      alert(`${ids.length} record(s) deleted.`);
    } catch (err: any) {
      console.error('Delete failed:', err);
      alert(err.response?.data?.error || err.response?.data?.message || err.message || 'Delete failed.');
    } finally {
      setLoading(false);
    }
  };

  //Select all checkbox handler
  const isAllSelected = visibleRoutingTable.length > 0 && selectedRows.length === visibleRoutingTable.length;
  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedRows([]);
    } else {
      setSelectedRows(visibleRoutingTable.map((_, idx) => idx));
    }
  };

  // Export PO button handler
  const handleExportPOClick = async () => {
    if (selectedRows.length === 0) {
      alert('Please select at least one row to export PO.');
      return;
    }

    // For PDF: create a zip of PDFs
    const zip = new JSZip();
    
    // Load logo once for all PDFs
    const logoImg = new Image();
    logoImg.src = logo;
    
    // Wait for logo to load, then create all PDFs
    logoImg.onload = async () => {
      for (const idx of selectedRows) {
        const row = visibleRoutingTable[idx];
        const doc = new jsPDF();
        
        // Add Alchemy logo in top-left corner (smaller size)
        doc.addImage(logoImg, 'PNG', 20, 15, 20, 20);
        
        // Add "Getting IT Done" tagline below logo
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('Getting IT Done', 22, 40);
        
        // Add company name on the right side
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('ALCHEMY TECHSOL INDIA PVT LTD', 105, 25, { align: 'center' });
        
        // Add CIN number below company name
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('CIN NO : U72200KA2015PTC081787', 105, 32, { align: 'center' });
        
        // Add horizontal line separator
        doc.setDrawColor(0, 0, 0);
        doc.line(20, 45, 190, 45);
        
        // PO Details section (left-aligned)
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`PO: ${row['Vendor Inv. No.'] || 'N/A'}`, 20, 60);
        doc.text(`PO Date: ${row['Vendor Inv. Date'] || 'N/A'}`, 20, 68);
        
        // Vendor Details
        doc.text(`${row['Vendor Details'] || 'N/A'}`, 20, 80);
        
        // Address formatted in 3 lines
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const address = row['Address'] || 'N/A';
        const addressLines = address.length > 60 ? 
          [address.substring(0, 60), address.substring(60, 120), address.substring(120, 180)] : 
          [address];
        
        addressLines.forEach((line, index) => {
          if (line && line.trim()) {
            doc.text(line, 20, 88 + (index * 4));
          }
        });
        
        // Kind Attn
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Kind Attn: ${row['Vendor SPOC'] || 'N/A'}`, 20, 105);
        
        // Subject
        doc.text(`Sub: ${row['Description'] || 'N/A'}`, 20, 118);
        
        // Vendor Details Table with proper table structure
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        
        // Table headers
        doc.text('Vendor Details', 20, 140);
        doc.text('Amount (in Rs)', 150, 140);
        
        // Draw table borders
        doc.setDrawColor(0, 0, 0);
        doc.line(20, 135, 190, 135); // Top border
        doc.line(20, 135, 20, 157);  // Left border
        doc.line(150, 135, 150, 157); // Middle border
        doc.line(190, 135, 190, 157); // Right border
        doc.line(20, 145, 190, 145);  // Header separator
        
        // Table content - handle multiple descriptions
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        
        // Split description by commas or semicolons to handle multiple items
        const descriptions = (row['Description'] || 'N/A').split(/[,;]/).map(d => d.trim()).filter(d => d);
        const alchemyPOValue = parseFloat(row['IBM / KYNDRYL PO Value'] || '0') || 0;
        
        let currentY = 153;
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
          doc.text(row['Description'] || 'N/A', 25, currentY);
          doc.text(alchemyPOValue.toFixed(2), 155, currentY);
          totalAmount = alchemyPOValue;
          currentY += 10;
        }
        
        // Total row
        doc.setFontSize(12);
        doc.setFont('montserrat', 'bold');
        doc.text('Total', 25, currentY + 5);
        doc.text(totalAmount.toFixed(2), 155, currentY + 5);
        
        // Draw bottom border
        doc.line(20, currentY + 8, 190, currentY + 8);
        
        // Extend vertical borders to meet bottom border
        doc.line(20, 135, 20, currentY + 8);  // Left border
        doc.line(150, 135, 150, currentY + 8); // Middle border
        doc.line(190, 135, 190, currentY + 8); // Right border
        
        // Amount in Words
        doc.setFontSize(10);
        doc.setFont('montserrat', 'normal');
        const amountInWords = numberToWords(totalAmount);
        doc.text(`Amount in Words: ${amountInWords}`, 20, currentY + 25);
        
        // Payment Terms
        doc.text(`Payment Terms: ${row["Payment Day's"] || 'N/A'}`, 20, currentY + 35);
        
        // Taxes
        doc.text('Taxes - As Applicable. (Alchemy Techsol GST No. 29AANCA7675B1ZC)', 20, currentY + 45);
        
        // Service Start date
        doc.text(`Service Start date: ${row['Training Dates'] || 'N/A'}`, 20, currentY + 55);
        
        // For Alchemy Techsol
        doc.setFontSize(12);
        doc.setFont('montserrat', 'bold');
        doc.text('For Alchemy Techsol India Pvt Ltd', 20, currentY + 65);
        
        // Date & Signature
        doc.text('Date & Signature:', 20, currentY + 85);
        
        // Footer - Reg. Office Address
        doc.setFontSize(10);
        doc.setFont('montserrat', 'normal');
        doc.text('Reg. Office Address :', 20, currentY + 100);
        doc.text('Padmavathi Complex, No.81/1, 4th Floor 80 Feet Road, 8th Block Koramangala.', 20, currentY + 110);
        doc.text('Bangalore, Karnataka, India – 560095', 20, currentY + 120);
        
        const pdfBlob = doc.output('blob');
        zip.file(
          `Purchase_Order_${row['Vendor Details'] || 'Vendor'}_${row['Sl.No'] || idx + 1}.pdf`,
          pdfBlob
        );
      }
      
      // For Excel: create a zip of Excels
      for (const idx of selectedRows) {
        const row = visibleRoutingTable[idx];
        const excelRows = [
          ["Field", "Value"],
          ...getPoTableRows(row).map(r => [r.field, r.value])
        ];
        const worksheet = XLSX.utils.aoa_to_sheet(excelRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'PO Summary');
        const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        zip.file(
          `PO_Summary_${row['Vendor Details'] || 'Vendor'}_${row['Sl.No'] || idx + 1}.xlsx`,
          wbout
        );
      }
      
      // Download zip
      const content = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(content);
      a.download = 'Purchase_Orders.zip';
      a.click();
    };
    
    // Fallback if logo doesn't load
    logoImg.onerror = async () => {
      for (const idx of selectedRows) {
        const row = visibleRoutingTable[idx];
        const doc = new jsPDF();
        
        // Continue without logo if it fails to load
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Getting IT Done', 25, 55);
        
        // Rest of the content without logo
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('ALCHEMY TECHSOL INDIA PVT LTD', 105, 30, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('CIN NO : U72200KA2015PTC081787', 105, 40, { align: 'center' });
        
        // Add horizontal line separator
        doc.setDrawColor(0, 0, 0);
        doc.line(20, 60, 190, 60);
        
        // Continue with rest of content...
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`PO: ${row['Vendor Inv. No.'] || 'N/A'}`, 20, 75);
        doc.text(`PO Date: ${row['Vendor Inv. Date'] || 'N/A'}`, 20, 85);
        
        doc.text(`${row['Vendor Details'] || 'N/A'}`, 20, 100);
        
        // Address formatted in 3 lines
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const address = row['Address'] || 'N/A';
        const addressLines = address.length > 60 ? 
          [address.substring(0, 60), address.substring(60, 120), address.substring(120, 180)] : 
          [address];
        
        addressLines.forEach((line, index) => {
          if (line && line.trim()) {
            doc.text(line, 20, 110 + (index * 5));
          }
        });
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Kind Attn : ${row['Vendor SPOC'] || 'N/A'}`, 20, 125);
        doc.text(`Sub: ${row['Description'] || 'N/A'}`, 20, 140);
        
        // Draw table borders
        doc.setDrawColor(0, 0, 0);
        doc.line(20, 155, 190, 155); // Top border
        doc.line(20, 155, 20, 192);  // Left border
        doc.line(150, 155, 150, 192); // Middle border
        doc.line(190, 155, 190, 192); // Right border
        doc.line(20, 165, 190, 165);  // Header separator
        
        doc.text('Vendor Details', 20, 160);
        doc.text('Amount (in Rs)', 150, 160);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`${row['Description'] || 'N/A'}`, 20, 170);
        doc.text(`${row['IBM / KYNDRYL PO No'] || 'N/A'}`, 150, 170);
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Total', 20, 185);
        doc.text(`${row['IBM / KYNDRYL PO No'] || 'N/A'}`, 150, 185);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Amount in Words:', 20, 200);
        doc.text(`Payment Terms: ${row["Payment Day's"] || 'N/A'}`, 20, 215);
        doc.text('Taxes - As Applicable. (Alchemy Techsol GST No. 29AANCA7675B1ZC)', 20, 230);
        doc.text(`Service Start date: ${row['Training Dates'] || 'N/A'}`, 20, 245);
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('For Alchemy Techsol India Pvt Ltd', 20, 265);
        doc.text('Date & Signature:', 20, 280);
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('Reg. Office Address :', 20, 295);
        doc.text('Padmavathi Complex, No.81/1, 4th Floor 80 Feet Road, 8th Block Koramangala.', 20, 300);
        doc.text('Bangalore, Karnataka, India – 560095', 20, 305);
        
        const pdfBlob = doc.output('blob');
        zip.file(
          `Purchase_Order_${row['Vendor Details'] || 'Vendor'}_${row['Sl.No'] || idx + 1}.pdf`,
          pdfBlob
        );
      }
      
      // For Excel: create a zip of Excels
      for (const idx of selectedRows) {
        const row = visibleRoutingTable[idx];
        const excelRows = [
          ["Field", "Value"],
          ...getPoTableRows(row).map(r => [r.field, r.value])
        ];
        const worksheet = XLSX.utils.aoa_to_sheet(excelRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'PO Summary');
        const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        zip.file(
          `PO_Summary_${row['Vendor Details'] || 'Vendor'}_${row['Sl.No'] || idx + 1}.xlsx`,
          wbout
        );
      }
      
      // Download zip
      const content = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(content);
      a.download = 'Purchase_Orders.zip';
      a.click();
    };
  };

    // Implement export logic here as needed
    // alert('Export PO logic not implemented in this snippet.');
  // REMOVE THIS EXTRA BRACE

  // Get all field names from the first item (if available)
  const allFields = routingTable.length > 0
    ? (Object.keys(routingTable[0]) as (keyof RoutingTableItem)[])
    : [];

  // Group additional fields into chunks for multi-column display
  const additionalFields = allFields.filter(field => !defaultVisibleFields.includes(field));
  const columnsCount = 8;
  const groupedFields: (keyof RoutingTableItem)[][] = [];
  
  for (let i = 0; i < additionalFields.length; i += columnsCount) {
    groupedFields.push(additionalFields.slice(i, i + columnsCount));
  }

  // Fetch data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await apiClient.get('/Alchemy_Routing');
        
        if (!Array.isArray(response.data)) {
          throw new Error("Data is not an array");
        }

        // Data is already sorted by most recent first from the backend (ORDER BY id DESC)
        setRoutingTable(response.data as RoutingTableItem[]);
        setVisibleRoutingTable(response.data.slice(0, itemsToShow) as RoutingTableItem[]);
      } catch (err: any) {
        console.error("Fetch failed:", err);
        setError(err.response?.data?.error || err.message || 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [itemsToShow, refreshCounter]);



// Helper to convert a date or date string to "YYYY-MM-DD"
function toYMD(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}



// Filter data based on search terms
// Note: We need to filter first, then calculate SL No. based on filtered position
// So we'll do a two-pass: first pass filters, second pass adds SL No. info for search
const filteredData = useMemo(() => {
  // First, filter the data based on all criteria except SL No.
  const initiallyFiltered = routingTable.filter((item) => {
    const billingDateLower = billingDateFilter.toLowerCase();
    const vendorDetailsLower = vendorDetailsFilter.toLowerCase();

    // Filter by billing date and vendor details first
    const hasBillingDateMatch = !billingDateLower || 
      (item['Costing Date'] && String(item['Costing Date']).toLowerCase().includes(billingDateLower));

    const hasVendorDetailsMatch = !vendorDetailsLower || 
      (item['Vendor Details'] && String(item['Vendor Details']).toLowerCase().includes(vendorDetailsLower));

    // Date range filter logic for "Costing Date"
    let hasDateRangeMatch = true;
    if (startDate || endDate) {
      const itemDateStr = item['Costing Date'];
      const itemYMD = toYMD(itemDateStr);
      const startYMD = toYMD(startDate);
      const endYMD = toYMD(endDate);
      if (!itemYMD) {
        hasDateRangeMatch = false;
      } else {
        if (startYMD && itemYMD < startYMD) hasDateRangeMatch = false;
        if (endYMD && itemYMD > endYMD) hasDateRangeMatch = false;
      }
    }

    return hasBillingDateMatch && hasVendorDetailsMatch && hasDateRangeMatch;
  });

  // Now filter by search term, including SL No. matching
  // SL No. is fetched directly from the database (item['Sl.No'])
  const searchTermLower = searchTerm.toLowerCase();
  const searchWords = searchTermLower.split(/\s+/).filter(word => word.length > 0);
  
  return initiallyFiltered.filter((item) => {
    const hasSearchMatch = searchWords.length === 0 || 
      searchWords.some(word => {
        // Get SL No. from database (item['Sl.No'])
        const slNo = item['Sl.No'] ? String(item['Sl.No']).toLowerCase() : '';
        
        // Check if search term matches SL No. from database
        if (slNo) {
          // Check if SL No. contains the search word (for partial text matches)
          if (slNo.includes(word)) {
            return true;
          }
          // Also check exact number match
          const searchNumber = parseInt(word, 10);
          const slNoNumber = parseInt(slNo, 10);
          if (!isNaN(searchNumber) && !isNaN(slNoNumber) && searchNumber === slNoNumber) {
            return true;
          }
        }
        // Check all other item values
        return Object.values(item).some(value => 
          String(value).toLowerCase().includes(word)
        );
      });

    return hasSearchMatch;
  });
}, [routingTable, searchTerm, billingDateFilter, vendorDetailsFilter, startDate, endDate]);
  useEffect(() => {
    setVisibleRoutingTable(filteredData.slice(0, itemsToShow));
  }, [filteredData, itemsToShow]);

  // Handle edit functions
  const handleEditClick = (rowIndex: number, field: string, currentValue: string) => {
    setEditingRow(rowIndex);
    setEditingField(field);
    setEditedValue(currentValue);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (editingRow === null || editingField === null) return;

    try {
      const updatedItem = { 
        ...visibleRoutingTable[editingRow], 
        [editingField]: editedValue 
      };

      // Use id for PATCH request
      const response = await apiClient.patch(`/Alchemy_Routing/${updatedItem.id}`, {
        [editingField]: editedValue
      });

      if (response.data) {
        // Update the local state
        const updatedTable = [...routingTable];
        const globalIndex = routingTable.findIndex(item => item.id === updatedItem.id);
        if (globalIndex !== -1) {
          updatedTable[globalIndex] = { ...updatedTable[globalIndex], [editingField]: editedValue };
          setRoutingTable(updatedTable);
        }

        // Update visible table
        const updatedVisibleTable = [...visibleRoutingTable];
        updatedVisibleTable[editingRow] = { ...updatedVisibleTable[editingRow], [editingField]: editedValue };
        setVisibleRoutingTable(updatedVisibleTable);

        setIsEditing(false);
        setEditingRow(null);
        setEditingField(null);
        setEditedValue('');
      }
    } catch (err: any) {
      console.error('Error updating record:', err);
      setError(err.response?.data?.error || err.message || 'Failed to update record');
    }
  };
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingRow(null);
    setEditingField(null);
    setEditedValue('');
  };

  // Other helper functions
  const loadMore = () => {
    const newItemsToShow = itemsToShow + 100;
    setItemsToShow(newItemsToShow);
    setVisibleRoutingTable(filteredData.slice(0, newItemsToShow));
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setItemsToShow(100);
  };

  const handleBillingDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBillingDateFilter(e.target.value);
    setItemsToShow(100);
  };

  const handleVendorDetailsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVendorDetailsFilter(e.target.value);
    setItemsToShow(100);
  };

  const toggleRowExpansion = (index: number) => {
    setExpandedRows(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Export all data functionality
  const exportAllData = () => {
    // Format the data for export with proper billing month formatting
    const formattedData = routingTable.map(item => ({
      ...item,
      'Billing Month': item['Billing Month'] ? formatBillingMonth(item['Billing Month']) : 'N/A',
      'Alchemy Billing Value': item['Alchemy Billing Value'] ? Math.round(parseFloat(item['Alchemy Billing Value']) || 0).toLocaleString() : '0',
      'Integrator Charges (Margin)': item['Integrator Charges (Margin)'] ? Math.round(parseFloat(item['Integrator Charges (Margin)']) || 0).toLocaleString() : '0',
      'Funding cost': item['Funding cost'] ? Math.round(parseFloat(item['Funding cost']) || 0).toLocaleString() : '0',
      'Net Margin': item['Net Margin'] ? Math.round(parseFloat(item['Net Margin']) || 0).toLocaleString() : '0'
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Routing Data');
    XLSX.writeFile(workbook, 'Routing_Data_Export.xlsx');
  };

  // Export all data as PDF
  const exportAllDataAsPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Routing Data Export', 105, 20, { align: 'center' });
    
    const headers = defaultVisibleFields;
    const data = routingTable.map(item => 
      headers.map(header => {
        if (header === 'Billing Month') {
          return item[header] ? formatBillingMonth(item[header]) : 'N/A';
        }
        if (['Alchemy Billing Value', 'Integrator Charges (Margin)', 'Funding cost', 'Net Margin'].includes(header as string)) {
          return item[header] ? Math.round(parseFloat(item[header]) || 0).toLocaleString() : '0';
        }
        return item[header] || 'N/A';
      })
    );
    
    autoTable(doc, {
      startY: 30,
      head: [headers],
      body: data,
      theme: 'grid',
      headStyles: { fillColor: [32, 145, 211] },
      styles: { cellPadding: 2, fontSize: 8 },
      margin: { left: 10, right: 10 }
    });
    doc.save('Routing_Data_Export.pdf');
  };

  // Handle logout
  const handleLogout = () => {
    // Clear any stored authentication data
    localStorage.removeItem('user');
    sessionStorage.clear();
    navigate('/');
  };

  // Close dropdown after action
  const handleDropdownAction = (action: () => void) => {
    setShowActionDropdown(false);
    action();
  };

  if (loading) return <div className="loading">Loading data...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (routingTable.length === 0) return <div className="empty">No records found</div>;

  return (
    <div className="homepage">
      <div className="routing-header-bar" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '2rem 2rem 0 2rem' }}>
        <div className="logo">
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
        }}>Alchemy Routing Data</h2>
        <div className="auth-buttons-container">
          <Link to="/RoutingDashboard">
            <button className="auth-button">Routing Dashboard</button>
          </Link>
          <Link to="/HomePage">
            <button className="auth-button">Home</button>
          </Link>
          <div className="action-dropdown-container">
            <button 
              className="auth-button action-button"
              onClick={() => setShowActionDropdown(!showActionDropdown)}
            >
              Actions ▼
            </button>
                         {showActionDropdown && (
               <div className="action-dropdown">
                 <Link to="/AddRoutingData">
                   <button className="dropdown-item" onClick={() => setShowActionDropdown(false)}>
                     Add Routing Data
                   </button>
                 </Link>
                 <button className="dropdown-item" onClick={() => handleDropdownAction(handleExportPOClick)}>
                   Export PO
                 </button>
                 <button className="dropdown-item" onClick={() => handleDropdownAction(exportAllData)}>
                   Export Data (Excel)
                 </button>
                 <button className="dropdown-item" onClick={() => handleDropdownAction(exportAllDataAsPDF)}>
                   Export Data (PDF)
                 </button>
                 <button className="dropdown-item" onClick={() => handleDropdownAction(handleLogout)}>
                   Log-out
                 </button>
               </div>
             )}
          </div>
        </div>
      </div>
      
      <div className="routing-table-container">
        <div className="search-controls">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search any field..."
              value={searchTerm}
              onChange={handleSearchChange}
            />
            <span className="search-icon">🔍</span>
          </div>
          <div className="filter-group">
  <label>Date Range:</label>
  <DatePicker
    selected={startDate}
    onChange={date => setStartDate(date)}
    selectsStart
    startDate={startDate}
    endDate={endDate}
    placeholderText="Start date"
    className="date-input"
    dateFormat="yyyy-MM-dd"
  />
  <span>to</span>
  <DatePicker
    selected={endDate}
    onChange={date => setEndDate(date)}
    selectsEnd
    startDate={startDate}
    endDate={endDate}
    minDate={startDate || undefined}
    placeholderText="End date"
    className="date-input"
    dateFormat="yyyy-MM-dd"
  />
  {(startDate || endDate) && (
    <button 
      onClick={() => {
        setStartDate(null);
        setEndDate(null);
      }}
      className="clear-button"
    >
      Clear
    </button>
  )}
</div>
          <div className="filter-group">
            <label htmlFor="vendor-details-filter">Vendor Details:</label>
            <input
              id="vendor-details-filter"
              type="text"
              placeholder="Filter by vendor..."
              value={vendorDetailsFilter}
              onChange={handleVendorDetailsChange}
            />
          </div>
          <div className="filter-group" style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setEditingMode(!editingMode)}
              className="edit-data-button"
              title="Click to show edit (✏️) on each cell"
            >
              {editingMode ? 'Cancel Editing' : 'Edit Data'}
            </button>
            {selectedRows.length > 0 && (
              <button
                type="button"
                onClick={handleDeleteSelected}
                className="edit-data-button"
                style={{ backgroundColor: '#c62828', color: '#fff' }}
                title="Delete selected rows"
              >
                Delete selected ({selectedRows.length})
              </button>
            )}
          </div>
        </div>
        
        <table className="routing-table">
          <thead>
    <tr>
       <th style={{ width: "40px", textAlign: "left", verticalAlign: "middle" }}>
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                  aria-label="Select all vendors"
                />
      </th>
      {defaultVisibleFields.map(field => (
        <th key={field}>
          {field}
        </th>
      ))}
      <th style={{ textAlign: "left", verticalAlign: "middle" }}>
        <button 
          onClick={() => setEditingMode(!editingMode)}
          className="edit-data-button"
        >
          {editingMode ? 'Cancel Editing' : 'Edit Data'}
        </button>
        {selectedRows.length > 0 && (
          <button 
            onClick={handleDeleteSelected}
            className="edit-data-button"
            style={{ marginLeft: 8, backgroundColor: '#c62828', color: '#fff' }}
          >
            Delete selected ({selectedRows.length})
          </button>
        )}
      </th>
    </tr>
  </thead>
          <tbody>
            {visibleRoutingTable.map((item, index) => (
              <React.Fragment key={index}>
                <tr>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedRows.includes(index)}
                      onChange={() => handleCheckboxChange(index)}
                    />
                  </td>
{defaultVisibleFields.map(field => (
  <td key={field}>
    {editingMode && editingRow === index && editingField === field && field !== 'Sl.No' ? (
      <div className="edit-container">
        <input
          type="text"
          value={editedValue}
          onChange={(e) => setEditedValue(e.target.value)}
          className="edit-input"
        />
        <button onClick={handleSaveEdit} className="save-button">
          Save
        </button>
        <button onClick={handleCancelEdit} className="cancel-button">
          Cancel
        </button>
      </div>
    ) : (
      <div className="cell-content">
        {field === 'Sl.No'
          ? (item['Sl.No'] || (index + 1).toString())
          : field === 'Costing Date'
          ? (item[field] ? formatDateOnly(item[field]) : 'No Date')
          : field === 'Billing Month'
          ? formatBillingMonth(item[field] || '')
          : ['Alchemy Billing Value', 'Integrator Charges (Margin)', 'Funding cost', 'Net Margin'].includes(field as string)
          ? (item[field] ? Math.round(parseFloat(item[field]) || 0).toLocaleString() : '0')
          : item[field] || 'N/A'}
        {editingMode && field !== 'Sl.No' && (
          <button
            type="button"
            onClick={() => handleEditClick(index, field as string, item[field] ?? '')}
            className="edit-pen-button"
            title={`Edit ${field}`}
          >
            ✏️
          </button>
        )}
      </div>
    )}
  </td>
))}
                  <td>
                    <button 
                      className="expand-button"
                      onClick={() => toggleRowExpansion(index)}
                    >
                      {expandedRows[index] ? '−' : '+'}
                    </button>
                  </td>
                </tr>
                {expandedRows[index] && (
                  <tr className="expanded-row">
                    <td colSpan={defaultVisibleFields.length + 2}>
                      <div className="expanded-content">
                        <div className="expanded-grid">
                          {Object.entries(item)
                            .filter(([key]) => !defaultVisibleFields.includes(key))
                            .map(([field, value]) => (
                              <div key={field} className="expanded-field">
                                <span className="field-name">{field}:</span>
                                <span className="field-value">
                                  {editingMode && editingRow === index && editingField === field ? (
                                    <div className="edit-container">
                                      <input
                                        type="text"
                                        value={editedValue}
                                        onChange={(e) => setEditedValue(e.target.value)}
                                        className="edit-input"
                                      />
                                      <button onClick={handleSaveEdit} className="save-button">
                                        Save
                                      </button>
                                      <button onClick={handleCancelEdit} className="cancel-button">
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="cell-content">
                                      {field === 'Billing Month'
                                        ? formatBillingMonth(value || '')
                                        : value || 'N/A'}
                                      {editingMode && (
                                        <button
                                          onClick={() => handleEditClick(index, field, value || '')}
                                          className="edit-pen-button"
                                        >
                                          ✏️
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        {itemsToShow < filteredData.length && (
          <button className="load-more-button" onClick={loadMore}>
            Load More
          </button>
        )}
      </div>
{/* PO Summary Modal */}
      {showPOSummary && poRow && (
        <div className="po-summary-modal">
          <div className="po-summary-content">
            <h3>PO Summary</h3>
            <table>
              <tbody>
                {getPoTableRows(poRow).map(row => (
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
  );
};

export default RoutingTable;