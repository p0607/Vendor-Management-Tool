import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './RoutingDashboard.css';
import RoutingDashboard_gauge_chart from './RoutingDashboardBarChart';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import VendorBarChart from './VendorBarChart';
import MetricPieChart from './MetricPieChart';
import * as XLSX from 'xlsx';
import * as am5 from "@amcharts/amcharts5";
import * as am5percent from "@amcharts/amcharts5/percent";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import logo from '../assets/logo_1.png';
import { Card, Row, Col, Select, Button, Spin, Alert } from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import apiClient from '../config/api';
import { formatDateToDDMMYYYY } from '../utils/dateUtils';

interface DashboardSummary {
  field: string;
  sum: number;
  average: number;
  min: number;
  max: number;
  count: number;
}



interface DatePivotSummary {
  dateGroup: string;
  integratorCharges: number;
  alchemyBilling: number;
  fundingCost: number;
  netMargin: number;
  vendorInvoiceAmount: number;
}

interface QuarterComparisonData {
  parameter: string;
  currentQuarter: number;
  previousQuarter: number;
  absoluteChange: number;
  growthPercentage: number;
}

interface RoutingTableItem {
  'Costing Date': string;
  'Vendor Details': string;
  'Alchemy Billing Value': string;
  'Integrator Charges (Margin)': string;
  'Funding cost': string;
  'Net Margin': string;
  [key: string]: any;
}

interface DateFilterOption {
  value: string;
  label: string;
}

