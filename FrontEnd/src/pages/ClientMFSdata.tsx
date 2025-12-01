import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Select } from 'antd';
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

const ClientMFSdata: React.FC = () => {
  const [teamReportData, setTeamReportData] = useState<TeamReportItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string>('');
  const [selectedClientName, setSelectedClientName] = useState<string>('');
  const [periodFilter, setPeriodFilter] = useState<string>(''); // 'year', 'quarter', or 'month'
  const [periodValue, setPeriodValue] = useState<string>(''); // The actual year/quarter/month value
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]); // Multiple month selection
  const [selectedParameters, setSelectedParameters] = useState<string[]>([]); // Multiple parameter selection
  const [editingCell, setEditingCell] = useState<{ parameter: string; monthKey: string; clientName?: string } | null>(null);
  const [editedValue, setEditedValue] = useState<string>('');
  const [editMode, setEditMode] = useState<boolean>(false);

  const navigate = useNavigate();

  // Define all available parameters
  const allParameters = [
    { key: 'hc', label: 'HC' },
    { key: 'revenue', label: 'Revenue' },
    { key: 'salary_cost', label: 'Salary Cost' },
    { key: 'gpm', label: 'GPM' },
    { key: 'gpm_percentage', label: 'GPM %' },
    { key: 'np', label: 'NP' },
    { key: 'np_percentage', label: 'NP %' },
    { key: 'leave_encashment', label: 'Leave Encashment' },
    { key: 'team_cost', label: 'Team Cost' },
    { key: 'opr_cost', label: 'Opr Cost' },
    { key: 'funding_cost', label: 'Funding Cost' },
    { key: 'rebate', label: 'Rebate' },
    { key: 'passthrough', label: 'Passthrough' }
  ];

  // Get selected parameters or default to all
  const parameters = useMemo(() => {
    if (selectedParameters.length === 0) {
      return allParameters;
    }
    return allParameters.filter(p => selectedParameters.includes(p.key));
  }, [selectedParameters]);

  // Fetch data from API - using team-report endpoint (same as ClientMFSCompare)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await apiClient.get('/team-report');
        
        if (!Array.isArray(response.data)) {
          throw new Error("Data is not an array");
        }

        if (response.data.length > 0) {
          console.log('Sample team report data:', response.data[0]);
          console.log('Total records:', response.data.length);
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

  // Get unique business units
  const businessUnits = useMemo(() => {
    const units = new Set<string>();
    teamReportData.forEach(item => {
      if (item.business_unit) {
        units.add(item.business_unit);
      }
    });
    return Array.from(units).sort();
  }, [teamReportData]);

  // Get unique client names (filtered by business unit if selected)
  const clientNames = useMemo(() => {
    const clients = new Set<string>();
    teamReportData.forEach(item => {
      if (item.client_name && (!selectedBusinessUnit || item.business_unit === selectedBusinessUnit)) {
        clients.add(item.client_name);
      }
    });
    return Array.from(clients).sort();
  }, [teamReportData, selectedBusinessUnit]);

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

  // Helper to extract month from various formats (date string, month name, etc.)
  const extractMonthFromValue = (monthValue: any): string => {
    if (!monthValue) return '';
    
    if (typeof monthValue === 'string') {
      // Check if it's a date string (ISO format like "2025-08-01T00:00:00.000Z" or "2025-08-01" or "2025-08-01t00:00:00.000z")
      const dateMatch = monthValue.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?(?:[Tt].*)?$/);
      if (dateMatch) {
        const monthNum = parseInt(dateMatch[2]);
        const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];
        if (monthNum >= 1 && monthNum <= 12) {
          return monthNames[monthNum];
        }
      }
      
      const date = new Date(monthValue);
      if (!isNaN(date.getTime())) {
        const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];
        return monthNames[date.getMonth() + 1];
      }
      
      return monthValue;
    }
    
    if (monthValue instanceof Date) {
      const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                         'July', 'August', 'September', 'October', 'November', 'December'];
      return monthNames[monthValue.getMonth() + 1];
    }
    
    return String(monthValue);
  };

  // Helper to normalize month name to full name (handles both full names and abbreviations)
  const normalizeToFullMonthName = (monthName: any): string => {
    const extractedMonth = extractMonthFromValue(monthName);
    if (!extractedMonth) return '';
    
    const normalized = extractedMonth.charAt(0).toUpperCase() + extractedMonth.slice(1).toLowerCase();
    
    const abbreviationMap: { [key: string]: string } = {
      'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April',
      'May': 'May', 'Jun': 'June', 'Jul': 'July', 'Aug': 'August',
      'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December'
    };
    
    if (abbreviationMap[normalized]) {
      return abbreviationMap[normalized];
    }
    
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
    const fullMonthName = normalizeToFullMonthName(month);
    const monthNum = getMonthNumber(fullMonthName);
    if (monthNum === 0) {
      console.warn('Invalid month name:', month);
    }
    return `${year}-${String(monthNum).padStart(2, '0')}`;
  };

  // Filter data based on business unit, client name, and period
  const filteredData = useMemo(() => {
    let filtered = [...teamReportData];

    if (selectedBusinessUnit) {
      filtered = filtered.filter(item => item.business_unit === selectedBusinessUnit);
    }

    if (selectedClientName) {
      filtered = filtered.filter(item => item.client_name === selectedClientName);
    }

    // Filter by period
    if (periodFilter && periodValue) {
      if (periodFilter === 'year') {
        const year = parseInt(periodValue);
        filtered = filtered.filter(item => item.year === year);
      } else if (periodFilter === 'quarter') {
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
            const normalizedMonth = normalizeToFullMonthName(item.month);
            if (quarter === 4) {
              return monthsInQuarter.includes(normalizedMonth) && item.year === year + 1;
            } else {
              return monthsInQuarter.includes(normalizedMonth) && item.year === year;
            }
          });
        }
      } else if (periodFilter === 'month' && selectedMonths.length === 0) {
        // Single month filter (when no multiple months selected)
        const parts = periodValue.split('-');
        if (parts.length === 2) {
          const monthName = parts[0];
          const year = parseInt(parts[1]);
          const normalizedMonthName = normalizeToFullMonthName(monthName);
          filtered = filtered.filter(item => {
            if (!item.month || !item.year) return false;
            const normalizedItemMonth = normalizeToFullMonthName(item.month);
            return normalizedItemMonth === normalizedMonthName && item.year === year;
          });
        }
      }
    }

    // Filter by selected months if multiple months are selected
    if (selectedMonths.length > 0) {
      const monthKeys = selectedMonths.map(monthStr => {
        const parts = monthStr.split(' ');
        const monthName = parts[0];
        const year = parseInt(parts[1]);
        const monthNames: { [key: string]: number } = {
          'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
          'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
        };
        const monthNum = monthNames[monthName] || 1;
        return `${year}-${String(monthNum).padStart(2, '0')}`;
      });

      filtered = filtered.filter(item => {
        if (!item.month || !item.year) return false;
        const fullMonthName = normalizeToFullMonthName(item.month);
        const monthKey = getMonthKey(fullMonthName, item.year);
        return monthKeys.includes(monthKey);
      });
    }

    return filtered;
  }, [teamReportData, selectedBusinessUnit, selectedClientName, periodFilter, periodValue, selectedMonths]);

  // Get available months for multi-select
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    filteredData.forEach(item => {
      if (item.month && item.year) {
        const fullMonthName = normalizeToFullMonthName(item.month);
        const monthKey = getMonthKey(fullMonthName, item.year);
        const [year, monthNum] = monthKey.split('-');
        const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthName = monthNames[parseInt(monthNum)];
        monthSet.add(`${monthName} ${year}`);
      }
    });
    return Array.from(monthSet).sort();
  }, [filteredData]);

  // Get months to display
  const months = useMemo(() => {
    if (selectedMonths.length > 0) {
      return selectedMonths.map(monthStr => {
        const parts = monthStr.split(' ');
        const monthName = parts[0];
        const year = parseInt(parts[1]);
        const monthNames: { [key: string]: number } = {
          'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
          'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
        };
        const monthNum = monthNames[monthName] || 1;
        return `${year}-${String(monthNum).padStart(2, '0')}`;
      });
    }
    
    if (periodFilter === 'year' && periodValue) {
      const year = parseInt(periodValue);
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                         'July', 'August', 'September', 'October', 'November', 'December'];
      return monthNames.map(month => getMonthKey(month, year));
    }
    
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
        const displayYear = quarter === 4 ? year + 1 : year;
        return monthsInQuarter.map(month => getMonthKey(month, displayYear));
      }
    }
    
    if (periodFilter === 'month' && periodValue && selectedMonths.length === 0) {
      const parts = periodValue.split('-');
      if (parts.length === 2) {
        const monthName = parts[0];
        const year = parseInt(parts[1]);
        return [getMonthKey(monthName, year)];
      }
    }
    
    const monthSet = new Set<string>();
    filteredData.forEach(item => {
      if (item.month && item.year) {
        const fullMonthName = normalizeToFullMonthName(item.month);
        monthSet.add(getMonthKey(fullMonthName, item.year));
      }
    });
    return Array.from(monthSet).sort();
  }, [filteredData, periodFilter, periodValue, selectedMonths]);

  // Get unique clients from filtered data
  const clients = useMemo(() => {
    if (!selectedBusinessUnit) {
      return [];
    }
    const clientSet = new Set<string>();
    filteredData.forEach(item => {
      if (item.client_name && item.business_unit === selectedBusinessUnit) {
        clientSet.add(item.client_name);
      }
    });
    return Array.from(clientSet).sort();
  }, [filteredData, selectedBusinessUnit]);

  // Build data structure: clients as rows, parameters as columns
  const tableData = useMemo(() => {
    if (!selectedBusinessUnit || clients.length === 0) {
      return [];
    }

    const clientsToShow = selectedClientName ? [selectedClientName] : clients;
    
    return clientsToShow.map(client => {
      const clientData = filteredData.filter(item => item.client_name === client);
      const clientRow: { client: string; [key: string]: any } = { client };
      
      // For each parameter and month combination
      parameters.forEach(param => {
        months.forEach(monthKey => {
          let totalValue = 0;
          
          clientData.forEach(item => {
            if (item.month && item.year) {
              const fullMonthName = normalizeToFullMonthName(item.month);
              const itemMonthKey = getMonthKey(fullMonthName, item.year);
              
              if (itemMonthKey === monthKey) {
                const paramValue = item[param.key];
                if (paramValue !== null && paramValue !== undefined && paramValue !== '') {
                  const numValue = typeof paramValue === 'string' ? parseFloat(paramValue) : paramValue;
                  if (!isNaN(numValue)) {
                    totalValue += numValue;
                  }
                }
              }
            }
          });
          
          // Create key: parameter_monthKey (e.g., "hc_2025-01")
          const cellKey = `${param.key}_${monthKey}`;
          clientRow[cellKey] = totalValue;
        });
      });
      
      return clientRow;
    });
  }, [filteredData, selectedBusinessUnit, selectedClientName, clients, parameters, months]);

  // Format value for display
  const formatValue = (value: number, parameter: string): string => {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    
    if (parameter.includes('percentage') || parameter.includes('_percentage')) {
      return `${value.toFixed(2)}%`;
    }
    
    return Math.round(value).toLocaleString('en-IN');
  };

  // Handle edit click
  const handleEditClick = (parameter: string, monthKey: string, currentValue: number, clientName?: string) => {
    setEditingCell({ parameter, monthKey, clientName });
    setEditedValue(String(currentValue || ''));
  };

  // Handle save edit
  const handleSaveEdit = async () => {
    if (!editingCell) return;

    try {
      const monthParts = editingCell.monthKey.split('-');
      const year = parseInt(monthParts[0]);
      const monthNum = parseInt(monthParts[1]);
      const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 
                         'July', 'August', 'September', 'October', 'November', 'December'];
      const monthName = monthNames[monthNum];

      let records = filteredData.filter(item => 
        item.month === monthName && item.year === year
      );

      if (editingCell.clientName) {
        records = records.filter(item => item.client_name === editingCell.clientName);
      }

      if (records.length === 0) {
        setError('No record found for this month');
        return;
      }

      const updateValue = editingCell.parameter.includes('percentage') 
        ? parseFloat(editedValue)
        : parseFloat(editedValue);

      if (isNaN(updateValue)) {
        setError('Invalid number');
        return;
      }

      const updatePromises = records.map(record => {
        return apiClient.patch(`/team-report/${record.id}`, {
          [editingCell.parameter]: updateValue
        });
      });

      await Promise.all(updatePromises);

      const response = await apiClient.get('/team-report');
      if (Array.isArray(response.data)) {
        setTeamReportData(response.data as TeamReportItem[]);
        setError(null);
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
      options.push(`Q4(Jan-Mar) ${year + 1}`);
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
        }}>Client MFS Team Report Data</h2>
        <div className="auth-buttons-container">
          <Link to="/client-mfs/compare">
            <button className="auth-button">Client MFS Compare</button>
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
                  setSelectedClientName('');
                  setPeriodFilter('');
                  setPeriodValue('');
                  setSelectedMonths([]);
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
              <label htmlFor="client-name-filter">Client Name:</label>
              <select
                id="client-name-filter"
                value={selectedClientName}
                onChange={(e) => {
                  setSelectedClientName(e.target.value);
                }}
                className="filter-select"
                disabled={!selectedBusinessUnit}
              >
                <option value="">All Clients</option>
                {clientNames.map(client => (
                  <option key={client} value={client}>{client}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="parameter-filter">Parameters:</label>
              <Select
                mode="multiple"
                value={selectedParameters}
                onChange={(values) => setSelectedParameters(values)}
                placeholder="Select Parameters"
                style={{ width: '100%', minWidth: '200px' }}
                allowClear
              >
                {allParameters.map(param => (
                  <Select.Option key={param.key} value={param.key}>{param.label}</Select.Option>
                ))}
              </Select>
            </div>

            <div className="filter-group">
              <label htmlFor="period-type-filter">Period Type:</label>
              <select
                id="period-type-filter"
                value={periodFilter}
                onChange={(e) => {
                  setPeriodFilter(e.target.value);
                  setPeriodValue('');
                  setSelectedMonths([]);
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
                <label htmlFor="month-multi-filter">Months:</label>
                <Select
                  mode="multiple"
                  value={selectedMonths}
                  onChange={(values) => {
                    setSelectedMonths(values);
                    if (values.length > 0) {
                      setPeriodValue('');
                    }
                  }}
                  placeholder="Select Months"
                  style={{ width: '100%', minWidth: '200px' }}
                  allowClear
                >
                  {availableMonths.map(month => (
                    <Select.Option key={month} value={month}>{month}</Select.Option>
                  ))}
                </Select>
              </div>
            )}
          </div>
          
          {selectedBusinessUnit && tableData.length > 0 ? (
            <table className="pivot-table">
              <thead>
                <tr>
                  <th className="parameter-header" rowSpan={parameters.length > 1 ? 2 : 1}>LOB</th>
                  {months.map(monthKey => {
                    const [year, monthNum] = monthKey.split('-');
                    const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const monthName = monthNames[parseInt(monthNum)];
                    return (
                      <th key={monthKey} className="month-header" colSpan={parameters.length}>
                        {monthName} {year}
                      </th>
                    );
                  })}
                </tr>
                {parameters.length > 1 ? (
                  <tr>
                    {months.map(monthKey => 
                      parameters.map(param => (
                        <th key={`${monthKey}_${param.key}`} className="month-header">
                          {param.label}
                        </th>
                      ))
                    )}
                  </tr>
                ) : null}
              </thead>
              <tbody>
                {tableData.map((row, rowIndex) => (
                  <tr key={row.client}>
                    <td className="parameter-cell">{row.client}</td>
                    {months.map(monthKey => 
                      parameters.map(param => {
                        const cellKey = `${param.key}_${monthKey}`;
                        const cellValue = row[cellKey] || 0;
                        const isEditing = editingCell?.parameter === param.key && 
                                         editingCell?.monthKey === monthKey &&
                                         editingCell?.clientName === row.client;
                        
                        return (
                          <td key={`${monthKey}_${param.key}`} className="data-cell">
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
                                <span>{formatValue(cellValue, param.key)}</span>
                                {editMode && (
                                  <button
                                    onClick={() => handleEditClick(param.key, monthKey, cellValue, row.client)}
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
                      })
                    )}
                  </tr>
                ))}
                {/* Total Row */}
                <tr className="total-row">
                  <td className="parameter-cell total-label">Total</td>
                  {months.map(monthKey => 
                    parameters.map(param => {
                      const cellKey = `${param.key}_${monthKey}`;
                      let totalValue = 0;
                      tableData.forEach(row => {
                        const value = row[cellKey] || 0;
                        if (!isNaN(value)) {
                          totalValue += value;
                        }
                      });
                      
                      return (
                        <td key={`total_${monthKey}_${param.key}`} className="data-cell total-cell">
                          {formatValue(totalValue, param.key)}
                        </td>
                      );
                    })
                  )}
                </tr>
              </tbody>
            </table>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
              {!selectedBusinessUnit ? 'Please select a Business Unit to view data' : 'No data available for the selected filters'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientMFSdata;
