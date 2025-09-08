import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './RoutingTable.css';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo_1.png';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import apiClient from '../config/api';
import { formatDateOnly } from '../utils/dateUtils';

interface RoutingTableItem {
  "Sl No": string;
  "VENDOR NAME": string;
  "BOOKING MONTH": string;
  "Name of the Resource": string;
  "SERVICE MONTH": string;
  "VENDOR Invoice No": string;
  "VENDOR Invoice Date": string;
  "ATIPL Invoice Base Amount": string;
  "GST": string;
  "Total Invoice amount": string;
  "TDS": string;
  "Net Receivable": string;
  "Payment receive from client": string;
  "Balance receivable from client": string;
  "Tally Book Entry Date": string;
  "Sub Vendor Invoice date": string;
  "Sub Vendor Invoice No": string;
  "Base amt as per Tally (Vendor)": string;
  "Margin": string;
  "Vendor Invoice Status": string;
  "Payment Date": string;
  "Instrument No": string;
  "Payment Mode": string;
  "Payment Status": string;
  "RECEIPTS STATUS": string;
  [key: string]: any;
}

const CTSDataTable: React.FC = () => {
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
  const navigate = useNavigate();
// Helper function to get current financial year start and current month end dates (Financial Year: April to March)
const getCurrentFinancialYearDates = () => {
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-11
  const currentYear = now.getFullYear();
  
  // Financial year starts from April (month 3)
  // Determine financial year start
  let financialYearStart = currentYear;
  if (currentMonth < 3) { // Jan, Feb, Mar - belongs to previous financial year
    financialYearStart = currentYear - 1;
  }
  
  // Financial year starts from April 1st
  const financialYearStartDate = new Date(financialYearStart, 3, 1); // April 1st
  
  // End date is current month (last day of current month)
  const currentMonthEndDate = new Date(currentYear, currentMonth + 1, 0); // Last day of current month
  
  return { financialYearStartDate, currentMonthEndDate };
};

const { financialYearStartDate, currentMonthEndDate } = getCurrentFinancialYearDates();
const [bookingMonthStart, setBookingMonthStart] = useState<Date | null>(financialYearStartDate);
const [bookingMonthEnd, setBookingMonthEnd] = useState<Date | null>(currentMonthEndDate);
const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
const dropdownRef = useRef<HTMLDivElement>(null);
  // Define default visible fields (first 7 fields)
  const defaultVisibleFields: (keyof RoutingTableItem)[] = [
    'vendor_name',
    'service_month',
    'resource_name', 
    'total_invoice_amount',
    'base_amt_as_per_tally_vendor',
    'payment_receive_from_client'
  ];

  // Header name mapping for display
  const getHeaderDisplayName = (field: keyof RoutingTableItem): string => {
    const headerMap: { [key in keyof RoutingTableItem]?: string } = {
      'vendor_name': 'Vendor Name',
      'service_month': 'Service Month',
      'resource_name': 'Resource Name',
      'total_invoice_amount': 'Total Invoice Amount',
      'base_amt_as_per_tally_vendor': 'Base Amount',
      'payment_receive_from_client': 'Payment Received'
    };
    return headerMap[field] || String(field);
  };

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
      const response = await apiClient.get('/CTS');
      
             // Debug: Log a few sample SERVICE MONTH values to understand the format
       if (response.data.length > 0) {
         console.log('Sample SERVICE MONTH values:', response.data.slice(0, 5).map((item: any) => item['SERVICE MONTH']));
         console.log('All field names in first record:', Object.keys(response.data[0]));
         console.log('First record sample:', response.data[0]);
       }
      
      setRoutingTable(response.data); // Already sorted by created_at DESC
      setVisibleRoutingTable(response.data.slice(0, itemsToShow));
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };
  fetchData();
}, [itemsToShow]);

