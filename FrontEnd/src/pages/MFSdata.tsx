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
  const [teamReportData, setTeamReportData] = useState<TeamReportItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string>('');
  const [periodFilter, setPeriodFilter] = useState<string>(''); // 'year', 'quarter', or 'month'
  const [periodValue, setPeriodValue] = useState<string>(''); // The actual year/quarter/month value
  const [editingCell, setEditingCell] = useState<{ parameter: string; monthKey: string } | null>(null);
  const [editedValue, setEditedValue] = useState<string>('');

  const navigate = useNavigate();

  // Define parameters to display
  const parameters = [
    { key: 'hc', label: 'HC' },
    { key: 'revenue', label: 'Revenue' },
    { key: 'gpm', label: 'GPM' },
    { key: 'gpm_percentage', label: 'GPM %' },
    { key: 'np', label: 'Net Margin' },
    { key: 'np_percentage', label: 'Net Margin %' }
  ];

  // Fetch data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await apiClient.get('/team-report');
        
        if (!Array.isArray(response.data)) {
          throw new Error("Data is not an array");
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

  // Helper to get month number from month name
  const getMonthNumber = (monthName: string): number => {
    const months: { [key: string]: number } = {
      'January': 1, 'February': 2, 'March': 3, 'April': 4, 'May': 5, 'June': 6,
      'July': 7, 'August': 8, 'September': 9, 'October': 10, 'November': 11, 'December': 12
    };
    return months[monthName] || 0;
  };

  // Helper to format month key
  const getMonthKey = (month: string, year: number): string => {
    const monthNum = getMonthNumber(month);
    return `${year}-${String(monthNum).padStart(2, '0')}`;
  };

  // Filter data based on business unit and period
  const filteredData = useMemo(() => {
    let filtered = [...teamReportData];

    // Filter by business unit
    if (selectedBusinessUnit) {
      filtered = filtered.filter(item => item.business_unit === selectedBusinessUnit);
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
          const quarterMonths: { [key: number]: number[] } = {
            1: [4, 5, 6],   // Apr, May, Jun
            2: [7, 8, 9],   // Jul, Aug, Sep
            3: [10, 11, 12], // Oct, Nov, Dec
            4: [1, 2, 3]    // Jan, Feb, Mar
          };
          const monthsInQuarter = quarterMonths[quarter] || [];
          filtered = filtered.filter(item => {
            if (!item.month || !item.year) return false;
            const monthNum = getMonthNumber(item.month);
            // Handle Q4 which spans across years
            if (quarter === 4) {
              return monthsInQuarter.includes(monthNum) && item.year === year + 1;
            } else {
              return monthsInQuarter.includes(monthNum) && item.year === year;
            }
          });
        }
      } else if (periodFilter === 'month') {
        // Parse month (format: "January-2025" or "Jan-2025")
        const parts = periodValue.split('-');
        if (parts.length === 2) {
          const monthName = parts[0];
          const year = parseInt(parts[1]);
          filtered = filtered.filter(item => 
            item.month === monthName && item.year === year
          );
        }
      }
    }

    return filtered;
  }, [teamReportData, selectedBusinessUnit, periodFilter, periodValue]);

  // Get unique months from filtered data
  const months = useMemo(() => {
    const monthSet = new Set<string>();
    filteredData.forEach(item => {
      if (item.month && item.year) {
        monthSet.add(getMonthKey(item.month, item.year));
      }
    });
    return Array.from(monthSet).sort();
  }, [filteredData]);

  // Build pivot table data
  const pivotData = useMemo(() => {
    const data: ParameterData[] = parameters.map(param => {
      const values: { [monthKey: string]: { value: number; id: number; record: TeamReportItem } } = {};
      
      filteredData.forEach(item => {
        if (item.month && item.year) {
          const monthKey = getMonthKey(item.month, item.year);
          const paramValue = item[param.key];
          
          if (paramValue !== null && paramValue !== undefined) {
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
    
    return data;
  }, [filteredData, parameters]);

  // Format value for display
  const formatValue = (value: number, parameter: string): string => {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    
    if (parameter.includes('percentage') || parameter.includes('_percentage')) {
      return `${value.toFixed(2)}%`;
    }
    
    return Math.round(value).toLocaleString('en-IN');
  };

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
        return apiClient.patch(`/team-report/${record.id}`, {
          [editingCell.parameter]: updateValue
        });
      });

      await Promise.all(updatePromises);

      // Refresh data
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
        <div className="search-controls">
          <div className="filter-group">
            <label htmlFor="business-unit-filter">Business Unit:</label>
            <select
              id="business-unit-filter"
              value={selectedBusinessUnit}
              onChange={(e) => {
                setSelectedBusinessUnit(e.target.value);
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
        
        <div className="table-wrapper">
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
              </tr>
            </thead>
            <tbody>
              {pivotData.map((paramData) => (
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
                            <button
                              onClick={() => handleEditClick(paramData.parameter, monthKey, cellData?.value || 0)}
                              className="edit-pen-button"
                              title="Edit"
                            >
                              ✏️
                            </button>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MFSdata;
