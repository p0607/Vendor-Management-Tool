// Calculation utilities for Team Report
// Pure functions for data calculations

import { ReportData, CompareType } from '../types';

// Parse date from month and year
export const parseDate = (month: string, year: number): Date => {
  // Handle Excel serial date format
  if (typeof month === "string" && /^\d{2}-\d{2}-\d{4}$/.test(month)) {
    const [day, monthStr, yearStr] = month.split('-');
    return new Date(parseInt(yearStr), parseInt(monthStr) - 1, parseInt(day));
  }

  // Handle YYYY-MM-DD format
  if (typeof month === "string" && /^\d{4}-\d{2}-\d{2}$/.test(month)) {
    return new Date(month);
  }

  // Handle standard date string
  if (typeof month === "string" && !isNaN(Date.parse(month))) {
    const date = new Date(month);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Handle Excel serial number
  if (typeof month === "number" || !isNaN(parseInt(month, 10))) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const days = typeof month === "number" ? month : parseInt(month, 10);
    const date = new Date(excelEpoch.getTime() + days * 86400000);
    return date;
  }

  // Default parsing
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const monthIndex = monthNames.findIndex(name => 
    name.toLowerCase() === month.toLowerCase()
  );
  
  if (monthIndex !== -1) {
    return new Date(year, monthIndex, 1);
  }
  
  return new Date(year, 0, 1);
};

// Get current financial year
export const getCurrentFinancialYear = (): number => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12
  
  // Financial year starts in April (month 4)
  if (currentMonth >= 4) {
    return currentYear;
  } else {
    return currentYear - 1;
  }
};

// Get fiscal quarter
export const getFiscalQuarter = (date: Date) => {
  const month = date.getMonth() + 1; // 1-12
  const year = date.getFullYear();
  
  if (month >= 4 && month <= 6) {
    return { label: `Q1(Apr-Jun) ${year}`, quarter: 'Q1' };
  } else if (month >= 7 && month <= 9) {
    return { label: `Q2(Jul-Sep) ${year}`, quarter: 'Q2' };
  } else if (month >= 10 && month <= 12) {
    return { label: `Q3(Oct-Dec) ${year}`, quarter: 'Q3' };
  } else {
    return { label: `Q4(Jan-Mar) ${year + 1}`, quarter: 'Q4' };
  }
};

// Parse numeric value from Excel
export const parseNumericValue = (value: any): number => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  
  if (typeof value === 'string') {
    // Remove commas and parse
    const cleaned = value.replace(/,/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  
  return 0;
};

// Convert string to null if empty
export const stringOrNull = (value: any): string | null => {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
};

// Calculate growth percentage
export const calculateGrowthPercentage = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? Infinity : 0;
  return ((current - previous) / previous) * 100;
};

// Format value for display
export const formatValue = (value: number, isCroreMode: boolean = true): string => {
  if (isCroreMode) {
    return (value / 10000000).toFixed(2) + ' Cr';
  } else {
    return value.toLocaleString();
  }
};

// Get financial year months
export const getFinancialYearMonths = (): string[] => {
  return [
    'April', 'May', 'June', 'July', 'August', 'September',
    'October', 'November', 'December', 'January', 'February', 'March'
  ];
};

// Check if date is in financial year
export const isInFinancialYear = (date: Date, year: number): boolean => {
  const dateYear = date.getFullYear();
  const dateMonth = date.getMonth() + 1;
  
  // Financial year runs from April to March
  if (dateMonth >= 4) {
    return dateYear === year;
  } else {
    return dateYear === year + 1;
  }
};
