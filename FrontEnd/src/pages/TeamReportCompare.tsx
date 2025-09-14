import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Select, Button, Dropdown, Tabs, message, AutoComplete } from "antd";
import { PlusOutlined, CloseOutlined, DownOutlined } from "@ant-design/icons";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import styles from './TeamReportDashboard.module.css';
import axios from "axios";
import TargetTrackingChart from './TargetTrackingChart';
import { formatValueForTable } from '../utils/formatUtils';
import apiClient from '../config/api';
import logo from '../assets/logo_1.png';
import * as XLSX from 'xlsx';

const { Option } = Select;

interface ReportData {
  id?: number;
  tower: string;
  client_name: string;
  project_name: string;
  business_unit: string;
  bu_head: string;
  hc: number;
  salary_cost: number;
  sales: number;
  gpm: number;
  gpm_percentage: number;
  leave_encashment: number;
  team_cost: number;
  opr_cost: number;
  funding_cost: number;
  np: number;
  np_percentage: number;
  month: string;
  year: number;
  created_at?: string;
}

interface PeriodChange {
  fromPeriod: string;
  toPeriod: string;
  absoluteChange: number;
  percentageChange: number;
  isPositive: boolean;
}

interface CombinedPeriod {
  periods: string[];
  label: string;
  totalAmount: number;
}

interface GrowthAnalysis {
  parameter: string;
  periodValues: {
    period: string | null;
    amount: number;
  }[];
  changes: PeriodChange[];
}

type CompareType = "year" | "quarter" | "month";

