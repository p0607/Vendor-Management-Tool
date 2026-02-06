import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Select } from 'antd';
import './MFSdata.css';
import { compareBusinessUnits, normalizeBusinessUnitName } from '../utils/businessUnitUtils';
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
  const [clientMFSData, setClientMFSData] = useState<TeamReportItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingClientMFS, setLoadingClientMFS] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string>('');
  // Set default to current FY (year filter showing FY data)
  const [periodFilter, setPeriodFilter] = useState<string>('year'); // 'year', 'quarter', or 'month'
  const [periodValue, setPeriodValue] = useState<string>(String(getCurrentFYStartYear())); // Default to current FY start year
  const [editingCell, setEditingCell] = useState<{
    parameter: string;
    monthKey: string;
    table?: 'summary' | 'client';
    clientName?: string;
    projectName?: string;
  } | null>(null);
  const [editedValue, setEditedValue] = useState<string>('');
  const [editMode, setEditMode] = useState<boolean>(false);
  const [clientSelectedClient, setClientSelectedClient] = useState<string>('');
  const [clientSelectedProject, setClientSelectedProject] = useState<string>('');
  const [clientSelectedParameters, setClientSelectedParameters] = useState<string[]>([]);
  const [user, setUser] = useState<any>({});
  const [isBUHead, setIsBUHead] = useState<boolean>(false);

  const navigate = useNavigate();

  // Define parameters to display - matching team_summary_report table structure
  const parameters = [
    { key: 'hc', label: 'HC' },
    { key: 'revenue', label: 'Revenue' },
    { key: 'gpm', label: 'GPM' },
    { key: 'team_cost', label: 'Team Cost' },
    { key: 'net_margin', label: 'Net Margin' }
  ];

  // Client-wise table: same parameters as Client MFS Team Report Data page (/team-report)
  const clientTableParameters = [
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

  // Fetch client-wise MFS data from /team-report (has client_name, project_name)
  useEffect(() => {
    const fetchClientData = async () => {
      setLoadingClientMFS(true);
      try {
        const response = await apiClient.get('/team-report');
        if (Array.isArray(response.data)) {
          setClientMFSData(response.data as TeamReportItem[]);
        } else {
          setClientMFSData([]);
        }
      } catch (err: any) {
        console.error('Fetch client MFS failed:', err);
        setClientMFSData([]);
      } finally {
        setLoadingClientMFS(false);
      }
    };
    fetchClientData();
  }, []);

  // Reset client/project selection when Business Unit changes (e.g. from top filters)
  useEffect(() => {
    setClientSelectedClient('');
    setClientSelectedProject('');
  }, [selectedBusinessUnit]);

  // Check user authentication and set BU head status
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");
      if (storedUser && storedUser !== "undefined") {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        
        const userIsBUHead = parsedUser?.designation === 'BU HEAD';
        setIsBUHead(userIsBUHead);
        
        // Auto-select business unit for BU head
        if (userIsBUHead && parsedUser.business_unit) {
          const normalizedBU = normalizeBusinessUnitName(parsedUser.business_unit);
          setSelectedBusinessUnit(normalizedBU || parsedUser.business_unit);
        }
      }
    } catch (error) {
      console.error("Failed to parse user data:", error);
    }
  }, []);

  // Use centralized normalizeBusinessUnitName function (imported from utils)

  // Get unique business units (normalized to handle case differences)
  const businessUnits = useMemo(() => {
    const unitsSet = new Set<string>();
    teamReportData.forEach(item => {
      if (item.business_unit) {
        const normalized = normalizeBusinessUnitName(item.business_unit);
        if (normalized) {
          unitsSet.add(normalized);
        }
      }
    });
    return Array.from(unitsSet).sort();
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

    // Filter by business unit (case-insensitive comparison)
    if (selectedBusinessUnit) {
      filtered = filtered.filter(item => {
        return compareBusinessUnits(item.business_unit, selectedBusinessUnit);
      });
    }

    // BU head filter - ensure BU head only sees their business unit's data
    if (isBUHead && user?.business_unit) {
      filtered = filtered.filter(item => {
        return compareBusinessUnits(item.business_unit, user.business_unit);
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

  // Helper to get month name and year from team_report item (month can be date string or name)
  const getItemMonthYear = (item: TeamReportItem): { monthName: string; year: number } | null => {
    if (!item.month || item.year == null) return null;
    const m = item.month;
    const y = Number(item.year);
    if (typeof m === 'string' && /^\d{4}-\d{1,2}-\d{1,2}/.test(m)) {
      const parts = m.split('-');
      const monthNum = parseInt(parts[1], 10);
      const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      return { monthName: monthNames[monthNum] || '', year: y || parseInt(parts[0], 10) };
    }
    return { monthName: normalizeToFullMonthName(String(m)), year: y };
  };

  // Filter client MFS data by selected BU and period (same logic as main table)
  const filteredClientMFSData = useMemo(() => {
    let filtered = clientMFSData.filter(item => {
      if (selectedBusinessUnit && !compareBusinessUnits(item.business_unit, selectedBusinessUnit)) return false;
      if (isBUHead && user?.business_unit && !compareBusinessUnits(item.business_unit, user.business_unit)) return false;
      return true;
    });
    if (!periodFilter || !periodValue) return filtered;
    if (periodFilter === 'year') {
      const fyStartYear = parseInt(periodValue);
      const fyEndYear = fyStartYear + 1;
      const fyStartMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const fyEndMonths = ['January', 'February', 'March'];
      filtered = filtered.filter(item => {
        const my = getItemMonthYear(item);
        if (!my) return false;
        if (fyStartMonths.includes(my.monthName) && my.year === fyStartYear) return true;
        if (fyEndMonths.includes(my.monthName) && my.year === fyEndYear) return true;
        return false;
      });
    } else if (periodFilter === 'quarter' && periodValue) {
      const quarterMatch = periodValue.match(/Q(\d)/);
      const yearMatch = periodValue.match(/(\d{4})/);
      if (quarterMatch && yearMatch) {
        const quarter = parseInt(quarterMatch[1]);
        const year = parseInt(yearMatch[1]);
        const quarterMonthNames: { [key: number]: string[] } = {
          1: ['April', 'May', 'June'], 2: ['July', 'August', 'September'],
          3: ['October', 'November', 'December'], 4: ['January', 'February', 'March']
        };
        const monthsInQuarter = quarterMonthNames[quarter] || [];
        filtered = filtered.filter(item => {
          const my = getItemMonthYear(item);
          if (!my) return false;
          if (quarter === 4) return monthsInQuarter.includes(my.monthName) && my.year === year + 1;
          return monthsInQuarter.includes(my.monthName) && my.year === year;
        });
      }
    } else if (periodFilter === 'month' && periodValue) {
      const parts = periodValue.split('-');
      if (parts.length === 2) {
        const monthName = normalizeToFullMonthName(parts[0]);
        const year = parseInt(parts[1], 10);
        filtered = filtered.filter(item => {
          const my = getItemMonthYear(item);
          if (!my) return false;
          return my.monthName === monthName && my.year === year;
        });
      }
    }
    return filtered;
  }, [clientMFSData, selectedBusinessUnit, periodFilter, periodValue, isBUHead, user?.business_unit]);

  // Client section: BU and years from client data (so filters work when team summary is empty)
  const clientBusinessUnits = useMemo(() => {
    const unitsSet = new Set<string>();
    clientMFSData.forEach(item => {
      if (item.business_unit) {
        const normalized = normalizeBusinessUnitName(item.business_unit);
        if (normalized) unitsSet.add(normalized);
      }
    });
    return Array.from(unitsSet).sort();
  }, [clientMFSData]);

  const clientYears = useMemo(() => {
    const yearSet = new Set<number>();
    clientMFSData.forEach(item => {
      if (item.year != null) yearSet.add(Number(item.year));
    });
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [clientMFSData]);

  const clientNames = useMemo(() => {
    const names = new Set<string>();
    filteredClientMFSData.forEach(item => {
      if (item.client_name && String(item.client_name).trim()) names.add(String(item.client_name).trim());
    });
    return Array.from(names).sort();
  }, [filteredClientMFSData]);

  const clientProjectNames = useMemo(() => {
    if (!selectedBusinessUnit || !compareBusinessUnits(selectedBusinessUnit, 'MS')) return [];
    const names = new Set<string>();
    filteredClientMFSData.forEach(item => {
      if (clientSelectedClient && String(item.client_name || '').trim() !== clientSelectedClient) return;
      if (item.project_name && String(item.project_name).trim()) names.add(String(item.project_name).trim());
    });
    return Array.from(names).sort();
  }, [filteredClientMFSData, selectedBusinessUnit, clientSelectedClient]);

  // Month keys for client table (from filtered client data, same logic as ClientMFSdata)
  const clientTableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    filteredClientMFSData.forEach(item => {
      const my = getItemMonthYear(item);
      if (my && my.monthName) {
        monthSet.add(getMonthKey(my.monthName, my.year));
      }
    });
    return Array.from(monthSet).sort();
  }, [filteredClientMFSData]);

  // Unique clients; for MS, unique (client_name, project_name) pairs
  const clientTableRowKeys = useMemo(() => {
    const isMS = selectedBusinessUnit ? compareBusinessUnits(selectedBusinessUnit, 'MS') : false;
    if (!isMS) {
      const seen = new Set<string>();
      filteredClientMFSData.forEach(item => {
        const name = (item.client_name as string) || '';
        if (name.trim()) seen.add(name.trim());
      });
      return Array.from(seen).sort().map(c => ({ client: c, project: undefined as string | undefined }));
    }
    const seen = new Set<string>();
    const pairs: { client: string; project: string }[] = [];
    filteredClientMFSData.forEach(item => {
      const c = String(item.client_name || '').trim();
      const p = String(item.project_name || '').trim();
      if (!c || !p) return;
      const key = `${c}\0${p}`;
      if (seen.has(key)) return;
      seen.add(key);
      pairs.push({ client: c, project: p });
    });
    pairs.sort((a, b) => a.client.localeCompare(b.client) || a.project.localeCompare(b.project));
    return pairs;
  }, [filteredClientMFSData, selectedBusinessUnit]);

  // Build client table data: same structure as Client MFS Team Report Data (rows = clients, cells = param_monthKey)
  const clientTableData = useMemo(() => {
    if (clientTableRowKeys.length === 0 || clientTableMonths.length === 0) return [];
    const isMS = selectedBusinessUnit ? compareBusinessUnits(selectedBusinessUnit, 'MS') : false;
    const rows: Array<{ client: string; project?: string; [key: string]: any }> = [];

    clientTableRowKeys.forEach(({ client: rowClient, project: rowProject }) => {
      const row: { client: string; project?: string; [key: string]: any } = { client: rowClient };
      if (isMS) row.project = rowProject;

      const clientData = isMS
        ? filteredClientMFSData.filter(item =>
            String(item.client_name || '').trim() === rowClient &&
            String(item.project_name || '').trim() === rowProject)
        : filteredClientMFSData.filter(item => String(item.client_name || '').trim() === rowClient);

      clientTableParameters.forEach(param => {
        clientTableMonths.forEach(monthKey => {
          let totalValue = 0;
          const [yearStr, monthNumStr] = monthKey.split('-');
          const year = parseInt(yearStr, 10);
          const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
          const monthName = monthNames[parseInt(monthNumStr, 10)] || '';

          clientData.forEach(item => {
            const my = getItemMonthYear(item);
            if (!my || my.monthName !== monthName || my.year !== year) return;
            const paramValue = item[param.key];
            if (paramValue !== null && paramValue !== undefined && paramValue !== '') {
              const numValue = typeof paramValue === 'string' ? parseFloat(paramValue) : paramValue;
              if (!isNaN(numValue)) totalValue += numValue;
            }
          });
          row[`${param.key}_${monthKey}`] = totalValue;
        });
      });
      rows.push(row);
    });

    return rows;
  }, [filteredClientMFSData, clientTableRowKeys, clientTableMonths, selectedBusinessUnit]);

  // Client table: which parameters to show (default all)
  const clientTableParametersFiltered = useMemo(() => {
    if (clientSelectedParameters.length === 0) return clientTableParameters;
    return clientTableParameters.filter(p => clientSelectedParameters.includes(p.key));
  }, [clientSelectedParameters]);

  // Client table: filter rows by selected client (and project for MS)
  const clientTableDataFiltered = useMemo(() => {
    if (!clientSelectedClient) return clientTableData;
    let rows = clientTableData.filter(r => r.client === clientSelectedClient);
    if (selectedBusinessUnit && compareBusinessUnits(selectedBusinessUnit, 'MS') && clientSelectedProject) {
      rows = rows.filter(r => r.project === clientSelectedProject);
    }
    return rows;
  }, [clientTableData, clientSelectedClient, clientSelectedProject, selectedBusinessUnit]);

  // Format value for client table (same as Client MFS page: 0 shows as "0", N/A for null/NaN)
  const formatClientTableValue = (value: number, parameter: string): string => {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
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

  // Sync client MFS section: header height, row heights, total row (same as ClientMFSdata page)
  useEffect(() => {
    const section = document.querySelector('.client-wise-mfs-section');
    if (!section) return;

    const fixedTable = section.querySelector('.client-mfs-fixed-table tbody');
    const scrollableTable = section.querySelector('.client-mfs-scrollable-table tbody');
    const fixedHeader = section.querySelector('.client-mfs-fixed-table thead');
    const scrollableHeader = section.querySelector('.client-mfs-scrollable-table thead');
    if (!fixedTable || !scrollableTable) return;

    let isSyncing = false;
    let syncTimeout: ReturnType<typeof setTimeout> | null = null;

    const syncClientTables = () => {
      if (isSyncing) return;
      const ft = section.querySelector('.client-mfs-fixed-table tbody');
      const st = section.querySelector('.client-mfs-scrollable-table tbody');
      const fh = section.querySelector('.client-mfs-fixed-table thead');
      const sh = section.querySelector('.client-mfs-scrollable-table thead');
      if (!ft || !st) return;

      isSyncing = true;
      const fixedRows = Array.from(ft.querySelectorAll('tr'));
      const scrollableRows = Array.from(st.querySelectorAll('tr'));
      const dataRowsFixed = fixedRows.filter(r => !(r as HTMLElement).classList.contains('total-row'));
      const dataRowsScroll = scrollableRows.filter(r => !(r as HTMLElement).classList.contains('total-row'));
      const minDataRows = Math.min(dataRowsFixed.length, dataRowsScroll.length);

      dataRowsFixed.forEach((row) => {
        (row as HTMLElement).style.height = '';
        (row as HTMLElement).style.minHeight = '';
      });
      dataRowsScroll.forEach((row) => {
        (row as HTMLElement).style.height = '';
        (row as HTMLElement).style.minHeight = '';
      });
      void (ft as HTMLElement).offsetHeight;
      void (st as HTMLElement).offsetHeight;

      for (let i = 0; i < minDataRows; i++) {
        const fixedRow = dataRowsFixed[i] as HTMLElement;
        const scrollableRow = dataRowsScroll[i] as HTMLElement;
        const fixedClient = fixedRow.getAttribute('data-client');
        const fixedProject = fixedRow.getAttribute('data-project') || '';
        const scrollClient = scrollableRow.getAttribute('data-client');
        const scrollProject = scrollableRow.getAttribute('data-project') || '';
        let targetScroll = scrollableRow;
        if (fixedClient && scrollClient && (fixedClient !== scrollClient || fixedProject !== scrollProject)) {
          const correct = dataRowsScroll.find((r) =>
            (r as HTMLElement).getAttribute('data-client') === fixedClient &&
            (r as HTMLElement).getAttribute('data-project') === fixedProject
          );
          if (correct) targetScroll = correct as HTMLElement;
        }
        const fhVal = fixedRow.offsetHeight || fixedRow.getBoundingClientRect().height;
        const shVal = targetScroll.offsetHeight || targetScroll.getBoundingClientRect().height;
        const maxH = Math.max(fhVal, shVal, 20);
        if (maxH > 0) {
          fixedRow.style.height = `${maxH}px`;
          fixedRow.style.minHeight = `${maxH}px`;
          fixedRow.style.maxHeight = `${maxH}px`;
          targetScroll.style.height = `${maxH}px`;
          targetScroll.style.minHeight = `${maxH}px`;
          targetScroll.style.maxHeight = `${maxH}px`;
        }
      }

      const fixedTotalRow = ft.querySelector('tr.total-row') as HTMLElement;
      const scrollableTotalRow = st.querySelector('tr.total-row') as HTMLElement;
      if (fixedTotalRow && scrollableTotalRow) {
        const fth = fixedTotalRow.offsetHeight || fixedTotalRow.getBoundingClientRect().height;
        const sth = scrollableTotalRow.offsetHeight || scrollableTotalRow.getBoundingClientRect().height;
        const maxTh = Math.max(fth, sth, 20);
        if (maxTh > 0) {
          fixedTotalRow.style.height = `${maxTh}px`;
          fixedTotalRow.style.minHeight = `${maxTh}px`;
          scrollableTotalRow.style.height = `${maxTh}px`;
          scrollableTotalRow.style.minHeight = `${maxTh}px`;
        }
      }

      if (fh && sh) {
        const fixedHeaderRows = Array.from((fh as HTMLElement).querySelectorAll('tr'));
        const scrollHeaderRows = Array.from((sh as HTMLElement).querySelectorAll('tr'));
        fixedHeaderRows.forEach((r) => {
          (r as HTMLElement).style.height = '';
          (r as HTMLElement).style.minHeight = '';
        });
        scrollHeaderRows.forEach((r) => {
          (r as HTMLElement).style.height = '';
          (r as HTMLElement).style.minHeight = '';
        });
        void (fh as HTMLElement).offsetHeight;
        void (sh as HTMLElement).offsetHeight;
        const minHeaderRows = Math.min(fixedHeaderRows.length, scrollHeaderRows.length);
        for (let i = 0; i < minHeaderRows; i++) {
          const fr = fixedHeaderRows[i] as HTMLElement;
          const sr = scrollHeaderRows[i] as HTMLElement;
          const frh = fr.offsetHeight || fr.getBoundingClientRect().height;
          const srh = sr.offsetHeight || sr.getBoundingClientRect().height;
          const maxRh = Math.max(frh, srh, 30);
          if (maxRh > 0) {
            fr.style.height = `${maxRh}px`;
            fr.style.minHeight = `${maxRh}px`;
            sr.style.height = `${maxRh}px`;
            sr.style.minHeight = `${maxRh}px`;
          }
        }
        const fhh = (fh as HTMLElement).offsetHeight;
        const shh = (sh as HTMLElement).offsetHeight;
        const maxHeaderH = Math.max(fhh, shh);
        if (maxHeaderH > 0) {
          (fh as HTMLElement).style.height = `${maxHeaderH}px`;
          (fh as HTMLElement).style.minHeight = `${maxHeaderH}px`;
          (sh as HTMLElement).style.height = `${maxHeaderH}px`;
          (sh as HTMLElement).style.minHeight = `${maxHeaderH}px`;
        }
      }

      isSyncing = false;
    };

    const debouncedSync = () => {
      if (syncTimeout) clearTimeout(syncTimeout);
      syncTimeout = setTimeout(syncClientTables, 50);
    };

    const runSync = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          syncClientTables();
          setTimeout(syncClientTables, 200);
        });
      });
    };

    setTimeout(runSync, 100);
    setTimeout(runSync, 400);

    const observer = new MutationObserver(() => {
      const hasChange = true;
      if (hasChange && !isSyncing) debouncedSync();
    });

    if (scrollableTable) {
      observer.observe(scrollableTable, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }
    if (fixedTable) {
      observer.observe(fixedTable, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }

    const handleResize = () => {
      if (syncTimeout) clearTimeout(syncTimeout);
      syncTimeout = setTimeout(syncClientTables, 150);
    };
    window.addEventListener('resize', handleResize);

    const scrollContainer = section.querySelector('.client-mfs-scrollable-wrapper');
    const handleScroll = () => {
      if (syncTimeout) clearTimeout(syncTimeout);
      syncTimeout = setTimeout(syncClientTables, 100);
    };
    if (scrollContainer) scrollContainer.addEventListener('scroll', handleScroll, { passive: true });

    if (editingCell?.table === 'client' || editMode) {
      setTimeout(() => { if (!isSyncing) syncClientTables(); }, 150);
    }
    requestAnimationFrame(() => setTimeout(() => { if (!isSyncing) syncClientTables(); }, 300));

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
      if (scrollContainer) scrollContainer.removeEventListener('scroll', handleScroll);
      if (syncTimeout) clearTimeout(syncTimeout);
      isSyncing = false;
    };
  }, [editingCell, editMode, clientTableDataFiltered, clientTableParametersFiltered, selectedBusinessUnit]);

  // Handle edit click (summary table or client table)
  const handleEditClick = (
    parameter: string,
    monthKey: string,
    currentValue: number,
    table: 'summary' | 'client' = 'summary',
    clientName?: string,
    projectName?: string
  ) => {
    setEditingCell({
      parameter,
      monthKey,
      table,
      clientName,
      projectName
    });
    setEditedValue(String(currentValue || ''));
  };

  // Handle save edit (both summary and client table)
  const handleSaveEdit = async () => {
    if (!editingCell) return;

    const monthParts = editingCell.monthKey.split('-');
    const year = parseInt(monthParts[0], 10);
    const monthNum = parseInt(monthParts[1], 10);
    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = monthNames[monthNum];

    const updateValue = parseFloat(editedValue);
    if (isNaN(updateValue)) {
      setError('Invalid number');
      return;
    }

    try {
      if (editingCell.table === 'client') {
        // Client table: PATCH /team-report
        let records = filteredClientMFSData.filter(
          (item: TeamReportItem) => {
            const my = getItemMonthYear(item);
            if (!my || my.monthName !== monthName || my.year !== year) return false;
            return true;
          }
        );
        if (editingCell.clientName) {
          records = records.filter((item: TeamReportItem) => item.client_name === editingCell.clientName);
        }
        if (selectedBusinessUnit && compareBusinessUnits(selectedBusinessUnit, 'MS') && editingCell.projectName) {
          records = records.filter((item: TeamReportItem) => item.project_name === editingCell.projectName);
        }
        if (records.length === 0) {
          setError('No record found for this cell');
          return;
        }
        await Promise.all(
          records.map((record: TeamReportItem) =>
            apiClient.patch(`/team-report/${record.id}`, { [editingCell!.parameter]: updateValue })
          )
        );
        const response = await apiClient.get('/team-report');
        if (Array.isArray(response.data)) {
          setClientMFSData(response.data as TeamReportItem[]);
          setError(null);
        }
      } else {
        // Summary table: PATCH /team-summary-report
        const records = filteredData.filter(
          (item: TeamReportItem) => item.month === monthName && item.year === year
        );
        if (records.length === 0) {
          setError('No record found for this month');
          return;
        }
        await Promise.all(
          records.map((record: TeamReportItem) =>
            apiClient.patch(`/team-summary-report/${record.id}`, { [editingCell.parameter]: updateValue })
          )
        );
        const response = await apiClient.get('/team-summary-report');
        if (Array.isArray(response.data)) {
          setTeamReportData(response.data as TeamReportItem[]);
          setError(null);
        }
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

  const clientQuarterOptions = useMemo(() => {
    const options: string[] = [];
    clientYears.forEach(year => {
      options.push(`Q1(Apr-Jun) ${year}`);
      options.push(`Q2(Jul-Sep) ${year}`);
      options.push(`Q3(Oct-Dec) ${year}`);
      options.push(`Q4(Jan-Mar) ${year + 1}`);
    });
    return options;
  }, [clientYears]);

  const clientMonthOptions = useMemo(() => {
    const options: string[] = [];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    clientYears.forEach(year => {
      monthNames.forEach(month => options.push(`${month}-${year}`));
    });
    return options;
  }, [clientYears]);

  // Show full page so both tables are visible (first: MFS from team-summary-report, second: client wise from team-report)
  if (loading) return <div className="loading">Loading data...</div>;
  if (error && !editingCell) return <div className="error">Error: {error}</div>;

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
              disabled={isBUHead}
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

          {/* First table: MFS Team Summary Report Data (API: /team-summary-report) */}
          {teamReportData.length === 0 ? (
            <div className="empty" style={{ padding: '1rem 0' }}>No MFS team summary records found.</div>
          ) : (
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
                                         editingCell?.monthKey === monthKey &&
                                         editingCell?.table !== 'client';
                        
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
                                    onClick={() => handleEditClick(paramData.parameter, monthKey, cellData?.value || 0, 'summary')}
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
          )}

          {/* Second table: Client wise MFS data (API: /team-report) - different table/API from above */}
          <div className="client-wise-mfs-section" style={{ marginTop: '2rem' }}>
            <h3 className="client-wise-title" style={{ marginBottom: '0.75rem', fontSize: '1.1rem' }}>
              Client MFS Team Report Data
            </h3>

            {/* Client MFS filters - same as Client MFS data page */}
            <div className="table-controls" style={{ flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
              <div className="filter-group">
                <label htmlFor="client-bu-filter">Business Unit:</label>
                <select
                  id="client-bu-filter"
                  value={selectedBusinessUnit}
                  onChange={(e) => {
                    setSelectedBusinessUnit(e.target.value);
                    setClientSelectedClient('');
                    setClientSelectedProject('');
                  }}
                  className="filter-select"
                >
                  <option value="">All Business Units</option>
                  {clientBusinessUnits.map(unit => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label htmlFor="client-name-filter">Client Name:</label>
                <select
                  id="client-name-filter"
                  value={clientSelectedClient}
                  onChange={(e) => {
                    setClientSelectedClient(e.target.value);
                    setClientSelectedProject('');
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
              {selectedBusinessUnit && compareBusinessUnits(selectedBusinessUnit, 'MS') && (
                <div className="filter-group">
                  <label htmlFor="client-project-filter">Project:</label>
                  <select
                    id="client-project-filter"
                    value={clientSelectedProject}
                    onChange={(e) => setClientSelectedProject(e.target.value)}
                    className="filter-select"
                  >
                    <option value="">All Projects</option>
                    {clientProjectNames.map(proj => (
                      <option key={proj} value={proj}>{proj}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="filter-group">
                <label htmlFor="client-param-filter">Parameters:</label>
                <Select
                  mode="multiple"
                  value={clientSelectedParameters}
                  onChange={(vals) => setClientSelectedParameters(vals)}
                  placeholder="Select Parameters"
                  style={{ minWidth: '200px' }}
                  allowClear
                >
                  {clientTableParameters.map(p => (
                    <Select.Option key={p.key} value={p.key}>{p.label}</Select.Option>
                  ))}
                </Select>
              </div>
              <div className="filter-group">
                <label htmlFor="client-period-type">Period Type:</label>
                <select
                  id="client-period-type"
                  value={periodFilter}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPeriodFilter(v);
                    if (v === 'year') setPeriodValue(String(getCurrentFYStartYear()));
                    else setPeriodValue('');
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
                  <label htmlFor="client-year-filter">Year:</label>
                  <select
                    id="client-year-filter"
                    value={periodValue}
                    onChange={(e) => setPeriodValue(e.target.value)}
                    className="filter-select"
                  >
                    <option value="">Select Year</option>
                    {clientYears.map(y => (
                      <option key={y} value={String(y)}>{y}</option>
                    ))}
                  </select>
                </div>
              )}
              {periodFilter === 'quarter' && (
                <div className="filter-group">
                  <label htmlFor="client-quarter-filter">Quarter:</label>
                  <select
                    id="client-quarter-filter"
                    value={periodValue}
                    onChange={(e) => setPeriodValue(e.target.value)}
                    className="filter-select"
                  >
                    <option value="">Select Quarter</option>
                    {clientQuarterOptions.map(q => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                </div>
              )}
              {periodFilter === 'month' && (
                <div className="filter-group">
                  <label htmlFor="client-month-filter">Month:</label>
                  <select
                    id="client-month-filter"
                    value={periodValue}
                    onChange={(e) => setPeriodValue(e.target.value)}
                    className="filter-select"
                  >
                    <option value="">Select Month</option>
                    {clientMonthOptions.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {loadingClientMFS ? (
              <div className="loading">Loading client data...</div>
            ) : !selectedBusinessUnit ? (
              <div className="empty">Please select a Business Unit to view client-wise data.</div>
            ) : clientTableDataFiltered.length === 0 ? (
              <div className="empty">No client-wise data for the selected filters.</div>
            ) : (
              <div className={`split-table-container client-mfs-split ${selectedBusinessUnit && compareBusinessUnits(selectedBusinessUnit, 'MS') ? 'ms-selected' : ''}`}>
                <div className="fixed-column-table">
                  <table className="pivot-table fixed-table client-mfs-fixed-table">
                    <thead>
                      <tr>
                        <th className="parameter-header" rowSpan={clientTableParametersFiltered.length > 1 ? 2 : 1}>Client</th>
                        {selectedBusinessUnit && compareBusinessUnits(selectedBusinessUnit, 'MS') && (
                          <th className="parameter-header" rowSpan={clientTableParametersFiltered.length > 1 ? 2 : 1}>Project</th>
                        )}
                      </tr>
                      {clientTableParametersFiltered.length > 1 ? (
                        <tr>
                          <th></th>
                          {selectedBusinessUnit && compareBusinessUnits(selectedBusinessUnit, 'MS') && <th></th>}
                        </tr>
                      ) : null}
                    </thead>
                    <tbody>
                      {clientTableDataFiltered.map((row, rowIndex) => (
                        <tr key={`cf_${row.client}_${row.project || ''}_${rowIndex}`} data-client={row.client} data-project={row.project || ''}>
                          <td className="parameter-cell">{row.client}</td>
                          {selectedBusinessUnit && compareBusinessUnits(selectedBusinessUnit, 'MS') && (
                            <td className="parameter-cell">{row.project || 'N/A'}</td>
                          )}
                        </tr>
                      ))}
                      <tr className="total-row">
                        <td className="parameter-cell total-label">Total</td>
                        {selectedBusinessUnit && compareBusinessUnits(selectedBusinessUnit, 'MS') && (
                          <td className="parameter-cell total-label"></td>
                        )}
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="scrollable-columns-table client-mfs-scrollable-wrapper">
                  <table className="pivot-table scrollable-table client-mfs-scrollable-table">
                    <thead>
                      <tr>
                        {clientTableMonths.map(monthKey => {
                          const [year, monthNum] = monthKey.split('-');
                          const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                          const monthName = monthNames[parseInt(monthNum)];
                          return (
                            <th key={monthKey} className="month-header" colSpan={clientTableParametersFiltered.length}>
                              {monthName} {year}
                            </th>
                          );
                        })}
                      </tr>
                      {clientTableParametersFiltered.length > 1 ? (
                        <tr>
                          {clientTableMonths.map(monthKey =>
                            clientTableParametersFiltered.map(param => (
                              <th key={`${monthKey}_${param.key}`} className="month-header">
                                {param.label}
                              </th>
                            ))
                          )}
                        </tr>
                      ) : null}
                    </thead>
                    <tbody>
                      {clientTableDataFiltered.map((row, rowIndex) => (
                        <tr key={`cs_${row.client}_${row.project || ''}_${rowIndex}`} data-client={row.client} data-project={row.project || ''}>
                          {clientTableMonths.map(monthKey =>
                            clientTableParametersFiltered.map(param => {
                              const cellKey = `${param.key}_${monthKey}`;
                              const cellValue = row[cellKey] ?? 0;
                              const isClientEditing =
                                editMode &&
                                editingCell?.table === 'client' &&
                                editingCell?.parameter === param.key &&
                                editingCell?.monthKey === monthKey &&
                                editingCell?.clientName === row.client &&
                                (!(selectedBusinessUnit && compareBusinessUnits(selectedBusinessUnit, 'MS')) || editingCell?.projectName === row.project);
                              return (
                                <td key={`${monthKey}_${param.key}`} className="data-cell">
                                  {isClientEditing ? (
                                    <div className="edit-container">
                                      <input
                                        type="text"
                                        value={editedValue}
                                        onChange={(e) => setEditedValue(e.target.value)}
                                        className="edit-input"
                                        autoFocus
                                      />
                                      <button onClick={handleSaveEdit} className="save-button" title="Save">✓</button>
                                      <button onClick={handleCancelEdit} className="cancel-button" title="Cancel">✕</button>
                                    </div>
                                  ) : (
                                    <div className="cell-content">
                                      <span>{formatClientTableValue(cellValue, param.key)}</span>
                                      {editMode && (
                                        <button
                                          onClick={() => handleEditClick(param.key, monthKey, cellValue, 'client', row.client, row.project)}
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
                      <tr className="total-row">
                        {clientTableMonths.map(monthKey => {
                          const revKey = `revenue_${monthKey}`;
                          const gpmKey = `gpm_${monthKey}`;
                          const npKey = `np_${monthKey}`;
                          let sumRevenue = 0, sumGpm = 0, sumNp = 0;
                          clientTableDataFiltered.forEach(r => {
                            sumRevenue += Number(r[revKey] ?? 0) || 0;
                            sumGpm += Number(r[gpmKey] ?? 0) || 0;
                            sumNp += Number(r[npKey] ?? 0) || 0;
                          });
                          return clientTableParametersFiltered.map(param => {
                            const cellKey = `${param.key}_${monthKey}`;
                            let totalValue: number;
                            if (param.key === 'gpm_percentage') {
                              totalValue = sumRevenue !== 0 ? (sumGpm / sumRevenue) * 100 : 0;
                            } else if (param.key === 'np_percentage') {
                              totalValue = sumRevenue !== 0 ? (sumNp / sumRevenue) * 100 : 0;
                            } else {
                              totalValue = 0;
                              clientTableDataFiltered.forEach(r => {
                                const v = r[cellKey] ?? 0;
                                if (!isNaN(Number(v))) totalValue += Number(v);
                              });
                            }
                            return (
                              <td key={`tot_${monthKey}_${param.key}`} className="data-cell total-cell">
                                {formatClientTableValue(totalValue, param.key)}
                              </td>
                            );
                          });
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MFSdata;