// Helper function to parse service month date
function parseServiceMonthDate(dateStr: string): Date | null {
  if (!dateStr || dateStr === 'N/A' || dateStr === '') {
    return null;
  }
  
  // Handle ISO date strings (like 2024-12-31T18:30:00.000Z)
  if (dateStr.includes('T') && dateStr.includes('Z')) {
    // Extract date parts directly from the string to avoid timezone issues
    const datePart = dateStr.split('T')[0]; // "2024-12-31"
    const [year, month, day] = datePart.split('-').map(Number);
    
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    
    // Create date with the first day of that month (month is 1-12, so subtract 1)
    const date = new Date(year, month - 1, 1);
    return isNaN(date.getTime()) ? null : date;
  }
  
  // Handle MM/YYYY format
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 2) {
      const [month, year] = parts;
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return isNaN(date.getTime()) ? null : date;
    } else if (parts.length === 3) {
      const [day, month, year] = parts;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return isNaN(date.getTime()) ? null : date;
    }
  }
  
  // Handle MM-YYYY format
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 2) {
      const [month, year] = parts;
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return isNaN(date.getTime()) ? null : date;
    } else if (parts.length === 3) {
      // YYYY-MM-DD format
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return null;
      // Extract year and month, create first day of month
      const year = date.getFullYear();
      const month = date.getMonth();
      return new Date(year, month, 1);
    }
  }
  
  // Try direct parsing
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  // Extract year and month, create first day of month
  const year = date.getFullYear();
  const month = date.getMonth();
  return new Date(year, month, 1);
}

  // Filter data based on search terms
const filteredData = useMemo(() => {
  return routingTable.filter((item: RoutingTableItem) => {
    const searchTermLower = searchTerm.toLowerCase();
    const billingDateLower = billingDateFilter.toLowerCase();
    const vendorDetailsLower = vendorDetailsFilter.toLowerCase();

    const searchWords = searchTermLower.split(/\s+/).filter(word => word.length > 0);
    const hasSearchMatch = searchWords.length === 0 || 
      searchWords.some(word => 
        Object.values(item).some(value => 
          String(value).toLowerCase().includes(word)
        )
      );

    // Service month range filter
    let hasServiceMonthMatch = true;
    if (bookingMonthStart || bookingMonthEnd) {
      // Try different possible field names for service month
      const possibleFieldNames = ['SERVICE MONTH', 'service_month', 'Service Month', 'serviceMonth'];
      let itemDateStr = null;
      let usedFieldName = null;
      
      for (const fieldName of possibleFieldNames) {
        if (item[fieldName] !== undefined) {
          itemDateStr = item[fieldName];
          usedFieldName = fieldName;
          break;
        }
      }
      
      console.log('Checking service month:', itemDateStr, 'from field:', usedFieldName, 'against range:', bookingMonthStart, 'to', bookingMonthEnd);
      
      // Parse the service month date using helper function
      const itemDate = parseServiceMonthDate(itemDateStr);
      
      if (!itemDate) {
        console.log('Failed to parse service month date:', itemDateStr);
        hasServiceMonthMatch = false;
      } else {
        console.log('Parsed date:', itemDate, 'for value:', itemDateStr);
        
        // Compare with start date
        if (bookingMonthStart) {
          const startOfMonth = new Date(bookingMonthStart.getFullYear(), bookingMonthStart.getMonth(), 1);
          // Check if the item's month and year are before the start month
          const itemMonth = itemDate.getMonth();
          const itemYear = itemDate.getFullYear();
          const startMonth = bookingMonthStart.getMonth();
          const startYear = bookingMonthStart.getFullYear();
          
          if (itemYear < startYear || (itemYear === startYear && itemMonth < startMonth)) {
            console.log('Date before start range:', itemDate, 'month:', itemMonth, 'year:', itemYear, '<', startMonth, startYear);
            hasServiceMonthMatch = false;
          }
        }
        
        // Compare with end date
        if (bookingMonthEnd) {
          const endOfMonth = new Date(bookingMonthEnd.getFullYear(), bookingMonthEnd.getMonth() + 1, 0, 23, 59, 59, 999);
          // Check if the item's month and year are after the end month
          const itemMonth = itemDate.getMonth();
          const itemYear = itemDate.getFullYear();
          const endMonth = bookingMonthEnd.getMonth();
          const endYear = bookingMonthEnd.getFullYear();
          
          if (itemYear > endYear || (itemYear === endYear && itemMonth > endMonth)) {
            console.log('Date after end range:', itemDate, 'month:', itemMonth, 'year:', itemYear, '>', endMonth, endYear);
            hasServiceMonthMatch = false;
          }
        }
        
                 if (hasServiceMonthMatch) {
           console.log('✅ Date within range:', itemDate, 'Month:', itemDate.getMonth(), 'Year:', itemDate.getFullYear());
         } else {
           console.log('❌ Date filtered out:', itemDate, 'Month:', itemDate.getMonth(), 'Year:', itemDate.getFullYear());
         }
      }
    }

   const hasVendorDetailsMatch = !vendorDetailsLower || 
      (item['VENDOR NAME'] && String(item['VENDOR NAME']).toLowerCase().includes(vendorDetailsLower));

    // Remove the old date range filter logic since we're using the new service month filter
    // This was causing conflicts with the service month range filter

    return hasSearchMatch && hasServiceMonthMatch && hasVendorDetailsMatch;
  });
}, [
  routingTable,
  searchTerm,
  billingDateFilter,
  vendorDetailsFilter,
  startDate,
  endDate,
  bookingMonthStart,
  bookingMonthEnd
]);

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