const TeamReportCompare: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  

  // Helper function to get current financial year quarters
  const getCurrentFinancialYearQuarters = () => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1; // 1-12
    const currentYear = currentDate.getFullYear();
    
    // Financial year starts from April (month 4)
    let financialYear;
    if (currentMonth >= 4) {
      financialYear = currentYear;
    } else {
      financialYear = currentYear - 1;
    }
    
    // Return quarters for the current financial year with proper labels
    return [
      `Q1(Apr-Jun) ${financialYear}`,
      `Q2(Jul-Sep) ${financialYear}`,
      `Q3(Oct-Dec) ${financialYear}`,
      `Q4(Jan-Mar) ${financialYear}` // Q4 belongs to same financial year but next calendar year
    ];
  };

  // State declarations with URL parameter defaults
  const [user, setUser] = useState<any>({});
  const [isBUHead, setIsBUHead] = useState(false);
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string | null>(null);
  const [selectedClientName, setSelectedClientName] = useState<string | null>(null);
  const [selectedBUHead, setSelectedBUHead] = useState<string | null>(null);
  const [businessUnits, setBusinessUnits] = useState<string[]>([]);
  const [clientNames, setClientNames] = useState<string[]>([]);
  const [filteredClientNames, setFilteredClientNames] = useState<string[]>([]);
  const [buHeads, setBUHeads] = useState<string[]>([]);
  const [compareType, setCompareType] = useState<CompareType>(
    (queryParams.get('compareType') as CompareType) || "quarter"
  );
  const [comparisonValues, setComparisonValues] = useState<(string | null)[]>(() => {
    // Set default to current financial year quarters if coming from MFS button
    const defaultFinancialYear = queryParams.get('defaultFinancialYear');
    if (defaultFinancialYear && compareType === "quarter") {
      const financialYear = parseInt(defaultFinancialYear);
      return [
        `Q1(Apr-Jun) ${financialYear}`,
        `Q2(Jul-Sep) ${financialYear}`,
        `Q3(Oct-Dec) ${financialYear}`,
        `Q4(Jan-Mar) ${financialYear}` // Q4 belongs to same financial year but next calendar year
      ];
    }
    return [null, null];
  });
  const [combinedPeriods, setCombinedPeriods] = useState<CombinedPeriod[]>([]);
  const [showCombinedModal, setShowCombinedModal] = useState<number | null>(null);
  const [selectedPeriodsForCombination, setSelectedPeriodsForCombination] = useState<string[]>([]);
  const [data, setData] = useState<ReportData[]>([]);
  const [availableOptions, setAvailableOptions] = useState<string[]>([]);
  const [selectedParameters, setSelectedParameters] = useState<string[]>(() => {
    // Set default parameters from URL or use GPM% and Net Margin%
    const paramsFromURL = queryParams.get('selectedParameters');
    if (paramsFromURL) {
      try {
        return decodeURIComponent(paramsFromURL).split(',');
      } catch (error) {
        console.warn('Failed to decode URL parameters, using defaults:', error);
        return ['GPM %', 'NP %'];
      }
    }
    return ['GPM %', 'NP %'];
  });
  const [chartType, setChartType] = useState<'bar' | 'line' | 'combo'>(
    (queryParams.get('chartType') as 'bar' | 'line' | 'combo') || 'bar'
  );
  const [availableParameters, setAvailableParameters] = useState<string[]>([]);
  const [comparisonData, setComparisonData] = useState<{[key: string]: any}[]>([]);
  const [growthAnalysis, setGrowthAnalysis] = useState<GrowthAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('chart');
  const [showGrowthAnalysis, setShowGrowthAnalysis] = useState<boolean>(false);
  const [isActionDropdownOpen, setIsActionDropdownOpen] = useState(false);
  const [showAllParameters, setShowAllParameters] = useState(false);

  // Enhanced date parser to handle various date formats
  const parseDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    
    // Handle month name format (e.g., "April")
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const monthIndex = monthNames.findIndex(month => 
      dateStr.toLowerCase().includes(month.toLowerCase())
    );
    
    if (monthIndex !== -1) {
      // If we find a month name, create a date for the 1st of that month
      // We'll use the year from the year field or current year
      return new Date(new Date().getFullYear(), monthIndex, 1);
    }
    
    // Handle ISO format (YYYY-MM-DD) or other standard formats
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }
    
    // Fallback to current date
    return new Date();
  };

  // Helper function to get fiscal quarter info
  const getFiscalQuarter = (date: Date) => {
    if (isNaN(date.getTime())) {
      return { label: "Invalid Date", quarter: 0, year: 0 };
    }
    
    const monthNum = date.getMonth(); // 0-11 (Jan-Dec)
    const year = date.getFullYear();
    
    let quarter, quarterRange, financialYear;
    if (monthNum >= 3 && monthNum <= 5) { // April (3)-June (5)
      quarter = 1;
      quarterRange = "Apr-Jun";
      financialYear = year; // Q1 belongs to current year
    } else if (monthNum >= 6 && monthNum <= 8) { // July (6)-Sept (8)
      quarter = 2;
      quarterRange = "Jul-Sep";
      financialYear = year; // Q2 belongs to current year
    } else if (monthNum >= 9 && monthNum <= 11) { // Oct (9)-Dec (11)
      quarter = 3;
      quarterRange = "Oct-Dec";
      financialYear = year; // Q3 belongs to current year
    } else { // Jan (0)-Mar (2)
      quarter = 4;
      quarterRange = "Jan-Mar";
      financialYear = year - 1; // Q4 belongs to previous financial year
    }
    
    return {
      label: `Q${quarter}(${quarterRange}) ${financialYear}`,
      quarter,
      year: financialYear
    };
  };

  // Excel date conversion helper
  const excelDateToISO = (serial: number | string): string => {
    if (!serial) return "";
    
    // Handle DD-MM-YYYY format (like "01-04-2024")
    if (typeof serial === "string" && /^\d{2}-\d{2}-\d{4}$/.test(serial)) {
      const [day, month, year] = serial.split('-');
      return `${year}-${month}-${day}`; // Convert to YYYY-MM-DD for database
    }
    
    // Handle YYYY-MM-DD format
    if (typeof serial === "string" && /^\d{4}-\d{2}-\d{2}$/.test(serial)) {
      return serial;
    }
    
    // Handle other date formats
    if (typeof serial === "string" && !isNaN(Date.parse(serial))) {
      const date = new Date(serial);
      return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
    }
    
    // Handle Excel serial numbers
    if (typeof serial === "number" || !isNaN(parseInt(serial, 10))) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const days = typeof serial === "number" ? serial : parseInt(serial, 10);
      const date = new Date(excelEpoch.getTime() + days * 86400000);
      return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
    }
    
    return "";
  };

  // Helper function to safely parse numeric values from Excel (handles formulas)
  const parseNumericValue = (value: any): number => {
    if (value === null || value === undefined || value === '') return 0;
    
    // If it's already a number, return it
    if (typeof value === 'number') return value;
    
    // Convert to string and clean it
    const stringValue = String(value).trim();
    
    // Handle empty strings
    if (stringValue === '' || stringValue === '-') return 0;
    
    // Try to parse as number
    const parsed = parseFloat(stringValue);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Handle Excel import
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      if (!bstr) return;
      
      // Read Excel with formula evaluation
      const workbook = XLSX.read(bstr, { 
        type: 'binary',
        cellFormula: true,
        cellHTML: false,
        cellNF: false,
        cellStyles: false,
        cellText: false,
        cellDates: true,
        dateNF: 'yyyy-mm-dd'
      });
      
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON with raw values (formulas will be evaluated)
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        raw: true,
        defval: '',
        blankrows: false
      });
      
      // Debug: Log the first few rows and column names
      console.log("🔍 Excel file loaded successfully");
      console.log("🔍 Total rows in Excel:", jsonData.length);
      if (jsonData.length > 0) {
        console.log("🔍 Available columns in Excel:", Object.keys(jsonData[0] as any));
        console.log("🔍 First 3 rows of Excel data:", jsonData.slice(0, 3));
      }
      
      const mappedData = jsonData.map((row: any) => {
        // Helper function to convert empty strings to null
        const stringOrNull = (value: any): string | null => {
          const str = String(value || '').trim();
          return str === '' ? null : str;
        };

        return {
          tower: stringOrNull(row['Tower'] || row.tower),
          client_name: stringOrNull(row['Client_Name'] || row['Client Name'] || row.client_name),
          project_name: stringOrNull(row['Project_Name'] || row.project_name),
          business_unit: stringOrNull(row['Business_unit'] || row['Business unit'] || row.business_unit),
          bu_head: stringOrNull(row['BU_Head'] || row['BU Head'] || row.bu_head),
          hc: parseNumericValue(row['HC'] || row.hc),
          salary_cost: parseNumericValue(row['Salary Cost'] || row.salary_cost),
          sales: parseNumericValue(row['SALES'] || row.sales),
          gpm: parseNumericValue(row['GPM'] || row.gpm),
          gpm_percentage: parseNumericValue(row['GPM %'] || row.gpm_percentage),
          leave_encashment: parseNumericValue(row['Loan Encash'] || row['Leav Encsh'] || row.leave_encashment),
          team_cost: parseNumericValue(row['Team Cost'] || row.team_cost),
          opr_cost: parseNumericValue(row['Opr Cost'] || row.opr_cost),
          funding_cost: parseNumericValue(row['Funding Cost'] || row.funding_cost),
          np: parseNumericValue(row['NP'] || row.np),
          np_percentage: parseNumericValue(row['NP %'] || row.np_percentage),
          month: stringOrNull(row['Month'] || row.month),
          year: parseNumericValue(row['Year'] || row.year) || new Date().getFullYear(),
        };
      });

      try {
        console.log(`Importing ${mappedData.length} records in batches...`);
        console.log("🔍 Sample mapped data (first 3 records):", mappedData.slice(0, 3));
        
        // Process in batches of 100 records to avoid server overload
        const batchSize = 100;
        const totalBatches = Math.ceil(mappedData.length / batchSize);
        let successCount = 0;
        let errorCount = 0;
        
        message.loading(`Importing ${mappedData.length} records... (0/${totalBatches} batches)`, 0);
        
        for (let i = 0; i < mappedData.length; i += batchSize) {
          const batch = mappedData.slice(i, i + batchSize);
          const batchNumber = Math.floor(i / batchSize) + 1;
          
          try {
            console.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} records)`);
            await apiClient.post("/team-report/bulk", { data: batch });
            successCount += batch.length;
            
            // Update progress message
            message.loading(`Importing ${mappedData.length} records... (${batchNumber}/${totalBatches} batches completed)`, 0);
            
            // Small delay to prevent overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 100));
            
          } catch (batchErr: any) {
            console.error(`Batch ${batchNumber} failed:`, batchErr);
            errorCount += batch.length;
            
            // Continue with next batch instead of stopping completely
            message.warning(`Batch ${batchNumber} failed, continuing with remaining batches...`);
          }
        }
        
        // Clear loading message
        message.destroy();
        
        if (errorCount === 0) {
          message.success(`Successfully imported all ${successCount} records!`);
        } else if (successCount > 0) {
          message.warning(`Imported ${successCount} records successfully, ${errorCount} records failed.`);
        } else {
          message.error('All batches failed to import.');
        }
        
        // Refresh data
        const res = await apiClient.get<ReportData[]>("/team-report");
        setData(res.data);
        
      } catch (err: any) {
        console.error('Error importing data:', err);
        console.error('Error response:', err.response?.data);
        message.destroy(); // Clear any loading messages
        message.error(err.response?.data?.error || 'Failed to import data');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Handle Excel export
  const handleExportExcel = () => {
    const exportData = data.map((row: ReportData) => ({
      'Tower': row.tower,
      'Client_Name': row.client_name,
      'Project_Name': row.project_name,
      'Business_unit': row.business_unit,
      'BU_Head': row.bu_head,
      'HC': row.hc,
      'Salary Cost': row.salary_cost,
      'SALES': row.sales,
      'GPM': row.gpm,
      'GPM %': row.gpm_percentage,
      'Loan Encash': row.leave_encashment,
      'Team Cost': row.team_cost,
      'Opr Cost': row.opr_cost,
      'Funding Cost': row.funding_cost,
      'NP': row.np,
      'NP %': row.np_percentage,
      'Month': row.month,
      'Year': row.year,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "TeamReport");
    XLSX.writeFile(workbook, "TeamReport.xlsx");
  };

  // Handle Excel template download
  const handleDownloadTemplate = () => {
    // Create a template with only headers (no sample data)
    const templateData = [
      {
        'Tower': '',
        'Client_Name': '',
        'Project_Name': '',
        'Business_unit': '',
        'BU_Head': '',
        'HC': '',
        'Salary Cost': '',
        'SALES': '',
        'GPM': '',
        'GPM %': '',
        'Loan Encash': '',
        'Team Cost': '',
        'Opr Cost': '',
        'Funding Cost': '',
        'NP': '',
        'NP %': '',
        'Month': '',
        'Year': '',
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    XLSX.writeFile(workbook, "TeamReport_Template.xlsx");
  };

  // Action dropdown items
  const actionDropdownItems = [
    {
      key: 'add',
      label: 'Add MFS Data',
      onClick: () => navigate('/AddTeamReportData')
    },
    {
      key: 'template',
      label: 'Download Template',
      onClick: handleDownloadTemplate
    },
    {
      key: 'import',
      label: 'Import Excel',
      onClick: () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xlsx, .xls';
        input.onchange = (e) => handleImportExcel(e as any);
        input.click();
      }
    },
    {
      key: 'export',
      label: 'Export Excel',
      onClick: handleExportExcel
    },
  ];

  // Handle adding a new comparison period
  const handleAddComparison = () => {
    if (comparisonValues.length < 5) {
      setComparisonValues([...comparisonValues, null]);
    }
  };

  // Handle removing a comparison period
  const handleRemoveComparison = (index: number) => {
    if (comparisonValues.length > 1) {
      const newValues = [...comparisonValues];
      newValues.splice(index, 1);
      setComparisonValues(newValues);
      
      // Also remove the corresponding combined period if it exists
      const newCombinedPeriods = [...combinedPeriods];
      newCombinedPeriods.splice(index, 1);
      setCombinedPeriods(newCombinedPeriods);
    }
  };

  // Handle changing a comparison period value
  const handleComparisonChange = (index: number, value: string | null) => {
    const newValues = [...comparisonValues];
    newValues[index] = value;
    setComparisonValues(newValues);
  };

  // Handle opening combined period modal
  const handleOpenCombinedModal = (index: number) => {
    setShowCombinedModal(index);
    setSelectedPeriodsForCombination([]);
  };

  // Handle creating combined period
  const handleCreateCombinedPeriod = (index: number) => {
    if (selectedPeriodsForCombination.length === 0) return;
    
    const combinedPeriod: CombinedPeriod = {
      periods: selectedPeriodsForCombination,
      label: selectedPeriodsForCombination.join(' + '),
      totalAmount: 0 // Will be calculated later
    };
    
    const newCombinedPeriods = [...combinedPeriods];
    newCombinedPeriods[index] = combinedPeriod;
    setCombinedPeriods(newCombinedPeriods);
    
    // Update comparison values to use the combined period
    const newValues = [...comparisonValues];
    newValues[index] = combinedPeriod.label;
    setComparisonValues(newValues);
    
    setShowCombinedModal(null);
    setSelectedPeriodsForCombination([]);
  };

  // Handle removing combined period
  const handleRemoveCombinedPeriod = (index: number) => {
    const newCombinedPeriods = [...combinedPeriods];
    newCombinedPeriods[index] = undefined as any;
    setCombinedPeriods(newCombinedPeriods);
    
    // Clear the comparison value
    const newValues = [...comparisonValues];
    newValues[index] = null;
    setComparisonValues(newValues);
  };

  // Check if a period is combined
  const isCombinedPeriod = (index: number) => {
    return combinedPeriods[index] !== undefined;
  };

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");
      if (storedUser && storedUser !== "undefined") {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        const userIsBUHead = parsedUser?.designation === 'BU HEAD';
        setIsBUHead(userIsBUHead);
        

        const buFromURL = queryParams.get('business_unit');
        if (buFromURL) {
          setSelectedBusinessUnit(buFromURL);
        } else if (userIsBUHead && parsedUser.business_unit) {
          setSelectedBusinessUnit(parsedUser.business_unit);
        }
      }
    } catch (error) {
      console.error("Failed to parse user data:", error);
    }
  }, []);

  // Handle URL parameters for MFS button redirect
  useEffect(() => {
    const defaultFinancialYear = queryParams.get('defaultFinancialYear');
    const compareTypeFromURL = queryParams.get('compareType');
    const selectedParamsFromURL = queryParams.get('selectedParameters');
    const chartTypeFromURL = queryParams.get('chartType');

    // Set default financial year quarters if coming from MFS button
    if (defaultFinancialYear && compareTypeFromURL === 'quarter') {
      const financialYear = parseInt(defaultFinancialYear);
      const quarters = [
        `Q1(Apr-Jun) ${financialYear}`,
        `Q2(Jul-Sep) ${financialYear}`,
        `Q3(Oct-Dec) ${financialYear}`,
        `Q4(Jan-Mar) ${financialYear}` // Q4 belongs to same financial year but next calendar year
      ];
      setComparisonValues(quarters);
    }

    // Set default parameters if coming from MFS button
    if (selectedParamsFromURL) {
      try {
        const params = decodeURIComponent(selectedParamsFromURL).split(',');
        setSelectedParameters(params);
      } catch (error) {
        console.warn('Failed to decode URL parameters in useEffect, using defaults:', error);
        setSelectedParameters(['GPM %', 'NP %']);
      }
    }

    // Set chart type if coming from MFS button
    if (chartTypeFromURL && ['bar', 'line', 'combo'].includes(chartTypeFromURL)) {
      setChartType(chartTypeFromURL as 'bar' | 'line' | 'combo');
    }
  }, []);

  // Extract available parameters from data and add calculated metrics
  useEffect(() => {
    if (data.length === 0) return;
    
    // Define available parameters - only the financial columns that behave like particulars
    const baseParameters = [
      'HC',
      'Salary Cost',
      'Sales',
      'GPM',
      'GPM %',
      'Leave Encashment',
      'Team Cost',
      'Opr Cost',
      'Funding Cost',
      'NP',
      'NP %'
    ];
    
    setAvailableParameters(baseParameters);
  }, [data]);

  useEffect(() => {
    if (data.length === 0) return;

    const periodMap = new Map<string, Date>();

    // Collect unique periods with their dates
    data.forEach(item => {
      const date = parseDate(item.month);
      if (isNaN(date.getTime())) return;

      let periodLabel = "";
      switch (compareType) {
        case "year":
          periodLabel = date.getFullYear().toString();
          break;
        case "month":
          periodLabel = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
          break;
        case "quarter":
          periodLabel = getFiscalQuarter(date).label;
          break;
      }

      // Only add if we haven't seen this label yet
      if (!periodMap.has(periodLabel)) {
        periodMap.set(periodLabel, date);
      }
    });

    // Sort periods by date descending
    const sortedPeriods = Array.from(periodMap.entries())
      .sort((a, b) => b[1].getTime() - a[1].getTime())
      .map(entry => entry[0]);

    setAvailableOptions(sortedPeriods);
  }, [data, compareType]);

  // Fetch business units from database
  const fetchBusinessUnits = async () => {
    try {
      console.log("🔍 Fetching business units from API...");
      console.log("🔍 API URL being called:", `${apiClient.defaults.baseURL}/team-report`);
      
      const res = await apiClient.get("/team-report");
      console.log("🔍 Raw API response:", res.data);
      console.log("🔍 Response status:", res.status);
      console.log("🔍 Response headers:", res.headers);
      
      if (res.data && Array.isArray(res.data)) {
        console.log("🔍 Total records received:", res.data.length);
        
        // Log all records to see what's actually in the database
        console.log("🔍 All records from database:", res.data);
        
        // Extract business units and filter out null/undefined values
        const businessUnitsFromData = res.data
          .map((item: any) => item.business_unit)
          .filter((bu: any) => bu && bu.trim() !== '');
        
        console.log("🔍 Business units from data:", businessUnitsFromData);
        
        const uniqueBusinessUnits = Array.from(new Set(businessUnitsFromData)) as string[];
        console.log("🔍 Unique business units:", uniqueBusinessUnits);
        
        setBusinessUnits(uniqueBusinessUnits);
        
        // If no business units found, show a warning
        if (uniqueBusinessUnits.length === 0) {
          console.warn("⚠️ No business units found in the database. The table might be empty.");
        }
      } else {
        console.warn("🔍 No data received from API or data is not an array");
        console.warn("🔍 Data type:", typeof res.data);
        console.warn("🔍 Data value:", res.data);
        setBusinessUnits([]);
      }
    } catch (error: any) {
      console.error("❌ Error fetching business units:", error);
      console.error("❌ Error details:", error.response?.data);
      console.error("❌ Error status:", error.response?.status);
      console.error("❌ Full error object:", error);
      setBusinessUnits([]);
    }
  };

  // Fetch client names based on selected business unit
  const fetchClientNames = async (businessUnit: string | null) => {
    if (!businessUnit) {
      setClientNames([]);
      return;
    }
    
    try {
      console.log(`🔍 Fetching client names for business unit: ${businessUnit}`);
      const res = await apiClient.get("/team-report");
      
      console.log(`🔍 Raw client data for ${businessUnit}:`, res.data);
      console.log(`🔍 Total records for ${businessUnit}:`, res.data?.length || 0);
      
      if (res.data && Array.isArray(res.data)) {
        // Filter data by business unit first
        const filteredData = res.data.filter((item: any) => 
          item.business_unit === businessUnit
        );
        
        console.log(`🔍 Filtered data for ${businessUnit}:`, filteredData);
        
        let uniqueNames: string[];
        if (businessUnit === "Managed Services" || businessUnit === "MS") {
          // For Managed Services, show project names
          const projectNames = filteredData
            .map((item: any) => item.project_name)
            .filter((name: any) => name && name.trim() !== '');
          console.log(`🔍 Project names for ${businessUnit}:`, projectNames);
          uniqueNames = Array.from(new Set(projectNames)) as string[];
        } else {
          // For other business units, show client names
          const clientNames = filteredData
            .map((item: any) => item.client_name)
            .filter((name: any) => name && name.trim() !== '');
          console.log(`🔍 Client names for ${businessUnit}:`, clientNames);
          uniqueNames = Array.from(new Set(clientNames)) as string[];
        }
        
        console.log(`🔍 Unique names for ${businessUnit}:`, uniqueNames);
        setClientNames(uniqueNames);
        setFilteredClientNames(uniqueNames);
      } else {
        console.warn(`🔍 No data received for business unit: ${businessUnit}`);
        setClientNames([]);
      }
    } catch (error: any) {
      console.error("❌ Error fetching client names:", error);
      console.error("❌ Error details:", error.response?.data);
      setClientNames([]);
    }
  };

  // Fetch BU heads based on selected business unit
  const fetchBUHeads = async (businessUnit: string | null) => {
    if (!businessUnit) {
      setBUHeads([]);
      return;
    }
    
    try {
      console.log(`🔍 Fetching BU heads for business unit: ${businessUnit}`);
      const res = await apiClient.get("/team-report");
      
      console.log(`🔍 Raw BU head data for ${businessUnit}:`, res.data);
      console.log(`🔍 Total records for ${businessUnit}:`, res.data?.length || 0);
      
      if (res.data && Array.isArray(res.data)) {
        // Filter data by business unit first
        const filteredData = res.data.filter((item: any) => 
          item.business_unit === businessUnit
        );
        
        console.log(`🔍 Filtered BU head data for ${businessUnit}:`, filteredData);
        
        const buHeadsFromData = filteredData
          .map((item: any) => item.bu_head)
          .filter((head: any) => head && head.trim() !== '');
        console.log(`🔍 BU heads for ${businessUnit}:`, buHeadsFromData);
        
        const uniqueBUHeads = Array.from(new Set(buHeadsFromData)) as string[];
        console.log(`🔍 Unique BU heads for ${businessUnit}:`, uniqueBUHeads);
        
        setBUHeads(uniqueBUHeads);
      } else {
        console.warn(`🔍 No data received for business unit: ${businessUnit}`);
        setBUHeads([]);
      }
    } catch (error: any) {
      console.error("❌ Error fetching BU heads:", error);
      console.error("❌ Error details:", error.response?.data);
      setBUHeads([]);
    }
  };

  // Fetch data with business unit filter
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        console.log("🔍 Fetching data with filters:", {
          selectedBusinessUnit,
          selectedClientName,
          selectedBUHead,
          isBUHead,
          userBusinessUnit: user.business_unit
        });
        
        // Always fetch all data and filter on frontend for better control
        const res = await apiClient.get("/team-report");
        
        console.log("🔍 Raw data received:", res.data?.length || 0, "records");
        
        // Filter data on frontend
        let filteredData = res.data || [];
        
        if (selectedBusinessUnit) {
          filteredData = filteredData.filter((item: any) => 
            item.business_unit === selectedBusinessUnit
          );
          console.log(`🔍 After business unit filter (${selectedBusinessUnit}):`, filteredData.length, "records");
        }
        
        if (selectedClientName) {
          if (selectedBusinessUnit === "Managed Services" || selectedBusinessUnit === "MS") {
            filteredData = filteredData.filter((item: any) => 
              item.project_name === selectedClientName
            );
            console.log(`🔍 After project name filter (${selectedClientName}):`, filteredData.length, "records");
          } else {
            filteredData = filteredData.filter((item: any) => 
              item.client_name === selectedClientName
            );
            console.log(`🔍 After client name filter (${selectedClientName}):`, filteredData.length, "records");
          }
        }
        
        if (selectedBUHead) {
          filteredData = filteredData.filter((item: any) => 
            item.bu_head === selectedBUHead
          );
          console.log(`🔍 After BU head filter (${selectedBUHead}):`, filteredData.length, "records");
        }
        
        if (isBUHead && user.business_unit) {
          filteredData = filteredData.filter((item: any) => 
            item.business_unit === user.business_unit
          );
          console.log(`🔍 After user BU filter (${user.business_unit}):`, filteredData.length, "records");
        }
        
        console.log("🔍 Final filtered data:", filteredData.length, "records");
        console.log("🔍 Sample filtered data:", filteredData.slice(0, 3));
        
        // Convert amounts to numbers and handle formatting
        const convertedData = filteredData.map((item: any) => {
          // Convert numeric fields to numbers
          const numericFields = ['hc', 'salary_cost', 'sales', 'gpm', 'gpm_percentage', 'leave_encashment', 'team_cost', 'opr_cost', 'funding_cost', 'np', 'np_percentage', 'year'];
          
          const processedItem = { ...item };
          
          for (const field of numericFields) {
            if (typeof processedItem[field] === 'string') {
              processedItem[field] = parseFloat(processedItem[field].replace(/,/g, '')) || 0;
            } else if (typeof processedItem[field] === 'number') {
              processedItem[field] = processedItem[field];
            } else {
              processedItem[field] = 0;
            }
          }
          
          // Create a proper date string for month field if it's just a month name
          if (processedItem.month && typeof processedItem.month === 'string') {
            const monthNames = [
              'January', 'February', 'March', 'April', 'May', 'June',
              'July', 'August', 'September', 'October', 'November', 'December'
            ];
            
            const monthIndex = monthNames.findIndex(month => 
              processedItem.month.toLowerCase().includes(month.toLowerCase())
            );
            
            if (monthIndex !== -1 && processedItem.year) {
              // Create a proper date string using the year from the data
              const year = processedItem.year || new Date().getFullYear();
              processedItem.month = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
            }
          }
          
          return processedItem;
        });
        
        setData(convertedData);
      } catch (error: any) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedBusinessUnit, selectedClientName, selectedBUHead, isBUHead, user?.business_unit]);

  // Fetch business units on component mount
  useEffect(() => {
    console.log("🚀 Component mounted, fetching business units...");
    console.log("🚀 Current businessUnits state:", businessUnits);
    fetchBusinessUnits();
  }, []);



  // Handle client name search
  const handleClientNameSearch = (value: string) => {
    if (!value) {
      setFilteredClientNames(clientNames);
      return;
    }
    
    const filtered = clientNames.filter(name => 
      name.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredClientNames(filtered);
  };

  // Fetch client names when business unit changes
  useEffect(() => {
    fetchClientNames(selectedBusinessUnit);
    setSelectedClientName(null); // Reset client name selection
  }, [selectedBusinessUnit]);

  // Fetch BU heads when business unit changes
  useEffect(() => {
    fetchBUHeads(selectedBusinessUnit);
    setSelectedBUHead(null); // Reset BU head selection
  }, [selectedBusinessUnit]);

  // Helper function to get base parameter value - moved to component level
  const getBaseParameterValue = useCallback((periodValue: string | null, index: number, parameter: string): number => {
    if (!periodValue) return 0;
    
    console.log(`🔍 getBaseParameterValue called:`, {
      periodValue,
      index,
      parameter,
      dataLength: data.length,
      selectedBusinessUnit,
      selectedClientName,
      selectedBUHead,
      compareType
    });
    
    // Check if this is a combined period
    const combinedPeriod = combinedPeriods[index];
    if (combinedPeriod && combinedPeriod.label === periodValue) {
      // Calculate total for combined periods
      return combinedPeriod.periods.reduce((total, period) => {
        return total + data
          .filter(item => {
            if (selectedBusinessUnit && item.business_unit !== selectedBusinessUnit) {
              return false;
            }
            // Filter by client name/project name if selected
            if (selectedClientName) {
              if (selectedBusinessUnit === "Managed Services" || selectedBusinessUnit === "MS") {
                if (item.project_name !== selectedClientName) return false;
              } else {
                if (item.client_name !== selectedClientName) return false;
              }
            }
            // Filter by BU head if selected
            if (selectedBUHead && item.bu_head !== selectedBUHead) {
              return false;
            }
            
            const date = parseDate(item.month);
            if (isNaN(date.getTime())) return false;
            
            let itemValue = "";
            switch (compareType) {
              case "year":
                itemValue = date.getFullYear().toString();
                break;
              case "month":
                itemValue = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
                break;
              case "quarter":
                itemValue = getFiscalQuarter(date).label;
                break;
              default:
                return false;
            }
            
            return itemValue === period;
          })
          .reduce((sum, item) => {
                  // Get the value based on the selected parameter
                  let value = 0;
                  switch (parameter) {
                    case 'Sales': value = item.sales || 0; break;
                    case 'GPM': value = item.gpm || 0; break;
                    case 'GPM %': value = item.gpm_percentage || 0; break;
                    case 'NP': value = item.np || 0; break;
                    case 'NP %': value = item.np_percentage || 0; break;
                    case 'Salary Cost': value = item.salary_cost || 0; break;
                    case 'Team Cost': value = item.team_cost || 0; break;
                    case 'Opr Cost': value = item.opr_cost || 0; break;
                    case 'Funding Cost': value = item.funding_cost || 0; break;
                    case 'Leave Encashment': value = item.leave_encashment || 0; break;
                    case 'HC': value = item.hc || 0; break;
                    default: 
                      console.warn(`🔍 Unknown parameter in combined period: ${parameter}`);
                      value = 0;
                  }
            return sum + value;
          }, 0);
      }, 0);
    }
    
    // Single period calculation
    const filteredData = data.filter(item => {
      // Business unit filter
      if (selectedBusinessUnit && item.business_unit !== selectedBusinessUnit) {
        return false;
      }
      
      // Client/Project name filter
      if (selectedClientName) {
        if (selectedBusinessUnit === "Managed Services" || selectedBusinessUnit === "MS") {
          if (item.project_name !== selectedClientName) return false;
        } else {
          if (item.client_name !== selectedClientName) return false;
        }
      }
      
      // BU head filter
      if (selectedBUHead && item.bu_head !== selectedBUHead) {
        return false;
      }
      
      // Date parsing and period matching
      const date = parseDate(item.month);
      if (isNaN(date.getTime())) {
        console.log(`🔍 Invalid date for item:`, item.month, item);
        return false;
      }
      
      let itemValue = "";
      switch (compareType) {
        case "year":
          itemValue = date.getFullYear().toString();
          break;
        case "month":
          itemValue = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
          break;
        case "quarter":
          itemValue = getFiscalQuarter(date).label;
          break;
        default:
          return false;
      }
      
      const matches = itemValue === periodValue;
      if (matches) {
        console.log(`🔍 Period match found:`, {
          itemValue,
          periodValue,
          item: {
            month: item.month,
            year: item.year,
            business_unit: item.business_unit,
            client_name: item.client_name,
            [parameter]: (item as any)[parameter.toLowerCase().replace(' ', '_').replace('%', '_percentage')] || (item as any)[parameter]
          }
        });
      }
      
      return matches;
    });
    
    console.log(`🔍 Filtered data for ${parameter} in ${periodValue}:`, filteredData.length, "items");
    console.log(`🔍 Sample filtered items:`, filteredData.slice(0, 3));
    
    return filteredData
      .reduce((sum, item) => {
        // Get the value based on the selected parameter
        let value = 0;
        switch (parameter) {
          case 'Sales': value = item.sales || 0; break;
          case 'GPM': value = item.gpm || 0; break;
          case 'GPM %': value = item.gpm_percentage || 0; break;
          case 'NP': value = item.np || 0; break;
          case 'NP %': value = item.np_percentage || 0; break;
          case 'Salary Cost': value = item.salary_cost || 0; break;
          case 'Team Cost': value = item.team_cost || 0; break;
          case 'Opr Cost': value = item.opr_cost || 0; break;
          case 'Funding Cost': value = item.funding_cost || 0; break;
          case 'Leave Encashment': value = item.leave_encashment || 0; break;
          case 'HC': value = item.hc || 0; break;
          default: 
            console.warn(`🔍 Unknown parameter: ${parameter}`);
            value = 0;
        }
        
        console.log(`🔍 Adding value for ${parameter}:`, {
          itemId: item.id,
          businessUnit: item.business_unit,
          clientName: item.client_name,
          month: item.month,
          parameter,
          value,
          runningSum: sum + value
        });
        
        return sum + value;
      }, 0);
  }, [data, selectedBusinessUnit, selectedClientName, selectedBUHead, compareType, combinedPeriods]);

  // Calculate comparison data when selections change
  useEffect(() => {
    console.log("🔍 Calculating comparison data...");
    console.log("🔍 selectedParameters:", selectedParameters);
    console.log("🔍 comparisonValues:", comparisonValues);
    console.log("🔍 data length:", data.length);
    console.log("🔍 compareType:", compareType);
    
    if (selectedParameters.length === 0 || comparisonValues.every(v => !v)) {
      console.log("🔍 No parameters or comparison values selected, skipping calculation");
      return;
    }

    const getPeriodAmountForParameter = (periodValue: string | null, index: number, parameter: string): number => {
      if (!periodValue) return 0;
      
      // Handle calculated metrics - these are now direct fields in our new structure
      // No need for complex calculations since we have direct percentage fields
      
      // For regular parameters, use the base function
      const value = getBaseParameterValue(periodValue, index, parameter);
      console.log(`🔍 Parameter ${parameter} for period ${periodValue}: ${value}`);
      return value;
    };
    
    // Create data structure for multiple parameters
    const periods = comparisonValues.filter(Boolean);
    console.log("🔍 Valid periods:", periods);
    
    const newComparisonData = periods.map((periodValue, index) => {
      const dataPoint: any = { period: periodValue as string };
      
      // Add amount for each parameter
      selectedParameters.forEach(parameter => {
        const value = getPeriodAmountForParameter(periodValue, index, parameter);
        dataPoint[parameter] = value;
        console.log(`🔍 Added ${parameter}: ${value} to period ${periodValue}`);
      });
      
      return dataPoint;
    });

    console.log("🔍 Final comparison data:", newComparisonData);
    console.log("🔍 Available parameters in comparison data:", newComparisonData.length > 0 ? Object.keys(newComparisonData[0]) : []);
    setComparisonData(newComparisonData);
  }, [comparisonValues, data, compareType, selectedBusinessUnit, selectedClientName, selectedBUHead, selectedParameters, combinedPeriods]);

  // Calculate growth analysis when selections change
  useEffect(() => {
    console.log("🔍 Calculating growth analysis...");
    console.log("🔍 comparisonValues:", comparisonValues);
    console.log("🔍 data length:", data.length);
    
    if (comparisonValues.filter(Boolean).length < 2) {
      console.log("🔍 Not enough periods for growth analysis, skipping");
      setGrowthAnalysis([]);
      return;
    }

    const calculateGrowth = (): GrowthAnalysis[] => {
      return availableParameters.map(param => {
        const periodAmounts = comparisonValues.map((periodValue, index) => {
          if (!periodValue) return null;
          
          // Handle calculated metrics - these are now direct fields in our new structure
          // No need for complex calculations since we have direct percentage fields
          
          // Check if this is a combined period
          const combinedPeriod = combinedPeriods[index];
          if (combinedPeriod && combinedPeriod.label === periodValue) {
            // Calculate total for combined periods
            return combinedPeriod.periods.reduce((total, period) => {
              return total + data
                .filter(item => {
                  if (selectedBusinessUnit && item.business_unit !== selectedBusinessUnit) return false;
                  // Filter by client name/project name if selected
                  if (selectedClientName) {
                    if (selectedBusinessUnit === "Managed Services" || selectedBusinessUnit === "MS") {
                      if (item.project_name !== selectedClientName) return false;
                    } else {
                      if (item.client_name !== selectedClientName) return false;
                    }
                  }
                  // Filter by BU head if selected
                  if (selectedBUHead && item.bu_head !== selectedBUHead) {
                    return false;
                  }
                  
                  const date = parseDate(item.month);
                  if (isNaN(date.getTime())) return false;
                  
                  let itemValue = "";
                  switch (compareType) {
                    case "year": itemValue = date.getFullYear().toString(); break;
                    case "month": itemValue = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`; break;
                    case "quarter": itemValue = getFiscalQuarter(date).label; break;
                    default: return false;
                  }
                  
                  return itemValue === period;
                })
                .reduce((sum, item) => {
                  // Get the value based on the selected parameter
                  let value = 0;
                  switch (param) {
                    case 'Sales': value = item.sales || 0; break;
                    case 'GPM': value = item.gpm || 0; break;
                    case 'GPM %': value = item.gpm_percentage || 0; break;
                    case 'NP': value = item.np || 0; break;
                    case 'NP %': value = item.np_percentage || 0; break;
                    case 'Salary Cost': value = item.salary_cost || 0; break;
                    case 'Team Cost': value = item.team_cost || 0; break;
                    case 'Opr Cost': value = item.opr_cost || 0; break;
                    case 'Funding Cost': value = item.funding_cost || 0; break;
                    case 'Leave Encashment': value = item.leave_encashment || 0; break;
                    case 'HC': value = item.hc || 0; break;
                    default: value = 0;
                  }
                  return sum + value;
                }, 0);
            }, 0);
          }
          
          // Single period calculation
          return data
            .filter(item => {
              if (selectedBusinessUnit && item.business_unit !== selectedBusinessUnit) return false;
              // Filter by client name/project name if selected
              if (selectedClientName) {
                if (selectedBusinessUnit === "Managed Services" || selectedBusinessUnit === "MS") {
                  if (item.project_name !== selectedClientName) return false;
                } else {
                  if (item.client_name !== selectedClientName) return false;
                }
              }
              // Filter by BU head if selected
              if (selectedBUHead && item.bu_head !== selectedBUHead) {
                return false;
              }
              
              const date = parseDate(item.month);
              if (isNaN(date.getTime())) return false;
              
              let itemValue = "";
              switch (compareType) {
                case "year": itemValue = date.getFullYear().toString(); break;
                case "month": itemValue = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`; break;
                case "quarter": itemValue = getFiscalQuarter(date).label; break;
                default: return false;
              }
              
              return itemValue === periodValue;
            })
            .reduce((sum, item) => {
              // Get the value based on the selected parameter
              let value = 0;
              switch (param) {
                case 'Sales': value = item.sales || 0; break;
                case 'GPM': value = item.gpm || 0; break;
                case 'GPM %': value = item.gpm_percentage || 0; break;
                case 'NP': value = item.np || 0; break;
                case 'NP %': value = item.np_percentage || 0; break;
                case 'Salary Cost': value = item.salary_cost || 0; break;
                case 'Team Cost': value = item.team_cost || 0; break;
                case 'Opr Cost': value = item.opr_cost || 0; break;
                case 'Funding Cost': value = item.funding_cost || 0; break;
                case 'Leave Encashment': value = item.leave_encashment || 0; break;
                case 'HC': value = item.hc || 0; break;
                default: value = 0;
              }
              return sum + value;
            }, 0);
        }).filter(amount => amount !== null);

        // Calculate changes between consecutive periods
        const changes: PeriodChange[] = [];
        for (let i = 1; i < periodAmounts.length; i++) {
          const firstAmount = periodAmounts[i-1] || 0;
          const secondAmount = periodAmounts[i] || 0;
          const absoluteChange = secondAmount - firstAmount;
          const percentageChange = firstAmount !== 0 
            ? (absoluteChange / Math.abs(firstAmount)) * 100 
            : secondAmount !== 0 ? Infinity : 0;

          changes.push({
            fromPeriod: comparisonValues[i-1] as string,
            toPeriod: comparisonValues[i] as string,
            absoluteChange,
            percentageChange,
            isPositive: absoluteChange >= 0
          });
        }

        return {
          parameter: param,
          periodValues: comparisonValues.map((period, i) => ({
            period,
            amount: periodAmounts[i] || 0
          })),
          changes
        };
      }).filter(item => item.periodValues.length > 0);
    };

    setGrowthAnalysis(calculateGrowth());
  }, [comparisonValues, data, compareType, selectedBusinessUnit, selectedClientName, selectedBUHead, availableParameters, combinedPeriods]);

  // Render comparison chart
  useEffect(() => {
    if (comparisonData.length === 0 || selectedParameters.length === 0) return;
    
    // Add a small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      // Check if the element exists before creating the chart
      const chartElement = document.getElementById("comparisonChart");
      if (!chartElement) {
        console.warn("Chart element not found, retrying in next render cycle");
        return;
      }
      
      // Cleanup existing chart
      am5.array.each(am5.registry.rootElements, (root) => {
        if (root && root.dom && root.dom.id === "comparisonChart") root.dispose();
      });

      const root = am5.Root.new("comparisonChart");
      root.setThemes([am5themes_Animated.new(root)]);

      const chart = root.container.children.push(
        am5xy.XYChart.new(root, {
          panX: false,
          panY: false,
          wheelX: "none",
          wheelY: "none",
          cursor: am5xy.XYCursor.new(root, {}),
          background: am5.Rectangle.new(root, { fill: am5.color(0xffffff) })
        })
      );

      // Create axes
      const xAxis = chart.xAxes.push(
        am5xy.CategoryAxis.new(root, {
          categoryField: "period",
          renderer: am5xy.AxisRendererX.new(root, {}),
          tooltip: am5.Tooltip.new(root, {})
        })
      );
      xAxis.get("renderer").labels.template.setAll({
        fill: am5.color(0x000000)
      });

      const yAxis = chart.yAxes.push(
        am5xy.ValueAxis.new(root, {
          renderer: am5xy.AxisRendererY.new(root, {}),
          tooltip: am5.Tooltip.new(root, {})
        })
      );
      yAxis.get("renderer").labels.template.setAll({
        fill: am5.color(0x000000)
      });

      // Define colors for different parameters
      const colors = [
        am5.color(0x677935), // Green
        am5.color(0x1890ff), // Blue
        am5.color(0xff4d4f), // Red
        am5.color(0xfaad14), // Yellow
        am5.color(0x722ed1), // Purple
        am5.color(0x13c2c2), // Cyan
        am5.color(0xeb2f96), // Magenta
        am5.color(0x52c41a), // Lime
      ];

      // Helper function to get format for parameter
      const getParameterFormat = (param: string) => {
        if (param === 'GPM %' || param === 'NP %') {
          return {
            prefix: '',
            suffix: '%',
            format: '#,##0.00'
          };
        }
        if (param === 'HC') {
          return {
            prefix: '',
            suffix: '',
            format: '#,##0'
          };
        }
        return {
          prefix: '₹',
          suffix: '',
          format: '#,##0.00'
        };
      };

      // Add series based on chart type
      if (chartType === 'bar' || chartType === 'combo') {
        selectedParameters.forEach((parameter, index) => {
          const format = getParameterFormat(parameter);
          const series = chart.series.push(
            am5xy.ColumnSeries.new(root, {
              name: parameter,
              xAxis: xAxis,
              yAxis: yAxis,
              valueYField: parameter,
              categoryXField: "period",
              tooltip: am5.Tooltip.new(root, {
                pointerOrientation: "horizontal",
                labelText: `{categoryX} - ${parameter}: ${format.prefix}{valueY.formatNumber('${format.format}')}${format.suffix}`,
                autoTextColor: false,
                labelHTML: `
                  <div style="
                    text-align: left; 
                    padding: 8px 12px; 
                    background: #ffffff; 
                    color: #333333; 
                    border-radius: 6px; 
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 12px;
                    line-height: 1.4;
                    min-width: 120px;
                  ">
                    <div style="font-weight: 600; margin-bottom: 4px; color: #1890ff; font-size: 11px;">{categoryX}</div>
                    <div style="font-weight: 500; margin-bottom: 2px; color: #666666; font-size: 11px;">${parameter}</div>
                    <div style="font-weight: 700; color: #000000; font-size: 13px;">${format.prefix}{valueY.formatNumber('${format.format}')}${format.suffix}</div>
                  </div>
                `
              })
            })
          );

          // Configure column appearance
          series.columns.template.setAll({
            width: am5.percent(60 / selectedParameters.length), // Adjust width based on number of parameters
            strokeOpacity: 0,
            cornerRadiusTL: 5,
            cornerRadiusTR: 5,
            tooltipY: 0,
            tooltipText: `{categoryX} - ${parameter}: ${format.prefix}{valueY.formatNumber('${format.format}')}${format.suffix}`,
            fill: colors[index % colors.length]
          });

          // Add hover state
          series.columns.template.states.create("hover", {
            fill: colors[index % colors.length],
            stroke: colors[index % colors.length]
          });

          // Add animation
          series.appear(1000, 100 * index);
        });
      }
      
      if (chartType === 'line' || chartType === 'combo') {
        selectedParameters.forEach((parameter, index) => {
          const format = getParameterFormat(parameter);
          const lineSeries = chart.series.push(
            am5xy.LineSeries.new(root, {
              name: parameter,
              xAxis: xAxis,
              yAxis: yAxis,
              valueYField: parameter,
              categoryXField: "period",
              tooltip: am5.Tooltip.new(root, {
                pointerOrientation: "horizontal",
                labelText: `{categoryX} - ${parameter}: ${format.prefix}{valueY.formatNumber('${format.format}')}${format.suffix}`,
                autoTextColor: false,
                labelHTML: `
                  <div style="
                    text-align: left; 
                    padding: 8px 12px; 
                    background: #ffffff; 
                    color: #333333; 
                    border-radius: 6px; 
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 12px;
                    line-height: 1.4;
                    min-width: 120px;
                  ">
                    <div style="font-weight: 600; margin-bottom: 4px; color: #1890ff; font-size: 11px;">{categoryX}</div>
                    <div style="font-weight: 500; margin-bottom: 2px; color: #666666; font-size: 11px;">${parameter}</div>
                    <div style="font-weight: 700; color: #000000; font-size: 13px;">${format.prefix}{valueY.formatNumber('${format.format}')}${format.suffix}</div>
                  </div>
                `
              })
            })
          );

          // Configure line appearance
          lineSeries.strokes.template.setAll({
            strokeWidth: 3,
            stroke: colors[index % colors.length]
          });

          // Add bullets with data labels
          lineSeries.bullets.push(() => {
            return am5.Bullet.new(root, {
              sprite: am5.Circle.new(root, {
                radius: 5,
                fill: colors[index % colors.length],
                stroke: am5.color(0xffffff),
                strokeWidth: 2
              })
            });
          });

          // Add data labels
          lineSeries.bullets.push(() => {
            return am5.Bullet.new(root, {
              sprite: am5.Label.new(root, {
                text: `${format.prefix}{valueY.formatNumber('${format.format}')}${format.suffix}`,
                fill: am5.color(0x000000),
                centerX: am5.p50,
                centerY: am5.p100,
                populateText: true,
                fontSize: 10,
                fontWeight: "500",
                dy: -10
              })
            });
          });

          // Add hover state
          lineSeries.strokes.template.states.create("hover", {
            strokeWidth: 4,
            stroke: colors[index % colors.length]
          });

          // Add animation
          lineSeries.appear(1000, 100 * index);
        });
      }

      // Add chart animation
      chart.appear(1000, 100);

      // Set data for all series
      xAxis.data.setAll(comparisonData);
      chart.series.values.forEach(series => {
        series.data.setAll(comparisonData);
      });
    }, 100); // 100ms delay

    return () => {
      clearTimeout(timer);
      am5.array.each(am5.registry.rootElements, (root) => {
        if (root && root.dom && root.dom.id === "comparisonChart") root.dispose();
      });
    };
  }, [comparisonData, selectedParameters, chartType]);

  // Render Profit Bridge and Trend Charts
  useEffect(() => {
    if (comparisonValues.length === 0 || !comparisonValues[comparisonValues.length - 1]) return;

    // Add a small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      // Profit Bridge Waterfall Chart
      const profitBridgeElement = document.getElementById("profitBridgeChart");
      if (profitBridgeElement) {
        // Cleanup existing chart
        am5.array.each(am5.registry.rootElements, (root) => {
          if (root && root.dom && root.dom.id === "profitBridgeChart") root.dispose();
        });

        const root = am5.Root.new("profitBridgeChart");
        root.setThemes([am5themes_Animated.new(root)]);

        const chart = root.container.children.push(
          am5xy.XYChart.new(root, {
            panX: false,
            panY: false,
            wheelX: "none",
            wheelY: "none",
            cursor: am5xy.XYCursor.new(root, {}),
            background: am5.Rectangle.new(root, { fill: am5.color(0xffffff) })
          })
        );

        // Create axes
        const xAxis = chart.xAxes.push(
          am5xy.CategoryAxis.new(root, {
            categoryField: "category",
            renderer: am5xy.AxisRendererX.new(root, {}),
            tooltip: am5.Tooltip.new(root, {})
          })
        );
        xAxis.get("renderer").labels.template.setAll({
          fill: am5.color(0x000000)
        });

        const yAxis = chart.yAxes.push(
          am5xy.ValueAxis.new(root, {
            renderer: am5xy.AxisRendererY.new(root, {}),
            tooltip: am5.Tooltip.new(root, {})
          })
        );
        yAxis.get("renderer").labels.template.setAll({
          fill: am5.color(0x000000)
        });

        // Get latest period data for waterfall - calculate independently of selected parameters
        const latestPeriodValue = comparisonValues[comparisonValues.length - 1];
        console.log("🔍 Waterfall Chart - Latest Period Value:", latestPeriodValue);
        
        if (latestPeriodValue) {
          // Calculate all parameters for the latest period independently
          const sales = getBaseParameterValue(latestPeriodValue, comparisonValues.length - 1, 'Sales') || 
                       getBaseParameterValue(latestPeriodValue, comparisonValues.length - 1, 'SALES') || 0;
          const salaryCost = getBaseParameterValue(latestPeriodValue, comparisonValues.length - 1, 'Salary Cost') || 0;
          const gpm = getBaseParameterValue(latestPeriodValue, comparisonValues.length - 1, 'GPM') || 0;
          const oprCost = getBaseParameterValue(latestPeriodValue, comparisonValues.length - 1, 'Opr Cost') || 0;
          const teamCost = getBaseParameterValue(latestPeriodValue, comparisonValues.length - 1, 'Team Cost') || 0;
          const fundingCost = getBaseParameterValue(latestPeriodValue, comparisonValues.length - 1, 'Funding Cost') || 0;
          const leaveEncashment = getBaseParameterValue(latestPeriodValue, comparisonValues.length - 1, 'Leave Encashment') || 0;
          const np = getBaseParameterValue(latestPeriodValue, comparisonValues.length - 1, 'NP') || 0;
          
          console.log("🔍 Waterfall Chart - Calculated Values:", {
            sales, salaryCost, gpm, oprCost, teamCost, fundingCost, leaveEncashment, np
          });
          
          // If we don't have the required parameters, show a message
          if (sales === 0 && gpm === 0 && np === 0) {
            console.log("🔍 Waterfall Chart - No data available for waterfall chart");
            // Add a message to the chart
            const noDataLabel = chart.children.push(
              am5.Label.new(root, {
                text: "No data available for waterfall chart.\nPlease check your data and filters.",
                centerX: am5.p50,
                centerY: am5.p50,
                fill: am5.color(0x666666),
                fontSize: 14,
                textAlign: "center"
              })
            );
            return;
          }

          const waterfallData = [
            { category: "Sales", value: sales, color: am5.color(0x4ade80) },
            { category: "(-) Salary Cost", value: -salaryCost, color: am5.color(0xf87171) },
            { category: "GPM", value: gpm, color: am5.color(0x3b82f6) },
            { category: "(-) Opr Cost", value: -oprCost, color: am5.color(0xf87171) },
            { category: "(-) Team Cost", value: -teamCost, color: am5.color(0xf87171) },
            { category: "(-) Funding Cost", value: -fundingCost, color: am5.color(0xf87171) },
            { category: "(-) Leave Encashment", value: -leaveEncashment, color: am5.color(0xf87171) },
            { category: "NP", value: np, color: am5.color(0x10b981) }
          ];

          const series = chart.series.push(
            am5xy.ColumnSeries.new(root, {
              name: "Profit Bridge",
              xAxis: xAxis,
              yAxis: yAxis,
              valueYField: "value",
              categoryXField: "category",
              tooltip: am5.Tooltip.new(root, {
                pointerOrientation: "horizontal",
                labelText: "{categoryX}: ₹{valueY.formatNumber('#,##0.00')}",
                autoTextColor: false,
                labelHTML: `
                  <div style="
                    text-align: left; 
                    padding: 8px 12px; 
                    background: #ffffff; 
                    color: #333333; 
                    border-radius: 6px; 
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 12px;
                    line-height: 1.4;
                    min-width: 120px;
                  ">
                    <div style="font-weight: 600; margin-bottom: 4px; color: #1890ff; font-size: 11px;">{categoryX}</div>
                    <div style="font-weight: 700; color: #000000; font-size: 13px;">₹{valueY.formatNumber('#,##0.00')}</div>
                  </div>
                `
              })
            })
          );

          series.columns.template.setAll({
            width: am5.percent(80),
            strokeOpacity: 0,
            cornerRadiusTL: 5,
            cornerRadiusTR: 5,
            tooltipY: 0
          });

          // Set colors for each column
          series.columns.template.adapters.add("fill", (fill, target) => {
            const dataItem = target.dataItem;
            if (dataItem && dataItem.dataContext) {
              return (dataItem.dataContext as any).color;
            }
            return fill;
          });

          series.appear(1000);
          xAxis.data.setAll(waterfallData);
          series.data.setAll(waterfallData);
        }
      }

      // Trend Chart (Sales, GPM, NP)
      const trendElement = document.getElementById("trendChart");
      if (trendElement) {
        // Cleanup existing chart
        am5.array.each(am5.registry.rootElements, (root) => {
          if (root && root.dom && root.dom.id === "trendChart") root.dispose();
        });

        const root = am5.Root.new("trendChart");
        root.setThemes([am5themes_Animated.new(root)]);

        const chart = root.container.children.push(
          am5xy.XYChart.new(root, {
            panX: false,
            panY: false,
            wheelX: "none",
            wheelY: "none",
            cursor: am5xy.XYCursor.new(root, {}),
            background: am5.Rectangle.new(root, { fill: am5.color(0xffffff) })
          })
        );

        // Create axes
        const xAxis = chart.xAxes.push(
          am5xy.CategoryAxis.new(root, {
            categoryField: "period",
            renderer: am5xy.AxisRendererX.new(root, {}),
            tooltip: am5.Tooltip.new(root, {})
          })
        );
        xAxis.get("renderer").labels.template.setAll({
          fill: am5.color(0x000000)
        });

        const yAxis = chart.yAxes.push(
          am5xy.ValueAxis.new(root, {
            renderer: am5xy.AxisRendererY.new(root, {}),
            tooltip: am5.Tooltip.new(root, {})
          })
        );
        yAxis.get("renderer").labels.template.setAll({
          fill: am5.color(0x000000)
        });

        // Sales series
        const salesSeries = chart.series.push(
          am5xy.LineSeries.new(root, {
            name: "Sales",
            xAxis: xAxis,
            yAxis: yAxis,
            valueYField: "sales",
            categoryXField: "period",
            stroke: am5.color(0x3b82f6),
            tooltip: am5.Tooltip.new(root, {
              pointerOrientation: "horizontal",
              labelText: "{categoryX} - Sales: ₹{valueY.formatNumber('#,##0.00')}",
              autoTextColor: false
            })
          })
        );

        // GPM series
        const gpmSeries = chart.series.push(
          am5xy.LineSeries.new(root, {
            name: "GPM",
            xAxis: xAxis,
            yAxis: yAxis,
            valueYField: "gpm",
            categoryXField: "period",
            stroke: am5.color(0x10b981),
            tooltip: am5.Tooltip.new(root, {
              pointerOrientation: "horizontal",
              labelText: "{categoryX} - GPM: ₹{valueY.formatNumber('#,##0.00')}",
              autoTextColor: false
            })
          })
        );

        // NP series
        const npSeries = chart.series.push(
          am5xy.LineSeries.new(root, {
            name: "NP",
            xAxis: xAxis,
            yAxis: yAxis,
            valueYField: "np",
            categoryXField: "period",
            stroke: am5.color(0xf59e0b),
            tooltip: am5.Tooltip.new(root, {
              pointerOrientation: "horizontal",
              labelText: "{categoryX} - NP: ₹{valueY.formatNumber('#,##0.00')}",
              autoTextColor: false
            })
          })
        );

        // Add bullets
        [salesSeries, gpmSeries, npSeries].forEach(series => {
          series.bullets.push(() => {
            return am5.Bullet.new(root, {
              sprite: am5.Circle.new(root, {
                radius: 4,
                fill: series.get("stroke"),
                stroke: am5.color(0xffffff),
                strokeWidth: 2
              })
            });
          });
        });

        // Add data labels to each series
        salesSeries.bullets.push(() => {
          return am5.Bullet.new(root, {
            sprite: am5.Label.new(root, {
              text: "₹{valueY.formatNumber('#,##0')}",
              fill: am5.color(0x000000),
              centerX: am5.p50,
              centerY: am5.p100,
              populateText: true,
              fontSize: 9,
              fontWeight: "500",
              dy: -8
            })
          });
        });

        gpmSeries.bullets.push(() => {
          return am5.Bullet.new(root, {
            sprite: am5.Label.new(root, {
              text: "₹{valueY.formatNumber('#,##0')}",
              fill: am5.color(0x000000),
              centerX: am5.p50,
              centerY: am5.p100,
              populateText: true,
              fontSize: 9,
              fontWeight: "500",
              dy: -8
            })
          });
        });

        npSeries.bullets.push(() => {
          return am5.Bullet.new(root, {
            sprite: am5.Label.new(root, {
              text: "₹{valueY.formatNumber('#,##0')}",
              fill: am5.color(0x000000),
              centerX: am5.p50,
              centerY: am5.p100,
              populateText: true,
              fontSize: 9,
              fontWeight: "500",
              dy: -8
            })
          });
        });

        // Set data - calculate independently for all periods
        const trendData = comparisonValues.filter(Boolean).map((periodValue, index) => {
          const sales = getBaseParameterValue(periodValue, index, 'Sales') || 
                       getBaseParameterValue(periodValue, index, 'SALES') || 0;
          const gpm = getBaseParameterValue(periodValue, index, 'GPM') || 0;
          const np = getBaseParameterValue(periodValue, index, 'NP') || 0;
          return {
            period: periodValue,
            sales,
            gpm,
            np
          };
        });

        xAxis.data.setAll(trendData);
        salesSeries.data.setAll(trendData);
        gpmSeries.data.setAll(trendData);
        npSeries.data.setAll(trendData);

        chart.appear(1000);
      }

      // Percentage Trend Chart (GPM % vs NP %)
      const percentageElement = document.getElementById("percentageTrendChart");
      if (percentageElement) {
        // Cleanup existing chart
        am5.array.each(am5.registry.rootElements, (root) => {
          if (root && root.dom && root.dom.id === "percentageTrendChart") root.dispose();
        });

        const root = am5.Root.new("percentageTrendChart");
        root.setThemes([am5themes_Animated.new(root)]);

        const chart = root.container.children.push(
          am5xy.XYChart.new(root, {
            panX: false,
            panY: false,
            wheelX: "none",
            wheelY: "none",
            cursor: am5xy.XYCursor.new(root, {}),
            background: am5.Rectangle.new(root, { fill: am5.color(0xffffff) })
          })
        );

        // Create axes
        const xAxis = chart.xAxes.push(
          am5xy.CategoryAxis.new(root, {
            categoryField: "period",
            renderer: am5xy.AxisRendererX.new(root, {}),
            tooltip: am5.Tooltip.new(root, {})
          })
        );
        xAxis.get("renderer").labels.template.setAll({
          fill: am5.color(0x000000)
        });

        const yAxis = chart.yAxes.push(
          am5xy.ValueAxis.new(root, {
            renderer: am5xy.AxisRendererY.new(root, {}),
            tooltip: am5.Tooltip.new(root, {}),
            min: 0
          })
        );
        yAxis.get("renderer").labels.template.setAll({
          fill: am5.color(0x000000)
        });

        // GPM % series
        const gpmPercentSeries = chart.series.push(
          am5xy.LineSeries.new(root, {
            name: "GPM %",
            xAxis: xAxis,
            yAxis: yAxis,
            valueYField: "gpmPercent",
            categoryXField: "period",
            stroke: am5.color(0x10b981),
            tooltip: am5.Tooltip.new(root, {
              pointerOrientation: "horizontal",
              labelText: "{categoryX} - GPM %: {valueY.formatNumber('#,##0.00')}%",
              autoTextColor: false
            })
          })
        );

        // NP % series
        const npPercentSeries = chart.series.push(
          am5xy.LineSeries.new(root, {
            name: "NP %",
            xAxis: xAxis,
            yAxis: yAxis,
            valueYField: "npPercent",
            categoryXField: "period",
            stroke: am5.color(0xf59e0b),
            tooltip: am5.Tooltip.new(root, {
              pointerOrientation: "horizontal",
              labelText: "{categoryX} - NP %: {valueY.formatNumber('#,##0.00')}%",
              autoTextColor: false
            })
          })
        );

        // Add bullets
        [gpmPercentSeries, npPercentSeries].forEach(series => {
          series.bullets.push(() => {
            return am5.Bullet.new(root, {
              sprite: am5.Circle.new(root, {
                radius: 4,
                fill: series.get("stroke"),
                stroke: am5.color(0xffffff),
                strokeWidth: 2
              })
            });
          });
        });

        // Add data labels to percentage series
        gpmPercentSeries.bullets.push(() => {
          return am5.Bullet.new(root, {
            sprite: am5.Label.new(root, {
              text: "{valueY.formatNumber('#,##0.0')}%",
              fill: am5.color(0x000000),
              centerX: am5.p50,
              centerY: am5.p100,
              populateText: true,
              fontSize: 9,
              fontWeight: "500",
              dy: -8
            })
          });
        });

        npPercentSeries.bullets.push(() => {
          return am5.Bullet.new(root, {
            sprite: am5.Label.new(root, {
              text: "{valueY.formatNumber('#,##0.0')}%",
              fill: am5.color(0x000000),
              centerX: am5.p50,
              centerY: am5.p100,
              populateText: true,
              fontSize: 9,
              fontWeight: "500",
              dy: -8
            })
          });
        });

        // Set data - calculate independently for all periods
        const percentageData = comparisonValues.filter(Boolean).map((periodValue, index) => {
          const sales = getBaseParameterValue(periodValue, index, 'Sales') || 
                       getBaseParameterValue(periodValue, index, 'SALES') || 0;
          const gpm = getBaseParameterValue(periodValue, index, 'GPM') || 0;
          const np = getBaseParameterValue(periodValue, index, 'NP') || 0;
          return {
            period: periodValue,
            gpmPercent: sales > 0 ? (gpm / sales) * 100 : 0,
            npPercent: sales > 0 ? (np / sales) * 100 : 0
          };
        });

        xAxis.data.setAll(percentageData);
        gpmPercentSeries.data.setAll(percentageData);
        npPercentSeries.data.setAll(percentageData);

        chart.appear(1000);
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      am5.array.each(am5.registry.rootElements, (root) => {
        if (root && root.dom && (root.dom.id === "profitBridgeChart" || root.dom.id === "trendChart" || root.dom.id === "percentageTrendChart")) {
          root.dispose();
        }
      });
    };
  }, [comparisonValues, data, selectedBusinessUnit, selectedClientName, selectedBUHead, compareType, combinedPeriods]);

  return (
    <div style={{ padding: 32, backgroundColor: '#ffffff', minHeight: '100vh', color: '#000000' }}>
      <style>
        {`
          .ant-select-selection-placeholder {
            color: #000000 !important;
          }
          .ant-select-selection-item {
            color: #000000 !important;
          }
          .ant-select-arrow {
            color: #000000 !important;
          }
          .ant-select-selector {
            background-color: #ffffff !important;
            border-color: #004a7a !important;
          }
          .ant-select-selector .ant-select-selection-item {
            color: #000000 !important;
          }
          .ant-select-selector .ant-select-selection-placeholder {
            color: #000000 !important;
          }
          .ant-select-dropdown {
            background-color: #ffffff !important;
          }
          .ant-select-dropdown * {
            color: #000000 !important;
          }
          .ant-select-item {
            color: #000000 !important;
            background-color: #ffffff !important;
          }
          .ant-select-item * {
            color: #000000 !important;
          }
          .ant-select-item-option-selected {
            background-color: #e6f7ff !important;
            color: #000000 !important;
          }
          .ant-select-item-option-selected * {
            color: #000000 !important;
          }
          .ant-select-item-option-active {
            background-color: #f5f5f5 !important;
            color: #000000 !important;
          }
          .ant-select-item-option-active * {
            color: #000000 !important;
          }
          .ant-select-item-option-content {
            color: #000000 !important;
          }
          .ant-select-dropdown .ant-select-item-option {
            color: #000000 !important;
          }
          .ant-select-dropdown .ant-select-item-option * {
            color: #000000 !important;
          }
          .ant-btn-dashed {
            color: #000000 !important;
            border-color: #004a7a !important;
            background-color: #ffffff !important;
          }
          .ant-btn-dashed:hover {
            color: #000000 !important;
            border-color: #00345a !important;
            background-color: #f5f5f5 !important;
          }
          .ant-btn-dashed:focus {
            color: #000000 !important;
            border-color: #004a7a !important;
            background-color: #ffffff !important;
          }
          .ant-btn-dashed * {
            color: #000000 !important;
          }
          .ant-btn-dashed span {
            color: #000000 !important;
          }
          .ant-btn-dashed .anticon {
            color: #000000 !important;
          }
                    .ant-btn-dashed .anticon-plus {
            color: #000000 !important;
          }
          .ant-tabs-tab {
            color: #000000 !important;
            background-color: #ffffff !important;
          }
          .ant-tabs-tab-active {
            color: #000000 !important;
            background-color: #ffffff !important;
          }
          .ant-tabs-tab:hover {
            color: #000000 !important;
          }
          .ant-tabs-content {
            background-color: #ffffff !important;
          }
          .ant-tabs-tabpane {
            background-color: #ffffff !important;
          }
          .ant-tabs-ink-bar {
            background-color: #1890ff !important;
          }
        `}
      </style>
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
        }}>MFS Comparison</h2>
        <div className="auth-buttons-container">
          <Dropdown
            menu={{ items: actionDropdownItems }}
            trigger={['click']}
            open={isActionDropdownOpen}
            onOpenChange={setIsActionDropdownOpen}
          >
            <button className="auth-button" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Actions <DownOutlined />
            </button>
          </Dropdown>
          <button className="auth-button" onClick={() => navigate('/HomePage')}>
            Home
          </button>
        </div>
      </div>

      <div style={{ margin: "6rem 24px 24px 24px" }}>
  <div style={{ 
    display: "flex", 
    gap: 16,
    alignItems: "center",
    flexWrap: "wrap"
  }}>
    {/* Business Unit Filter */}
    <div style={{ marginBottom: 16 }}>
      <label style={{ color: '#000000' }}>Business Unit:</label>
      <Select
        value={selectedBusinessUnit || ''}
        onChange={(value) => setSelectedBusinessUnit(value || null)}
        style={{ width: 200, marginLeft: 8 }}
        disabled={isBUHead}
        allowClear={!isBUHead}
        showSearch
        filterOption={(input, option) =>
          (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
        }
        optionFilterProp="children"
      >
        <Option value="">All Business Units</Option>
        {businessUnits.map((bu: string) => (
          <Option key={bu} value={bu}>{bu}</Option>
        ))}
        {businessUnits.length === 0 && (
          <Option value="create_sample" disabled>
            No data found - Click "Create Sample Data" below
          </Option>
        )}
      </Select>
    </div>

    {/* Client Name / Project Name Filter */}
    <div style={{ marginBottom: 16 }}>
      <label style={{ color: '#000000' }}>
        {selectedBusinessUnit === "Managed Services" || selectedBusinessUnit === "MS" ? "Project Name:" : "Client Name:"}
      </label>
      <AutoComplete
        value={selectedClientName || ''}
        onChange={(value) => setSelectedClientName(value || null)}
        onSearch={handleClientNameSearch}
        style={{ width: 200, marginLeft: 8 }}
        placeholder={selectedBusinessUnit === "Managed Services" || selectedBusinessUnit === "MS" ? "Search projects..." : "Search clients..."}
        allowClear
        disabled={!selectedBusinessUnit}
        options={[
          { value: '', label: selectedBusinessUnit === "Managed Services" || selectedBusinessUnit === "MS" ? "All Projects" : "All Clients" },
          ...filteredClientNames.map((name: string) => ({
            value: name,
            label: name
          }))
        ]}
        filterOption={false}
      />
    </div>

    {/* BU Head Filter */}
    <div style={{ marginBottom: 16 }}>
      <label style={{ color: '#000000' }}>BU Head:</label>
      <Select
        value={selectedBUHead || ''}
        onChange={(value) => setSelectedBUHead(value || null)}
        style={{ width: 200, marginLeft: 8 }}
        allowClear
        disabled={!selectedBusinessUnit}
        showSearch
        filterOption={(input, option) =>
          (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
        }
        optionFilterProp="children"
      >
        <Option value="">All BU Heads</Option>
        {buHeads.map((head: string) => (
          <Option key={head} value={head}>{head}</Option>
        ))}
      </Select>
    </div>
    
    {/* Parameter Selector */}
    <div style={{ marginBottom: 16 }}>
      <label style={{ color: '#000000' }}>Compare Parameters:</label>
      <Select
        mode="multiple"
        value={selectedParameters}
        onChange={(value) => setSelectedParameters(value)}
        style={{ width: 300, marginLeft: 8 }}
        placeholder="Select parameters to compare"
        loading={isLoading}
        allowClear
        showSearch
        filterOption={(input, option) =>
          (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
        }
        optionFilterProp="children"
      >
        {availableParameters.map((param: string) => (
          <Option key={param} value={param}>{param}</Option>
        ))}
      </Select>
    </div>

    {/* Chart Type Selector */}
    <div style={{ marginBottom: 16 }}>
      <label style={{ color: '#000000' }}>Chart Type:</label>
      <Select
        value={chartType}
        onChange={(value: 'bar' | 'line' | 'combo') => setChartType(value)}
        style={{ width: 120, marginLeft: 8 }}
      >
        <Option value="bar">Bar Chart</Option>
        <Option value="line">Line Chart</Option>
        <Option value="combo">Combo Chart</Option>
      </Select>
    </div>

    {/* Compare Type Selector */}
    <div style={{ marginBottom: 16 }}>
      <label style={{ color: '#000000' }}>Compare by:</label>
      <Select
        value={compareType}
        onChange={(value: CompareType) => {
          setCompareType(value);
          setComparisonValues([null, null]);
        }}
        style={{ width: 120, marginLeft: 8 }}
        disabled={isLoading}
      >
        <Option value="year">Year</Option>
        <Option value="quarter">Quarter</Option>
        <Option value="month">Month</Option>
      </Select>
    </div>

    {/* Status Message */}
    <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ color: '#666666', fontSize: '12px' }}>
        {businessUnits.length === 0 
          ? "No business units found. Use 'Download Template' to get the correct Excel format."
          : `${businessUnits.length} business units loaded: ${businessUnits.join(', ')}`
        }
      </span>
    </div>
  </div>

       
         {/* Period Selectors */}
  <div style={{ marginBottom: 24 }}>
    <label style={{ color: '#000000' }}>Comparison Periods ({compareType}):</label>
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
      {comparisonValues.map((value, index) => (
        <div key={index} style={{ display: 'flex', alignItems: 'center', minWidth: 280, width: '280px' }}>
          <Select
            value={value}
            onChange={(val) => handleComparisonChange(index, val)}
            style={{ width: '100%' }}
            placeholder={`Select ${index === 0 ? 'baseline' : 'compare'} ${compareType}`}
            loading={isLoading}
            showSearch
            filterOption={(input, option) =>
              (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
            }
            optionFilterProp="children"
          >
            {availableOptions.map((option: string) => (
              <Option key={option} value={option}>{option}</Option>
            ))}
          </Select>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'combine',
                  label: 'Combine Periods',
                  icon: <PlusOutlined />,
                  onClick: () => handleOpenCombinedModal(index)
                },
                {
                  key: 'remove',
                  label: 'Remove Period',
                  icon: <CloseOutlined />,
                  danger: true,
                  onClick: () => handleRemoveComparison(index)
                }
              ]
            }}
            trigger={['click']}
          >
            <Button 
              type="text" 
              icon={<DownOutlined />}
              style={{ marginLeft: 4, padding: '2px 6px', height: '24px', minWidth: '16px' }}
              title="Period actions"
            />
          </Dropdown>
        </div>
      ))}
      {comparisonValues.length < 5 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={handleAddComparison}
            style={{ height: 32, padding: '4px 8px' }}
          >
            Add
          </Button>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'add-combine',
                  label: 'Add & Combine',
                  icon: <PlusOutlined />,
                  onClick: () => {
                    handleAddComparison();
                    setTimeout(() => {
                      handleOpenCombinedModal(comparisonValues.length);
                    }, 100);
                  }
                },
                {
                  key: 'remove-last',
                  label: 'Remove Last',
                  icon: <CloseOutlined />,
                  danger: true,
                  disabled: comparisonValues.length <= 1,
                  onClick: () => {
                    if (comparisonValues.length > 1) {
                      handleRemoveComparison(comparisonValues.length - 1);
                    }
                  }
                }
              ]
            }}
            trigger={['click']}
          >
            <Button 
              type="text" 
              icon={<DownOutlined />}
              style={{ height: 32, padding: '4px 6px', minWidth: '16px' }}
              title="More actions"
            />
          </Dropdown>
        </div>
      )}
    </div>
  </div>
</div>
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#000000' }}>Loading data...</div>
      ) : selectedParameters.length > 0 && comparisonValues.some(v => v) ? (
        comparisonData.length > 0 ? (
          <>
            <div style={{ width: "100%", height: "500px" }}>
              <h3 style={{ color: '#000000' }}>{selectedParameters.join(', ')} Comparison</h3>
              <div id="comparisonChart" style={{ width: "100%", height: "100%" }} />
            </div>

            {/* Growth Analysis Dashboard */}
            {comparisonValues.filter(Boolean).length >= 2 && growthAnalysis.length > 0 && (
              <div style={{ marginTop: 40 }}>
                <h2 style={{ color: '#000000' }}>Growth Analysis Report</h2>
<p style={{ marginBottom: 16, color: '#000000' }}>
  Comparing {comparisonValues.filter(Boolean).join(' vs ')} for {selectedBusinessUnit || "All Business Units"}
  {selectedClientName && ` - ${selectedBusinessUnit === "Managed Services" || selectedBusinessUnit === "MS" ? "Project" : "Client"}: ${selectedClientName}`}
  {selectedBUHead && ` - BU Head: ${selectedBUHead}`}
</p>

<div style={{
  border: '1px solid #d9d9d9',
  borderRadius: 4,
  overflow: 'hidden',
  backgroundColor: '#ffffff'
}}>
  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
    <thead>
      <tr style={{ backgroundColor: '#f5f5f5' }}>
        <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #d9d9d9', color: '#000000' }}>Parameter</th>
        {comparisonValues.filter(Boolean).map((period, i) => (
          <th key={i} style={{ padding: '12px 16px', textAlign: 'right', borderBottom: '1px solid #d9d9d9', color: '#000000' }}>
            {period}
          </th>
        ))}
        <th style={{ padding: '12px 16px', textAlign: 'right', borderBottom: '1px solid #d9d9d9', color: '#000000' }}>Absolute Change</th>
        <th style={{ padding: '12px 16px', textAlign: 'right', borderBottom: '1px solid #d9d9d9', color: '#000000' }}>Growth %</th>
      </tr>
    </thead>
    <tbody>
      {(showAllParameters ? growthAnalysis : growthAnalysis.filter(item => selectedParameters.includes(item.parameter))).map((item, index) => {
        // Calculate growth between first and last period for each parameter
        const firstPeriodAmount = item.periodValues[0]?.amount || 0;
        const lastPeriodAmount = item.periodValues[item.periodValues.length - 1]?.amount || 0;
        const absoluteChange = lastPeriodAmount - firstPeriodAmount;
        const growthPercentage = firstPeriodAmount !== 0 
          ? ((absoluteChange) / Math.abs(firstPeriodAmount)) * 100 
          : lastPeriodAmount !== 0 ? Infinity : 0;
        const isPositive = absoluteChange >= 0;

        return (
          <tr key={item.parameter} style={{ 
            backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9f9f9',
            borderBottom: '1px solid #d9d9d9',
            color: '#000000'
          }}>
            <td style={{ padding: '12px 16px', fontWeight: 500, color: '#000000' }}>{item.parameter}</td>
            {item.periodValues.filter(pv => pv.period).map((pv, i) => {
              return (
                <td key={i} style={{ padding: '12px 16px', textAlign: 'right', color: '#000000' }}>
                  {formatValueForTable(pv.amount, item.parameter)}
                </td>
              );
            })}
            <td style={{ 
              padding: '12px 16px', 
              textAlign: 'right',
              color: isPositive ? '#4ade80' : '#f87171'
            }}>
              {isPositive ? '+' : ''}
              {formatValueForTable(absoluteChange, item.parameter)}
            </td>
            <td style={{ 
              padding: '12px 16px', 
              textAlign: 'right',
              color: isPositive ? '#4ade80' : '#f87171',
              fontWeight: 600
            }}>
              {isPositive ? '+' : ''}
              {growthPercentage === Infinity ? '∞' : growthPercentage.toFixed(2)}%
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
</div>

{/* Expand/Collapse Button */}
<div style={{ textAlign: 'center', marginTop: 16 }}>
  <Button
    type="dashed"
    onClick={() => setShowAllParameters(!showAllParameters)}
    style={{ 
      color: '#000000',
      borderColor: '#004a7a',
      backgroundColor: '#ffffff'
    }}
  >
    {showAllParameters ? 'Show Only Selected Parameters' : 'Show All Parameters'}
  </Button>
</div>

                {/* Summary Cards */}
<div style={{ 
  display: 'grid', 
  gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', // Increased min width
  gap: 16,
  marginTop: 24
}}>
  <div style={{
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
    minWidth: '380px', // Added min-width
    border: '1px solid #d9d9d9'
  }}>
    <h3 style={{ marginTop: 0, color: '#000000' }}>Top Growth</h3>
    {growthAnalysis
      .flatMap(item => 
        item.changes
          .filter(change => change.isPositive)
          .map(change => ({
            ...change,
            parameter: item.parameter // Include parameter name
          }))
      )
      .sort((a, b) => b.percentageChange - a.percentageChange)
      .slice(0, 3)
      .map((change, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
                      <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontWeight: 500, color: '#000000' }}>{change.parameter}</div>
                <div style={{ fontSize: 12, color: '#666666' }}>
                  {change.fromPeriod} → {change.toPeriod}
                </div>
              </div>
              <span style={{ 
                color: '#4ade80', 
                fontWeight: 600,
                fontSize: 14
              }}>
                +{change.percentageChange.toFixed(2)}%
              </span>
            </div>
        </div>
      ))}
  </div>

  <div style={{
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
    minWidth: '380px', // Added min-width
    border: '1px solid #d9d9d9'
  }}>
    <h3 style={{ marginTop: 0, color: '#000000' }}>Top Decline</h3>
    {growthAnalysis
      .flatMap(item => 
        item.changes
          .filter(change => !change.isPositive)
          .map(change => ({
            ...change,
            parameter: item.parameter // Include parameter name
          }))
      )
      .sort((a, b) => a.percentageChange - b.percentageChange)
      .slice(0, 3)
      .map((change, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
                      <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontWeight: 500, color: '#000000' }}>{change.parameter}</div>
                <div style={{ fontSize: 12, color: '#666666' }}>
                  {change.fromPeriod} → {change.toPeriod}
                </div>
              </div>
              <span style={{ 
                color: '#f87171', 
                fontWeight: 600,
                fontSize: 14
              }}>
                {change.percentageChange.toFixed(2)}%
              </span>
            </div>
        </div>
      ))}
  </div>

  <div style={{
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
    minWidth: '380px', // Added min-width
    border: '1px solid #d9d9d9'
  }}>
    <h3 style={{ marginTop: 0, color: '#000000' }}>Summary</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#000000' }}>Parameters Increased:</span>
        <span style={{ fontWeight: 500, color: '#000000' }}>
          {growthAnalysis
            .flatMap(item => item.changes)
            .filter(change => change.isPositive).length}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#000000' }}>Parameters Decreased:</span>
        <span style={{ fontWeight: 500, color: '#000000' }}>
          {growthAnalysis
            .flatMap(item => item.changes)
            .filter(change => !change.isPositive).length}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#000000' }}>Highest Growth:</span>
        <span style={{ fontWeight: 500, color: '#000000' }}>
          {growthAnalysis.length > 0 
            ? `${Math.max(...growthAnalysis.flatMap(item => 
                item.changes.map(c => c.percentageChange))).toFixed(2)}%`
            : '-'}
        </span>
      </div>
  </div>
</div>

<div style={{
  backgroundColor: '#ffffff',
  borderRadius: 8,
  padding: 16,
  boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
  marginTop: 16,
  width: '100%',
  border: '1px solid #d9d9d9'
}}>
  <h3 style={{ marginTop: 0, borderBottom: '1px solid #d9d9d9', paddingBottom: 8, color: '#000000' }}>
    Efficiency Dashboard
  </h3>
  
  {(() => {
    // Get required metrics for all periods
    const allPeriods = comparisonValues.filter(Boolean);
    if (allPeriods.length < 2) {
      return <div style={{ color: '#000000', padding: 16, textAlign: 'center' }}>
        Select at least 2 periods to compare efficiency metrics
      </div>;
    }

    const metrics = allPeriods.map(period => {
      const periodData = growthAnalysis
        .map(item => ({
          parameter: item.parameter,
          amount: item.periodValues.find(pv => pv.period === period)?.amount || 0
        }));

      return {
        period,
        hc: periodData.find(i => i.parameter === "HC")?.amount || 0,
        teamCost: periodData.find(i => i.parameter === "Team Cost")?.amount || 0,
        revenue: periodData.find(i => i.parameter === "Sales")?.amount || 0,
        gpm: periodData.find(i => i.parameter === "GPM")?.amount || 0,
        netMargin: periodData.find(i => i.parameter === "NP")?.amount || 0
      };
    });

    const baseline = metrics[0];
    
    // Key efficiency metrics to track
    const metricDefinitions = [
      {
        name: "Cost Efficiency",
        calculate: (m: typeof metrics[0]) => m.teamCost / (m.netMargin || 1),
        ideal: 'decrease',
        unit: '₹'
      },
      {
        name: "Sales per HC",
        calculate: (m: typeof metrics[0]) => m.revenue / (m.hc || 1),
        ideal: 'increase',
        unit: '₹'
      },
      {
        name: "Margin per ₹ Team Cost",
        calculate: (m: typeof metrics[0]) => m.netMargin / (m.teamCost || 1),
        ideal: 'increase',
        unit: '₹'
      },
      {
        name: "Team Cost % of Sales",
        calculate: (m: typeof metrics[0]) => (m.teamCost / (m.revenue || 1)) * 100,
        ideal: 'decrease',
        unit: '%'
      },
      {
        name: "NP %",
        calculate: (m: typeof metrics[0]) => (m.netMargin / (m.revenue || 1)) * 100,
        ideal: 'increase',
        unit: '%'
      }
    ];

    return (
      <div>
       {/* Summary Trend Cards */}
<div style={{ 
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',  // Increased from 220px to 280px
  gap: 16,  // Increased gap from 12px to 16px
  marginBottom: 24  // Increased margin from 20px to 24px
}}>
  {metricDefinitions.map((metric, i) => {
    const currentValue = metric.calculate(metrics[metrics.length - 1]);
    const baselineValue = metric.calculate(baseline);
    const change = currentValue - baselineValue;
    const percentageChange = baselineValue !== 0 ? (change / Math.abs(baselineValue)) * 100 : 0;
    const isPositive = metric.ideal === 'increase' ? change >= 0 : change <= 0;
    
    return (
      <div key={i} style={{
        backgroundColor: '#ffffff',
        borderRadius: 8,  // Increased from 6px
        padding: 16,  // Increased from 12px
        borderLeft: `4px solid ${isPositive ? '#4ade80' : '#f87171'}`,
        minHeight: '100px',  // Added fixed height
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        border: '1px solid #d9d9d9'
      }}>
        <div style={{ 
          fontWeight: 600, 
          fontSize: 16,
          marginBottom: 8,  // Added margin
          color: '#000000'
        }}>
          {metric.name}
        </div>
        <div style={{ 
          fontSize: 20,  // Increased from 18px
          fontWeight: 700,
          margin: '8px 0',  // Increased margin
          color: '#000000'
        }}>
          {metric.name === "Sales per HC" 
            ? `${currentValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₹`
            : `${currentValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${metric.unit}`
          }
        </div>
        <div style={{ 
          fontSize: 14,  // Increased from 13px
          color: isPositive ? '#4ade80' : '#f87171',
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          <span style={{ fontSize: 16 }}>
            {isPositive ? '↑' : '↓'}
          </span>
          <span style={{ color: '#000000' }}>
            {Math.abs(percentageChange).toFixed(2)}% vs baseline
          </span>
        </div>
      </div>
    );
  })}
</div>

        {/* Detailed Comparison Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#000000' }}>Metric</th>
                {metrics.map((m, i) => (
                  <th key={i} style={{ padding: '12px 16px', textAlign: 'right', color: '#000000' }}>
                    {m.period}
                    {i === 0 && <div style={{ fontSize: 12, fontWeight: 400, color: '#000000' }}>(Baseline)</div>}
                  </th>
                ))}
                <th style={{ padding: '12px 16px', textAlign: 'right', color: '#000000' }}>Change vs Baseline</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', color: '#000000' }}>Trend</th>
              </tr>
            </thead>
            <tbody>
              {metricDefinitions.map((metric, i) => (
                <tr key={i} style={{ 
                  borderBottom: '1px solid #d9d9d9',
                  backgroundColor: i % 2 === 0 ? '#ffffff' : '#f9f9f9',
                  color: '#000000'
                }}>
                  <td style={{ padding: '12px 16px', fontWeight: 500, color: '#000000' }}>{metric.name}</td>
                  
                  {metrics.map((m, j) => {
                    const value = metric.calculate(m);
                    const baselineValue = metric.calculate(baseline);
                    const change = value - baselineValue;
                    const isPositive = metric.ideal === 'increase' ? change >= 0 : change <= 0;
                    
                    return (
                      <td key={j} style={{ padding: '12px 16px', textAlign: 'right', color: '#000000' }}>
                        <div style={{ color: '#000000' }}>
                          {metric.name === "Sales per HC" 
                            ? `${value.toFixed(2)}₹`
                            : `${value.toFixed(2)}${metric.unit}`
                          }
                        </div>
                        {j > 0 && (
                          <div style={{ 
                            fontSize: 12,
                            color: isPositive ? '#4ade80' : '#f87171'
                          }}>
                            {isPositive ? '+' : ''}
                            {metric.name === "Sales per HC" 
                              ? `${change.toFixed(2)}₹`
                              : `${change.toFixed(2)}${metric.unit}`
                            }
                          </div>
                        )}
                      </td>
                    );
                  })}
                  
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    {(() => {
                      const current = metric.calculate(metrics[metrics.length - 1]);
                      const baselineValue = metric.calculate(baseline);
                      const change = current - baselineValue;
                      const pctChange = baselineValue !== 0 ? (change / Math.abs(baselineValue)) * 100 : 0;
                      const isPositive = metric.ideal === 'increase' ? change >= 0 : change <= 0;
                      
                      return (
                        <div style={{ color: isPositive ? '#4ade80' : '#f87171' }}>
                          {isPositive ? '+' : ''}
                          {metric.name === "Sales per HC" 
                            ? `${change.toFixed(2)}₹`
                            : `${change.toFixed(2)}${metric.unit}`
                          } ({pctChange.toFixed(2)}%)
                        </div>
                      );
                    })()}
                  </td>
                  
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {(() => {
                      const values = metrics.map(m => metric.calculate(m));
                      const isImproving = values.every((val, idx, arr) => 
                        idx === 0 || 
                        (metric.ideal === 'increase' ? val >= arr[idx-1] : val <= arr[idx-1])
                      );
                      
                      return (
                        <div style={{ 
                          color: isImproving ? '#4ade80' : '#f87171',
                          fontWeight: 600
                        }}>
                          {isImproving ? 'Consistent Improvement' : 'Fluctuating'}
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Period-to-Period Changes */}
        <h4 style={{ margin: '24px 0 12px 0', color: '#000000' }}>
          Period-to-Period Changes
        </h4>
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
          gap: 16
        }}>
          {metrics.slice(1).map((metric, i) => {
            const prevMetric = metrics[i];
            return (
              <div key={i} style={{
                backgroundColor: '#ffffff',
                borderRadius: 6,
                padding: 16,
                border: '1px solid #d9d9d9'
              }}>
                <h4 style={{ marginTop: 0, borderBottom: '1px solid #d9d9d9', paddingBottom: 8, color: '#000000' }}>
                  {prevMetric.period} → {metric.period}
                </h4>
                <div style={{ display: 'grid', gap: 12 }}>
                  {metricDefinitions.map((def, j) => {
                    const current = def.calculate(metric);
                    const previous = def.calculate(prevMetric);
                    const change = current - previous;
                    const pctChange = previous !== 0 ? (change / Math.abs(previous)) * 100 : 0;
                    const isPositive = def.ideal === 'increase' ? change >= 0 : change <= 0;
                    
                    return (
                      <div key={j} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#000000' }}>{def.name}:</span>
                        <span style={{ 
                          fontWeight: 600,
                          color: isPositive ? '#4ade80' : '#f87171'
                        }}>
                          {isPositive ? '+' : ''}
                          {def.name === "Sales per HC" 
                            ? `${change.toFixed(2)}₹`
                            : `${change.toFixed(2)}${def.unit}`
                          } ({pctChange.toFixed(2)}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
                    })}
        </div>
      </div>
    );
  })()}
</div>
</div>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: '#000000' }}>
            No data available for the selected filters
          </div>
        )
      ) : null}

      {/* Profit Bridge & NP Insight Dashboard */}
      {comparisonData.length > 0 && (
        <div style={{ marginTop: 40, marginBottom: 40 }}>
          <h2 style={{ color: '#000000', marginBottom: 24 }}>Profit Bridge & NP Insight Dashboard</h2>
          
          {/* KPI Cards */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: 16, 
            marginBottom: 24 
          }}>
            {(() => {
              // Calculate KPIs from the latest period independently of selected parameters
              const latestPeriodValue = comparisonValues[comparisonValues.length - 1];
              console.log("🔍 KPI Cards - Latest Period Value:", latestPeriodValue);
              
              if (!latestPeriodValue) {
                console.log("🔍 KPI Cards - No latest period found");
                return null;
              }

              // Calculate all parameters for the latest period independently
              const sales = getBaseParameterValue(latestPeriodValue, comparisonValues.length - 1, 'Sales') || 
                           getBaseParameterValue(latestPeriodValue, comparisonValues.length - 1, 'SALES') || 0;
              const salaryCost = getBaseParameterValue(latestPeriodValue, comparisonValues.length - 1, 'Salary Cost') || 0;
              const gpm = getBaseParameterValue(latestPeriodValue, comparisonValues.length - 1, 'GPM') || 0;
              const oprCost = getBaseParameterValue(latestPeriodValue, comparisonValues.length - 1, 'Opr Cost') || 0;
              const teamCost = getBaseParameterValue(latestPeriodValue, comparisonValues.length - 1, 'Team Cost') || 0;
              const fundingCost = getBaseParameterValue(latestPeriodValue, comparisonValues.length - 1, 'Funding Cost') || 0;
              const leaveEncashment = getBaseParameterValue(latestPeriodValue, comparisonValues.length - 1, 'Leave Encashment') || 0;
              const np = getBaseParameterValue(latestPeriodValue, comparisonValues.length - 1, 'NP') || 0;
              
              console.log("🔍 KPI Cards - Calculated Values:", {
                sales, salaryCost, gpm, oprCost, teamCost, fundingCost, leaveEncashment, np
              });

              // If no data available, show a message
              if (sales === 0 && gpm === 0 && np === 0) {
                console.log("🔍 KPI Cards - No data available");
                return (
                  <div style={{
                    gridColumn: '1 / -1',
                    textAlign: 'center',
                    padding: 20,
                    backgroundColor: '#f5f5f5',
                    borderRadius: 8,
                    border: '1px solid #d9d9d9'
                  }}>
                    <div style={{ color: '#666666', fontSize: 14 }}>
                      No data available for KPI calculations.<br/>
                      Please check your data and filters.
                    </div>
                  </div>
                );
              }

              const gpmPercentage = sales > 0 ? (gpm / sales) * 100 : 0;
              const npPercentage = sales > 0 ? (np / sales) * 100 : 0;
              const salaryPercentage = sales > 0 ? (salaryCost / sales) * 100 : 0;
              const oprPercentage = sales > 0 ? (oprCost / sales) * 100 : 0;

              return (
                <>
                  <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 8,
                    padding: 16,
                    border: '1px solid #d9d9d9',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: 12, color: '#666666', marginBottom: 4 }}>Total Sales</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#000000' }}>
                      ₹{sales.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                  </div>
                  
                  <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 8,
                    padding: 16,
                    border: '1px solid #d9d9d9',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: 12, color: '#666666', marginBottom: 4 }}>GPM %</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: gpmPercentage >= 0 ? '#4ade80' : '#f87171' }}>
                      {gpmPercentage.toFixed(2)}%
                    </div>
                  </div>
                  
                  <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 8,
                    padding: 16,
                    border: '1px solid #d9d9d9',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: 12, color: '#666666', marginBottom: 4 }}>NP %</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: npPercentage >= 0 ? '#4ade80' : '#f87171' }}>
                      {npPercentage.toFixed(2)}%
                    </div>
                  </div>
                  
                  <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 8,
                    padding: 16,
                    border: '1px solid #d9d9d9',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: 12, color: '#666666', marginBottom: 4 }}>Salary % of Sales</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#000000' }}>
                      {salaryPercentage.toFixed(2)}%
                    </div>
                  </div>
                  
                  <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 8,
                    padding: 16,
                    border: '1px solid #d9d9d9',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: 12, color: '#666666', marginBottom: 4 }}>Opr % of Sales</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#000000' }}>
                      {oprPercentage.toFixed(2)}%
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Profit Bridge Waterfall Chart */}
          <div style={{ 
            backgroundColor: '#ffffff', 
            borderRadius: 8, 
            padding: 24, 
            border: '1px solid #d9d9d9',
            marginBottom: 24
          }}>
            <h3 style={{ color: '#000000', marginBottom: 16 }}>Profit Bridge (Waterfall) - {comparisonData[comparisonData.length - 1]?.period}</h3>
            <div id="profitBridgeChart" style={{ width: "100%", height: "400px" }} />
          </div>

          {/* Trend Analysis Charts */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', 
            gap: 24 
          }}>
            {/* Sales, GPM, NP Trend */}
            <div style={{ 
              backgroundColor: '#ffffff', 
              borderRadius: 8, 
              padding: 24, 
              border: '1px solid #d9d9d9'
            }}>
              <h3 style={{ color: '#000000', marginBottom: 16 }}>Sales, GPM & NP Trend</h3>
              <div id="trendChart" style={{ width: "100%", height: "300px" }} />
            </div>

            {/* Percentage Trends */}
            <div style={{ 
              backgroundColor: '#ffffff', 
              borderRadius: 8, 
              padding: 24, 
              border: '1px solid #d9d9d9'
            }}>
              <h3 style={{ color: '#000000', marginBottom: 16 }}>GPM % vs NP % Trend</h3>
              <div id="percentageTrendChart" style={{ width: "100%", height: "300px" }} />
            </div>
          </div>
        </div>
      )}

      {/* Target Tracking Chart - Always visible */}
      <TargetTrackingChart
        selectedBusinessUnit={selectedBusinessUnit}
        selectedPeriod={comparisonValues[0]}
        compareType={compareType}
        actualData={comparisonData.map(item => ({
          revenue: item.amount,
          netMargin: item.amount * 0.15, // Assuming 15% net margin for demo
          period: item.period
        }))}
      />

      {/* Combined Period Modal */}
      {showCombinedModal !== null && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            padding: 24,
            borderRadius: 8,
            minWidth: 400,
            maxWidth: 600,
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: 16, color: '#000000' }}>
              Combine Periods for Comparison {showCombinedModal + 1}
            </h3>
            <p style={{ marginBottom: 16, color: '#666666' }}>
              Select multiple periods to combine them into a single comparison period.
            </p>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, color: '#000000' }}>
                Available Periods:
              </label>
              <div style={{ 
                border: '1px solid #d9d9d9', 
                borderRadius: 4, 
                padding: 8, 
                maxHeight: 200, 
                overflow: 'auto',
                backgroundColor: '#f9f9f9'
              }}>
                {availableOptions.map((option) => (
                  <div 
                    key={option}
                    style={{
                      padding: 8,
                      margin: 4,
                      backgroundColor: selectedPeriodsForCombination.includes(option) ? '#e6f7ff' : '#ffffff',
                      border: selectedPeriodsForCombination.includes(option) ? '1px solid #1890ff' : '1px solid #d9d9d9',
                      borderRadius: 4,
                      cursor: 'pointer',
                      color: '#000000'
                    }}
                    onClick={() => {
                      if (selectedPeriodsForCombination.includes(option)) {
                        setSelectedPeriodsForCombination(selectedPeriodsForCombination.filter(p => p !== option));
                      } else {
                        setSelectedPeriodsForCombination([...selectedPeriodsForCombination, option]);
                      }
                    }}
                  >
                    {option}
                  </div>
                ))}
              </div>
            </div>

            {selectedPeriodsForCombination.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 8, color: '#000000' }}>
                  Selected Periods:
                </label>
                <div style={{ 
                  padding: 8, 
                  backgroundColor: '#f0f8ff', 
                  borderRadius: 4,
                  border: '1px solid #d9d9d9'
                }}>
                  {selectedPeriodsForCombination.join(' + ')}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <Button 
                onClick={() => {
                  setShowCombinedModal(null);
                  setSelectedPeriodsForCombination([]);
                }}
              >
                Cancel
              </Button>
              <Button 
                type="primary"
                onClick={() => handleCreateCombinedPeriod(showCombinedModal)}
                disabled={selectedPeriodsForCombination.length === 0}
              >
                Create Combined Period
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamReportCompare;