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

  // Helper function to get date group based on pivot type
  const getDateGroup = (dateStr: string, type: 'month' | 'quarter' | 'year'): string => {
    if (!dateStr) return 'Unknown Date';
    
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Invalid Date';
      
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      
      switch (type) {
        case 'year':
          return `${year}`;
        case 'quarter':
          const quarter = Math.ceil(month / 3);
          return `Q${quarter} ${year}`;
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
        
        // Set default filter to current financial year
        const { startDate: fyStartDate, endDate: fyEndDate } = getCurrentFinancialYearRange();
        setStartDate(fyStartDate);
        setEndDate(fyEndDate);
        setDateFilterType('dateRange');
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
        (item['Costing Date'] && String(item['Costing Date']).toLowerCase().includes(billingDateLower));

      // Date filters
       let hasDateMatch = true;
    const itemDateStr = item['Costing Date'];
     if (itemDateStr) {
      // Parse the date string (assuming format is YYYY-MM-DD)
      const itemDate = new Date(itemDateStr);
      if (isNaN(itemDate.getTime())) {
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
              if (itemYear < startY || (itemYear === startY && itemMonth < startQ.start)) {
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
          const strValue = String(val || '0')
            .replace(/[^\d.-]/g, '')
            .replace(/,/g, '');
          return parseFloat(strValue) || 0;
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



  // Calculate date-based summaries for pivot table
  const calculateDatePivotSummaries = (): DatePivotSummary[] => {
    const dateMap = new Map<string, DatePivotSummary>();

    filteredData.forEach(item => {
      // Use Costing Date as primary date field, fallback to other date fields
      const dateStr = item['Costing Date'] || item['IBM / KYNDRYL PO Date'] || item['Vendor_PO_Date'] || '';
      const dateGroup = getDateGroup(dateStr, pivotDateType);
      
      const toNumber = (value: any): number => {
        if (typeof value === 'number') return value;
        const strValue = String(value || '0')
          .replace(/[^\d.-]/g, '')
          .replace(/,/g, '');
        return parseFloat(strValue) || 0;
      };

      const charges = toNumber(item['Integrator Charges (Margin)']);
      const billing = toNumber(item['Alchemy Billing Value']);
      const funding = toNumber(item['Funding cost']);
      const margin = toNumber(item['Net Margin']);
      const vendorInvoice = toNumber(item['Vendor Inv. Amount']);

      if (!dateMap.has(dateGroup)) {
        dateMap.set(dateGroup, {
          dateGroup,
          integratorCharges: 0,
          alchemyBilling: 0,
          fundingCost: 0,
          netMargin: 0,
          vendorInvoiceAmount: 0
        });
      }

      const dateData = dateMap.get(dateGroup)!;
      dateData.integratorCharges += charges;
      dateData.alchemyBilling += billing;
      dateData.fundingCost += funding;
      dateData.netMargin += margin;
      dateData.vendorInvoiceAmount += vendorInvoice;
    });

    return Array.from(dateMap.values()).sort((a, b) => {
      // Sort by date group (chronological order)
      const dateA = new Date(a.dateGroup.replace('Q', '').replace(/(\d+)/, ' $1'));
      const dateB = new Date(b.dateGroup.replace('Q', '').replace(/(\d+)/, ' $1'));
      return dateA.getTime() - dateB.getTime();
    });
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

  // Calculate monthly billing data for bar chart
  const calculateMonthlyBillingData = () => {
    const monthlyMap = new Map<string, {
      alchemyBilling: number;
      integratorCharges: number;
      fundingCost: number;
      netMargin: number;
    }>();
    
    filteredData.forEach(item => {
      const billingMonth = item['Billing Month'] || 'Unknown Month';
      const alchemyBilling = parseFloat(String(item['Alchemy Billing Value'] || '0').replace(/[^\d.-]/g, '').replace(/,/g, '')) || 0;
      const integratorCharges = parseFloat(String(item['Integrator Charges (Margin)'] || '0').replace(/[^\d.-]/g, '').replace(/,/g, '')) || 0;
      const fundingCost = parseFloat(String(item['Funding cost'] || '0').replace(/[^\d.-]/g, '').replace(/,/g, '')) || 0;
      const netMargin = parseFloat(String(item['Net Margin'] || '0').replace(/[^\d.-]/g, '').replace(/,/g, '')) || 0;
      
      if (!monthlyMap.has(billingMonth)) {
        monthlyMap.set(billingMonth, {
          alchemyBilling: 0,
          integratorCharges: 0,
          fundingCost: 0,
          netMargin: 0
        });
      }
      
      const monthData = monthlyMap.get(billingMonth)!;
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
      const dateA = new Date(a.billingMonth);
      const dateB = new Date(b.billingMonth);
      return dateA.getTime() - dateB.getTime();
    });
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
  };

  if (loading) return <div className="loading">Loading dashboard data...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  const summariesWithPercentages = calculatePercentageValues();
  const domainData = calculateDomainData();
  const monthlyBillingData = calculateMonthlyBillingData();
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
    {/* Costing Date range filter display */}
    {dateFilterType === 'dateRange' && (startDate || endDate) && (
  <>
    {vendorDetailsFilter ? <span> | </span> : null}
    <span>Costing Date Range: 
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
                  <div className="card-label">Total</div>
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

           <div className="dashboard-table-container">
  <div className="pie-chart-container">
    <MetricPieChart key={filteredData.length} data={domainData} />
  </div>
  <div className="chart-container">
    <RoutingDashboard_gauge_chart data={monthlyBillingData} />
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
                    <td>₹{summary.alchemyBilling.toLocaleString()}</td>
                    <td>₹{summary.vendorInvoiceAmount.toLocaleString()}</td>
                    <td>₹{summary.integratorCharges.toLocaleString()}</td>
                    <td>₹{summary.fundingCost.toLocaleString()}</td>
                    <td>₹{summary.netMargin.toLocaleString()}</td>
                  </tr>
                ))}
                <tr className="grand-total">
                  <td><strong>Grand Total</strong></td>
                  <td>₹{datePivotGrandTotals.alchemyBilling.toLocaleString()}</td>
                  <td>₹{datePivotGrandTotals.vendorInvoiceAmount.toLocaleString()}</td>
                  <td>₹{datePivotGrandTotals.integratorCharges.toLocaleString()}</td>
                  <td>₹{datePivotGrandTotals.fundingCost.toLocaleString()}</td>
                  <td>₹{datePivotGrandTotals.netMargin.toLocaleString()}</td>
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