function mapToBackendFields(item: any) {
  return {
    vendor_name: item['VENDOR NAME'],
    booking_month: item['BOOKING MONTH'],
    resource_name: item['Name of the Resource'],
    service_month: item['SERVICE MONTH'],
    vendor_invoice_no: item['VENDOR Invoice No'],
    vendor_invoice_date: item['VENDOR Invoice Date'],
    base_amount: item['ATIPL Invoice Base Amount'],
    gst: item['GST'],
    total_invoice_amount: item['total_invoice_amount'],
    tds: item['TDS'],
    net_receivable: item['Net Receivable'],
    payment_receive_from_client: item['payment_receive_from_client'],
    balance_receivable: item['Balance receivable from client'],
    tally_book_entry_date: item['Tally Book Entry Date'],
    sub_vendor_invoice_date: item['Sub Vendor Invoice date'],
    sub_vendor_invoice_no: item['Sub Vendor Invoice No'],
    base_amt_as_per_tally_vendort: item['base_amt_as_per_tally_vendor'],
    margin: item['Margin'],
    vendor_invoice_status: item['Vendor Invoice Status'],
    payment_date: item['Payment Date'],
    instrument_no: item['Instrument No'],
    payment_mode: item['Payment Mode'],
    payment_status: item['Payment Status'],
    receipts_status: item['RECEIPTS STATUS'],
    created_at: item['created_at'] || new Date().toISOString(),
  };
}

  const handleSaveEdit = async () => {
  if (editingRow === null || editingField === null) return;

  try {
    const updatedItem = visibleRoutingTable[editingRow];
    const id = updatedItem.id; 

    const updatePayload = { [editingField]: editedValue };

    const response = await apiClient.patch(`/CTS/${id}`, updatePayload);

    if (response.data) {
      // Update local state
      const updatedData = [...routingTable];
      const originalIndex = routingTable.findIndex(item => item['Sl No'] === updatedItem['Sl No']);
      if (originalIndex !== -1) {
        updatedData[originalIndex] = response.data;
        setRoutingTable(updatedData);
        
        const visibleIndex = visibleRoutingTable.findIndex(item => item['Sl No'] === updatedItem['Sl No']);
        if (visibleIndex !== -1) {
          const updatedVisibleData = [...visibleRoutingTable];
          updatedVisibleData[visibleIndex] = response.data;
          setVisibleRoutingTable(updatedVisibleData);
        }
      }

      setIsEditing(false);
      setEditingRow(null);
      setEditingField(null);
      setEditedValue('');
    }
  } catch (err: any) {
    console.error('Error updating data:', err);
    setError(err.response?.data?.error || err.message || 'Failed to update data');
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

  function monthYearToDate(str: string) {
  // str: "Apr-24"
  const [monthStr, yearStr] = str.split('-');
  const month = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].indexOf(monthStr);
  const year = parseInt(yearStr, 10) + 2000; // "24" -> 2024
  return `${year}-${String(month + 1).padStart(2, '0')}-01`; // "2024-04-01"
}

// formData.booking_month = monthYearToDate(formData.booking_month);
// formData.service_month = monthYearToDate(formData.service_month);

function dateToMonthYear(dateStr: string) {
  if (!dateStr) return '';
  // Handle both "MM/YYYY" and "YYYY-MM-DD" formats
  if (dateStr.includes('/')) {
    const [month, year] = dateStr.split('/');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    if (isNaN(date.getTime())) return '';
    const monthName = date.toLocaleString('default', { month: 'short' });
    const shortYear = String(date.getFullYear()).slice(-2);
    return `${monthName}-${shortYear}`;
  } else {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const month = date.toLocaleString('default', { month: 'short' });
    const year = String(date.getFullYear()).slice(-2);
    return `${month}-${year}`;
  }
}

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

// Excel export functionality
const exportToExcel = () => {
  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  
  // Debug: Log the first item to see the actual field names
  console.log('First item in filteredData:', filteredData[0]);
  console.log('Filtered data length:', filteredData.length);
  
  // Prepare data for export (use filtered data)
  const exportData = filteredData.map(item => {
    // Map the actual database field names to display names
    return {
      'Sl No': item['sl_no'] || '',
      'Vendor Name': item['vendor_name'] || '',
      'Booking Month': item['booking_month'] || '',
      'Resource Name': item['resource_name'] || '',
      'Service Month': item['service_month'] || '',
      'Vendor Invoice No': item['vendor_invoice_no'] || '',
      'Vendor Invoice Date': item['vendor_invoice_date'] || '',
      'ATIPL Invoice Base Amount': item['atipl_invoice_base_amount'] || '',
      'GST': item['gst'] || '',
      'Total Invoice Amount': item['total_invoice_amount'] || '',
      'TDS': item['tds'] || '',
      'Net Receivable': item['net_receivable'] || '',
      'Payment Received from Client': item['payment_receive_from_client'] || '',
      'Balance Receivable from Client': item['balance_receivable_from_client'] || '',
      'Tally Book Entry Date': item['tally_book_entry_date'] || '',
      'Sub Vendor Invoice Date': item['sub_vendor_invoice_date'] || '',
      'Sub Vendor Invoice No': item['sub_vendor_invoice_no'] || '',
      'Base Amount as per Tally': item['base_amt_as_per_tally_vendor'] || '',
      'Margin': item['margin'] || '',
      'Vendor Invoice Status': item['vendor_invoice_status'] || '',
      'Payment Date': item['payment_date'] || '',
      'Instrument No': item['instrument_no'] || '',
      'Payment Mode': item['payment_mode'] || '',
      'Payment Status': item['payment_status'] || '',
      'Receipts Status': item['receipts_status'] || ''
    };
  });

  console.log('Export data sample:', exportData.slice(0, 2));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'CTS Data');
  
  // Generate filename with current date
  const currentDate = new Date().toISOString().split('T')[0];
  const filename = `CTS_Data_${currentDate}.xlsx`;
  
  // Save file
  XLSX.writeFile(workbook, filename);
};

  if (loading) return <div className="loading">Loading data...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (routingTable.length === 0) return <div className="empty">No records found</div>;

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
        }}>CTS Data Table</h2>
        <div className="auth-buttons-container">
          <Link to="/CTSDashboard">
            <button className="auth-button">CTS Dashboard</button>
          </Link>
          <Link to="/HomePage">
            <button className="auth-button">Home</button>
          </Link>
          <div className="action-dropdown-container" ref={dropdownRef}>
            <button 
              className="auth-button action-button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              Actions ▼
            </button>
            {isDropdownOpen && (
              <div className="dropdown-menu">
                <Link to="/AddCTSData" onClick={() => setIsDropdownOpen(false)}>
                  <div className="dropdown-item">Add CTS Data</div>
                </Link>
                <Link to="/AddHRMSData" onClick={() => setIsDropdownOpen(false)}>
                  <div className="dropdown-item">Add Resource Data</div>
                </Link>
                <div className="dropdown-item" onClick={() => { exportToExcel(); setIsDropdownOpen(false); }}>
                  Export Excel
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="routing-table-container" style={{ marginTop: '3rem' }}>
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
            <label>Service Month Range:</label>
            <DatePicker
              selected={bookingMonthStart}
              onChange={(date: Date | null) => setBookingMonthStart(date)}
              dateFormat="MMM-yyyy"
              showMonthYearPicker
              placeholderText="Start month"
              className="date-input"
              isClearable
            />
            <span>to</span>
            <DatePicker
              selected={bookingMonthEnd}
              onChange={(date: Date | null) => setBookingMonthEnd(date)}
              dateFormat="MMM-yyyy"
              showMonthYearPicker
              placeholderText="End month"
              className="date-input"
              isClearable
            />
            {(bookingMonthStart || bookingMonthEnd) && (
              <button
                onClick={() => {
                  setBookingMonthStart(null);
                  setBookingMonthEnd(null);
                }}
                className="clear-button"
              >
                Clear
              </button>
            )}
          </div>

        </div>
        
        <div className="results-count">
          Showing {visibleRoutingTable.length} of {filteredData.length} matching records
        </div>
        
        <table className="routing-table">
          <thead>
            <tr>
              {defaultVisibleFields.map(field => (
                <th key={field} className="data-header">{getHeaderDisplayName(field)}</th>
              ))}
              <th className="edit-header">
                <button 
                  onClick={() => setEditingMode(!editingMode)}
                  className="edit-data-button"
                >
                  {editingMode ? 'Cancel Editing' : 'Edit Data'}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRoutingTable.map((item, index) => (
              <React.Fragment key={index}>
                <tr>
                  {defaultVisibleFields.map(field => (
  <td key={field}>
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
        {field === 'service_month'
          ? (item[field] ? formatDateOnly(item[field]) : 'No Date')
          : item[field] || 'N/A'}
        {editingMode && (
          <button
            onClick={() => handleEditClick(index, field as string, item[field] || '')}
            className="edit-pen-button"
          >
            ✏️
          </button>
        )}
      </div>
    )}
  </td>
))}

                  <td className="edit-column">
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
                    <td colSpan={defaultVisibleFields.length + 1}>
                      <div className="expanded-content">
                        <table className="expanded-fields-table">
                          <tbody>
                            {groupedFields.map((rowFields, rowIndex) => (
                              <tr key={rowIndex}>
                                {rowFields.map(field => (
                                  <React.Fragment key={field}>
                                    <td className="field-name">{field}:</td>
                                    <td className="field-value">
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
                                          {item[field] || 'N/A'}
                                          {editingMode && (
                                            <button
                                              onClick={() => handleEditClick(index, field as string, item[field] || '')}
                                              className="edit-pen-button"
                                            >
                                              ✏️
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </td>
                                  </React.Fragment>
                                ))}
                                {rowFields.length < columnsCount && Array.from(
                                  { length: (columnsCount - rowFields.length) * 2 }, 
                                  (_, i) => <td key={`empty-${i}`}>&nbsp;</td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
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
    </div>
  );
};

export default CTSDataTable;