const RoutingDashboard: React.FC = () => {
  // Get current financial year (starts from April)
  const getCurrentFinancialYear = () => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1; // 1-12
    const currentYear = currentDate.getFullYear();
    
    // Financial year starts from April (month 4)
    // If current month is Jan-Mar (1-3), financial year is previous year
    // If current month is Apr-Dec (4-12), financial year is current year
    if (currentMonth >= 4) {
      return currentYear;
    } else {
      return currentYear - 1;
    }
  };

  // Get current financial year range
  const getCurrentFinancialYearRange = () => {
    const financialYear = getCurrentFinancialYear();
    const startDate = new Date(financialYear, 3, 1); // April 1st (month 3 = April)
    const endDate = new Date(financialYear + 1, 2, 31); // March 31st next year (month 2 = March)
    return { startDate, endDate };
  };

  // State declarations
  const [data, setData] = useState<RoutingTableItem[]>([]);
  const [filteredData, setFilteredData] = useState<RoutingTableItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'datePivot'>('summary');
  const [pivotDateType, setPivotDateType] = useState<'month' | 'quarter' | 'year'>('month');
  const [isActionDropdownOpen, setIsActionDropdownOpen] = useState<boolean>(false);
  const actionDropdownRef = useRef<HTMLDivElement>(null);
  const [billingDateFilter, setBillingDateFilter] = useState<string>('');
  const [vendorDetailsFilter, setVendorDetailsFilter] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [dateFilterType, setDateFilterType] = useState<string>('dateRange');
  const [selectedQuarter, setSelectedQuarter] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [startQuarter, setStartQuarter] = useState<string>('');
  const [endQuarter, setEndQuarter] = useState<string>('');
  const [startYear, setStartYear] = useState<string>('');
  const [endYear, setEndYear] = useState<string>('');
  const [startMonth, setStartMonth] = useState<string>('');
  const [endMonth, setEndMonth] = useState<string>('');
  const [startYearRange, setStartYearRange] = useState<string>('');
  const [endYearRange, setEndYearRange] = useState<string>('');

  const navigate = useNavigate();

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionDropdownRef.current && !actionDropdownRef.current.contains(event.target as Node)) {
        setIsActionDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Helper function to parse billing month from various formats including Excel serial numbers
  const parseBillingMonth = (billingMonthStr: string): Date | null => {
    if (!billingMonthStr || billingMonthStr === 'N/A' || billingMonthStr === '') {
      return null;
    }
    
    // Handle DD-MM-YYYY format (e.g., "01-09-2024") - NEW CONVERTED DATA
    if (/^\d{2}-\d{2}-\d{4}$/.test(billingMonthStr.trim())) {
      const [day, month, year] = billingMonthStr.split('-').map(Number);
      return new Date(year, month - 1, day); // month is 0-indexed in JavaScript
    }
    
    // Handle Excel serial numbers (5-digit numbers like 45532, 45535) - for existing data
    if (/^\d{5}$/.test(billingMonthStr.trim())) {
      const serialNumber = parseInt(billingMonthStr, 10);
      
      // CORRECTED Excel serial number to JavaScript Date conversion
      // Excel's date system: January 1, 1900 = serial number 1
      // Excel has a leap year bug - it thinks 1900 is a leap year
      // The issue was in the epoch calculation - we need to be more precise
      
      // Method 1: Correct Excel epoch calculation
      // Excel epoch is December 30, 1899 (serial number 0)
      // But we need to account for the leap year bug more accurately
      const excelEpoch = new Date(1899, 11, 30); // December 30, 1899
      
      // For serial numbers > 59, Excel incorrectly includes Feb 29, 1900
      // So we need to add 1 day to compensate for this bug
      let daysToAdd = serialNumber;
      if (serialNumber > 59) {
        daysToAdd = serialNumber + 1; // ADD 1 day, not subtract
      }
      
      const date1 = new Date(excelEpoch.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
      
      // Method 2: Alternative approach - use January 1, 1900 as base
      // Excel serial number 1 = January 1, 1900
      const date2 = new Date(1900, 0, serialNumber); // January 1, 1900 + serialNumber days
      
      // Method 3: Most accurate approach
      // Excel serial numbers represent days since December 30, 1899
      // But we need to handle the leap year bug correctly
      const baseDate = new Date(1899, 11, 30); // December 30, 1899
      let adjustedSerial = serialNumber;
      
      // Excel's leap year bug: it treats 1900 as a leap year
      // So for dates after Feb 28, 1900, we need to add 1 day
      if (serialNumber > 59) {
        adjustedSerial = serialNumber + 1;
      }
      
      const date3 = new Date(baseDate.getTime() + adjustedSerial * 24 * 60 * 60 * 1000);
      
      // Choose the most reasonable date (between 1900 and 2100)
      const candidates = [date1, date2, date3];
      for (const candidate of candidates) {
        if (candidate.getFullYear() >= 1900 && candidate.getFullYear() <= 2100) {
          console.log(`🔍 Excel Serial Conversion: ${serialNumber} -> ${candidate.toISOString().split('T')[0]}`);
          return candidate;
        }
      }
    }
    
    // Handle MMM-YY format (e.g., "Sep-24", "Aug-24") - for existing data
    if (billingMonthStr.includes('-') && billingMonthStr.length === 6) {
      const [monthStr, yearStr] = billingMonthStr.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthIndex = monthNames.indexOf(monthStr);
      
      if (monthIndex !== -1 && yearStr) {
        const year = 2000 + parseInt(yearStr, 10);
        return new Date(year, monthIndex, 1);
      }
    }
    
    // Handle YYYY-MM-DD format (for new data from backend)
    if (billingMonthStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const date = new Date(billingMonthStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    
    // Handle other date formats as fallback
    try {
      const date = new Date(billingMonthStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
    } catch (error) {
      // Ignore parsing errors
    }
    
    return null;
  };

  // Helper function to get date group based on pivot type
  const getDateGroup = (dateStr: string, type: 'month' | 'quarter' | 'year'): string => {
    if (!dateStr) return 'Unknown Date';
    
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Invalid Date';
      
      const year = date.getFullYear();
      const month = date.getMonth() + 1; // 1-12
      
      switch (type) {
        case 'year':
          return `${year}`;
        case 'quarter':
          // Indian financial year quarters
          let quarter, financialYear;
          if (month >= 4 && month <= 6) { // April (4)-June (6) = Q1
            quarter = 1;
            financialYear = year;
          } else if (month >= 7 && month <= 9) { // July (7)-Sept (9) = Q2
            quarter = 2;
            financialYear = year;
          } else if (month >= 10 && month <= 12) { // Oct (10)-Dec (12) = Q3
            quarter = 3;
            financialYear = year;
          } else { // Jan (1)-Mar (3) = Q4
            quarter = 4;
            financialYear = year - 1; // Q4 belongs to previous financial year (Jan-Mar 2025 = Q4 2024)
          }
          return `Q${quarter} ${financialYear}`;
        case 'month':
        default:
          const monthNames = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
          ];
          return `${monthNames[month - 1]} ${year}`;
      }
    } catch (error) {
      return 'Invalid Date';
    }
  };

  // Helper function to get date group from billing month
  const getDateGroupFromBillingMonth = (billingMonthStr: string, type: 'month' | 'quarter' | 'year'): string => {
    const date = parseBillingMonth(billingMonthStr);
    if (!date) return 'Unknown Date';
    
    return getDateGroup(date.toISOString().split('T')[0], type);
  };




  const exportDatePivotToExcel = () => {
    const exportData = datePivotSummaries.map(summary => ({
      'Date Group': summary.dateGroup,
      'Alchemy Billing': summary.alchemyBilling,
      'Vendor Invoice Amount': summary.vendorInvoiceAmount,
      'Integrator Charges': summary.integratorCharges,
      'Funding Cost': summary.fundingCost,
      'Net Margin': summary.netMargin,
    }));
    exportData.push({
      'Date Group': 'Grand Total',
      'Alchemy Billing': datePivotGrandTotals.alchemyBilling,
      'Vendor Invoice Amount': datePivotGrandTotals.vendorInvoiceAmount,
      'Integrator Charges': datePivotGrandTotals.integratorCharges,
      'Funding Cost': datePivotGrandTotals.fundingCost,
      'Net Margin': datePivotGrandTotals.netMargin,
    });
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Date Pivot');
    XLSX.writeFile(workbook, `date_pivot_${pivotDateType}.xlsx`);
  };
  // Filter options
  const dateFilterOptions: DateFilterOption[] = [
    { value: 'dateRange', label: 'Date Range' },
    { value: 'quarterRange', label: 'Quarter Range' },
    { value: 'monthRange', label: 'Month Range' },
    { value: 'yearRange', label: 'Year Range' },
    { value: 'singleQuarter', label: 'Single Quarter' },
    { value: 'singleMonth', label: 'Single Month' },
    { value: 'singleYear', label: 'Single Year' }
  ];

  const quarterOptions = [
    { value: 'Q1', label: 'Q1 (Apr-Jun)' },
    { value: 'Q2', label: 'Q2 (Jul-Sep)' },
    { value: 'Q3', label: 'Q3 (Oct-Dec)' },
    { value: 'Q4', label: 'Q4 (Jan-Mar)' }
  ];

  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: (i + 1).toString().padStart(2, '0'),
    label: new Date(0, i).toLocaleString('default', { month: 'long' })
  }));

  const yearOptions = Array.from({ length: 10 }, (_, i) => ({
    value: (new Date().getFullYear() - i).toString(),
    label: (new Date().getFullYear() - i).toString()
  }));

  // Fetch data when component mounts
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await apiClient.get('/Alchemy_Routing');
        
        if (!Array.isArray(response.data)) {
          throw new Error("Data is not an array");
        }
        
        setData(response.data as RoutingTableItem[]);
        setFilteredData(response.data as RoutingTableItem[]);
        
        // Don't set default date filter - show all data by default
        // Users can manually apply filters if needed
      } catch (err: any) {
        console.error("Fetch failed:", err);
        setError(err.response?.data?.error || err.message || 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Apply filters when they change
  useEffect(() => {
  if (!vendorDetailsFilter && !startDate && !endDate && 
      !selectedQuarter && !selectedMonth && !selectedYear &&
      !startQuarter && !endQuarter && !startYear && !endYear &&
      !startMonth && !endMonth && !startYearRange && !endYearRange) {
    setFilteredData(data);
    return;
  }
  
function parseClosingDate(closingDate: string): Date | null {
  // Expects format "YYYY-MM-DD"
  if (!closingDate || !/^\d{4}-\d{2}-\d{2}$/.test(closingDate)) return null;
  return new Date(closingDate);
}

function formatClosingDate(closingDate: string): string {
  const date = parseClosingDate(closingDate);
  if (!date) return closingDate || '';
  return date.toLocaleString('default', { month: 'short', year: 'numeric' }); // e.g., "Jun 2024"
}

    const filtered = data.filter(item => {
    // Vendor filter
    const vendorDetailsLower = vendorDetailsFilter.toLowerCase();
    const billingDateLower = billingDateFilter.toLowerCase();
    const hasVendorDetailsMatch = !vendorDetailsLower || 
      (item['Vendor Details'] && String(item['Vendor Details']).toLowerCase().includes(vendorDetailsLower));

      const hasBillingDateMatch = !billingDateLower || 
        (item['Billing Month'] && String(item['Billing Month']).toLowerCase().includes(billingDateLower));

      // Date filters - now using Billing Month instead of Costing Date
       let hasDateMatch = true;
    const itemBillingMonth = item['Billing Month'];
     if (itemBillingMonth) {
      // Parse the billing month string (MMM-YY format)
      const itemDate = parseBillingMonth(itemBillingMonth);
      if (!itemDate) {
        hasDateMatch = false;
      } else {
        const itemYear = itemDate.getFullYear().toString();
        const itemMonth = (itemDate.getMonth() + 1).toString().padStart(2, '0');
        const itemQuarter = Math.ceil(parseInt(itemMonth) / 3).toString();

        if (dateFilterType === 'dateRange' && (startDate || endDate)) {
          // Compare dates directly
          if (startDate && itemDate < startDate) hasDateMatch = false;
          if (endDate && itemDate > endDate) hasDateMatch = false;
        }
        else if (dateFilterType === 'singleQuarter' && selectedQuarter && selectedYear) {
          // For financial year quarters, we need to map quarters to months correctly
          let quarterStartMonth: number = 0;
          let quarterEndMonth: number = 0;
          
          switch (selectedQuarter) {
            case 'Q1': // Apr-Jun
              quarterStartMonth = 3; // April (0-indexed)
              quarterEndMonth = 5;   // June (0-indexed)
              break;
            case 'Q2': // Jul-Sep
              quarterStartMonth = 6; // July (0-indexed)
              quarterEndMonth = 8;   // September (0-indexed)
              break;
            case 'Q3': // Oct-Dec
              quarterStartMonth = 9; // October (0-indexed)
              quarterEndMonth = 11;  // December (0-indexed)
              break;
            case 'Q4': // Jan-Mar
              quarterStartMonth = 0; // January (0-indexed)
              quarterEndMonth = 2;   // March (0-indexed)
              break;
            default:
              hasDateMatch = false;
              break;
          }
          
          if (selectedQuarter && selectedYear && hasDateMatch !== false) {
            const itemMonth = itemDate.getMonth();
            const itemYear = itemDate.getFullYear().toString();
            
            // For Q4 (Jan-Mar), we need to check if it's in the next calendar year
            if (selectedQuarter === 'Q4') {
              const nextYear = (parseInt(selectedYear) + 1).toString();
              hasDateMatch = itemMonth >= quarterStartMonth && itemMonth <= quarterEndMonth && 
                           (itemYear === selectedYear || itemYear === nextYear);
            } else {
              hasDateMatch = itemMonth >= quarterStartMonth && itemMonth <= quarterEndMonth && 
                           itemYear === selectedYear;
            }
          }
        }
        else if (dateFilterType === 'singleMonth' && selectedMonth && selectedYear) {
          hasDateMatch = itemMonth === selectedMonth && itemYear === selectedYear;
        }
        else if (dateFilterType === 'singleYear' && selectedYear) {
          hasDateMatch = itemYear === selectedYear;
        }
        else if (dateFilterType === 'quarterRange' && (startQuarter || endQuarter) && (startYear || endYear)) {
          const itemMonth = itemDate.getMonth();
          const itemYear = itemDate.getFullYear();
          
          // Helper function to get quarter start and end months
          const getQuarterMonths = (quarter: string) => {
            switch (quarter) {
              case 'Q1': return { start: 3, end: 5 }; // Apr-Jun
              case 'Q2': return { start: 6, end: 8 }; // Jul-Sep
              case 'Q3': return { start: 9, end: 11 }; // Oct-Dec
              case 'Q4': return { start: 0, end: 2 }; // Jan-Mar
              default: return { start: 0, end: 0 };
            }
          };
          
          if (startQuarter && startYear) {
            const startQ = getQuarterMonths(startQuarter);
            const startY = parseInt(startYear);
            
            // For Q4, check if it's in the current year or next year
            if (startQuarter === 'Q4') {
              const nextStartY = startY + 1;
              if (itemYear < nextStartY || (itemYear === nextStartY && itemMonth < startQ.start)) {
                hasDateMatch = false;
              }
            } else {
              if (itemYear < startY || (itemYear === startY && itemMonth < startQ.start)) {
                hasDateMatch = false;
              }
            }
          }
          
          if (endQuarter && endYear && hasDateMatch) {
            const endQ = getQuarterMonths(endQuarter);
            const endY = parseInt(endYear);
            
            // For Q4, check if it's in the current year or next year
            if (endQuarter === 'Q4') {
              if (itemYear > endY + 1 || (itemYear === endY + 1 && itemMonth > endQ.end)) {
                hasDateMatch = false;
              }
            } else {
              if (itemYear > endY || (itemYear === endY && itemMonth > endQ.end)) {
                hasDateMatch = false;
              }
            }
          }
        }
        else if (dateFilterType === 'monthRange' && (startMonth || endMonth) && (startYear || endYear)) {
          const itemMonthNum = parseInt(itemMonth);
          const itemYearNum = parseInt(itemYear);
          
          if (startMonth && startYear) {
            const startM = parseInt(startMonth);
            const startY = parseInt(startYear);
            if (itemYearNum < startY || (itemYearNum === startY && itemMonthNum < startM)) {
              hasDateMatch = false;
            }
          }
          if (endMonth && endYear) {
            const endM = parseInt(endMonth);
            const endY = parseInt(endYear);
            if (itemYearNum > endY || (itemYearNum === endY && itemMonthNum > endM)) {
              hasDateMatch = false;
            }
          }
        }
        else if (dateFilterType === 'yearRange' && (startYearRange || endYearRange)) {
          const itemYearNum = parseInt(itemYear);
          
          if (startYearRange && itemYearNum < parseInt(startYearRange)) {
            hasDateMatch = false;
          }
          if (endYearRange && itemYearNum > parseInt(endYearRange)) {
            hasDateMatch = false;
          }
        }
      }
    } else {
      hasDateMatch = false;
    }

    return hasVendorDetailsMatch && hasDateMatch;
  });

  setFilteredData(filtered);
}, [
  data, vendorDetailsFilter, 
  startDate, endDate, selectedQuarter, selectedMonth, selectedYear,
  startQuarter, endQuarter, startYear, endYear,
  startMonth, endMonth, startYearRange, endYearRange,
  dateFilterType
]);

  // Define which numeric fields to analyze
  const numericFields = [
    'Alchemy Billing Value',
    'Integrator Charges (Margin)',
    'Funding cost',
    'Net Margin'
  ];

  // Calculate all summary metrics
const metricFields = [
  { field: "Alchemy Billing Value", label: "Alchemy Billing Value" },
  { field: "Vendor Payout", label: "Vendor Payout" },
  { field: "Total Invoice", label: "Total Invoice" },
  // ...other fields
];

// Calculate the sum of "Alchemy Billing Value" for percentage calculation
const alchemyBillingSum = filteredData.reduce(
  (acc, row) => acc + Number(row["Alchemy Billing Value"] || 0),
  0
);

const chartData = metricFields.map(({ field, label }) => {
  const sum = filteredData.reduce((acc, row) => acc + Number(row[field] || 0), 0);
  return {
    field: label,
    sum,
    percent: alchemyBillingSum ? (sum / alchemyBillingSum) * 100 : 0,
  };
});

  // Calculate summary statistics for numeric fields
  const calculateSummaries = (): DashboardSummary[] => {
    return numericFields.map(field => {
      const values = filteredData
        .map(item => {
          const val = item[field];
          if (typeof val === 'number') return val;
          
          // Use the same enhanced number conversion for summary calculations
          return toNumber(val);
        })
        .filter(val => !isNaN(val));

      const sum = values.reduce((acc, val) => acc + val, 0);
      const count = values.length;
      const average = count > 0 ? sum / count : 0;
      const min = count > 0 ? Math.min(...values) : 0;
      const max = count > 0 ? Math.max(...values) : 0;

      return {
        field,
        sum,
        average,
        min,
        max,
        count
      };
    });
  };

  // Calculate percentage values for specific fields based on Alchemy Billing Value
  const calculatePercentageValues = () => {
    const alchemyBillingSum = filteredData.reduce((acc, item) => {
      const val = item['Alchemy Billing Value'];
      if (typeof val === 'number') return acc + val;
      const strValue = String(val || '0').replace(/[^\d.-]/g, '').replace(/,/g, '');
      return acc + (parseFloat(strValue) || 0);
    }, 0);

    const summaries = calculateSummaries();
    
    return summaries.map(summary => {
      if (summary.field === 'Alchemy Billing Value') {
        return {
          ...summary,
          percentage: 100, // Base value is always 100%
          showPercentage: false // Don't show percentage for base value
        };
      } else if (['Integrator Charges (Margin)', 'Funding cost', 'Net Margin'].includes(summary.field)) {
        const percentage = alchemyBillingSum > 0 ? (summary.sum / alchemyBillingSum) * 100 : 0;
        return {
          ...summary,
          percentage,
          showPercentage: true // Show percentage for these fields
        };
      } else {
        return {
          ...summary,
          percentage: 0,
          showPercentage: false // Don't show percentage for other fields
        };
      }
    });
  };



  // Enhanced number conversion function to handle Excel number corruption
  const toNumber = (value: any): number => {
    if (typeof value === 'number') return value;
    if (!value || value === '') return 0;
    
    let strValue = String(value);
    
    // Handle various Excel number corruption scenarios
    
    // 1. Handle scientific notation (e.g., "1.23E+05" = 123000)
    if (strValue.includes('E+') || strValue.includes('e+')) {
      const num = parseFloat(strValue);
      if (!isNaN(num)) return num;
    }
    
    // 2. Handle Excel date serial numbers that might be in numeric fields
    // If it's a 5-digit number that could be a date serial, check if it's reasonable
    if (/^\d{5}$/.test(strValue.trim())) {
      const serialNum = parseInt(strValue, 10);
      // Excel serial numbers for dates are typically between 1 (1900-01-01) and 73050 (2099-12-31)
      if (serialNum >= 1 && serialNum <= 73050) {
        // This might be a date serial number in a numeric field - skip it
        console.warn(`⚠️ Potential date serial number in numeric field: ${strValue}`);
        return 0;
      }
    }
    
    // 3. Handle Indian numbering system (lakhs format: 63,30,299.04)
    if (strValue.includes(',') && strValue.split(',')[1] && strValue.split(',')[1].length === 2) {
      const parts = strValue.split(',');
      if (parts.length === 2) {
        // Format: 63,30,299.04 -> 6,330,299.04
        strValue = parts[0] + parts[1];
      } else if (parts.length === 3) {
        // Format: 1,23,45,678.90 -> 12,345,678.90
        strValue = parts[0] + parts[1] + parts[2];
      }
    }
    
    // 4. Handle currency symbols and other formatting
    strValue = strValue.replace(/[₹$€£¥]/g, ''); // Remove currency symbols
    
    // 5. Handle percentage values (e.g., "15%" -> 15)
    if (strValue.includes('%')) {
      strValue = strValue.replace('%', '');
      const num = parseFloat(strValue.replace(/[^\d.-]/g, ''));
      return isNaN(num) ? 0 : num;
    }
    
    // 6. Handle text with numbers (e.g., "Amount: 1234.56" -> 1234.56)
    const numberMatch = strValue.match(/-?\d+\.?\d*/);
    if (numberMatch) {
      strValue = numberMatch[0];
    }
    
    // 7. Final cleanup and conversion
    strValue = strValue.replace(/[^\d.-]/g, '').replace(/,/g, '');
    const result = parseFloat(strValue);
    
    // 8. Validate the result
    if (isNaN(result) || !isFinite(result)) {
      console.warn(`⚠️ Invalid number conversion: "${value}" -> "${strValue}"`);
      return 0;
    }
    
    return result;
  };

  // Calculate date-based summaries for pivot table - EXCEL-LIKE SIMPLE PIVOT
  const calculateDatePivotSummaries = (): DatePivotSummary[] => {
    const pivotMap = new Map<string, DatePivotSummary>();

    // Debug: Log all unique billing months in the data
    const uniqueBillingMonths = new Set();
    filteredData.forEach(item => {
      if (item['Billing Month']) {
        uniqueBillingMonths.add(item['Billing Month']);
      }
    });
    console.log('🔍 All Unique Billing Months in Data:', Array.from(uniqueBillingMonths).sort());

    filteredData.forEach(item => {
      // Get billing month value directly
      const billingMonthStr = item['Billing Month'] || '';
      
      // Convert to date and get the appropriate group based on pivot type
      let dateGroup = 'Unknown';
      if (billingMonthStr) {
        const date = parseBillingMonth(billingMonthStr);
        if (date) {
          const year = date.getFullYear();
          const month = date.getMonth() + 1; // 1-12
          
          // Debug specific months that are causing issues
          if (year === 2025 && (month === 8 || month === 9)) {
            console.log(`🔍 Date Parsing Debug:`, {
              billingMonthStr,
              parsedDate: date,
              year,
              month,
              monthName: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1]
            });
          }
          
          // Debug all 2025 data to see what's being processed
          if (year === 2025) {
            console.log(`🔍 2025 Data Found:`, {
              billingMonthStr,
              parsedDate: date,
              year,
              month,
              monthName: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1],
              itemId: item.id
            });
          }
          
          switch (pivotDateType) {
            case 'year':
              dateGroup = `${year}`;
              break;
            case 'quarter':
              // Simple calendar quarters (not financial year)
              const quarter = Math.ceil(month / 3);
              dateGroup = `Q${quarter} ${year}`;
              break;
            case 'month':
            default:
              const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
              // Use Excel-like format: Aug-24, Sep-24, etc.
              const shortYear = year.toString().slice(-2); // Get last 2 digits of year
              dateGroup = `${monthNames[month - 1]}-${shortYear}`;
              break;
          }
        }
      }
      

      // Get all values for this item
      const charges = toNumber(item['Integrator Charges (Margin)']);
      const billing = toNumber(item['Alchemy Billing Value']);
      const funding = toNumber(item['Funding cost']);
      const margin = toNumber(item['Net Margin']);
      const vendorInvoice = toNumber(item['Vendor Inv. Amount']);
      
      // Debug logging for data discrepancy analysis
      if ((dateGroup === 'Aug-24' || dateGroup === 'Aug-25' || dateGroup === 'Sep-25') && billing > 0) {
        console.log(`🔍 ${dateGroup} Data Debug:`, {
          originalBilling: item['Alchemy Billing Value'],
          convertedBilling: billing,
          dateGroup,
          itemId: item.id || 'unknown',
          costingDate: item['Costing Date'],
          billingMonth: item['Billing Month'],
          parsedDate: parseBillingMonth(item['Billing Month'])
        });
      }

      // Initialize date group if not exists
      if (!pivotMap.has(dateGroup)) {
        pivotMap.set(dateGroup, {
          dateGroup: dateGroup,
          integratorCharges: 0,
          alchemyBilling: 0,
          fundingCost: 0,
          netMargin: 0,
          vendorInvoiceAmount: 0
        });
      }

      // Add values to date group
      const groupData = pivotMap.get(dateGroup)!;
      groupData.integratorCharges += charges;
      groupData.alchemyBilling += billing;
      groupData.fundingCost += funding;
      groupData.netMargin += margin;
      groupData.vendorInvoiceAmount += vendorInvoice;
    });

    const result = Array.from(pivotMap.values()).sort((a, b) => {
      // Sort by date group (chronological order)
      const parseDateGroup = (dateGroup: string): Date => {
        // Handle different date group formats
        if (dateGroup.includes('Q')) {
          // Quarter format: "Q1 2024" - Simple calendar quarters
          const [quarter, year] = dateGroup.split(' ');
          const quarterNum = parseInt(quarter.replace('Q', ''));
          const yearNum = parseInt(year);
          
          // Convert calendar quarter to month (Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec)
          let month: number;
          if (quarterNum === 1) {
            month = 0; // January (Q1)
          } else if (quarterNum === 2) {
            month = 3; // April (Q2)
          } else if (quarterNum === 3) {
            month = 6; // July (Q3)
          } else if (quarterNum === 4) {
            month = 9; // October (Q4)
          } else {
            // Default fallback
            month = 0;
          }
          return new Date(yearNum, month, 1);
        } else if (dateGroup.includes(' ')) {
          // Month format: "Jan 2024"
          const [monthName, year] = dateGroup.split(' ');
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const monthIndex = monthNames.indexOf(monthName);
          const yearNum = parseInt(year);
          return new Date(yearNum, monthIndex, 1);
        } else {
          // Year format: "2024"
          const yearNum = parseInt(dateGroup);
          return new Date(yearNum, 0, 1);
        }
      };

      try {
        const dateA = parseDateGroup(a.dateGroup);
        const dateB = parseDateGroup(b.dateGroup);
        return dateA.getTime() - dateB.getTime();
      } catch (error) {
        // If parsing fails, sort alphabetically
        return a.dateGroup.localeCompare(b.dateGroup);
      }
    });
    
    // Debug logging to compare with Excel pivot
    console.log('🔍 Date Pivot Summary:', result);
    console.log('🔍 Date Groups Found:', result.map(r => r.dateGroup));
    const totalBilling = result.reduce((sum, item) => sum + item.alchemyBilling, 0);
    console.log('🔍 Total Alchemy Billing:', totalBilling);
    console.log('🔍 Filtered Data Count:', filteredData.length);
    console.log('🔍 Total Data Count:', data.length);
    console.log('🔍 Active Filters:', {
      billingDateFilter,
      vendorDetailsFilter,
      startDate,
      endDate,
      dateFilterType,
      selectedQuarter,
      selectedMonth,
      selectedYear
    });
    
    return result;
  };

  // Calculate domain data for pie chart
  const calculateDomainData = () => {
    const domainMap = new Map<string, number>();
    
    filteredData.forEach(item => {
      const domain = item['domain'] || 'Unknown Domain';
      const alchemyBilling = parseFloat(String(item['Alchemy Billing Value'] || '0').replace(/[^\d.-]/g, '').replace(/,/g, '')) || 0;
      
      if (!domainMap.has(domain)) {
        domainMap.set(domain, 0);
      }
      domainMap.set(domain, domainMap.get(domain)! + alchemyBilling);
    });
    
    const total = Array.from(domainMap.values()).reduce((acc, val) => acc + val, 0);
    
    return Array.from(domainMap.entries()).map(([domain, sum]) => ({
      field: domain,
      sum,
      percent: total > 0 ? (sum / total) * 100 : 0
    })).sort((a, b) => b.sum - a.sum); // Sort by sum descending
  };

  // Calculate monthly billing data for bar chart based on Billing Month
  const calculateMonthlyBillingData = () => {
    const monthlyMap = new Map<string, {
      alchemyBilling: number;
      integratorCharges: number;
      fundingCost: number;
      netMargin: number;
    }>();
    
    filteredData.forEach(item => {
      // Get billing month value directly (same as date pivot)
      const billingMonthStr = item['Billing Month'] || '';
      
      // Convert Excel serial number to month format (same as date pivot)
      let monthLabel = 'Unknown';
      if (billingMonthStr) {
        const date = parseBillingMonth(billingMonthStr);
        if (date) {
          const year = date.getFullYear();
          const month = date.getMonth() + 1; // 1-12
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                             'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          monthLabel = `${monthNames[month - 1]} ${year}`;
        }
      }
      
      // Simple number conversion function (same as date pivot)
      // Use the enhanced number conversion function (defined above)

      // Get all values for this item (same as date pivot)
      const alchemyBilling = toNumber(item['Alchemy Billing Value']);
      const integratorCharges = toNumber(item['Integrator Charges (Margin)']);
      const fundingCost = toNumber(item['Funding cost']);
      const netMargin = toNumber(item['Net Margin']);
      
      // Initialize monthly group if not exists
      if (!monthlyMap.has(monthLabel)) {
        monthlyMap.set(monthLabel, {
          alchemyBilling: 0,
          integratorCharges: 0,
          fundingCost: 0,
          netMargin: 0
        });
      }
      
      // Add values to monthly group
      const monthData = monthlyMap.get(monthLabel)!;
      monthData.alchemyBilling += alchemyBilling;
      monthData.integratorCharges += integratorCharges;
      monthData.fundingCost += fundingCost;
      monthData.netMargin += netMargin;
    });
    
    return Array.from(monthlyMap.entries()).map(([month, data]) => ({
      billingMonth: month,
      alchemyBilling: Math.round(data.alchemyBilling),
      integratorCharges: Math.round(data.integratorCharges),
      fundingCost: Math.round(data.fundingCost),
      netMargin: Math.round(data.netMargin)
    })).sort((a, b) => {
      // Sort by date properly
      try {
        const dateA = new Date(a.billingMonth);
        const dateB = new Date(b.billingMonth);
        if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
          return dateA.getTime() - dateB.getTime();
        }
      } catch (error) {
        // If date parsing fails, sort alphabetically
      }
      return a.billingMonth.localeCompare(b.billingMonth);
    });
  };

  // Calculate dynamic comparison data based on selected date filter
  const calculateDynamicComparison = (): { data: QuarterComparisonData[], period1: string, period2: string } => {
    let period1Data: RoutingTableItem[] = [];
    let period2Data: RoutingTableItem[] = [];
    let period1Label = '';
    let period2Label = '';

    // Determine comparison periods based on date filter type
    if (dateFilterType === 'quarterRange' && startQuarter && endQuarter) {
      // Quarter range comparison
      const getQuarterMonths = (quarter: string) => {
        if (quarter.includes('Q1')) return [4, 5, 6]; // Apr, May, Jun
        if (quarter.includes('Q2')) return [7, 8, 9]; // Jul, Aug, Sep
        if (quarter.includes('Q3')) return [10, 11, 12]; // Oct, Nov, Dec
        if (quarter.includes('Q4')) return [1, 2, 3]; // Jan, Feb, Mar
        return [];
      };

      const startQuarterMonths = getQuarterMonths(startQuarter);
      const endQuarterMonths = getQuarterMonths(endQuarter);
      
      period1Data = filteredData.filter(item => {
        const billingMonth = parseBillingMonth(item['Billing Month']);
        if (!billingMonth) return false;
        const itemYear = billingMonth.getFullYear();
        const itemMonth = billingMonth.getMonth() + 1;
        return itemYear === parseInt(startYear) && startQuarterMonths.includes(itemMonth);
      });

      period2Data = filteredData.filter(item => {
        const billingMonth = parseBillingMonth(item['Billing Month']);
        if (!billingMonth) return false;
        const itemYear = billingMonth.getFullYear();
        const itemMonth = billingMonth.getMonth() + 1;
        return itemYear === parseInt(endYear) && endQuarterMonths.includes(itemMonth);
      });

      period1Label = `${startQuarter} ${startYear}`;
      period2Label = `${endQuarter} ${endYear}`;
    } else if (dateFilterType === 'monthRange' && startMonth && endMonth) {
      // Month range comparison
      const startMonthNum = parseInt(startMonth);
      const endMonthNum = parseInt(endMonth);
      
      period1Data = filteredData.filter(item => {
        const billingMonth = parseBillingMonth(item['Billing Month']);
        if (!billingMonth) return false;
        const itemYear = billingMonth.getFullYear();
        const itemMonth = billingMonth.getMonth() + 1;
        return itemYear === parseInt(startYear) && itemMonth === startMonthNum;
      });

      period2Data = filteredData.filter(item => {
        const billingMonth = parseBillingMonth(item['Billing Month']);
        if (!billingMonth) return false;
        const itemYear = billingMonth.getFullYear();
        const itemMonth = billingMonth.getMonth() + 1;
        return itemYear === parseInt(endYear) && itemMonth === endMonthNum;
      });

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      period1Label = `${monthNames[startMonthNum - 1]} ${startYear}`;
      period2Label = `${monthNames[endMonthNum - 1]} ${endYear}`;
    } else {
      // Default: Current quarter vs Previous quarter
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;
      
      let currentQuarter: string;
      let currentQuarterYear: number;
      
      if (currentMonth >= 4 && currentMonth <= 6) {
        currentQuarter = 'Q1(Apr-Jun)';
        currentQuarterYear = currentYear;
      } else if (currentMonth >= 7 && currentMonth <= 9) {
        currentQuarter = 'Q2(Jul-Sep)';
        currentQuarterYear = currentYear;
      } else if (currentMonth >= 10 && currentMonth <= 12) {
        currentQuarter = 'Q3(Oct-Dec)';
        currentQuarterYear = currentYear;
      } else {
        currentQuarter = 'Q4(Jan-Mar)';
        currentQuarterYear = currentYear;
      }
      
      let previousQuarter: string;
      let previousQuarterYear: number;
      
      if (currentQuarter === 'Q1(Apr-Jun)') {
        previousQuarter = 'Q4(Jan-Mar)';
        previousQuarterYear = currentYear - 1;
      } else if (currentQuarter === 'Q2(Jul-Sep)') {
        previousQuarter = 'Q1(Apr-Jun)';
        previousQuarterYear = currentYear;
      } else if (currentQuarter === 'Q3(Oct-Dec)') {
        previousQuarter = 'Q2(Jul-Sep)';
        previousQuarterYear = currentYear;
      } else {
        previousQuarter = 'Q3(Oct-Dec)';
        previousQuarterYear = currentYear - 1;
      }
      
      const getQuarterMonths = (quarter: string) => {
        if (quarter.includes('Q1')) return [4, 5, 6];
        if (quarter.includes('Q2')) return [7, 8, 9];
        if (quarter.includes('Q3')) return [10, 11, 12];
        if (quarter.includes('Q4')) return [1, 2, 3];
        return [];
      };
      
      const currentQuarterMonths = getQuarterMonths(currentQuarter);
      const previousQuarterMonths = getQuarterMonths(previousQuarter);
      
      period1Data = filteredData.filter(item => {
        const billingMonth = parseBillingMonth(item['Billing Month']);
        if (!billingMonth) return false;
        const itemYear = billingMonth.getFullYear();
        const itemMonth = billingMonth.getMonth() + 1;
        return itemYear === currentQuarterYear && currentQuarterMonths.includes(itemMonth);
      });

      period2Data = filteredData.filter(item => {
        const billingMonth = parseBillingMonth(item['Billing Month']);
        if (!billingMonth) return false;
        const itemYear = billingMonth.getFullYear();
        const itemMonth = billingMonth.getMonth() + 1;
        return itemYear === previousQuarterYear && previousQuarterMonths.includes(itemMonth);
      });

      period1Label = currentQuarter;
      period2Label = previousQuarter;
    }
    
    // Calculate totals for each parameter
    const parameters = [
      { key: 'Alchemy Billing Value', label: 'Alchemy Billing Value' },
      { key: 'Integrator Charges (Margin)', label: 'Integrator Charges' },
      { key: 'Funding cost', label: 'Funding Cost' },
      { key: 'Net Margin', label: 'Net Margin' }
    ];
    
    const comparisonData = parameters.map(param => {
      const period1Total = period1Data.reduce((sum, item) => 
        sum + toNumber(item[param.key]), 0);
      const period2Total = period2Data.reduce((sum, item) => 
        sum + toNumber(item[param.key]), 0);
      
      const absoluteChange = period1Total - period2Total;
      const growthPercentage = period2Total > 0 ? ((period2Total - period1Total) / period2Total) * 100 : 0;
      
      return {
        parameter: param.label,
        currentQuarter: period1Total,
        previousQuarter: period2Total,
        absoluteChange,
        growthPercentage
      };
    });

    return {
      data: comparisonData,
      period1: period1Label,
      period2: period2Label
    };
  };

  const handleBillingDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBillingDateFilter(e.target.value);
  };

  const handleVendorDetailsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVendorDetailsFilter(e.target.value);
  };

  const handleVendorClick = (vendorName: string) => {
    setVendorDetailsFilter(vendorName);
    setBillingDateFilter('');
    setStartDate(null);
    setEndDate(null);
    // Clear all other date filters
    setSelectedQuarter('');
    setSelectedMonth('');
    setSelectedYear('');
    setStartQuarter('');
    setEndQuarter('');
    setStartYear('');
    setEndYear('');
    setStartMonth('');
    setEndMonth('');
    setStartYearRange('');
    setEndYearRange('');
  };

  const clearAllDateFilters = () => {
    setStartDate(null);
    setEndDate(null);
    setSelectedQuarter('');
    setSelectedMonth('');
    setSelectedYear('');
    setStartQuarter('');
    setEndQuarter('');
    setStartYear('');
    setEndYear('');
    setStartMonth('');
    setEndMonth('');
    setStartYearRange('');
    setEndYearRange('');
    console.log('🔍 All filters cleared - processing all data');
  };

  if (loading) return <div className="loading">Loading dashboard data...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  const summariesWithPercentages = calculatePercentageValues();
  const domainData = calculateDomainData();
  const monthlyBillingData = calculateMonthlyBillingData();
  const comparisonResult = calculateDynamicComparison();
  const quarterComparisonData = comparisonResult.data;
  
  // Generate comparison chart data in the format expected by the chart component
  const comparisonChartData = [
    {
      billingMonth: comparisonResult.period1,
      alchemyBilling: quarterComparisonData.find(item => item.parameter === 'Alchemy Billing Value')?.currentQuarter || 0,
      integratorCharges: quarterComparisonData.find(item => item.parameter === 'Integrator Charges')?.currentQuarter || 0,
      fundingCost: quarterComparisonData.find(item => item.parameter === 'Funding Cost')?.currentQuarter || 0,
      netMargin: quarterComparisonData.find(item => item.parameter === 'Net Margin')?.currentQuarter || 0
    },
    {
      billingMonth: comparisonResult.period2,
      alchemyBilling: quarterComparisonData.find(item => item.parameter === 'Alchemy Billing Value')?.previousQuarter || 0,
      integratorCharges: quarterComparisonData.find(item => item.parameter === 'Integrator Charges')?.previousQuarter || 0,
      fundingCost: quarterComparisonData.find(item => item.parameter === 'Funding Cost')?.previousQuarter || 0,
      netMargin: quarterComparisonData.find(item => item.parameter === 'Net Margin')?.previousQuarter || 0
    }
  ];
  const totals = {
    sum: summariesWithPercentages.reduce((acc: any, item: any) => acc + item.sum, 0),
    average: summariesWithPercentages.reduce((acc: any, item: any) => acc + item.average, 0) / summariesWithPercentages.length,
    count: filteredData.length
  };

  const summariesWithPercent = summariesWithPercentages.map(summary => ({
  ...summary,
  percent: totals.sum > 0 ? (summary.sum / totals.sum) * 100 : 0
}));

  const datePivotSummaries = calculateDatePivotSummaries();

  const datePivotGrandTotals = datePivotSummaries.reduce(
    (acc, summary) => ({
      integratorCharges: acc.integratorCharges + (summary.integratorCharges || 0),
      alchemyBilling: acc.alchemyBilling + (summary.alchemyBilling || 0),
      fundingCost: acc.fundingCost + (summary.fundingCost || 0),
      netMargin: acc.netMargin + (summary.netMargin || 0),
      vendorInvoiceAmount: acc.vendorInvoiceAmount + (summary.vendorInvoiceAmount || 0),
    }),
    {
      integratorCharges: 0,
      alchemyBilling: 0,
      fundingCost: 0,
      netMargin: 0,
      vendorInvoiceAmount: 0,
    }
  );

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
        }}>Routing Dashboard</h2>
        <div className="auth-buttons-container">
          {/* Action Dropdown */}
          <div className="action-dropdown-container" ref={actionDropdownRef}>
            <button
              className="auth-button action-button"
              onClick={() => setIsActionDropdownOpen(!isActionDropdownOpen)}
            >
              Actions ▼
            </button>
            {isActionDropdownOpen && (
              <div className="dropdown-menu">
                <div className="dropdown-item" onClick={() => { setActiveTab('datePivot'); setIsActionDropdownOpen(false); }}>
                  Date Pivot View
                </div>
                <div className="dropdown-item" onClick={() => { navigate('/AddRoutingData'); setIsActionDropdownOpen(false); }}>
                  Add Routing Data
                </div>
              </div>
            )}
          </div>

          {/* Export buttons when in pivot views */}
          {activeTab === 'datePivot' && (
            <button className="auth-button" onClick={exportDatePivotToExcel}>
              Export Date Pivot
            </button>
          )}

          {/* Back to Summary button when in pivot views */}
          {activeTab === 'datePivot' && (
            <button className="auth-button" onClick={() => setActiveTab('summary')}>
              Back to Summary
            </button>
          )}

          <button
            className="auth-button"
            onClick={() => navigate(-1)}
          >
            Back
          </button>
          
        </div>
      </div>

      {/* Filter Controls */}
      <div className="filter-controls">
        <div className="filter-row">
          <div className="filter-group">
            <label>Date Filter:</label>
            <select 
              value={dateFilterType}
              onChange={(e) => setDateFilterType(e.target.value)}
              className="filter-select"
            >
              {dateFilterOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {dateFilterType === 'dateRange' && (
  <>
    <DatePicker
      selected={startDate}
      onChange={date => setStartDate(date)}
      selectsStart
      startDate={startDate}
      endDate={endDate}
      placeholderText="Start date (YYYY-MM-DD)"
      className="date-input"
      dateFormat="yyyy-MM-dd"
    />
    <span>to</span>
    <DatePicker
      selected={endDate}
      onChange={date => setEndDate(date)}
      selectsEnd
      startDate={startDate}
      endDate={endDate}
      minDate={startDate || undefined}
      placeholderText="End date (YYYY-MM-DD)"
      className="date-input"
      dateFormat="yyyy-MM-dd"
    />
  </>
)}

            {dateFilterType === 'singleQuarter' && (
              <div className="quarter-filter">
                <select
                  value={selectedQuarter}
                  onChange={(e) => setSelectedQuarter(e.target.value)}
                  className="filter-select"
                >
                  <option value="">Select Quarter</option>
                  {quarterOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="filter-select"
                >
                  <option value="">Select Year</option>
                  {yearOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {dateFilterType === 'singleMonth' && (
              <div className="month-filter">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="filter-select"
                >
                  <option value="">Select Month</option>
                  {monthOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="filter-select"
                >
                  <option value="">Select Year</option>
                  {yearOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {dateFilterType === 'singleYear' && (
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="filter-select"
              >
                <option value="">Select Year</option>
                {yearOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}

            {dateFilterType === 'quarterRange' && (
              <div className="quarter-range-filter">
                <select
                  value={startQuarter}
                  onChange={(e) => setStartQuarter(e.target.value)}
                  className="filter-select"
                >
                  <option value="">Start Quarter</option>
                  {quarterOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={startYear}
                  onChange={(e) => setStartYear(e.target.value)}
                  className="filter-select"
                >
                  <option value="">Start Year</option>
                  {yearOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span>to</span>
                <select
                  value={endQuarter}
                  onChange={(e) => setEndQuarter(e.target.value)}
                  className="filter-select"
                >
                  <option value="">End Quarter</option>
                  {quarterOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={endYear}
                  onChange={(e) => setEndYear(e.target.value)}
                  className="filter-select"
                >
                  <option value="">End Year</option>
                  {yearOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {dateFilterType === 'monthRange' && (
              <div className="month-range-filter">
                <select
                  value={startMonth}
                  onChange={(e) => setStartMonth(e.target.value)}
                  className="filter-select"
                >
                  <option value="">Start Month</option>
                  {monthOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={startYear}
                  onChange={(e) => setStartYear(e.target.value)}
                  className="filter-select"
                >
                  <option value="">Start Year</option>
                  {yearOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span>to</span>
                <select
                  value={endMonth}
                  onChange={(e) => setEndMonth(e.target.value)}
                  className="filter-select"
                >
                  <option value="">End Month</option>
                  {monthOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={endYear}
                  onChange={(e) => setEndYear(e.target.value)}
                  className="filter-select"
                >
                  <option value="">End Year</option>
                  {yearOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {dateFilterType === 'yearRange' && (
              <div className="year-range-filter">
                <select
                  value={startYearRange}
                  onChange={(e) => setStartYearRange(e.target.value)}
                  className="filter-select"
                >
                  <option value="">Start Year</option>
                  {yearOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span>to</span>
                <select
                  value={endYearRange}
                  onChange={(e) => setEndYearRange(e.target.value)}
                  className="filter-select"
                >
                  <option value="">End Year</option>
                  {yearOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(startDate || endDate || selectedQuarter || selectedMonth || selectedYear ||
              startQuarter || endQuarter || startYear || endYear ||
              startMonth || endMonth || startYearRange || endYearRange) && (
              <button 
                onClick={clearAllDateFilters}
                className="clear-button"
              >
                Clear Date Filters
              </button>
            )}
          </div>

          <div className="filter-group">
            <label htmlFor="vendor-details-filter">Vendor Details:</label>
            <input
              id="vendor-details-filter"
              type="text"
              placeholder="Filter by vendor..."
              value={vendorDetailsFilter}
              onChange={handleVendorDetailsChange}
            />
          </div>
        </div>
      </div>


      {/* Display active filters */}
      {(vendorDetailsFilter || 
  startDate || endDate || selectedQuarter || selectedMonth || selectedYear ||
  startQuarter || endQuarter || startYear || endYear ||
  startMonth || endMonth || startYearRange || endYearRange) && (
  <div className="active-filter">
    {vendorDetailsFilter && (
      <span>Vendor Details: <strong>{vendorDetailsFilter}</strong></span>
    )}
    {/* Billing Month range filter display */}
    {dateFilterType === 'dateRange' && (startDate || endDate) && (
  <>
    {vendorDetailsFilter ? <span> | </span> : null}
    <span>Billing Month Range: 
                      <strong>{startDate ? ` ${formatDateToDDMMYYYY(startDate.toISOString())}` : ''}</strong>
      {startDate && endDate ? ' to ' : ''}
              <strong>{endDate ? ` ${formatDateToDDMMYYYY(endDate.toISOString())}` : ''}</strong>
    </span>
  </>
)}
    {/* Quarter range filter display */}
    {dateFilterType === 'quarterRange' && (startQuarter || endQuarter) && (
      <>
        {vendorDetailsFilter || startDate || endDate ? <span> | </span> : null}
        <span>Quarter Range: 
          <strong>{startQuarter ? ` ${startQuarter} ${startYear}` : ''}</strong>
          {startQuarter && endQuarter ? ' to ' : ''}
          <strong>{endQuarter ? ` ${endQuarter} ${endYear}` : ''}</strong>
              </span>
            </>
          )}
          
          {/* Month range filter display */}
          {dateFilterType === 'monthRange' && (startMonth || endMonth) && (
            <>
              {billingDateFilter || vendorDetailsFilter ? <span> | </span> : null}
              <span>Month Range: 
                <strong>{startMonth ? ` ${monthOptions.find(m => m.value === startMonth)?.label} ${startYear}` : ''}</strong>
                {startMonth && endMonth ? ' to ' : ''}
                <strong>{endMonth ? ` ${monthOptions.find(m => m.value === endMonth)?.label} ${endYear}` : ''}</strong>
              </span>
            </>
          )}
          
          {/* Year range filter display */}
          {dateFilterType === 'yearRange' && (startYearRange || endYearRange) && (
            <>
              {billingDateFilter || vendorDetailsFilter ? <span> | </span> : null}
              <span>Year Range: 
                <strong>{startYearRange ? ` ${startYearRange}` : ''}</strong>
                {startYearRange && endYearRange ? ' to ' : ''}
                <strong>{endYearRange ? ` ${endYearRange}` : ''}</strong>
              </span>
            </>
          )}
          
          {/* Single quarter filter display */}
          {dateFilterType === 'singleQuarter' && selectedQuarter && (
            <>
              {billingDateFilter || vendorDetailsFilter ? <span> | </span> : null}
              <span>Quarter: 
                <strong> {selectedQuarter} {selectedYear}</strong>
              </span>
            </>
          )}
          
          {/* Single month filter display */}
          {dateFilterType === 'singleMonth' && selectedMonth && (
            <>
              {billingDateFilter || vendorDetailsFilter ? <span> | </span> : null}
              <span>Month: 
                <strong> {monthOptions.find(m => m.value === selectedMonth)?.label} {selectedYear}</strong>
              </span>
            </>
          )}
          
          {/* Single year filter display */}
          {dateFilterType === 'singleYear' && selectedYear && (
            <>
              {billingDateFilter || vendorDetailsFilter ? <span> | </span> : null}
              <span>Year: 
                <strong> {selectedYear}</strong>
              </span>
            </>
          )}

          <button
            className="clear-filter"
            onClick={() => {
  setVendorDetailsFilter('');
  clearAllDateFilters();
}}
          >
            Clear All Filters
          </button>
        </div>
      )}

      {/* Main Content */}
      {filteredData.length > 0 ? (
        activeTab === 'summary' ? (
          <>
            <div className="summary-cards">
              {summariesWithPercentages.map(summary => (
                <div key={summary.field} className="summary-card">
                  <h3>{summary.field}</h3>
                  <div className="card-value">₹{summary.sum.toLocaleString()}</div>
                  <div className="card-stats">
                    {summary.showPercentage ? (
                      <span>Percentage: {summary.percentage.toFixed(2)}%</span>
                    ) : (
                      <>
                        <span>Avg: ₹{summary.average.toLocaleString()}</span>
                        <span>Min: ₹{summary.min.toLocaleString()}</span>
                        <span>Max: ₹{summary.max.toLocaleString()}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Comparison Analysis Table */}
            <div className="comparison-header-container">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th>{comparisonResult.period2}</th>
                    <th>{comparisonResult.period1}</th>
                    <th>Absolute Change</th>
                    <th>Growth %</th>
                  </tr>
                </thead>
                <tbody>
                  {quarterComparisonData.map((item, index) => (
                    <tr key={index}>
                      <td style={{ textAlign: 'left', fontWeight: '600' }}>{item.parameter}</td>
                      <td>₹{item.previousQuarter.toLocaleString()}</td>
                      <td>₹{item.currentQuarter.toLocaleString()}</td>
                      <td style={{ 
                        color: item.absoluteChange >= 0 ? '#28a745' : '#dc3545',
                        fontWeight: '600'
                      }}>
                        {item.absoluteChange >= 0 ? '+' : ''}₹{item.absoluteChange.toLocaleString()}
                      </td>
                      <td style={{ 
                        color: item.growthPercentage >= 0 ? '#28a745' : '#dc3545',
                        fontWeight: '600'
                      }}>
                        {item.growthPercentage >= 0 ? '+' : ''}{item.growthPercentage.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>


           <div className="dashboard-table-container">
  <div className="pie-chart-container">
    <MetricPieChart key={filteredData.length} data={domainData} />
  </div>
  <div className="chart-container">
    <RoutingDashboard_gauge_chart data={comparisonChartData} />
  </div>
</div>
            <div>
              <VendorBarChart
                data={filteredData.map(item => ({
                  vendorName: item['Vendor Details'] || 'Unknown Vendor',
                  value: parseFloat(
                    String(item['Alchemy Billing Value'] || '0')
                      .replace(/[^\d.-]/g, '')
                      .replace(/,/g, '')
                  ) || 0,
                }))}
                onVendorClick={handleVendorClick}
              />
            </div>
          </>
        ) : activeTab === 'datePivot' ? (
          <div className="pivot-table-container">
            {/* Date Pivot Controls */}
            <div className="pivot-controls" style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <select 
                value={pivotDateType}
                onChange={(e) => setPivotDateType(e.target.value as 'month' | 'quarter' | 'year')}
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                <option value="month">Month</option>
                <option value="quarter">Quarter</option>
                <option value="year">Year</option>
              </select>
            </div>
            
            <table className="pivot-table">
              <thead>
                <tr>
                  <th>Date Group</th>
                  <th>Alchemy Billing</th>
                  <th>Vendor Invoice Amount</th>
                  <th>Integrator Charges</th>
                  <th>Funding Cost</th>
                  <th>Net Margin</th>
                </tr>
              </thead>
              <tbody>
                {datePivotSummaries.map((summary, index) => (
                  <tr key={index}>
                    <td>{summary.dateGroup}</td>
                    <td>{summary.alchemyBilling.toLocaleString()}</td>
                    <td>{summary.vendorInvoiceAmount.toLocaleString()}</td>
                    <td>{summary.integratorCharges.toLocaleString()}</td>
                    <td>{summary.fundingCost.toLocaleString()}</td>
                    <td>{summary.netMargin.toLocaleString()}</td>
                  </tr>
                ))}
                <tr className="grand-total">
                  <td><strong>Grand Total</strong></td>
                  <td>{datePivotGrandTotals.alchemyBilling.toLocaleString()}</td>
                  <td>{datePivotGrandTotals.vendorInvoiceAmount.toLocaleString()}</td>
                  <td>{datePivotGrandTotals.integratorCharges.toLocaleString()}</td>
                  <td>{datePivotGrandTotals.fundingCost.toLocaleString()}</td>
                  <td>{datePivotGrandTotals.netMargin.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null
      ) : (
        <div className="no-data">
          <p>No matching records found. Please adjust your filters.</p>
        </div>
      )}
    </div>
  );
};

export default RoutingDashboard;