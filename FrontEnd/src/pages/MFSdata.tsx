import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './MFSdata.css';
import apiClient from '../config/api';
import logo from '../assets/logo_1.png';

interface TeamReportItem {
  id: number;
  tower?: string;
  client_name?: string;
  project_name?: string;
  business_unit?: string;
  bu_head?: string;
  hc?: number;
  salary_cost?: number;
  sales?: number;
  revenue?: number;
  gpm?: number;
  gpm_percentage?: number;
  leave_encashment?: number;
  team_cost?: number;
  opr_cost?: number;
  funding_cost?: number;
  np?: number;
  np_percentage?: number;
  month?: string;
  year?: number;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

interface ParameterData {
  parameter: string;
  label: string;
  values: { [monthKey: string]: { value: number; id: number; record: TeamReportItem } };
}

const MFSdata: React.FC = () => {
  // Helper function to get current Financial Year start year
  // FY runs from April to March (e.g., April 2025 to March 2026 = FY 2025-26)
  const getCurrentFYStartYear = (): number => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12 (Jan=1, Apr=4, etc.)
    const currentYear = now.getFullYear();
    
    // If current month is April (4) to December (12), FY started in current year
    // If current month is January (1) to March (3), FY started in previous year
    if (currentMonth >= 4) {
      return currentYear;
    } else {
      return currentYear - 1;
    }
  };

  const [teamReportData, setTeamReportData] = useState<TeamReportItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string>('');
  // Set default to current FY (year filter showing FY data)
  const [periodFilter, setPeriodFilter] = useState<string>('year'); // 'year', 'quarter', or 'month'
  const [periodValue, setPeriodValue] = useState<string>(String(getCurrentFYStartYear())); // Default to current FY start year
  const [editingCell, setEditingCell] = useState<{ parameter: string; monthKey: string } | null>(null);
  const [editedValue, setEditedValue] = useState<string>('');
  const [editMode, setEditMode] = useState<boolean>(false);

  const navigate = useNavigate();

  // Define parameters to display - matching team_summary_report table structure
  const parameters = [
    { key: 'hc', label: 'HC' },
    { key: 'revenue', label: 'Revenue' },
    { key: 'gpm', label: 'GPM' },
    { key: 'team_cost', label: 'Team Cost' },
    { key: 'net_margin', label: 'Net Margin' }
  ];

  // Fetch data from API - using same endpoint as TeamReportCompare
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await apiClient.get('/team-summary-report');
        
        if (!Array.isArray(response.data)) {
          throw new Error("Data is not an array");
        }

        // Debug: Log sample data to see structure
        if (response.data.length > 0) {
          console.log('Sample team summary report data:', response.data[0]);
          console.log('Total records:', response.data.length);
          console.log('Sample month values:', response.data.slice(0, 5).map((item: any) => ({ month: item.month, year: item.year })));
        }

