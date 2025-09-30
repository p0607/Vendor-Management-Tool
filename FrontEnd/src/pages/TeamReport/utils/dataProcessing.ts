// Data processing utilities for Team Report
// Functions for data transformation and filtering

import { ReportData, CompareType } from '../types';
import { parseDate, getFiscalQuarter, isInFinancialYear } from './calculations';

// Filter data by business unit
export const filterByBusinessUnit = (data: ReportData[], businessUnit: string | null): ReportData[] => {
  if (!businessUnit) return data;
  return data.filter(item => item.business_unit === businessUnit);
};

// Filter data by client name
export const filterByClientName = (
  data: ReportData[], 
  clientName: string | null, 
  businessUnit: string | null
): ReportData[] => {
  if (!clientName) return data;
  
  return data.filter(item => {
    if (businessUnit === "Managed Services" || businessUnit === "MS") {
      return item.project_name === clientName;
    } else {
      return item.client_name === clientName;
    }
  });
};

// Filter data by BU head
export const filterByBUHead = (data: ReportData[], buHead: string | null): ReportData[] => {
  if (!buHead) return data;
  return data.filter(item => item.bu_head === buHead);
};

// Filter data by period
export const filterByPeriod = (
  data: ReportData[], 
  period: string, 
  compareType: CompareType
): ReportData[] => {
  return data.filter(item => {
    const date = parseDate(item.month, item.year);
    if (isNaN(date.getTime())) return false;
    
    switch (compareType) {
      case "year":
        const yearStr = date.getFullYear().toString();
        const fyYearStr = `FY ${yearStr}`;
        return period === yearStr || period === fyYearStr;
      
      case "month":
        const monthStr = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
        return monthStr === period;
      
      case "quarter":
        const quarter = getFiscalQuarter(date);
        return quarter.label === period;
      
      default:
        return false;
    }
  });
};

// Get unique business units from data
export const getUniqueBusinessUnits = (data: ReportData[]): string[] => {
  const units = new Set<string>();
  data.forEach(item => {
    if (item.business_unit) {
      units.add(item.business_unit);
    }
  });
  return Array.from(units).sort();
};

// Get unique client names from data
export const getUniqueClientNames = (data: ReportData[], businessUnit: string | null): string[] => {
  const clients = new Set<string>();
  data.forEach(item => {
    if (businessUnit === "Managed Services" || businessUnit === "MS") {
      if (item.project_name) {
        clients.add(item.project_name);
      }
    } else {
      if (item.client_name) {
        clients.add(item.client_name);
      }
    }
  });
  return Array.from(clients).sort();
};

// Get unique BU heads from data
export const getUniqueBUHeads = (data: ReportData[]): string[] => {
  const heads = new Set<string>();
  data.forEach(item => {
    if (item.bu_head) {
      heads.add(item.bu_head);
    }
  });
  return Array.from(heads).sort();
};

// Get available periods from data
export const getAvailablePeriods = (data: ReportData[], compareType: CompareType): string[] => {
  const periods = new Set<string>();
  
  data.forEach(item => {
    const date = parseDate(item.month, item.year);
    if (isNaN(date.getTime())) return;
    
    switch (compareType) {
      case "year":
        const year = date.getFullYear();
        periods.add(year.toString());
        periods.add(`FY ${year}`);
        break;
      
      case "month":
        const monthStr = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
        periods.add(monthStr);
        break;
      
      case "quarter":
        const quarter = getFiscalQuarter(date);
        periods.add(quarter.label);
        break;
    }
  });
  
  return Array.from(periods).sort();
};

// Process Excel data for import
export const processExcelData = (data: any[]): ReportData[] => {
  return data.map((row, index) => {
    const yearValue = row['Year'] || row.year;
    if (!yearValue) {
      throw new Error(`Row ${index + 1}: Year is required but missing`);
    }
    
    const monthValue = row['Month'] || row.month;
    if (!monthValue) {
      throw new Error(`Row ${index + 1}: Month is required but missing`);
    }

    const processedItem: ReportData = {
      tower: row['Tower'] || row.tower || '',
      client_name: row['Client_name'] || row['Client name'] || row.client_name || '',
      project_name: row['Project_name'] || row['Project name'] || row.project_name || '',
      business_unit: row['Business_unit'] || row['Business unit'] || row.business_unit || '',
      bu_head: row['BU_Head'] || row['BU Head'] || row.bu_head || '',
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
      month: monthValue,
      year: parseInt(String(yearValue))
    };

    // Convert empty strings to null for optional fields
    Object.keys(processedItem).forEach(key => {
      if (processedItem[key as keyof ReportData] === '') {
        (processedItem as any)[key] = null;
      }
    });

    return processedItem;
  });
};

// Helper function for parseNumericValue
const parseNumericValue = (value: any): number => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  
  return 0;
};
