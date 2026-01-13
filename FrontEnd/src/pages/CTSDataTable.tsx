import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import './RoutingTable.css';
import logo from '../assets/logo_1.png';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import apiClient from '../config/api';

interface CTSSummaryItem {
  "Month & Year": string;
  year: number;
  month: number;
  "OB - HC": number;
  "Attrition - HC": number;
  "Net - HC": number;
  "OB - PO Value": number;
  "Attrition PO Value": number;
  "Net - OB PO Value": number;
  "OB - Vendor PO Value": number;
  "Attrition Vendor PO Value": number;
  "Net Vendor Po Value": number;
  "Month OB Margin (Month)": number;
  "Month Net Margin (Month)": number;
  "Current HC": number;
  "Current PO Value": number;
  "Current Vendor Cost": number;
  "Current Margin": number;
  "%- Margin": number;
}

const CTSDataTable: React.FC = () => {
  const [summaryData, setSummaryData] = useState<CTSSummaryItem[]>([]);
  const [allSummaryData, setAllSummaryData] = useState<CTSSummaryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'month' | 'quarter' | 'year'>('month');
  const [filterValue, setFilterValue] = useState<string>('');
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState<boolean>(false);
  const actionsDropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Format number with commas (Indian numbering system)
  const formatNumber = (value: number | null | undefined): string => {
    if (value === null || value === undefined || typeof value !== 'number' || isNaN(value)) return '0';
    return value.toLocaleString('en-IN');
  };

  // Format month-year string (e.g., "2024-01" -> "Jan-2024")
  // Special handling for "Opening" row (2024-12)
  const formatMonthYear = (monthYear: string | null | undefined): string => {
    if (!monthYear || typeof monthYear !== 'string') return '';
    const parts = monthYear.split('-');
    if (parts.length !== 2) return monthYear;
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return monthYear;
    
    // Special handling for Opening balance (December 2024)
    if (year === 2024 && month === 12) {
      return 'Opening';
    }
    
    const date = new Date(year, month - 1, 1);
    if (isNaN(date.getTime())) return monthYear;
    const monthName = date.toLocaleString('default', { month: 'short' });
    const shortYear = String(year).slice(-2);
    return `${monthName}-${shortYear}`;
  };

  // Get quarter from month (Financial Year: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar)
  const getQuarter = (month: number | null | undefined): number => {
    if (month === null || month === undefined || typeof month !== 'number' || isNaN(month)) return 4;
    if (month >= 4 && month <= 6) return 1; // Q1: Apr-Jun
    if (month >= 7 && month <= 9) return 2; // Q2: Jul-Sep
    if (month >= 10 && month <= 12) return 3; // Q3: Oct-Dec
    return 4; // Q4: Jan-Mar
  };

  // Get unique filter options based on filter type
  const getFilterOptions = useMemo(() => {
    if (filterType === 'month') {
      const months = new Set<string>();
      allSummaryData.forEach(item => {
        months.add(item["Month & Year"]);
      });
      return Array.from(months).sort().reverse();
    } else if (filterType === 'quarter') {
      const quarters = new Set<string>();
      allSummaryData.forEach(item => {
        if (item.month === null || item.month === undefined || isNaN(item.month) || 
            item.year === null || item.year === undefined || isNaN(item.year)) return;
        const quarter = getQuarter(item.month);
        const year = item.year;
        // Q4 spans across years (Jan-Mar belongs to next FY)
        const displayYear = quarter === 4 ? year - 1 : year;
        if (!isNaN(displayYear)) {
          quarters.add(`Q${quarter} ${displayYear}`);
        }
      });
      return Array.from(quarters).sort().reverse();
    } else if (filterType === 'year') {
      const years = new Set<number>();
      allSummaryData.forEach(item => {
        if (item.year !== null && item.year !== undefined && typeof item.year === 'number' && !isNaN(item.year)) {
          years.add(item.year);
        }
      });
      return Array.from(years).sort((a, b) => b - a).map(y => y.toString());
    }
    return [];
  }, [allSummaryData, filterType]);

  // Filter data based on selected filter
  const filteredSummaryData = useMemo(() => {
    if (!filterValue) return allSummaryData;

    return allSummaryData.filter(item => {
      if (filterType === 'month') {
        return item["Month & Year"] === filterValue;
      } else if (filterType === 'quarter') {
        const quarterMatch = filterValue.match(/Q(\d)\s+(\d{4})/);
        if (quarterMatch) {
          const targetQuarter = parseInt(quarterMatch[1]);
          const targetYear = parseInt(quarterMatch[2]);
          if (isNaN(targetQuarter) || isNaN(targetYear)) return false;
          if (item.month === null || item.month === undefined || isNaN(item.month) ||
              item.year === null || item.year === undefined || isNaN(item.year)) return false;
          const itemQuarter = getQuarter(item.month);
          // Q4 spans across years
          if (itemQuarter === 4) {
            return itemQuarter === targetQuarter && item.year === targetYear + 1;
          }
          return itemQuarter === targetQuarter && item.year === targetYear;
        }
        return false;
      } else if (filterType === 'year') {
        const targetYear = parseInt(filterValue);
        if (isNaN(targetYear)) return false;
        if (item.month === null || item.month === undefined || isNaN(item.month) ||
            item.year === null || item.year === undefined || isNaN(item.year)) return false;
        // Financial year: April to March
        // If month >= 4, year matches targetYear
        // If month < 4, year should be targetYear + 1
        if (item.month >= 4) {
          return item.year === targetYear;
        } else {
          return item.year === targetYear + 1;
        }
      }
      return true;
    });
  }, [allSummaryData, filterType, filterValue]);

  // Fetch summary data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('Fetching CTS Summary data from /CTS-Summary...');
        const response = await apiClient.get('/CTS-Summary');
        
        console.log('CTS Summary API Response:', {
          status: response.status,
          dataLength: response.data?.length,
          sampleData: response.data?.[0],
          allKeys: response.data?.[0] ? Object.keys(response.data[0]) : [],
          attritionFields: response.data?.[0] ? {
            'Attrition - HC': response.data[0]['Attrition - HC'],
            'Attrition PO Value': response.data[0]['Attrition PO Value'],
            'Attrition Vendor PO Value': response.data[0]['Attrition Vendor PO Value'],
            'Month Net Margin (Month)': response.data[0]['Month Net Margin (Month)']
          } : null
        });
        
        // Validate response data
        if (!response || !response.data) {
          console.error('Invalid response structure:', response);
          throw new Error('Invalid response from server');
        }
        
        // Helper function to parse numeric values (handles both strings and numbers)
        const parseNumeric = (value: any): number => {
          if (value === null || value === undefined || value === '') return 0;
          if (typeof value === 'number' && !isNaN(value)) return value;
          if (typeof value === 'string') {
            const parsed = parseFloat(value);
            return !isNaN(parsed) ? parsed : 0;
          }
          return 0;
        };

        // Ensure data is an array and validate each item
        const validatedData = Array.isArray(response.data) 
          ? response.data.map((item: any, index: number) => {
              if (index === 0) {
                console.log('First item before validation:', item);
                console.log('First item keys:', Object.keys(item));
              }
              return {
                "Month & Year": item["Month & Year"] || item["month_year"] || '',
                year: parseNumeric(item.year),
                month: parseNumeric(item.month),
                "OB - HC": parseNumeric(item["OB - HC"]),
                "Attrition - HC": parseNumeric(item["Attrition - HC"]),
                "Net - HC": parseNumeric(item["Net - HC"]),
                "OB - PO Value": parseNumeric(item["OB - PO Value"]),
                "Attrition PO Value": parseNumeric(item["Attrition PO Value"]),
                "Net - OB PO Value": parseNumeric(item["Net - OB PO Value"]),
                "OB - Vendor PO Value": parseNumeric(item["OB - Vendor PO Value"]),
                "Attrition Vendor PO Value": parseNumeric(item["Attrition Vendor PO Value"]),
                "Net Vendor Po Value": parseNumeric(item["Net Vendor Po Value"]),
                "Month OB Margin (Month)": parseNumeric(item["Month OB Margin (Month)"]),
                "Month Net Margin (Month)": parseNumeric(item["Month Net Margin (Month)"]),
                "Current HC": parseNumeric(item["Current HC"]),
                "Current PO Value": parseNumeric(item["Current PO Value"]),
                "Current Vendor Cost": parseNumeric(item["Current Vendor Cost"]),
                "Current Margin": parseNumeric(item["Current Margin"]),
                "%- Margin": parseNumeric(item["%- Margin"])
              };
            })
          : [];
        
        console.log('Validated data:', {
          count: validatedData.length,
          firstItem: validatedData[0],
          allItems: validatedData
        });
        
        // Sort data chronologically (oldest first) for better readability
        // This ensures historical data appears before current data
        const sortedData = [...validatedData].sort((a, b) => {
          // First sort by year
          if (a.year !== b.year) {
            return a.year - b.year;
          }
          // Then by month
          return a.month - b.month;
        });
        
        setAllSummaryData(sortedData);
        setSummaryData(sortedData);
      } catch (err: any) {
        console.error('Error fetching CTS Summary:', err);
        console.error('Error details:', {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status,
          url: err.config?.url
        });
        setError(err.response?.data?.error || err.message || 'An unknown error occurred');
        setAllSummaryData([]);
        setSummaryData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Update filtered data when filter changes
  useEffect(() => {
    setSummaryData(filteredSummaryData);
  }, [filteredSummaryData]);

// Handle dropdown click outside
useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
      if (actionsDropdownRef.current && !actionsDropdownRef.current.contains(event.target as Node)) {
        setIsActionsDropdownOpen(false);
    }
  };
  document.addEventListener('mousedown', handleClickOutside);
  return () => {
    document.removeEventListener('mousedown', handleClickOutside);
  };
}, []);

  // Download Active Data Excel Template
  const downloadActiveFormat = () => {
    const headers = [
      'Employee Name',
      'Vendor',
      'Skill',
      'OB Month',
      'DOJ',
      'Employment Status',
      'PO Value',
      'Vendor Value',
      'Alchemy Routing',
      'Gross Margin',
      'GM Percentage'
    ];
    
    // Create worksheet with headers only
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    
    // Set column widths
    const columnWidths = [
      { wch: 20 }, // Employee Name
      { wch: 20 }, // Vendor
      { wch: 15 }, // Skill
      { wch: 12 }, // OB Month
      { wch: 12 }, // DOJ
      { wch: 18 }, // Employment Status
      { wch: 12 }, // PO Value
      { wch: 12 }, // Vendor Value
      { wch: 18 }, // Alchemy Routing
      { wch: 15 }, // Gross Margin
      { wch: 15 }  // GM Percentage
    ];
    worksheet['!cols'] = columnWidths;
    
  const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Active Data Template');
    XLSX.writeFile(workbook, 'Active_Data_Template.xlsx');
    setIsActionsDropdownOpen(false);
  };

  // Download Attrition Data Excel Template
  const downloadAttritionFormat = () => {
    const headers = [
      'Employee Name',
      'Vendor',
      'Skill',
      'B Month',
      'DOJ',
      'Employment Status',
      'Attrition Month',
      'Attrition Date',
      'PO Value',
      'Vendor Value',
      'Alchemy Routing',
      'Gross Margin',
      'GM Percentage'
    ];
    
    // Create worksheet with headers only
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    
    // Set column widths
    const columnWidths = [
      { wch: 20 }, // Employee Name
      { wch: 20 }, // Vendor
      { wch: 15 }, // Skill
      { wch: 12 }, // B Month
      { wch: 12 }, // DOJ
      { wch: 18 }, // Employment Status
      { wch: 15 }, // Attrition Month
      { wch: 15 }, // Attrition Date
      { wch: 12 }, // PO Value
      { wch: 12 }, // Vendor Value
      { wch: 18 }, // Alchemy Routing
      { wch: 15 }, // Gross Margin
      { wch: 15 }  // GM Percentage
    ];
    worksheet['!cols'] = columnWidths;
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attrition Data Template');
    XLSX.writeFile(workbook, 'Attrition_Data_Template.xlsx');
    setIsActionsDropdownOpen(false);
  };

  // Export to Excel
  const exportToExcel = () => {
    try {
      if (!summaryData || summaryData.length === 0) {
        alert('No data available to export.');
        return;
      }
      const worksheet = XLSX.utils.json_to_sheet(summaryData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'CTS Summary');
      XLSX.writeFile(workbook, `CTS_Summary_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Failed to export Excel. Please try again.');
    }
  };

  // Export to PDF
  const exportToPDF = () => {
    try {
      const doc = new jsPDF('landscape');
      doc.setFontSize(16);
      doc.text('CTS Summary Report', 14, 15);

      const tableData = summaryData.map(item => {
        try {
          return [
            formatMonthYear(item["Month & Year"] || ''),
            formatNumber(item["OB - HC"]),
            formatNumber(item["Attrition - HC"]),
            formatNumber(item["Net - HC"]),
            formatNumber(item["OB - PO Value"]),
            formatNumber(item["Attrition PO Value"]),
            formatNumber(item["Net - OB PO Value"]),
            formatNumber(item["OB - Vendor PO Value"]),
            formatNumber(item["Attrition Vendor PO Value"]),
            formatNumber(item["Net Vendor Po Value"]),
            formatNumber(item["Month OB Margin (Month)"]),
            formatNumber(item["Month Net Margin (Month)"]),
            formatNumber(item["Current HC"]),
            formatNumber(item["Current PO Value"]),
            formatNumber(item["Current Vendor Cost"]),
            formatNumber(item["Current Margin"]),
            item["%- Margin"] !== null && item["%- Margin"] !== undefined && typeof item["%- Margin"] === 'number' && !isNaN(item["%- Margin"]) ? `${item["%- Margin"].toFixed(2)}%` : '0%'
          ];
        } catch (error) {
          console.error('Error formatting row for PDF:', error, item);
          return ['Error', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
        }
      });

      autoTable(doc, {
        startY: 20,
        head: [[
          'Month & Year',
          'OB - HC',
          'Attrition - HC',
          'Net - HC',
          'OB - PO Value',
          'Attrition PO Value',
          'Net - OB PO Value',
          'OB - Vendor PO Value',
          'Attrition Vendor PO Value',
          'Net Vendor Po Value',
          'Month OB Margin (Month)',
          'Month Net Margin (Month)',
          'Current HC',
          'Current PO Value',
          'Current Vendor Cost',
          'Current Margin',
          '%- Margin'
        ]],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [32, 145, 211] },
        styles: { fontSize: 7, cellPadding: 2 },
        margin: { left: 10, right: 10 }
      });

      doc.save(`CTS_Summary_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      alert('Failed to export PDF. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="homepage">
        <div className="routing-header-bar" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '1rem 2rem 0 2rem' }}>
          <div className="homepage-logo-top-left" style={{ width: '120px', height: 'auto' }}>
            <img src={logo} alt="Alchemy Logo" style={{ width: '100%', height: 'auto', maxWidth: '120px' }} />
          </div>
          <h2 style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', color: 'white', fontWeight: 700, fontSize: '2rem', fontFamily: 'Montserrat, sans-serif', margin: 0, zIndex: 1 }}>CTS Data Table</h2>
          <div className="auth-buttons-container">
            <button className="auth-button" onClick={() => navigate('/CTSDataView')}>Data</button>
            <button className="auth-button" onClick={() => navigate('/HomePage')}>Home</button>
            <div className="action-dropdown-container" ref={actionsDropdownRef} style={{ position: 'relative' }}>
              <button className="auth-button action-button">Actions ▼</button>
            </div>
          </div>
        </div>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p>Loading summary report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="homepage">
        <div className="routing-header-bar" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '1rem 2rem 0 2rem' }}>
          <div className="homepage-logo-top-left" style={{ width: '120px', height: 'auto' }}>
            <img src={logo} alt="Alchemy Logo" style={{ width: '100%', height: 'auto', maxWidth: '120px' }} />
          </div>
          <h2 style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', color: 'white', fontWeight: 700, fontSize: '2rem', fontFamily: 'Montserrat, sans-serif', margin: 0, zIndex: 1 }}>CTS Data Table</h2>
          <div className="auth-buttons-container">
            <button className="auth-button" onClick={() => navigate('/CTSDataView')}>Data</button>
            <button className="auth-button" onClick={() => navigate('/HomePage')}>Home</button>
            <div className="action-dropdown-container" ref={actionsDropdownRef} style={{ position: 'relative' }}>
              <button className="auth-button action-button">Actions ▼</button>
            </div>
          </div>
        </div>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: 'red' }}>Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="homepage">
      <style>{`
        .routing-table th:nth-child(1) { width: 5% !important; min-width: 5% !important; max-width: 5% !important; }
        .routing-table th:nth-child(2) { width: 3% !important; min-width: 3% !important; max-width: 3% !important; }
        .routing-table th:nth-child(3) { width: 3% !important; min-width: 3% !important; max-width: 3% !important; }
        .routing-table th:nth-child(4) { width: 3% !important; min-width: 3% !important; max-width: 3% !important; }
        .routing-table th:nth-child(5) { width: 6.8% !important; min-width: 6.8% !important; max-width: 6.8% !important; }
        .routing-table th:nth-child(6) { width: 6.8% !important; min-width: 6.8% !important; max-width: 6.8% !important; }
        .routing-table th:nth-child(7) { width: 8% !important; min-width: 8% !important; max-width: 8% !important; }
        .routing-table th:nth-child(8) { width: 6.8% !important; min-width: 6.8% !important; max-width: 6.8% !important; }
        .routing-table th:nth-child(9) { width: 6.8% !important; min-width: 6.8% !important; max-width: 6.8% !important; }
        .routing-table th:nth-child(10) { width: 8% !important; min-width: 8% !important; max-width: 8% !important; }
        .routing-table th:nth-child(11) { width: 8% !important; min-width: 8% !important; max-width: 8% !important; }
        .routing-table th:nth-child(12) { width: 6.8% !important; min-width: 6.8% !important; max-width: 6.8% !important; }
        .routing-table th:nth-child(13) { width: 3% !important; min-width: 3% !important; max-width: 3% !important; }
        .routing-table th:nth-child(14) { width: 7.5% !important; min-width: 7.5% !important; max-width: 7.5% !important; }
        .routing-table th:nth-child(15) { width: 7.5% !important; min-width: 7.5% !important; max-width: 7.5% !important; }
        .routing-table th:nth-child(16) { width: 6.5% !important; min-width: 6.5% !important; max-width: 6.5% !important; }
        .routing-table th:nth-child(17) { width: 6.5% !important; min-width: 6.5% !important; max-width: 6.5% !important; }
        
        .routing-table td:nth-child(1) { width: 5% !important; min-width: 5% !important; max-width: 5% !important; }
        .routing-table td:nth-child(2) { width: 3% !important; min-width: 3% !important; max-width: 3% !important; }
        .routing-table td:nth-child(3) { width: 3% !important; min-width: 3% !important; max-width: 3% !important; }
        .routing-table td:nth-child(4) { width: 3% !important; min-width: 3% !important; max-width: 3% !important; }
        .routing-table td:nth-child(5) { width: 6.8% !important; min-width: 6.8% !important; max-width: 6.8% !important; }
        .routing-table td:nth-child(6) { width: 6.8% !important; min-width: 6.8% !important; max-width: 6.8% !important; }
        .routing-table td:nth-child(7) { width: 8% !important; min-width: 8% !important; max-width: 8% !important; }
        .routing-table td:nth-child(8) { width: 6.8% !important; min-width: 6.8% !important; max-width: 6.8% !important; }
        .routing-table td:nth-child(9) { width: 6.8% !important; min-width: 6.8% !important; max-width: 6.8% !important; }
        .routing-table td:nth-child(10) { width: 8% !important; min-width: 8% !important; max-width: 8% !important; }
        .routing-table td:nth-child(11) { width: 8% !important; min-width: 8% !important; max-width: 8% !important; }
        .routing-table td:nth-child(12) { width: 6.8% !important; min-width: 6.8% !important; max-width: 6.8% !important; }
        .routing-table td:nth-child(13) { width: 3% !important; min-width: 3% !important; max-width: 3% !important; }
        .routing-table td:nth-child(14) { width: 7.5% !important; min-width: 7.5% !important; max-width: 7.5% !important; }
        .routing-table td:nth-child(15) { width: 7.5% !important; min-width: 7.5% !important; max-width: 7.5% !important; }
        .routing-table td:nth-child(16) { width: 6.5% !important; min-width: 6.5% !important; max-width: 6.5% !important; }
        .routing-table td:nth-child(17) { width: 6.5% !important; min-width: 6.5% !important; max-width: 6.5% !important; }
      `}</style>
      <div className="routing-header-bar" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '1rem 2rem', minHeight: '80px' }}>
        <div className="homepage-logo-top-left" style={{ position: 'absolute', left: '2rem', top: '1rem', width: '120px', height: 'auto', zIndex: 10 }}>
          <img src={logo} alt="Alchemy Logo" style={{ width: '100%', height: 'auto', maxWidth: '120px' }} />
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
        <div className="auth-buttons-container" style={{ position: 'absolute', right: '2rem', top: '1rem', zIndex: 10 }}>
          <button className="auth-button" onClick={() => navigate('/CTSDataView')}>Data</button>
          <button className="auth-button" onClick={() => navigate('/HomePage')}>Home</button>
          <div className="action-dropdown-container" ref={actionsDropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
            <button 
              className="auth-button action-button"
              onClick={() => setIsActionsDropdownOpen(!isActionsDropdownOpen)}
            >
              Actions ▼
            </button>
            {isActionsDropdownOpen && (
              <div className="dropdown-menu" style={{ position: 'absolute', top: '100%', right: 0, backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', zIndex: 1000, minWidth: '200px' }}>
                <div className="dropdown-item" onClick={() => { navigate('/AddActiveData'); setIsActionsDropdownOpen(false); }} style={{ padding: '10px 15px', cursor: 'pointer', borderBottom: '1px solid #eee' }}>
                  Add Active Data
                </div>
                <div className="dropdown-item" onClick={() => { navigate('/AddAttritionData'); setIsActionsDropdownOpen(false); }} style={{ padding: '10px 15px', cursor: 'pointer', borderBottom: '1px solid #eee' }}>
                  Add Attrition Data
                </div>
                <div className="dropdown-item" onClick={downloadActiveFormat} style={{ padding: '10px 15px', cursor: 'pointer', borderBottom: '1px solid #eee' }}>
                  Download Active Format
                </div>
                <div className="dropdown-item" onClick={downloadAttritionFormat} style={{ padding: '10px 15px', cursor: 'pointer' }}>
                  Download Attrition Format
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="routing-container" style={{ marginTop: '3rem', padding: '0 2rem 2rem 2rem' }}>
        {/* Filter Section */}
        <div style={{ marginBottom: '1.5rem', marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <label style={{ fontWeight: 'bold', fontSize: '14px' }}>Filter by:</label>
          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value as 'month' | 'quarter' | 'year');
              setFilterValue(''); // Reset filter value when type changes
            }}
            style={{
              padding: '8px 12px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            <option value="month">Month</option>
            <option value="quarter">Quarter</option>
            <option value="year">Year</option>
          </select>
          
          {filterType && getFilterOptions.length > 0 && (
            <>
              <select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  fontSize: '14px',
                  cursor: 'pointer',
                  minWidth: '150px'
                }}
              >
                <option value="">All {filterType === 'month' ? 'Months' : filterType === 'quarter' ? 'Quarters' : 'Years'}</option>
                {getFilterOptions.map((option) => {
                  try {
                    return (
                      <option key={option} value={option}>
                        {filterType === 'month' ? formatMonthYear(option) : option}
                      </option>
                    );
                  } catch (error) {
                    return (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    );
                  }
                })}
              </select>
              
              {filterValue && (
                <button
                  onClick={() => setFilterValue('')}
                  style={{
                    padding: '8px 15px',
                    backgroundColor: '#ff6b35',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
              >
                Clear
              </button>
            )}
            </>
          )}
        </div>
        <table className="routing-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto', fontSize: '10px' }}>
          <thead>
            {/* Row 1: Main sections - Monthly (75%) and Cumulative (25%) */}
            <tr>
              <th rowSpan={3} style={{ width: '5%', borderBottom: '2px solid #ff6b35', borderRight: '1px solid #e0e0e0', padding: '8px', backgroundColor: '#000000', color: '#ffffff', fontWeight: 'bold', fontSize: '10px', verticalAlign: 'middle' }}>
                <div style={{ color: '#ffffff' }}>Month &</div>
                <div style={{ color: '#ffffff' }}>Year</div>
              </th>
              <th colSpan={11} style={{ width: '66%', borderBottom: '2px solid #ff6b35', borderRight: '1px solid #e0e0e0', padding: '8px', backgroundColor: '#000000', color: '#ffffff', fontWeight: 'bold', fontSize: '10px', textAlign: 'center' }}>Monthly</th>
              <th colSpan={5} style={{ width: '29%', borderBottom: '2px solid #ff6b35', borderRight: 'none', padding: '8px', backgroundColor: '#000000', color: '#ffffff', fontWeight: 'bold', fontSize: '10px', textAlign: 'center' }}>Cumulative</th>
            </tr>
            {/* Row 2: 4 columns under Monthly + Cumulative headers */}
            <tr>
              {/* Column 1: HC (blank header, 3 sub-columns) */}
              <th colSpan={3} style={{ borderBottom: '2px solid #ff6b35', borderRight: '1px solid #e0e0e0', padding: '8px', backgroundColor: '#000000', color: '#ffffff', fontWeight: 'bold', fontSize: '10px', textAlign: 'center' }}></th>
              {/* Column 2: Alchemy Status (3 sub-columns) */}
              <th colSpan={3} style={{ borderBottom: '2px solid #ff6b35', borderRight: '1px solid #e0e0e0', padding: '8px', backgroundColor: '#000000', color: '#ffffff', fontWeight: 'bold', fontSize: '10px', textAlign: 'center' }}><span style={{ color: '#ffffff' }}>Alchemy Status</span></th>
              {/* Column 3: Vendor Status (3 sub-columns) */}
              <th colSpan={3} style={{ borderBottom: '2px solid #ff6b35', borderRight: '1px solid #e0e0e0', padding: '8px', backgroundColor: '#000000', color: '#ffffff', fontWeight: 'bold', fontSize: '10px', textAlign: 'center' }}><span style={{ color: '#ffffff' }}>Vendor Status</span></th>
              {/* Column 4: Margin (2 sub-columns - blank headers in row 2) */}
              <th colSpan={1} style={{ borderBottom: '2px solid #ff6b35', borderRight: '1px solid #e0e0e0', padding: '8px', backgroundColor: '#000000', color: '#ffffff', fontWeight: 'bold', fontSize: '10px', textAlign: 'center' }}></th>
              <th colSpan={1} style={{ borderBottom: '2px solid #ff6b35', borderRight: '1px solid #e0e0e0', padding: '8px', backgroundColor: '#000000', color: '#ffffff', fontWeight: 'bold', fontSize: '10px', textAlign: 'center' }}></th>
              {/* Cumulative columns (span 2 rows) */}
              <th rowSpan={2} style={{ width: '3%', minWidth: '3%', maxWidth: '3%', borderBottom: '2px solid #ff6b35', borderRight: '1px solid #e0e0e0', padding: '8px', backgroundColor: '#000000', color: '#ffffff', fontWeight: 'bold', fontSize: '7px', textAlign: 'center', verticalAlign: 'middle' }}>
                <div style={{ color: '#ffffff' }}>Current</div>
                <div style={{ color: '#ffffff' }}>HC</div>
              </th>
              <th rowSpan={2} style={{ width: '7.5%', minWidth: '7.5%', maxWidth: '7.5%', borderBottom: '2px solid #ff6b35', borderRight: '1px solid #e0e0e0', padding: '8px', backgroundColor: '#000000', color: '#ffffff', fontWeight: 'bold', fontSize: '7px', textAlign: 'center', verticalAlign: 'middle' }}>
                <div style={{ color: '#ffffff' }}>Current PO</div>
                <div style={{ color: '#ffffff' }}>Value</div>
              </th>
              <th rowSpan={2} style={{ width: '7.5%', minWidth: '7.5%', maxWidth: '7.5%', borderBottom: '2px solid #ff6b35', borderRight: '1px solid #e0e0e0', padding: '8px', backgroundColor: '#000000', color: '#ffffff', fontWeight: 'bold', fontSize: '7px', textAlign: 'center', verticalAlign: 'middle' }}>
                <div style={{ color: '#ffffff' }}>Current Vendor</div>
                <div style={{ color: '#ffffff' }}>Cost</div>
              </th>
              <th rowSpan={2} style={{ width: '6.5%', borderBottom: '2px solid #ff6b35', borderRight: '1px solid #e0e0e0', padding: '8px', backgroundColor: '#000000', color: '#ffffff', fontWeight: 'bold', fontSize: '7px', textAlign: 'center', verticalAlign: 'middle' }}>
                <div style={{ color: '#ffffff' }}>Current</div>
                <div style={{ color: '#ffffff' }}>Margin</div>
              </th>
              <th rowSpan={2} style={{ width: '6.5%', borderBottom: '2px solid #ff6b35', borderRight: 'none', padding: '8px', backgroundColor: '#000000', color: '#ffffff', fontWeight: 'bold', fontSize: '7px', textAlign: 'center', verticalAlign: 'middle' }}>
                <div style={{ color: '#ffffff' }}>%-</div>
                <div style={{ color: '#ffffff' }}>Margin</div>
              </th>
            </tr>
            {/* Row 3: Individual column headers */}
            <tr>
              {/* Column 1: HC sub-columns */}
              <th style={{ width: '3%', minWidth: '3%', maxWidth: '3%', borderBottom: '2px solid #ff6b35', borderRight: '1px solid #e0e0e0', padding: '6px', backgroundColor: '#000000', color: '#ffffff', fontWeight: 'bold', fontSize: '10px', textAlign: 'right' }}>
                <div style={{ color: '#ffffff' }}>OB-HC</div>
              </th>
              <th style={{ width: '3%', minWidth: '3%', maxWidth: '3%', borderBottom: '2px solid #ff6b35', borderRight: '1px solid #e0e0e0', padding: '6px', backgroundColor: '#000000', color: '#ffffff', fontWeight: 'bold', fontSize: '10px', textAlign: 'right' }}>
                <div style={{ color: '#ffffff' }}>Attrition-HC</div>
              </th>
              <th style={{ width: '3%', minWidth: '3%', maxWidth: '3%', borderBottom: '2px solid #ff6b35', borderRight: '1px solid #e0e0e0', padding: '6px', backgroundColor: '#000000', color: '#ffffff', fontWeight: 'bold', fontSize: '10px', textAlign: 'right' }}>
                <div style={{ color: '#ffffff' }}>Net-HC</div>
              </th>
              {/* Column 2: Alchemy Status sub-columns */}
              <th style={{ width: '6.8%', minWidth: '6.8%', maxWidth: '6.8%', borderBottom: '2px solid #ff6b35', borderRight: '1px solid #e0e0e0', padding: '6px', backgroundColor: '#000000', color: '#ffffff', fontWeight: 'bold', fontSize: '10px', textAlign: 'right' }}>
                <div style={{ color: '#ffffff' }}>OB-PO Value</div>
              </th>
              <th style={{ width: '6.8%', minWidth: '6.8%', maxWidth: '6.8%', borderBottom: '2px solid #ff6b35', borderRight: '1px solid #e0e0e0', padding: '6px', backgroundColor: '#000000', color: '#ffffff', fontWeight: 'bold', fontSize: '10px', textAlign: 'right' }}>
                <div style={{ color: '#ffffff' }}>Attrition PO Value</div>
              </th>
              <th style={{ width: '8%', minWidth: '8%', maxWidth: '8%', borderBottom: '2px solid #ff6b35', borderRight: '1px solid #e0e0e0', padding: '6px', backgroundColor: '#000000', color: '#ffffff', fontWeight: 'bold', fontSize: '10px', textAlign: 'right' }}>
                <div style={{ color: '#ffffff' }}>Net OB-PO Value</div>
              </th>
              {/* Column 3: Vendor Status sub-columns */}
              <th style={{ width: '6.8%', minWidth: '6.8%', maxWidth: '6.8%', borderBottom: '2px solid #ff6b35', borderRight: '1px solid #e0e0e0', padding: '6px', backgroundColor: '#000000', color: '#ffffff', fontWeight: 'bold', fontSize: '10px', textAlign: 'right' }}>
                <div style={{ color: '#ffffff' }}>OB - Vendor PO Value</div>
              </th>
              <th style={{ width: '6.8%', minWidth: '6.8%', maxWidth: '6.8%', borderBottom: '2px solid #ff6b35', borderRight: '1px solid #e0e0e0', padding: '6px', backgroundColor: '#000000', color: '#ffffff', fontWeight: 'bold', fontSize: '10px', textAlign: 'right' }}>
                <div style={{ color: '#ffffff' }}>Attrition Vendor PO Value</div>
              </th>
              <th style={{ width: '8%', minWidth: '8%', maxWidth: '8%', borderBottom: '2px solid #ff6b35', borderRight: '1px solid #e0e0e0', padding: '6px', backgroundColor: '#000000', color: '#ffffff', fontWeight: 'bold', fontSize: '10px', textAlign: 'right' }}>
                <div style={{ color: '#ffffff' }}>Net Vendor Po Value</div>
              </th>
              {/* Column 4: Margin sub-columns */}
              <th style={{ width: '8%', minWidth: '8%', maxWidth: '8%', borderBottom: '2px solid #ff6b35', borderRight: '1px solid #e0e0e0', padding: '6px', backgroundColor: '#000000', color: '#ffffff', fontWeight: 'bold', fontSize: '10px', textAlign: 'right' }}>
                <div style={{ color: '#ffffff' }}>Month OB Margin (Month)</div>
              </th>
              <th style={{ width: '6.8%', minWidth: '6.8%', maxWidth: '6.8%', borderBottom: '2px solid #ff6b35', borderRight: '1px solid #e0e0e0', padding: '6px', backgroundColor: '#000000', color: '#ffffff', fontWeight: 'bold', fontSize: '10px', textAlign: 'right' }}>
                <div style={{ color: '#ffffff' }}>Month Net Margin (Month)</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {summaryData.length === 0 ? (
              <tr>
                <td colSpan={17} style={{ textAlign: 'center', padding: '20px', border: '1px solid #000', fontSize: '10px' }}>
                  No data available
                </td>
              </tr>
            ) : (
              summaryData.map((item, index) => {
                if (!item) return null;
                return (
                <tr key={index} style={{ fontSize: '10px' }}>
                  <td style={{ width: '5%', border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: 'bold', fontSize: '10px' }}>
                    {formatMonthYear(item["Month & Year"] || '')}
                  </td>
                  {/* Column 1: HC */}
                  <td style={{ width: '3%', minWidth: '3%', maxWidth: '3%', border: '1px solid #000', padding: '6px', textAlign: 'right', fontSize: '10px' }}>
                    {formatNumber(item["OB - HC"])}
                  </td>
                  <td style={{ width: '3%', minWidth: '3%', maxWidth: '3%', border: '1px solid #000', padding: '6px', textAlign: 'right', fontSize: '10px' }}>
                    {formatNumber(item["Attrition - HC"])}
                  </td>
                  <td style={{ width: '3%', minWidth: '3%', maxWidth: '3%', border: '1px solid #000', padding: '6px', textAlign: 'right', fontWeight: 'bold', fontSize: '10px' }}>
                    {formatNumber(item["Net - HC"])}
                  </td>
                  {/* Column 2: Alchemy Status */}
                  <td style={{ width: '6.8%', minWidth: '6.8%', maxWidth: '6.8%', border: '1px solid #000', padding: '6px', textAlign: 'right', fontSize: '10px' }}>
                    {formatNumber(item["OB - PO Value"])}
                  </td>
                  <td style={{ width: '6.8%', minWidth: '6.8%', maxWidth: '6.8%', border: '1px solid #000', padding: '6px', textAlign: 'right', fontSize: '10px' }}>
                    {formatNumber(item["Attrition PO Value"])}
                  </td>
                  <td style={{ width: '8%', minWidth: '8%', maxWidth: '8%', border: '1px solid #000', padding: '6px', textAlign: 'right', fontWeight: 'bold', fontSize: '10px' }}>
                    {formatNumber(item["Net - OB PO Value"])}
                  </td>
                  {/* Column 3: Vendor Status */}
                  <td style={{ width: '6.8%', minWidth: '6.8%', maxWidth: '6.8%', border: '1px solid #000', padding: '6px', textAlign: 'right', fontSize: '10px' }}>
                    {formatNumber(item["OB - Vendor PO Value"])}
                  </td>
                  <td style={{ width: '6.8%', minWidth: '6.8%', maxWidth: '6.8%', border: '1px solid #000', padding: '6px', textAlign: 'right', fontSize: '10px' }}>
                    {formatNumber(item["Attrition Vendor PO Value"])}
                  </td>
                  <td style={{ width: '8%', minWidth: '8%', maxWidth: '8%', border: '1px solid #000', padding: '6px', textAlign: 'right', fontWeight: 'bold', fontSize: '10px' }}>
                    {formatNumber(item["Net Vendor Po Value"])}
                  </td>
                  {/* Column 4: Margin */}
                  <td style={{ width: '8%', minWidth: '8%', maxWidth: '8%', border: '1px solid #000', padding: '6px', textAlign: 'right', fontSize: '10px' }}>
                    {formatNumber(item["Month OB Margin (Month)"])}
                  </td>
                  <td style={{ width: '6.8%', minWidth: '6.8%', maxWidth: '6.8%', border: '1px solid #000', padding: '6px', textAlign: 'right', fontSize: '10px' }}>
                    {formatNumber(item["Month Net Margin (Month)"])}
                  </td>
                  {/* Cumulative columns */}
                  <td style={{ width: '3%', minWidth: '3%', maxWidth: '3%', border: '1px solid #000', padding: '6px', textAlign: 'right', fontSize: '10px', fontWeight: 'bold' }}>
                    {formatNumber(item["Current HC"])}
                  </td>
                  <td style={{ width: '7.5%', minWidth: '7.5%', maxWidth: '7.5%', border: '1px solid #000', padding: '6px', textAlign: 'right', fontSize: '10px', fontWeight: 'bold' }}>
                    {formatNumber(item["Current PO Value"])}
                  </td>
                  <td style={{ width: '7.5%', minWidth: '7.5%', maxWidth: '7.5%', border: '1px solid #000', padding: '6px', textAlign: 'right', fontSize: '10px', fontWeight: 'bold' }}>
                    {formatNumber(item["Current Vendor Cost"])}
                  </td>
                  <td style={{ width: '6.5%', border: '1px solid #000', padding: '6px', textAlign: 'right', fontSize: '10px', fontWeight: 'bold' }}>
                    {formatNumber(item["Current Margin"])}
  </td>
                  <td style={{ width: '6.5%', border: '1px solid #000', padding: '6px', textAlign: 'right', fontSize: '10px', fontWeight: 'bold' }}>
                    {item["%- Margin"] !== null && item["%- Margin"] !== undefined && typeof item["%- Margin"] === 'number' && !isNaN(item["%- Margin"]) ? `${item["%- Margin"].toFixed(2)}%` : '0%'}
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CTSDataTable;
