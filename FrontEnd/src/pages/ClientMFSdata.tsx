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

const ClientMFSdata: React.FC = () => {
  const [teamReportData, setTeamReportData] = useState<TeamReportItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string>('');
  const [selectedClientName, setSelectedClientName] = useState<string>('');
  const [periodFilter, setPeriodFilter] = useState<string>(''); // 'year', 'quarter', or 'month'
  const [periodValue, setPeriodValue] = useState<string>(''); // The actual year/quarter/month value
  const [editingCell, setEditingCell] = useState<{ parameter: string; monthKey: string; clientName?: string } | null>(null);
  const [editedValue, setEditedValue] = useState<string>('');
  const [editMode, setEditMode] = useState<boolean>(false);

  const navigate = useNavigate();

  // Define parameters to display - matching team_report table structure
  const parameters = [
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

  // Fetch data from API - using team-report endpoint (same as ClientMFSCompare)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await apiClient.get('/team-report');
        
        if (!Array.isArray(response.data)) {
          throw new Error("Data is not an array");
        }

        // Debug: Log sample data to see structure
        if (response.data.length > 0) {
          console.log('Sample team report data:', response.data[0]);
          console.log('Total records:', response.data.length);
          console.log('Sample month values:', response.data.slice(0, 5).map((item: any) => ({ month: item.month, year: item.year, client_name: item.client_name })));
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

  // Filter data based on business unit, client name, and period
  const filteredData = useMemo(() => {
    let filtered = [...teamReportData];

    // Filter by business unit
    if (selectedBusinessUnit) {
      filtered = filtered.filter(item => item.business_unit === selectedBusinessUnit);
    }

    // Filter by client name
    if (selectedClientName) {
      filtered = filtered.filter(item => item.client_name === selectedClientName);
    }

    // Filter by period
    if (periodFilter && periodValue) {
      if (periodFilter === 'year') {
        const year = parseInt(periodValue);
        filtered = filtered.filter(item => item.year === year);
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
  }, [teamReportData, selectedBusinessUnit, selectedClientName, periodFilter, periodValue]);

  // Get unique months from filtered data
  const months = useMemo(() => {
    // If year filter is selected, show all 12 months of that year
    if (periodFilter === 'year' && periodValue) {
      const year = parseInt(periodValue);
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                         'July', 'August', 'September', 'October', 'November', 'December'];
      return monthNames.map(month => getMonthKey(month, year));
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

  // Get unique clients from filtered data (for grouping)
  const clients = useMemo(() => {
    if (!selectedBusinessUnit) {
      // If no business unit selected, show all clients
      const clientSet = new Set<string>();
      filteredData.forEach(item => {
        if (item.client_name) {
          clientSet.add(item.client_name);
        }
      });
      return Array.from(clientSet).sort();
    } else {
      // If business unit selected, group by client
      const clientSet = new Set<string>();
      filteredData.forEach(item => {
        if (item.client_name && item.business_unit === selectedBusinessUnit) {
          clientSet.add(item.client_name);
        }
      });
      return Array.from(clientSet).sort();
    }
  }, [filteredData, selectedBusinessUnit]);

  // Build pivot table data - grouped by client if business unit is selected
  const pivotData = useMemo(() => {
    // Debug: Log filtering state
    console.log('🔍 ClientMFSdata Pivot Data Debug:', {
      selectedBusinessUnit,
      selectedClientName,
      clientsCount: clients.length,
      clients: clients.slice(0, 5),
      filteredDataCount: filteredData.length,
      sampleFilteredData: filteredData.slice(0, 3).map(item => ({
        client_name: item.client_name,
        business_unit: item.business_unit,
        month: item.month,
        year: item.year,
        revenue: item.revenue,
        hc: item.hc
      })),
      monthsCount: months.length,
      months: months.slice(0, 5)
    });

    // If business unit is selected, group by client
    if (selectedBusinessUnit && clients.length > 0) {
      const data: { client: string; parameters: ParameterData[] }[] = [];
      
      // If client name is also selected, only show that client
      const clientsToShow = selectedClientName ? [selectedClientName] : clients;
      
      if (clientsToShow.length === 0) {
        // No clients found, return empty grouped data
        return { grouped: true, data: [] };
      }
      
      clientsToShow.forEach(client => {
        const clientData = filteredData.filter(item => item.client_name === client);
        
        // Debug: Log client data
        if (client === clientsToShow[0]) {
          console.log(`🔍 Processing client "${client}":`, {
            clientDataCount: clientData.length,
            sampleClientData: clientData.slice(0, 3).map(item => ({
              month: item.month,
              year: item.year,
              revenue: item.revenue,
              hc: item.hc
            }))
          });
        }
        
        const paramData: ParameterData[] = parameters.map(param => {
          const values: { [monthKey: string]: { value: number; id: number; record: TeamReportItem } } = {};
          
          clientData.forEach(item => {
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
          
          // Debug: Log parameter values for first parameter of first client
          if (client === clientsToShow[0] && param.key === parameters[0].key) {
            console.log(`🔍 Parameter "${param.key}" values:`, Object.keys(values).map(key => ({
              monthKey: key,
              value: values[key].value
            })));
          }
          
          return {
            parameter: param.key,
            label: param.label,
            values
          };
        });
        
        data.push({ client, parameters: paramData });
      });
      
      return { grouped: true, data };
    } else {
      // No business unit selected, show aggregated data
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
      
      return { grouped: false, data };
    }
  }, [filteredData, parameters, selectedBusinessUnit, clients]);

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
      // Find the record(s) for this month and parameter
      const monthParts = editingCell.monthKey.split('-');
      const year = parseInt(monthParts[0]);
      const monthNum = parseInt(monthParts[1]);
      const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 
                         'July', 'August', 'September', 'October', 'November', 'December'];
      const monthName = monthNames[monthNum];

      // Find records that match the current filters and month
      let records = filteredData.filter(item => 
        item.month === monthName && item.year === year
      );

      // If client name is specified in editing cell, filter by it
      if (editingCell.clientName) {
        records = records.filter(item => item.client_name === editingCell.clientName);
      }

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
        return apiClient.patch(`/team-report/${record.id}`, {
          [editingCell.parameter]: updateValue
        });
      });

      await Promise.all(updatePromises);

      // Refresh data - using same endpoint as fetch
      const response = await apiClient.get('/team-report');
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

  const isGrouped = pivotData.grouped;
  const dataToRender = isGrouped ? (pivotData as { grouped: true; data: { client: string; parameters: ParameterData[] }[] }).data : 
                                   (pivotData as { grouped: false; data: ParameterData[] }).data;

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
                  setSelectedClientName(''); // Reset client when BU changes
                  setPeriodFilter('');
                  setPeriodValue('');
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
              <label htmlFor="period-type-filter">Period Type:</label>
              <select
                id="period-type-filter"
                value={periodFilter}
                onChange={(e) => {
                  setPeriodFilter(e.target.value);
                  setPeriodValue('');
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
          
          {isGrouped ? (
            // Render grouped by client
            (dataToRender as { client: string; parameters: ParameterData[] }[]).map((clientGroup, groupIndex) => (
              <div key={clientGroup.client} style={{ marginBottom: '2rem' }}>
                <h3 style={{ 
                  marginBottom: '1rem', 
                  padding: '0.5rem 1rem',
                  backgroundColor: '#000000',
                  color: '#ffffff',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: 700
                }}>
                  {clientGroup.client}
                </h3>
                <table className="pivot-table">
                  <thead>
                    <tr>
                      <th className="parameter-header">Parameter</th>
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
                    {clientGroup.parameters.map((paramData) => (
                      <tr key={paramData.parameter}>
                        <td className="parameter-cell">{paramData.label}</td>
                        {months.map(monthKey => {
                          const cellData = paramData.values[monthKey];
                          const isEditing = editingCell?.parameter === paramData.parameter && 
                                           editingCell?.monthKey === monthKey &&
                                           editingCell?.clientName === clientGroup.client;
                          
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
                                      onClick={() => handleEditClick(paramData.parameter, monthKey, cellData?.value || 0, clientGroup.client)}
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
            ))
          ) : (
            // Render aggregated (no grouping)
            <table className="pivot-table">
              <thead>
                <tr>
                  <th className="parameter-header">Parameter</th>
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
                {(dataToRender as ParameterData[]).map((paramData) => (
                  <tr key={paramData.parameter}>
                    <td className="parameter-cell">{paramData.label}</td>
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
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientMFSdata;

