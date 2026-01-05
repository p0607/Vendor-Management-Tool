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
  "Active Gross Margin": number;
  "Attrition Gross Margin": number;
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
    if (value === null || value === undefined) return '0';
    return value.toLocaleString('en-IN');
  };

  // Format month-year string (e.g., "2024-01" -> "Jan-2024")
  const formatMonthYear = (monthYear: string): string => {
    if (!monthYear) return '';
    const [year, month] = monthYear.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    const monthName = date.toLocaleString('default', { month: 'short' });
    const shortYear = year.slice(-2);
    return `${monthName}-${shortYear}`;
  };

  // Get quarter from month (Financial Year: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar)
  const getQuarter = (month: number): number => {
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
        const quarter = getQuarter(item.month);
        const year = item.year;
        // Q4 spans across years (Jan-Mar belongs to next FY)
        const displayYear = quarter === 4 ? year - 1 : year;
        quarters.add(`Q${quarter} ${displayYear}`);
      });
      return Array.from(quarters).sort().reverse();
    } else if (filterType === 'year') {
      const years = new Set<number>();
      allSummaryData.forEach(item => {
        years.add(item.year);
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
        const response = await apiClient.get('/CTS-Summary');
        setAllSummaryData(response.data);
        setSummaryData(response.data);
      } catch (err: any) {
        setError(err.response?.data?.error || err.message || 'An unknown error occurred');
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

  // Export to Excel
  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(summaryData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'CTS Summary');
    XLSX.writeFile(workbook, `CTS_Summary_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(16);
    doc.text('CTS Summary Report', 14, 15);

    const tableData = summaryData.map(item => [
      item["Month & Year"],
      formatNumber(item["OB - HC"]),
      formatNumber(item["Attrition - HC"]),
      formatNumber(item["Net - HC"]),
      formatNumber(item["OB - PO Value"]),
      formatNumber(item["Attrition PO Value"]),
      formatNumber(item["Net - OB PO Value"]),
      formatNumber(item["OB - Vendor PO Value"]),
      formatNumber(item["Attrition Vendor PO Value"]),
      formatNumber(item["Net Vendor Po Value"]),
      formatNumber(item["Active Gross Margin"]),
      formatNumber(item["Attrition Gross Margin"])
    ]);

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
        'Active Gross Margin',
        'Attrition Gross Margin'
      ]],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [32, 145, 211] },
      styles: { fontSize: 8, cellPadding: 2 },
      margin: { left: 10, right: 10 }
    });

    doc.save(`CTS_Summary_Report_${new Date().toISOString().split('T')[0]}.pdf`);
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
            <button className="auth-button" onClick={() => navigate('/HomePage')}>Data</button>
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
            <button className="auth-button" onClick={() => navigate('/HomePage')}>Data</button>
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
      <div className="routing-header-bar" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '1rem 2rem 0 2rem' }}>
        <div className="homepage-logo-top-left" style={{ width: '120px', height: 'auto' }}>
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
        <div className="auth-buttons-container">
          <button className="auth-button" onClick={() => navigate('/HomePage')}>Data</button>
          <button className="auth-button" onClick={() => navigate('/HomePage')}>Home</button>
          <div className="action-dropdown-container" ref={actionsDropdownRef} style={{ position: 'relative' }}>
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
                <div className="dropdown-item" onClick={() => { navigate('/AddAttritionData'); setIsActionsDropdownOpen(false); }} style={{ padding: '10px 15px', cursor: 'pointer' }}>
                  Add Attrition Data
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="routing-container" style={{ marginTop: '2rem', padding: '0 2rem 2rem 2rem' }}>
        {/* Filter Section */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
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
                {getFilterOptions.map((option) => (
                  <option key={option} value={option}>
                    {filterType === 'month' ? formatMonthYear(option) : option}
                  </option>
                ))}
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
        <table className="routing-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: '10px', backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>Month & Year</th>
              <th colSpan={3} style={{ border: '1px solid #000', padding: '10px', backgroundColor: '#f0f0f0', fontWeight: 'bold', textAlign: 'center' }}>HC</th>
              <th colSpan={3} style={{ border: '1px solid #000', padding: '10px', backgroundColor: '#f0f0f0', fontWeight: 'bold', textAlign: 'center' }}>Alchemy Status</th>
              <th colSpan={3} style={{ border: '1px solid #000', padding: '10px', backgroundColor: '#f0f0f0', fontWeight: 'bold', textAlign: 'center' }}>Vendor Status</th>
              <th colSpan={2} style={{ border: '1px solid #000', padding: '10px', backgroundColor: '#f0f0f0', fontWeight: 'bold', textAlign: 'center' }}>Gross Margin</th>
            </tr>
            <tr>
              {/* HC Columns */}
              <th style={{ border: '1px solid #000', padding: '8px', backgroundColor: '#f9f9f9', fontWeight: 'bold' }}>OB - HC</th>
              <th style={{ border: '1px solid #000', padding: '8px', backgroundColor: '#f9f9f9', fontWeight: 'bold' }}>Attrition - HC</th>
              <th style={{ border: '1px solid #000', padding: '8px', backgroundColor: '#f9f9f9', fontWeight: 'bold' }}>Net - HC</th>
              {/* Alchemy Status Columns */}
              <th style={{ border: '1px solid #000', padding: '8px', backgroundColor: '#f9f9f9', fontWeight: 'bold' }}>OB - PO Value</th>
              <th style={{ border: '1px solid #000', padding: '8px', backgroundColor: '#f9f9f9', fontWeight: 'bold' }}>Attrition PO Value</th>
              <th style={{ border: '1px solid #000', padding: '8px', backgroundColor: '#f9f9f9', fontWeight: 'bold' }}>Net - OB PO Value</th>
              {/* Vendor Status Columns */}
              <th style={{ border: '1px solid #000', padding: '8px', backgroundColor: '#f9f9f9', fontWeight: 'bold' }}>OB - Vendor PO Value</th>
              <th style={{ border: '1px solid #000', padding: '8px', backgroundColor: '#f9f9f9', fontWeight: 'bold' }}>Attrition Vendor PO Value</th>
              <th style={{ border: '1px solid #000', padding: '8px', backgroundColor: '#f9f9f9', fontWeight: 'bold' }}>Net Vendor Po Value</th>
              {/* Gross Margin Columns */}
              <th style={{ border: '1px solid #000', padding: '8px', backgroundColor: '#f9f9f9', fontWeight: 'bold' }}>Active Gross Margin</th>
              <th style={{ border: '1px solid #000', padding: '8px', backgroundColor: '#f9f9f9', fontWeight: 'bold' }}>Attrition Gross Margin</th>
            </tr>
          </thead>
          <tbody>
            {summaryData.length === 0 ? (
              <tr>
                <td colSpan={13} style={{ textAlign: 'center', padding: '20px', border: '1px solid #000' }}>
                  No data available
                </td>
              </tr>
            ) : (
              summaryData.map((item, index) => (
                <tr key={index}>
                  <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>
                    {formatMonthYear(item["Month & Year"])}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>
                    {formatNumber(item["OB - HC"])}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>
                    {formatNumber(item["Attrition - HC"])}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>
                    {formatNumber(item["Net - HC"])}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>
                    {formatNumber(item["OB - PO Value"])}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>
                    {formatNumber(item["Attrition PO Value"])}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>
                    {formatNumber(item["Net - OB PO Value"])}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>
                    {formatNumber(item["OB - Vendor PO Value"])}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>
                    {formatNumber(item["Attrition Vendor PO Value"])}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>
                    {formatNumber(item["Net Vendor Po Value"])}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>
                    {formatNumber(item["Active Gross Margin"])}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>
                    {formatNumber(item["Attrition Gross Margin"])}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CTSDataTable;
