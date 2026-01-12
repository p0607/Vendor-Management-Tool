import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Select } from 'antd';
import './MFSdata.css';
import { compareBusinessUnits, normalizeBusinessUnitName, mapClientMFSToMFSBusinessUnit } from '../utils/businessUnitUtils';
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
  const [selectedClientName, setSelectedClientName] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  // Set default to current FY (year filter showing FY data)
  const [periodFilter, setPeriodFilter] = useState<string>('year'); // 'year', 'quarter', or 'month'
  const [periodValue, setPeriodValue] = useState<string>(String(getCurrentFYStartYear())); // Default to current FY start year
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]); // Multiple month selection
  const [selectedParameters, setSelectedParameters] = useState<string[]>([]); // Multiple parameter selection
  const [editingCell, setEditingCell] = useState<{ parameter: string; monthKey: string; clientName?: string; projectName?: string } | null>(null);
  const [editedValue, setEditedValue] = useState<string>('');
  const [editMode, setEditMode] = useState<boolean>(false);
  const [user, setUser] = useState<any>({});
  const [isBUHead, setIsBUHead] = useState<boolean>(false);

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

  // Use centralized business unit utility functions (imported from utils)

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

  // Get unique client names (filtered by business unit if selected)
  const clientNames = useMemo(() => {
    const clients = new Set<string>();
    teamReportData.forEach(item => {
      if (item.client_name) {
        if (!selectedBusinessUnit || compareBusinessUnits(item.business_unit, selectedBusinessUnit)) {
          clients.add(item.client_name);
        }
      }
    });
    return Array.from(clients).sort();
  }, [teamReportData, selectedBusinessUnit]);

  // Check if MS is selected (case-insensitive)
  const isMSSelected = selectedBusinessUnit ? compareBusinessUnits(selectedBusinessUnit, 'MS') : false;

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

    if (selectedClientName) {
      filtered = filtered.filter(item => item.client_name === selectedClientName);
    }

    // Filter by project (only when MS is selected)
    if (isMSSelected && selectedProject) {
      filtered = filtered.filter(item => item.project_name === selectedProject);
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
  }, [teamReportData, selectedBusinessUnit, selectedClientName, selectedProject, isMSSelected, periodFilter, periodValue, selectedMonths]);

  // Get unique project names (only for MS business unit)
  const projectNames = useMemo(() => {
    if (!selectedBusinessUnit || !compareBusinessUnits(selectedBusinessUnit, 'MS')) {
      return [];
    }
    const projects = new Set<string>();
    filteredData.forEach(item => {
      if (item.project_name && item.business_unit && compareBusinessUnits(item.business_unit, 'MS')) {
        if (!selectedClientName || item.client_name === selectedClientName) {
          // Normalize project name: trim whitespace
          const normalizedProject = String(item.project_name).trim();
          if (normalizedProject) {
            projects.add(normalizedProject);
          }
        }
      }
    });
    return Array.from(projects).sort();
  }, [filteredData, selectedBusinessUnit, selectedClientName]);

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
    const normalizedSelectedBU = normalizeBusinessUnitName(selectedBusinessUnit);
    const clientSet = new Set<string>();
    filteredData.forEach(item => {
      if (item.client_name && item.business_unit && compareBusinessUnits(item.business_unit, selectedBusinessUnit)) {
        clientSet.add(item.client_name);
      }
    });
    return Array.from(clientSet).sort();
  }, [filteredData, selectedBusinessUnit]);

  // Build data structure: clients (and projects for MS) as rows, parameters as columns
  const tableData = useMemo(() => {
    if (!selectedBusinessUnit || clients.length === 0) {
      return [];
    }

    const clientsToShow = selectedClientName ? [selectedClientName] : clients;
    const rows: Array<{ client: string; project?: string; [key: string]: any }> = [];
    
    clientsToShow.forEach(client => {
      let clientData = filteredData.filter(item => item.client_name === client);
      
      // For MS, group by project_name as well
      if (isMSSelected) {
        // Get unique projects for THIS specific client only
        const clientProjects = new Set<string>();
        clientData.forEach(item => {
          if (item.project_name) {
            const normalizedProject = String(item.project_name).trim();
            if (normalizedProject) {
              clientProjects.add(normalizedProject);
            }
          }
        });
        const clientProjectsList = Array.from(clientProjects).sort();
        
        const projectsToShow = selectedProject ? [selectedProject] : clientProjectsList;
        
        projectsToShow.forEach(project => {
          // Filter by project_name, handling null/empty values and normalizing
          const projectData = clientData.filter(item => {
            const itemProject = (item.project_name || '').toString().trim();
            const normalizedProject = project.toString().trim();
            return itemProject === normalizedProject;
          });
          const row: { client: string; project?: string; [key: string]: any } = { 
            client, 
            project 
          };
          
          // For each parameter and month combination
          parameters.forEach(param => {
            months.forEach(monthKey => {
              let totalValue = 0;
              
              projectData.forEach(item => {
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
              row[cellKey] = totalValue;
            });
          });
          
          rows.push(row);
        });
      } else {
        // For non-MS, group only by client
        const row: { client: string; project?: string; [key: string]: any } = { client };
        
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
            row[cellKey] = totalValue;
          });
        });
        
        rows.push(row);
      }
    });
    
    return rows;
  }, [filteredData, selectedBusinessUnit, selectedClientName, selectedProject, isMSSelected, projectNames, clients, parameters, months]);

  // Format value for display
  const formatValue = (value: number, parameter: string): string => {
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
  }, [editingCell, editMode, tableData]); // Sync when editing state or data changes

  // Handle edit click
  const handleEditClick = (parameter: string, monthKey: string, currentValue: number, clientName?: string, projectName?: string) => {
    setEditingCell({ parameter, monthKey, clientName, projectName });
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

      // For MS, also filter by project_name
      if (isMSSelected && editingCell.projectName) {
        records = records.filter(item => item.project_name === editingCell.projectName);
      }

      if (records.length === 0) {
        setError('No record found for this month');
        return;
      }

      // Parse the edited value - use exactly what the user entered
      const updateValue = parseFloat(editedValue);

      if (isNaN(updateValue)) {
        setError('Invalid number');
        return;
      }

      // Update all matching records with the exact value the user entered
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
                  setSelectedProject('');
                  // Keep period filter active - don't reset it
                  // Only clear selected months if period filter is not 'year'
                  if (periodFilter !== 'year') {
                    setSelectedMonths([]);
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
              <label htmlFor="client-name-filter">Client Name:</label>
              <select
                id="client-name-filter"
                value={selectedClientName}
                onChange={(e) => {
                  setSelectedClientName(e.target.value);
                  setSelectedProject(''); // Clear project when client changes
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

            {isMSSelected && (
              <div className="filter-group">
                <label htmlFor="project-filter">Project:</label>
                <select
                  id="project-filter"
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="filter-select"
                  disabled={!selectedBusinessUnit}
                >
                  <option value="">All Projects</option>
                  {projectNames.map(project => (
                    <option key={project} value={project}>{project}</option>
                  ))}
                </select>
              </div>
            )}

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
                  const newPeriodFilter = e.target.value;
                  setPeriodFilter(newPeriodFilter);
                  // If changing to 'year' or clearing, restore default to current FY
                  if (newPeriodFilter === 'year' || newPeriodFilter === '') {
                    if (newPeriodFilter === 'year') {
                      setPeriodValue(String(getCurrentFYStartYear()));
                    } else {
                      setPeriodValue('');
                    }
                  } else {
                    // For quarter or month, clear the value so user can select
                    setPeriodValue('');
                  }
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
            <div className="split-table-container">
              {/* Fixed LOB/Project Column Table */}
              <div className={`fixed-column-table ${isMSSelected ? 'ms-selected' : ''}`}>
                <table className="pivot-table fixed-table">
                  <thead>
                    <tr>
                      <th className="parameter-header" rowSpan={parameters.length > 1 ? 2 : 1}>Client</th>
                      {isMSSelected && (
                        <th className="parameter-header" rowSpan={parameters.length > 1 ? 2 : 1}>Project</th>
                      )}
                    </tr>
                    {parameters.length > 1 ? (
                      <tr>
                        <th></th>
                        {isMSSelected && <th></th>}
                      </tr>
                    ) : null}
                  </thead>
                  <tbody>
                    {tableData.map((row, rowIndex) => (
                      <tr key={`fixed_${row.client}_${row.project || ''}_${rowIndex}`}>
                        <td className="parameter-cell">{row.client}</td>
                        {isMSSelected && (
                          <td className="parameter-cell">{row.project || 'N/A'}</td>
                        )}
                      </tr>
                    ))}
                    {/* Total Row */}
                    <tr className="total-row">
                      <td className="parameter-cell total-label">Total</td>
                      {isMSSelected && (
                        <td className="parameter-cell total-label"></td>
                      )}
                    </tr>
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
                      <tr key={`scrollable_${row.client}_${row.project || ''}_${rowIndex}`}>
                        {months.map(monthKey => 
                          parameters.map(param => {
                            const cellKey = `${param.key}_${monthKey}`;
                            const cellValue = row[cellKey] || 0;
                        const isEditing = editingCell?.parameter === param.key && 
                                         editingCell?.monthKey === monthKey &&
                                         editingCell?.clientName === row.client &&
                                         (!isMSSelected || editingCell?.projectName === row.project);
                            
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
                                    <button onClick={handleSaveEdit} className="save-button" title="Save">
                                      ✓
                                    </button>
                                    <button onClick={handleCancelEdit} className="cancel-button" title="Cancel">
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <div className="cell-content">
                                    <span>{formatValue(cellValue, param.key)}</span>
                                {editMode && (
                                  <button
                                    onClick={() => handleEditClick(param.key, monthKey, cellValue, row.client, row.project)}
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
              </div>
            </div>
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
