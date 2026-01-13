import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import './RoutingTable.css';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import apiClient from '../config/api';

interface ActiveDataItem {
  id: number;
  active_employee_name: string;
  active_vendor: string;
  active_skill: string;
  active_ob_month: string;
  active_doj: string;
  active_employment_status: string;
  active_po_value: number | string;
  active_vendor_value: number | string;
  active_alchemy_routing: string;
  active_gross_margin: number | string;
  active_gm_percentage: number | string;
  created_at?: string;
  updated_at?: string;
}

interface AttritionDataItem {
  id: number;
  attrition_employee_name: string;
  attrition_vendor: string;
  attrition_skill: string;
  attrition_b_month: string;
  attrition_doj: string;
  attrition_employment_status: string;
  attrition_month: string;
  attrition_date: string;
  attrition_po_value: number | string;
  attrition_vendor_value: number | string;
  attrition_alchemy_routing: string;
  attrition_gross_margin: number | string;
  attrition_gm_percentage: number | string;
  created_at?: string;
  updated_at?: string;
}

const CTSDataView: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'active' | 'attrition'>('active');
  const [activeData, setActiveData] = useState<ActiveDataItem[]>([]);
  const [attritionData, setAttritionData] = useState<AttritionDataItem[]>([]);
  const [filteredActiveData, setFilteredActiveData] = useState<ActiveDataItem[]>([]);
  const [filteredAttritionData, setFilteredAttritionData] = useState<AttritionDataItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState<boolean>(false);
  const actionsDropdownRef = useRef<HTMLDivElement>(null);
  const [filterType, setFilterType] = useState<'month' | 'quarter' | 'year'>('month');
  const [filterValue, setFilterValue] = useState<string>('');

  // Format date for display
  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr || dateStr === '' || dateStr === 'null' || dateStr === 'undefined') return 'N/A';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Format number with commas
  const formatNumber = (value: number | string | null | undefined): string => {
    if (value === null || value === undefined || value === '' || value === 'null') return '0';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0';
    return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

  // Get quarter from month (Financial Year: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar)
  const getQuarter = (month: number): number => {
    if (month >= 4 && month <= 6) return 1; // Q1: Apr-Jun
    if (month >= 7 && month <= 9) return 2; // Q2: Jul-Sep
    if (month >= 10 && month <= 12) return 3; // Q3: Oct-Dec
    return 4; // Q4: Jan-Mar
  };

  // Parse date string to extract year and month
  const parseDate = (dateStr: string | null | undefined): { year: number | null; month: number | null } => {
    if (!dateStr || dateStr === '' || dateStr === 'null' || dateStr === 'undefined') return { year: null, month: null };
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return { year: null, month: null };
      return { year: date.getFullYear(), month: date.getMonth() + 1 };
    } catch {
      return { year: null, month: null };
    }
  };

  // Get unique filter options based on filter type
  const getFilterOptions = useMemo(() => {
    const allData = activeTab === 'active' ? activeData : attritionData;
    const dateField = activeTab === 'active' ? 'active_ob_month' : 'attrition_month';
    
    if (filterType === 'month') {
      const months = new Set<string>();
      allData.forEach(item => {
        const dateValue = activeTab === 'active' ? (item as ActiveDataItem).active_ob_month : (item as AttritionDataItem).attrition_month;
        if (dateValue) {
          const { year, month } = parseDate(dateValue);
          if (year && month) {
            const date = new Date(year, month - 1, 1);
            const monthName = date.toLocaleString('default', { month: 'short' });
            const shortYear = String(year).slice(-2);
            months.add(`${monthName}-${shortYear}`);
          }
        }
      });
      return Array.from(months).sort().reverse();
    } else if (filterType === 'quarter') {
      const quarters = new Set<string>();
      allData.forEach(item => {
        const dateValue = activeTab === 'active' ? (item as ActiveDataItem).active_ob_month : (item as AttritionDataItem).attrition_month;
        if (dateValue) {
          const { year, month } = parseDate(dateValue);
          if (year && month) {
            const quarter = getQuarter(month);
            const displayYear = quarter === 4 ? year - 1 : year;
            quarters.add(`Q${quarter} ${displayYear}`);
          }
        }
      });
      return Array.from(quarters).sort().reverse();
    } else if (filterType === 'year') {
      const years = new Set<number>();
      allData.forEach(item => {
        const dateValue = activeTab === 'active' ? (item as ActiveDataItem).active_ob_month : (item as AttritionDataItem).attrition_month;
        if (dateValue) {
          const { year, month } = parseDate(dateValue);
          if (year && month) {
            // Financial year: April to March
            const fyYear = month >= 4 ? year : year - 1;
            years.add(fyYear);
          }
        }
      });
      return Array.from(years).sort((a, b) => b - a).map(y => y.toString());
    }
    return [];
  }, [activeData, attritionData, filterType, activeTab]);

  // Fetch Active data
  useEffect(() => {
    const fetchActiveData = async () => {
      try {
        const response = await apiClient.get('/Active');
        if (Array.isArray(response.data)) {
          setActiveData(response.data);
          setFilteredActiveData(response.data);
        }
      } catch (err: any) {
        console.error('Error fetching Active data:', err);
        setError(err.response?.data?.error || 'Failed to fetch Active data');
      }
    };
    fetchActiveData();
  }, []);

  // Fetch Attrition data
  useEffect(() => {
    const fetchAttritionData = async () => {
      try {
        const response = await apiClient.get('/Attrition');
        if (Array.isArray(response.data)) {
          setAttritionData(response.data);
          setFilteredAttritionData(response.data);
        }
      } catch (err: any) {
        console.error('Error fetching Attrition data:', err);
        setError(err.response?.data?.error || 'Failed to fetch Attrition data');
      } finally {
        setLoading(false);
      }
    };
    fetchAttritionData();
  }, []);

  // Filter data based on search term and date filters
  useEffect(() => {
    let filteredActive = [...activeData];
    let filteredAttrition = [...attritionData];

    // Apply date filter
    if (filterValue) {
      if (filterType === 'month') {
        const filterLower = filterValue.toLowerCase();
        filteredActive = filteredActive.filter(item => {
          const { year, month } = parseDate(item.active_ob_month);
          if (!year || !month) return false;
          const date = new Date(year, month - 1, 1);
          const monthName = date.toLocaleString('default', { month: 'short' });
          const shortYear = String(year).slice(-2);
          return `${monthName}-${shortYear}`.toLowerCase() === filterLower;
        });
        filteredAttrition = filteredAttrition.filter(item => {
          const { year, month } = parseDate(item.attrition_month);
          if (!year || !month) return false;
          const date = new Date(year, month - 1, 1);
          const monthName = date.toLocaleString('default', { month: 'short' });
          const shortYear = String(year).slice(-2);
          return `${monthName}-${shortYear}`.toLowerCase() === filterLower;
        });
      } else if (filterType === 'quarter') {
        const quarterMatch = filterValue.match(/Q(\d)\s+(\d{4})/);
        if (quarterMatch) {
          const targetQuarter = parseInt(quarterMatch[1]);
          const targetYear = parseInt(quarterMatch[2]);
          filteredActive = filteredActive.filter(item => {
            const { year, month } = parseDate(item.active_ob_month);
            if (!year || !month) return false;
            const itemQuarter = getQuarter(month);
            if (itemQuarter === 4) {
              return itemQuarter === targetQuarter && year === targetYear + 1;
            }
            return itemQuarter === targetQuarter && year === targetYear;
          });
          filteredAttrition = filteredAttrition.filter(item => {
            const { year, month } = parseDate(item.attrition_month);
            if (!year || !month) return false;
            const itemQuarter = getQuarter(month);
            if (itemQuarter === 4) {
              return itemQuarter === targetQuarter && year === targetYear + 1;
            }
            return itemQuarter === targetQuarter && year === targetYear;
          });
        }
      } else if (filterType === 'year') {
        const targetYear = parseInt(filterValue);
        filteredActive = filteredActive.filter(item => {
          const { year, month } = parseDate(item.active_ob_month);
          if (!year || !month) return false;
          if (month >= 4) {
            return year === targetYear;
          } else {
            return year === targetYear + 1;
          }
        });
        filteredAttrition = filteredAttrition.filter(item => {
          const { year, month } = parseDate(item.attrition_month);
          if (!year || !month) return false;
          if (month >= 4) {
            return year === targetYear;
          } else {
            return year === targetYear + 1;
          }
        });
      }
    }

    // Apply search term filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filteredActive = filteredActive.filter(item => 
        Object.values(item).some(val => 
          val && String(val).toLowerCase().includes(searchLower)
        )
      );
      filteredAttrition = filteredAttrition.filter(item => 
        Object.values(item).some(val => 
          val && String(val).toLowerCase().includes(searchLower)
        )
      );
    }

    setFilteredActiveData(filteredActive);
    setFilteredAttritionData(filteredAttrition);
  }, [searchTerm, activeData, attritionData, filterType, filterValue]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsDropdownRef.current && !actionsDropdownRef.current.contains(event.target as Node)) {
        setIsActionsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Export to Excel
  const exportToExcel = () => {
    if (activeTab === 'active') {
      const ws = XLSX.utils.json_to_sheet(filteredActiveData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Active Data');
      XLSX.writeFile(wb, 'Active_Data.xlsx');
    } else {
      const ws = XLSX.utils.json_to_sheet(filteredAttritionData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Attrition Data');
      XLSX.writeFile(wb, 'Attrition_Data.xlsx');
    }
  };

  // Export to PDF
  const exportToPDF = () => {
    const title = activeTab === 'active' ? 'Active Data' : 'Attrition Data';
    const doc = new jsPDF('landscape');
    
    // Add title
    doc.setFontSize(16);
    doc.text(title, 14, 15);
    
    // Prepare table data
    let tableData: any[][] = [];
    let headers: string[] = [];

    if (activeTab === 'active') {
      headers = ['Sl.No', 'Employee Name', 'Vendor', 'Skill', 'OB Month', 'DOJ', 'Employment Status', 'PO Value', 'Vendor Value', 'Alchemy Routing', 'Gross Margin', 'GM %'];
      tableData = filteredActiveData.map((item, index) => [
        index + 1,
        item.active_employee_name || 'N/A',
        item.active_vendor || 'N/A',
        item.active_skill || 'N/A',
        formatDate(item.active_ob_month),
        formatDate(item.active_doj),
        item.active_employment_status || 'N/A',
        formatNumber(item.active_po_value),
        formatNumber(item.active_vendor_value),
        item.active_alchemy_routing || 'N/A',
        formatNumber(item.active_gross_margin),
        formatNumber(item.active_gm_percentage)
      ]);
    } else {
      headers = ['Sl.No', 'Employee Name', 'Vendor', 'Skill', 'B Month', 'DOJ', 'Employment Status', 'Attrition Month', 'Attrition Date', 'PO Value', 'Vendor Value', 'Alchemy Routing', 'Gross Margin', 'GM %'];
      tableData = filteredAttritionData.map((item, index) => [
        index + 1,
        item.attrition_employee_name || 'N/A',
        item.attrition_vendor || 'N/A',
        item.attrition_skill || 'N/A',
        formatDate(item.attrition_b_month),
        formatDate(item.attrition_doj),
        item.attrition_employment_status || 'N/A',
        formatDate(item.attrition_month),
        formatDate(item.attrition_date),
        formatNumber(item.attrition_po_value),
        formatNumber(item.attrition_vendor_value),
        item.attrition_alchemy_routing || 'N/A',
        formatNumber(item.attrition_gross_margin),
        formatNumber(item.attrition_gm_percentage)
      ]);
    }

    autoTable(doc, {
      head: [headers],
      body: tableData,
      startY: 25,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [245, 245, 245] }
    });

    doc.save(`${activeTab === 'active' ? 'Active' : 'Attrition'}_Data.pdf`);
  };

  return (
    <div className="routing-table-container">
      <div className="routing-table-header" style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%', padding: '1rem 2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="search-section" style={{ width: '300px' }}>
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>
          {/* Filter Section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
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
              <option value="">Select {filterType}</option>
              {getFilterOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginLeft: '20px' }}>
          <button 
            className="auth-button"
            onClick={() => navigate('/CTSDataTable')}
            style={{ backgroundColor: '#f57c00', color: 'white' }}
          >
            ← Back
          </button>
          <div className="actions-dropdown" ref={actionsDropdownRef}>
            <button 
              className="auth-button"
              onClick={() => setIsActionsDropdownOpen(!isActionsDropdownOpen)}
            >
              Actions ▼
            </button>
            {isActionsDropdownOpen && (
              <div className="dropdown-menu">
                <button onClick={exportToExcel}>Export to Excel</button>
                <button onClick={exportToPDF}>Export to PDF</button>
                <button onClick={() => navigate('/AddActiveData')}>Add Active Data</button>
                <button onClick={() => navigate('/AddAttritionData')}>Add Attrition Data</button>
              </div>
            )}
          </div>
          <button className="auth-button" onClick={() => navigate('/HomePage')}>Home</button>
        </div>
      </div>

      <div className="tabs-container" style={{ marginTop: '20px', marginBottom: '20px' }}>
        <button
          className={`tab-button ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          Active Data ({filteredActiveData.length})
        </button>
        <button
          className={`tab-button ${activeTab === 'attrition' ? 'active' : ''}`}
          onClick={() => setActiveTab('attrition')}
        >
          Attrition Data ({filteredAttritionData.length})
        </button>
      </div>

      {error && (
        <div className="error-message" style={{ margin: '20px', padding: '10px', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading-message" style={{ textAlign: 'center', padding: '40px' }}>
          Loading data...
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="routing-table" style={{ tableLayout: 'fixed', width: '100%' }}>
            <thead>
              <tr>
                {activeTab === 'active' ? (
                  <>
                    <th style={{ width: '8.33%' }}>Sl.No</th>
                    <th style={{ width: '8.33%' }}>Employee Name</th>
                    <th style={{ width: '8.33%' }}>Vendor</th>
                    <th style={{ width: '8.33%' }}>Skill</th>
                    <th style={{ width: '8.33%' }}>OB Month</th>
                    <th style={{ width: '8.33%' }}>DOJ</th>
                    <th style={{ width: '8.33%' }}>Employment Status</th>
                    <th style={{ width: '8.33%' }}>PO Value</th>
                    <th style={{ width: '8.33%' }}>Vendor Value</th>
                    <th style={{ width: '8.33%' }}>Alchemy Routing</th>
                    <th style={{ width: '8.33%' }}>Gross Margin</th>
                    <th style={{ width: '8.33%' }}>GM %</th>
                  </>
                ) : (
                  <>
                    <th style={{ width: '7.14%' }}>Sl.No</th>
                    <th style={{ width: '7.14%' }}>Employee Name</th>
                    <th style={{ width: '7.14%' }}>Vendor</th>
                    <th style={{ width: '7.14%' }}>Skill</th>
                    <th style={{ width: '7.14%' }}>B Month</th>
                    <th style={{ width: '7.14%' }}>DOJ</th>
                    <th style={{ width: '7.14%' }}>Employment Status</th>
                    <th style={{ width: '7.14%' }}>Attrition Month</th>
                    <th style={{ width: '7.14%' }}>Attrition Date</th>
                    <th style={{ width: '7.14%' }}>PO Value</th>
                    <th style={{ width: '7.14%' }}>Vendor Value</th>
                    <th style={{ width: '7.14%' }}>Alchemy Routing</th>
                    <th style={{ width: '7.14%' }}>Gross Margin</th>
                    <th style={{ width: '7.14%' }}>GM %</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {activeTab === 'active' ? (
                filteredActiveData.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ textAlign: 'center', padding: '20px' }}>
                      No data available
                    </td>
                  </tr>
                ) : (
                  filteredActiveData.map((item, index) => (
                    <tr key={item.id || index}>
                      <td>{index + 1}</td>
                      <td>{item.active_employee_name || 'N/A'}</td>
                      <td>{item.active_vendor || 'N/A'}</td>
                      <td>{item.active_skill || 'N/A'}</td>
                      <td>{formatDate(item.active_ob_month)}</td>
                      <td>{formatDate(item.active_doj)}</td>
                      <td>{item.active_employment_status || 'N/A'}</td>
                      <td>{formatNumber(item.active_po_value)}</td>
                      <td>{formatNumber(item.active_vendor_value)}</td>
                      <td>{item.active_alchemy_routing || 'N/A'}</td>
                      <td>{formatNumber(item.active_gross_margin)}</td>
                      <td>{formatNumber(item.active_gm_percentage)}</td>
                    </tr>
                  ))
                )
              ) : (
                filteredAttritionData.length === 0 ? (
                  <tr>
                    <td colSpan={14} style={{ textAlign: 'center', padding: '20px' }}>
                      No data available
                    </td>
                  </tr>
                ) : (
                  filteredAttritionData.map((item, index) => (
                    <tr key={item.id || index}>
                      <td>{index + 1}</td>
                      <td>{item.attrition_employee_name || 'N/A'}</td>
                      <td>{item.attrition_vendor || 'N/A'}</td>
                      <td>{item.attrition_skill || 'N/A'}</td>
                      <td>{formatDate(item.attrition_b_month)}</td>
                      <td>{formatDate(item.attrition_doj)}</td>
                      <td>{item.attrition_employment_status || 'N/A'}</td>
                      <td>{formatDate(item.attrition_month)}</td>
                      <td>{formatDate(item.attrition_date)}</td>
                      <td>{formatNumber(item.attrition_po_value)}</td>
                      <td>{formatNumber(item.attrition_vendor_value)}</td>
                      <td>{item.attrition_alchemy_routing || 'N/A'}</td>
                      <td>{formatNumber(item.attrition_gross_margin)}</td>
                      <td>{formatNumber(item.attrition_gm_percentage)}</td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CTSDataView;