        setTeamReportData(response.data as TeamReportItem[]);
      } catch (err: any) {
        console.error("Fetch failed:", err);
        setError(err.response?.data?.error || err.message || 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Helper function to normalize business unit name (title case)
  const normalizeBusinessUnitName = (name: string): string => {
    if (!name) return '';
    // Convert to title case: first letter uppercase, rest lowercase
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  };

  // Get unique business units (normalized to handle case differences)
  const businessUnits = useMemo(() => {
    const unitsMap = new Map<string, string>(); // normalized name -> original name (prefer title case)
    teamReportData.forEach(item => {
      if (item.business_unit) {
        const normalized = normalizeBusinessUnitName(item.business_unit);
        // If we haven't seen this normalized name, or if current is title case and stored isn't
        if (!unitsMap.has(normalized)) {
          unitsMap.set(normalized, item.business_unit);
        } else {
          // Prefer title case version if available
          const stored = unitsMap.get(normalized)!;
          const currentIsTitleCase = item.business_unit === normalized;
          const storedIsTitleCase = stored === normalized;
          if (currentIsTitleCase && !storedIsTitleCase) {
            unitsMap.set(normalized, item.business_unit);
          }
        }
      }
    });
    return Array.from(unitsMap.values()).sort();
  }, [teamReportData]);

  // Get unique years
  const years = useMemo(() => {
    const yearSet = new Set<number>();
    teamReportData.forEach(item => {
      if (item.year) {
        yearSet.add(item.year);
      }
    });
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [teamReportData]);

  // Helper to normalize month name to full name (handles both full names and abbreviations)
  const normalizeToFullMonthName = (monthName: string): string => {
    if (!monthName || typeof monthName !== 'string') return '';
    
    const normalized = monthName.charAt(0).toUpperCase() + monthName.slice(1).toLowerCase();
    
    // Map abbreviations to full names
    const abbreviationMap: { [key: string]: string } = {
      'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April',
      'May': 'May', 'Jun': 'June', 'Jul': 'July', 'Aug': 'August',
      'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December'
    };
    
    // If it's an abbreviation, convert to full name
    if (abbreviationMap[normalized]) {
      return abbreviationMap[normalized];
    }
    
    // Otherwise return normalized (should be full name already)
    return normalized;
  };

  // Helper to get month number from month name
  const getMonthNumber = (monthName: string): number => {
    const fullMonthName = normalizeToFullMonthName(monthName);
    
    const months: { [key: string]: number } = {
      'January': 1, 'February': 2, 'March': 3, 'April': 4, 'May': 5, 'June': 6,
      'July': 7, 'August': 8, 'September': 9, 'October': 10, 'November': 11, 'December': 12
    };
    return months[fullMonthName] || 0;
  };

  // Helper to format month key
  const getMonthKey = (month: string, year: number): string => {
    // Normalize month name to full name first
    const fullMonthName = normalizeToFullMonthName(month);
    const monthNum = getMonthNumber(fullMonthName);
    if (monthNum === 0) {
      console.warn('Invalid month name:', month);
    }
    return `${year}-${String(monthNum).padStart(2, '0')}`;
  };

  // Filter data based on business unit and period
  const filteredData = useMemo(() => {
    let filtered = [...teamReportData];

    // Filter by business unit (case-insensitive)
    if (selectedBusinessUnit) {
      const normalizedSelected = normalizeBusinessUnitName(selectedBusinessUnit);
      filtered = filtered.filter(item => {
        if (!item.business_unit) return false;
        return normalizeBusinessUnitName(item.business_unit) === normalizedSelected;
      });
    }

    // Filter by period
    if (periodFilter && periodValue) {
      if (periodFilter === 'year') {
        // For year filter, show Financial Year data (April of selected year to March of next year)
        const fyStartYear = parseInt(periodValue);
        const fyEndYear = fyStartYear + 1;
        
        // FY months: April (4) to December (12) of start year, January (1) to March (3) of end year
        const fyStartMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const fyEndMonths = ['January', 'February', 'March'];
        
        filtered = filtered.filter(item => {
          if (!item.month || !item.year) return false;
          const normalizedMonth = normalizeToFullMonthName(item.month);
          
          // Check if month is in FY start year (Apr-Dec) or FY end year (Jan-Mar)
          if (fyStartMonths.includes(normalizedMonth) && item.year === fyStartYear) {
            return true;
          }
          if (fyEndMonths.includes(normalizedMonth) && item.year === fyEndYear) {
            return true;
          }
          return false;
        });
      } else if (periodFilter === 'quarter') {
        // Parse quarter (format: "Q1-2025" or "Q1(Apr-Jun) 2025")
        const quarterMatch = periodValue.match(/Q(\d)/);
        const yearMatch = periodValue.match(/(\d{4})/);
        if (quarterMatch && yearMatch) {
          const quarter = parseInt(quarterMatch[1]);
          const year = parseInt(yearMatch[1]);
          const quarterMonthNames: { [key: number]: string[] } = {
            1: ['April', 'May', 'June'],
            2: ['July', 'August', 'September'],
            3: ['October', 'November', 'December'],
            4: ['January', 'February', 'March']
          };
          const monthsInQuarter = quarterMonthNames[quarter] || [];
          filtered = filtered.filter(item => {
            if (!item.month || !item.year) return false;
            // Normalize month name to full name for comparison
            const normalizedMonth = normalizeToFullMonthName(item.month);
            // Handle Q4 which spans across years
            if (quarter === 4) {
              return monthsInQuarter.includes(normalizedMonth) && item.year === year + 1;
            } else {
              return monthsInQuarter.includes(normalizedMonth) && item.year === year;
            }
          });
        }
      } else if (periodFilter === 'month') {
        // Parse month (format: "January-2025" or "Jan-2025")
        const parts = periodValue.split('-');
        if (parts.length === 2) {
          const monthName = parts[0];
          const year = parseInt(parts[1]);
          // Normalize month name to full name for comparison
          const normalizedMonthName = normalizeToFullMonthName(monthName);
          filtered = filtered.filter(item => {
            if (!item.month || !item.year) return false;
            const normalizedItemMonth = normalizeToFullMonthName(item.month);
            return normalizedItemMonth === normalizedMonthName && item.year === year;
          });
        }
      }
    }

    return filtered;
  }, [teamReportData, selectedBusinessUnit, periodFilter, periodValue]);

  // Get unique months from filtered data
  const months = useMemo(() => {
    // If year filter is selected, show all 12 months of the Financial Year (Apr to Mar)
    if (periodFilter === 'year' && periodValue) {
      const fyStartYear = parseInt(periodValue);
      const fyEndYear = fyStartYear + 1;
      // FY months: April to December of start year, then January to March of end year
      const fyMonths = [
        { month: 'April', year: fyStartYear },
        { month: 'May', year: fyStartYear },
        { month: 'June', year: fyStartYear },
        { month: 'July', year: fyStartYear },
        { month: 'August', year: fyStartYear },
        { month: 'September', year: fyStartYear },
        { month: 'October', year: fyStartYear },
        { month: 'November', year: fyStartYear },
        { month: 'December', year: fyStartYear },
        { month: 'January', year: fyEndYear },
        { month: 'February', year: fyEndYear },
        { month: 'March', year: fyEndYear }
      ];
      return fyMonths.map(({ month, year }) => getMonthKey(month, year));
    }
    
    // If quarter filter is selected, show all 3 months of that quarter
    if (periodFilter === 'quarter' && periodValue) {
      const quarterMatch = periodValue.match(/Q(\d)/);
      const yearMatch = periodValue.match(/(\d{4})/);
      if (quarterMatch && yearMatch) {
        const quarter = parseInt(quarterMatch[1]);
        const year = parseInt(yearMatch[1]);
        const quarterMonthNames: { [key: number]: string[] } = {
          1: ['April', 'May', 'June'],
          2: ['July', 'August', 'September'],
          3: ['October', 'November', 'December'],
          4: ['January', 'February', 'March']
        };
        const monthsInQuarter = quarterMonthNames[quarter] || [];
        // Handle Q4 which spans across years
        const displayYear = quarter === 4 ? year + 1 : year;
        return monthsInQuarter.map(month => getMonthKey(month, displayYear));
      }
    }
    
    // If month filter is selected, show just that month
    if (periodFilter === 'month' && periodValue) {
      const parts = periodValue.split('-');
      if (parts.length === 2) {
        const monthName = parts[0];
        const year = parseInt(parts[1]);
        return [getMonthKey(monthName, year)];
      }
    }
    
    // Otherwise, show only months that have data
    const monthSet = new Set<string>();
    filteredData.forEach(item => {
      if (item.month && item.year) {
        // Normalize month name to full name before generating key
        const fullMonthName = normalizeToFullMonthName(item.month);
        monthSet.add(getMonthKey(fullMonthName, item.year));
      }
    });
    return Array.from(monthSet).sort();
  }, [filteredData, periodFilter, periodValue]);

  // Build pivot table data
  const pivotData = useMemo(() => {
    const data: ParameterData[] = parameters.map(param => {
      const values: { [monthKey: string]: { value: number; id: number; record: TeamReportItem } } = {};
      
      filteredData.forEach(item => {
        if (item.month && item.year) {
          // Normalize month name to full name - handles both full names and abbreviations
          const fullMonthName = normalizeToFullMonthName(item.month);
          
          const monthKey = getMonthKey(fullMonthName, item.year);
          const paramValue = item[param.key];
          
          if (paramValue !== null && paramValue !== undefined && paramValue !== '') {
            const numValue = typeof paramValue === 'string' ? parseFloat(paramValue) : paramValue;
            if (!isNaN(numValue)) {
              // If multiple records exist for same month, sum them
              if (values[monthKey]) {
                values[monthKey].value += numValue;
                // Keep the first record's ID for editing (or we could track all IDs)
              } else {
                values[monthKey] = {
                  value: numValue,
                  id: item.id,
                  record: item
                };
              }
            }
          }
        }
      });
      
      return {
        parameter: param.key,
        label: param.label,
        values
      };
    });
    
    return data;
  }, [filteredData, parameters]);

  // Calculate totals for each month (excluding percentage fields)
  const totals = useMemo(() => {
    const totalsByMonth: { [monthKey: string]: number } = {};
    
    months.forEach(monthKey => {
      let total = 0;
      pivotData.forEach(paramData => {
        // Exclude percentage fields from totals
        if (!paramData.parameter.includes('percentage') && !paramData.parameter.includes('_percentage')) {
          const cellData = paramData.values[monthKey];
          if (cellData && !isNaN(cellData.value)) {
            total += cellData.value;
          }
        }
      });
      totalsByMonth[monthKey] = total;
    });
    
    return totalsByMonth;
  }, [pivotData, months]);

  // Format value for display
  const formatValue = (value: number, parameter: string): string => {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    
    // team_summary_report doesn't have percentage fields, but keep this for compatibility
    if (parameter.includes('percentage') || parameter.includes('_percentage')) {
      return `${value.toFixed(2)}%`;
    }
    
    return Math.round(value).toLocaleString('en-IN');
  };

  // Sync row heights and column widths between fixed and scrollable tables
  useEffect(() => {
    const syncTables = () => {
      const fixedTable = document.querySelector('.fixed-table tbody');
      const scrollableTable = document.querySelector('.scrollable-table tbody');
      const fixedHeader = document.querySelector('.fixed-table thead');
      const scrollableHeader = document.querySelector('.scrollable-table thead');
      
      if (!fixedTable || !scrollableTable) return;
      
      // Sync row heights
      const fixedRows = fixedTable.querySelectorAll('tr');
      const scrollableRows = scrollableTable.querySelectorAll('tr');
      
      // Match the number of rows
      const minRows = Math.min(fixedRows.length, scrollableRows.length);
      
      for (let i = 0; i < minRows; i++) {
        const fixedRow = fixedRows[i] as HTMLElement;
        const scrollableRow = scrollableRows[i] as HTMLElement;
        
        // Get the actual height of the scrollable row (which may have edit container)
        const scrollableHeight = scrollableRow.offsetHeight;
        
        // Set fixed row to match scrollable row height
        if (scrollableHeight > 0) {
          fixedRow.style.height = `${scrollableHeight}px`;
          fixedRow.style.minHeight = `${scrollableHeight}px`;
        }
      }
      
      // Sync header heights
      if (fixedHeader && scrollableHeader) {
        const fixedHeaderHeight = (fixedHeader as HTMLElement).offsetHeight;
        const scrollableHeaderHeight = (scrollableHeader as HTMLElement).offsetHeight;
        const maxHeaderHeight = Math.max(fixedHeaderHeight, scrollableHeaderHeight);
        
        if (maxHeaderHeight > 0) {
          (fixedHeader as HTMLElement).style.height = `${maxHeaderHeight}px`;
          (fixedHeader as HTMLElement).style.minHeight = `${maxHeaderHeight}px`;
          (scrollableHeader as HTMLElement).style.height = `${maxHeaderHeight}px`;
          (scrollableHeader as HTMLElement).style.minHeight = `${maxHeaderHeight}px`;
        }
      }
      
      // Sync column widths - ensure both tables have same cell widths
      if (scrollableRows.length > 0 && fixedRows.length > 0) {
        const firstScrollableRow = scrollableRows[0] as HTMLElement;
        const firstFixedRow = fixedRows[0] as HTMLElement;
        
        // Sync cell widths from scrollable to fixed (for consistency)
        const scrollableCells = firstScrollableRow.querySelectorAll('td');
        scrollableCells.forEach((cell, index) => {
          const cellWidth = (cell as HTMLElement).offsetWidth;
          if (cellWidth > 0 && index < fixedRows.length) {
            // Ensure corresponding cells have same width
            const fixedCell = firstFixedRow.querySelectorAll('td')[index] as HTMLElement;
            if (fixedCell) {
              fixedCell.style.width = `${cellWidth}px`;
              fixedCell.style.minWidth = `${cellWidth}px`;
              fixedCell.style.maxWidth = `${cellWidth}px`;
            }
          }
        });
      }
    };
    
    // Sync initially and whenever editing state changes
    syncTables();
    
    // Use MutationObserver to watch for DOM changes (like when edit container appears)
    const observer = new MutationObserver(() => {
      syncTables();
    });
    
    const scrollableTable = document.querySelector('.scrollable-table tbody');
    const fixedTable = document.querySelector('.fixed-table tbody');
    
    if (scrollableTable) {
      observer.observe(scrollableTable, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
      });
    }
    
    if (fixedTable) {
      observer.observe(fixedTable, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
      });
    }
    
    // Also sync on window resize
    window.addEventListener('resize', syncTables);
    
    // Sync when editing state changes
    if (editingCell || editMode) {
      setTimeout(syncTables, 100); // Small delay to allow DOM to update
    }
    
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncTables);
    };
  }, [editingCell, editMode, pivotData]); // Sync when editing state or data changes

  // Handle edit click
  const handleEditClick = (parameter: string, monthKey: string, currentValue: number) => {
    setEditingCell({ parameter, monthKey });
    setEditedValue(String(currentValue || ''));
  };

  // Handle save edit
  const handleSaveEdit = async () => {
    if (!editingCell) return;

    try {
      // Find the record(s) for this month and parameter
      const monthParts = editingCell.monthKey.split('-');
      const year = parseInt(monthParts[0]);
      const monthNum = parseInt(monthParts[1]);
      const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 
                         'July', 'August', 'September', 'October', 'November', 'December'];
      const monthName = monthNames[monthNum];

      // Find records that match the current filters and month
      const records = filteredData.filter(item => 
        item.month === monthName && item.year === year
      );

      if (records.length === 0) {
        setError('No record found for this month');
        return;
      }

      // Parse the value
      const updateValue = editingCell.parameter.includes('percentage') 
        ? parseFloat(editedValue)
        : parseFloat(editedValue);

      if (isNaN(updateValue)) {
        setError('Invalid number');
        return;
      }

      // Update all records for this month (in case of multiple records per month)
      const updatePromises = records.map(record => {
        return apiClient.patch(`/team-summary-report/${record.id}`, {
          [editingCell.parameter]: updateValue
        });
      });

      await Promise.all(updatePromises);

      // Refresh data - using same endpoint as fetch
      const response = await apiClient.get('/team-summary-report');
      if (Array.isArray(response.data)) {
        setTeamReportData(response.data as TeamReportItem[]);
        setError(null); // Clear any previous errors
      }

      setEditingCell(null);
      setEditedValue('');
    } catch (err: any) {
      console.error('Error updating record:', err);
      setError(err.response?.data?.error || err.message || 'Failed to update record');
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditedValue('');
  };

  // Generate quarter options
  const quarterOptions = useMemo(() => {
    const options: string[] = [];
    years.forEach(year => {
      options.push(`Q1(Apr-Jun) ${year}`);
      options.push(`Q2(Jul-Sep) ${year}`);
      options.push(`Q3(Oct-Dec) ${year}`);
      options.push(`Q4(Jan-Mar) ${year + 1}`); // Q4 belongs to next calendar year
    });
    return options;
  }, [years]);

  // Generate month options
  const monthOptions = useMemo(() => {
    const options: string[] = [];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    years.forEach(year => {
      monthNames.forEach(month => {
        options.push(`${month}-${year}`);
      });
    });
    return options;
  }, [years]);

  if (loading) return <div className="loading">Loading data...</div>;
  if (error && !editingCell) return <div className="error">Error: {error}</div>;
  if (teamReportData.length === 0) return <div className="empty">No records found</div>;

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
        }}>MFS Team Summary Report Data</h2>
        <div className="auth-buttons-container">
          <Link to="/team-report/compare">
            <button className="auth-button">Team Report Compare</button>
          </Link>
          <Link to="/HomePage">
            <button className="auth-button">Home</button>
          </Link>
        </div>
      </div>
      
      <div className="routing-table-container">
        <div className="table-wrapper">
          <div className="table-controls">
            <button 
              onClick={() => setEditMode(!editMode)}
              className="edit-mode-button"
            >
              {editMode ? 'Exit Edit Mode' : 'Edit Mode'}
            </button>
          </div>
          
          <div className="search-controls">
          <div className="filter-group">
            <label htmlFor="business-unit-filter">Business Unit:</label>
            <select
              id="business-unit-filter"
              value={selectedBusinessUnit}
              onChange={(e) => {
                setSelectedBusinessUnit(e.target.value);
                // Keep period filter active - don't reset it
                // Only ensure period filter is set to current FY if it's empty
                if (!periodFilter || periodFilter === '') {
                  setPeriodFilter('year');
                  setPeriodValue(String(getCurrentFYStartYear()));
                } else if (periodFilter === 'year' && (!periodValue || periodValue === '')) {
                  // If year filter is selected but no value, set to current FY
                  setPeriodValue(String(getCurrentFYStartYear()));
                }
              }}
              className="filter-select"
            >
              <option value="">All Business Units</option>
              {businessUnits.map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="period-type-filter">Period Type:</label>
            <select
              id="period-type-filter"
              value={periodFilter}
              onChange={(e) => {
                const newFilter = e.target.value;
                setPeriodFilter(newFilter);
                // If year is selected, default to current FY
                if (newFilter === 'year') {
                  setPeriodValue(String(getCurrentFYStartYear()));
                } else {
                  setPeriodValue('');
                }
              }}
              className="filter-select"
            >
              <option value="">All Periods</option>
              <option value="year">Year</option>
              <option value="quarter">Quarter</option>
              <option value="month">Month</option>
            </select>
          </div>

          {periodFilter === 'year' && (
            <div className="filter-group">
              <label htmlFor="year-filter">Year:</label>
              <select
                id="year-filter"
                value={periodValue}
                onChange={(e) => setPeriodValue(e.target.value)}
                className="filter-select"
              >
                <option value="">Select Year</option>
                {years.map(year => (
                  <option key={year} value={String(year)}>{year}</option>
                ))}
              </select>
            </div>
          )}

          {periodFilter === 'quarter' && (
            <div className="filter-group">
              <label htmlFor="quarter-filter">Quarter:</label>
              <select
                id="quarter-filter"
                value={periodValue}
                onChange={(e) => setPeriodValue(e.target.value)}
                className="filter-select"
              >
                <option value="">Select Quarter</option>
                {quarterOptions.map(quarter => (
                  <option key={quarter} value={quarter}>{quarter}</option>
                ))}
              </select>
            </div>
          )}

          {periodFilter === 'month' && (
            <div className="filter-group">
              <label htmlFor="month-filter">Month:</label>
              <select
                id="month-filter"
                value={periodValue}
                onChange={(e) => setPeriodValue(e.target.value)}
                className="filter-select"
              >
                <option value="">Select Month</option>
                {monthOptions.map(month => (
                  <option key={month} value={month}>{month}</option>
                ))}
              </select>
            </div>
          )}
          </div>
          
          <div className="split-table-container">
            {/* Fixed Parameter Column Table */}
            <div className="fixed-column-table">
              <table className="pivot-table fixed-table">
                <thead>
                  <tr>
                    <th className="parameter-header">Parameter</th>
                  </tr>
                </thead>
                <tbody>
                  {pivotData.map((paramData) => (
                    <tr key={paramData.parameter}>
                      <td className="parameter-cell">{paramData.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Scrollable Data Columns Table */}
            <div className="scrollable-columns-table">
              <table className="pivot-table scrollable-table">
                <thead>
                  <tr>
                    {months.map(monthKey => {
                      const [year, monthNum] = monthKey.split('-');
                      const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                      const monthName = monthNames[parseInt(monthNum)];
                      return (
                        <th key={monthKey} className="month-header">
                          {monthName} {year}
                        </th>
                      );
                    })}
                    <th className="total-header">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {pivotData.map((paramData) => (
                    <tr key={paramData.parameter}>
                      {months.map(monthKey => {
                        const cellData = paramData.values[monthKey];
                        const isEditing = editingCell?.parameter === paramData.parameter && 
                                         editingCell?.monthKey === monthKey;
                        
                        return (
                          <td key={monthKey} className="data-cell">
                            {isEditing ? (
                              <div className="edit-container">
                                <input
                                  type="text"
                                  value={editedValue}
                                  onChange={(e) => setEditedValue(e.target.value)}
                                  className="edit-input"
                                  autoFocus
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
                                <span>{cellData ? formatValue(cellData.value, paramData.parameter) : 'N/A'}</span>
                                {editMode && (
                                  <button
                                    onClick={() => handleEditClick(paramData.parameter, monthKey, cellData?.value || 0)}
                                    className="edit-pen-button"
                                    title="Edit"
                                  >
                                    ✏️
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className="data-cell parameter-total-cell">
                        {(() => {
                          // Calculate total for this parameter across all months
                          let paramTotal = 0;
                          months.forEach(monthKey => {
                            const cellData = paramData.values[monthKey];
                            if (cellData && !isNaN(cellData.value)) {
                              paramTotal += cellData.value;
                            }
                          });
                          return formatValue(paramTotal, paramData.parameter);
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MFSdata;
