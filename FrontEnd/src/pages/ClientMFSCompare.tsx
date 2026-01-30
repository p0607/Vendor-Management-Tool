import React, { useState, useEffect, useCallback, useMemo } from "react";

import { useNavigate, useLocation } from "react-router-dom";

import { Select, Button, Dropdown, Tabs, message, AutoComplete } from "antd";

import { PlusOutlined, CloseOutlined, DownOutlined } from "@ant-design/icons";

import * as am5 from "@amcharts/amcharts5";

import * as am5xy from "@amcharts/amcharts5/xy";

import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";

import styles from './TeamReportDashboard.module.css';

import axios from "axios";

import ClientParameterTrackingChart from './ClientParameterTrackingChart';

import { formatValueForTable } from '../utils/formatUtils';

import { compareBusinessUnits, normalizeBusinessUnitName, mapClientMFSToMFSBusinessUnit } from '../utils/businessUnitUtils';

import apiClient from '../config/api';

import * as XLSX from 'xlsx';



const { Option } = Select;

// API endpoint configuration - Using team_report table endpoint
// This fetches data from the team_report table (different from team_summary_report used by TeamReportCompare)
const API_ENDPOINT = "/team-report";



interface ReportData {

  id?: number;

  business_unit: string;

  client_name?: string;

  project_name?: string;

  bu_head?: string;

  month: string;

  year: number;

  hc: number;

  revenue: number;

  salary_cost?: number;

  gpm: number;

  gpm_percentage?: number;

  np?: number;

  np_percentage?: number;

  leave_encashment?: number;

  team_cost: number;

  opr_cost?: number;

  funding_cost?: number;

  net_margin?: number;

  rebate?: number;

  passthrough?: number;

  created_at?: string;

  updated_at?: string;

  [key: string]: any; // Add index signature for dynamic property access
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

  // Projection values for first period (current year)
  predictedAmount?: number; // Projected amount (projected - actual)
  sumAmount?: number; // Sum of actual + predicted (= projected)

}



type CompareType = "year" | "quarter" | "month";



const ClientMFSCompare: React.FC = () => {

  const navigate = useNavigate();

  const location = useLocation();

  
  // Clear URL parameters immediately to prevent them from overriding defaults
  const currentUrl = new URL(window.location.href);
  const paramsToRemove = ['compareType', 'selectedParameters', 'chartType', 'defaultFinancialYear'];
  
  paramsToRemove.forEach(param => {
    if (currentUrl.searchParams.has(param)) {
      // Removed verbose console.log for performance
      currentUrl.searchParams.delete(param);
    }
  });
  
  // Update URL without the problematic parameters
  if (paramsToRemove.some(param => window.location.search.includes(param))) {
    window.history.replaceState({}, '', currentUrl.toString());
    // console.log("🔍 URL cleaned, parameters removed");
  }
  
  // Create queryParams from the cleaned URL
  const queryParams = new URLSearchParams(currentUrl.search);
  

  

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


  // Helper function to get current financial year
  const getCurrentFinancialYear = () => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1; // 1-12
    const currentYear = currentDate.getFullYear();
    
    // Financial year starts from April (month 4)
    // FY 2025 = April 2025 to March 2026
    if (currentMonth >= 4) {
      return currentYear;
    } else {
      return currentYear - 1;
    }
  };

  // Helper function to get months completed in current financial year
  const getMonthsCompletedInCurrentFY = () => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1; // 1-12
    const currentYear = currentDate.getFullYear();
    
    // Financial year starts from April (month 4)
    if (currentMonth >= 4) {
      return currentMonth - 3; // April = 1, May = 2, etc.
    } else {
      return currentMonth + 9; // Jan = 10, Feb = 11, Mar = 12
    }
  };

  // Helper function to get quarter months
  const getQuarterMonths = (quarter: string) => {
    if (quarter.includes('Q1')) return [4, 5, 6]; // Apr, May, Jun
    if (quarter.includes('Q2')) return [7, 8, 9]; // Jul, Aug, Sep
    if (quarter.includes('Q3')) return [10, 11, 12]; // Oct, Nov, Dec
    if (quarter.includes('Q4')) return [1, 2, 3]; // Jan, Feb, Mar
    return [];
  };

  // Helper function to get available years for chart filter (last 5 years)
  const getAvailableYears = () => {
    const currentFY = getCurrentFinancialYear();
    const years = [];
    for (let i = 0; i < 5; i++) {
      years.push(currentFY - i);
    }
    return years;
  };

  // Helper function to get available quarters for chart filter
  const getAvailableQuarters = () => {
    const currentFY = getCurrentFinancialYear();
    return [
      `Q1(Apr-Jun) ${currentFY}`,
      `Q2(Jul-Sep) ${currentFY}`,
      `Q3(Oct-Dec) ${currentFY}`,
      `Q4(Jan-Mar) ${currentFY}`,
      `Q1(Apr-Jun) ${currentFY - 1}`,
      `Q2(Jul-Sep) ${currentFY - 1}`,
      `Q3(Oct-Dec) ${currentFY - 1}`,
      `Q4(Jan-Mar) ${currentFY - 1}`
    ];
  };

  // Helper function to get available months for chart filter
  const getAvailableMonths = () => {
    const currentFY = getCurrentFinancialYear();
    const months = [];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    
    // Add months for current FY (Apr to Mar)
    for (let i = 3; i < 12; i++) {
      months.push(`${monthNames[i]} ${currentFY}`);
    }
    for (let i = 0; i < 3; i++) {
      months.push(`${monthNames[i]} ${currentFY + 1}`);
    }
    
    // Add months for previous FY
    for (let i = 3; i < 12; i++) {
      months.push(`${monthNames[i]} ${currentFY - 1}`);
    }
    for (let i = 0; i < 3; i++) {
      months.push(`${monthNames[i]} ${currentFY}`);
    }
    
    return months;
  };

  // Helper function to get corresponding quarter from previous year
  const getCorrespondingPreviousQuarter = (quarter: string) => {
    const yearMatch = quarter.match(/(\d{4})/);
    if (!yearMatch) return null;
    
    const currentYear = parseInt(yearMatch[1]);
    const previousYear = currentYear - 1;
    
    // Match the exact format: Q1(Apr-Jun) 2025 -> Q1(Apr-Jun) 2024
    if (quarter.includes('Q1(Apr-Jun)')) return `Q1(Apr-Jun) ${previousYear}`;
    if (quarter.includes('Q2(Jul-Sep)')) return `Q2(Jul-Sep) ${previousYear}`;
    if (quarter.includes('Q3(Oct-Dec)')) return `Q3(Oct-Dec) ${previousYear}`;
    if (quarter.includes('Q4(Jan-Mar)')) return `Q4(Jan-Mar) ${previousYear}`;
    
    return null;
  };

  // Calculate raw database values for Growth Analysis Report (no projections)
  const calculateRawDatabaseValues = (): Record<string, {
    currentFY: number;
    previousFY: number;
    growthPercentage: number;
    isPositive: boolean;
    period: string;
  }> => {
    if (!data || data.length === 0) return {};

    // If comparing by quarters and we have selected quarters
    if (compareType === 'quarter' && comparisonValues.some(v => v)) {
      const currentQuarter = comparisonValues[0];
      const previousQuarter = comparisonValues[1];
      
      if (!currentQuarter || !previousQuarter) return {};

      const currentQuarterMonths = getQuarterMonths(currentQuarter);
      const previousQuarterMonths = getQuarterMonths(previousQuarter);
      
      // Extract years from quarter strings
      const currentYearMatch = currentQuarter.match(/(\d{4})/);
      const previousYearMatch = previousQuarter.match(/(\d{4})/);
      
      if (!currentYearMatch || !previousYearMatch) return {};
      
      const currentYear = parseInt(currentYearMatch[1]);
      const previousYear = parseInt(previousYearMatch[1]);

      // Filter data for current quarter
      const currentQuarterData = data.filter(item => {
        const itemDate = parseDate(item.month, item.year);
        const itemYear = itemDate.getFullYear();
        const itemMonth = itemDate.getMonth() + 1;
        
        // For quarters, we need to handle financial year logic
        // Q1(Apr-Jun) 2025 = April 2025 to June 2025
        // Q4(Jan-Mar) 2025 = January 2026 to March 2026
        if (currentQuarterMonths.includes(1) || currentQuarterMonths.includes(2) || currentQuarterMonths.includes(3)) {
          // Q4: Jan-Mar belongs to next calendar year
          return itemYear === currentYear + 1 && currentQuarterMonths.includes(itemMonth);
        } else {
          // Q1, Q2, Q3: Apr-Dec belongs to same calendar year
          return itemYear === currentYear && currentQuarterMonths.includes(itemMonth);
        }
      });

      // Filter data for previous quarter
      const previousQuarterData = data.filter(item => {
        const itemDate = parseDate(item.month, item.year);
        const itemYear = itemDate.getFullYear();
        const itemMonth = itemDate.getMonth() + 1;
        
        // For quarters, we need to handle financial year logic
        if (previousQuarterMonths.includes(1) || previousQuarterMonths.includes(2) || previousQuarterMonths.includes(3)) {
          // Q4: Jan-Mar belongs to next calendar year
          return itemYear === previousYear + 1 && previousQuarterMonths.includes(itemMonth);
        } else {
          // Q1, Q2, Q3: Apr-Dec belongs to same calendar year
          return itemYear === previousYear && previousQuarterMonths.includes(itemMonth);
        }
      });

      const calculateParameterRaw = (parameter: string) => {
        let currentValue, previousValue;

        // Special handling for HC - use sum of last available month's HC data
        if (parameter === 'hc') {
          // For current quarter: get the last month's HC value and sum it
          if (currentQuarterData.length > 0) {
            const lastMonthCurrent = currentQuarterData.reduce((latest, item) => {
              const itemDate = parseDate(item.month, item.year);
              const latestDate = parseDate(latest.month, latest.year);
              return itemDate > latestDate ? item : latest;
            });
            // Sum all HC values from that last month
            const lastMonthDate = parseDate(lastMonthCurrent.month, lastMonthCurrent.year);
            currentValue = currentQuarterData
              .filter(item => {
                const itemDate = parseDate(item.month, item.year);
                return itemDate.getMonth() === lastMonthDate.getMonth() && 
                       itemDate.getFullYear() === lastMonthDate.getFullYear();
              })
              .reduce((sum, item) => sum + (item.hc || 0), 0);
          } else {
            currentValue = 0;
          }

          // For previous quarter: get the last month's HC value and sum it
          if (previousQuarterData.length > 0) {
            const lastMonthPrevious = previousQuarterData.reduce((latest, item) => {
              const itemDate = parseDate(item.month, item.year);
              const latestDate = parseDate(latest.month, latest.year);
              return itemDate > latestDate ? item : latest;
            });
            // Sum all HC values from that last month
            const lastMonthDate = parseDate(lastMonthPrevious.month, lastMonthPrevious.year);
            previousValue = previousQuarterData
              .filter(item => {
                const itemDate = parseDate(item.month, item.year);
                return itemDate.getMonth() === lastMonthDate.getMonth() && 
                       itemDate.getFullYear() === lastMonthDate.getFullYear();
              })
              .reduce((sum, item) => sum + (item.hc || 0), 0);
          } else {
            previousValue = 0;
          }
        } else {
          // For all other parameters: aggregate by month first, then sum
          // This prevents double-counting when there are multiple records per month
          
          // Map parameter name to database field name
          const getFieldName = (param: string): string => {
            const paramLower = param.toLowerCase();
            if (paramLower === 'revenue') return 'revenue';
            if (paramLower === 'salary_cost') return 'salary_cost';
            if (paramLower === 'gpm') return 'gpm';
            if (paramLower === 'team_cost') return 'team_cost';
            if (paramLower === 'np' || paramLower === 'net_margin') return 'np'; // Use 'np' field
            if (paramLower === 'leave_encashment') return 'leave_encashment';
            if (paramLower === 'opr_cost') return 'opr_cost';
            if (paramLower === 'funding_cost') return 'funding_cost';
            if (paramLower === 'rebate') return 'rebate';
            if (paramLower === 'passthrough') return 'passthrough';
            return param; // Fallback to parameter name
          };
          
          const fieldName = getFieldName(parameter);
          
          // Current quarter aggregation
          const currentMonthlyTotals: {[key: string]: number} = {};
          currentQuarterData.forEach(item => {
            const monthKey = `${item.month} ${item.year}`;
            if (!currentMonthlyTotals[monthKey]) {
              currentMonthlyTotals[monthKey] = 0;
            }
            currentMonthlyTotals[monthKey] += (item[fieldName] || 0);
          });
          currentValue = Object.values(currentMonthlyTotals).reduce((sum: number, val: number) => sum + val, 0);
          
          // Previous quarter aggregation
          const previousMonthlyTotals: {[key: string]: number} = {};
          previousQuarterData.forEach(item => {
            const monthKey = `${item.month} ${item.year}`;
            if (!previousMonthlyTotals[monthKey]) {
              previousMonthlyTotals[monthKey] = 0;
            }
            previousMonthlyTotals[monthKey] += (item[fieldName] || 0);
          });
          previousValue = Object.values(previousMonthlyTotals).reduce((sum: number, val: number) => sum + val, 0);
        }

        const growthPercentage = previousValue > 0 
          ? ((currentValue - previousValue) / previousValue) * 100 
          : 0;

        return {
          currentFY: currentValue,
          previousFY: previousValue,
          growthPercentage,
          isPositive: growthPercentage >= 0,
          period: `${currentQuarter} vs ${previousQuarter}`
        };
      };

      return {
        Revenue: calculateParameterRaw('revenue'),
        GPM: calculateParameterRaw('gpm'),
        'Team Cost': calculateParameterRaw('team_cost'),
        NP: calculateParameterRaw('np') // Use 'np' field from database, not 'net_margin'
        // Removed unused KPIs: 'Opr Cost', 'Funding Cost', 'Leave Encashment', 'HC'
      };
    }

    // Default financial year calculation
    let currentFY = getCurrentFinancialYear();
    let previousFY = currentFY - 1;
    
    // If we have comparison values set, use them
    if (compareType === 'year' && comparisonValues.length >= 2 && comparisonValues[0] && comparisonValues[1]) {
      const currentFYMatch = comparisonValues[0].match(/FY (\d{4})/);
      const previousFYMatch = comparisonValues[1].match(/FY (\d{4})/);
      
      if (currentFYMatch) currentFY = parseInt(currentFYMatch[1]);
      if (previousFYMatch) previousFY = parseInt(previousFYMatch[1]);
    }


    // Filter data for current and previous financial years
    const currentFYData = data.filter(item => {
      const itemDate = parseDate(item.month, item.year);
      if (isNaN(itemDate.getTime())) return false;
      
      const itemYear = itemDate.getFullYear();
      const itemMonth = itemDate.getMonth() + 1;
      
      // Financial year filtering: FY 2025 = April 2025 to March 2026
      if (itemMonth >= 4) {
        // April to December: same calendar year
        return itemYear === currentFY;
      } else {
        // January to March: next calendar year
        return itemYear === currentFY + 1;
      }
    });

    const previousFYData = data.filter(item => {
      const itemDate = parseDate(item.month, item.year);
      if (isNaN(itemDate.getTime())) return false;
      
      const itemYear = itemDate.getFullYear();
      const itemMonth = itemDate.getMonth() + 1;
      
      // Financial year filtering: FY 2024 = April 2024 to March 2025
      if (itemMonth >= 4) {
        // April to December: same calendar year
        return itemYear === previousFY;
      } else {
        // January to March: next calendar year
        return itemYear === previousFY + 1;
      }
    });

    // Debug logging to see what data we're getting

    const calculateParameterRaw = (parameter: string) => {
      let currentFYActual, previousFYTotal;

      // Special handling for HC - use sum of last available month's HC data for each FY
      if (parameter === 'hc') {
        // For current FY: get the last month's HC value and sum it
        if (currentFYData.length > 0) {
          const lastMonthCurrent = currentFYData.reduce((latest, item) => {
            const itemDate = parseDate(item.month, item.year);
            const latestDate = parseDate(latest.month, latest.year);
            return itemDate > latestDate ? item : latest;
          });
          // Sum all HC values from that last month
          const lastMonthDate = parseDate(lastMonthCurrent.month, lastMonthCurrent.year);
          currentFYActual = currentFYData
            .filter(item => {
              const itemDate = parseDate(item.month, item.year);
              return itemDate.getMonth() === lastMonthDate.getMonth() && 
                     itemDate.getFullYear() === lastMonthDate.getFullYear();
            })
            .reduce((sum, item) => sum + (item.hc || 0), 0);
        } else {
          currentFYActual = 0;
        }

        // For previous FY: get the last month's HC value and sum it (March of next year for complete FY)
        if (previousFYData.length > 0) {
          const lastMonthPrevious = previousFYData.reduce((latest, item) => {
            const itemDate = parseDate(item.month, item.year);
            const latestDate = parseDate(latest.month, latest.year);
            return itemDate > latestDate ? item : latest;
          });
          // Sum all HC values from that last month
          const lastMonthDate = parseDate(lastMonthPrevious.month, lastMonthPrevious.year);
          previousFYTotal = previousFYData
            .filter(item => {
              const itemDate = parseDate(item.month, item.year);
              return itemDate.getMonth() === lastMonthDate.getMonth() && 
                     itemDate.getFullYear() === lastMonthDate.getFullYear();
            })
            .reduce((sum, item) => sum + (item.hc || 0), 0);
        } else {
          previousFYTotal = 0;
        }

        // console.log(`🔍 HC Raw Database Values (Sum of Last Available Month):`, {
        //   currentFY,
        //   previousFY,
        //   currentFYActual,
        //   previousFYTotal
        // });
      } else {
        // For all other parameters: aggregate by month first, then sum (ACTUAL DATA ONLY - NO PROJECTIONS)
        // This prevents double-counting when there are multiple records per month
        
        // Map parameter name to database field name
        // Support both space-separated ('salary cost') and underscore-separated ('salary_cost') formats
        const getFieldName = (param: string): string => {
          const paramLower = param.toLowerCase();
          if (paramLower === 'revenue') return 'revenue';
          if (paramLower === 'salary cost' || paramLower === 'salary_cost') return 'salary_cost';
          if (paramLower === 'gpm') return 'gpm';
          if (paramLower === 'team cost' || paramLower === 'team_cost') return 'team_cost';
          if (paramLower === 'np' || paramLower === 'net margin' || paramLower === 'net_margin') return 'np'; // Use 'np' field
          if (paramLower === 'leave encashment' || paramLower === 'leave_encashment') return 'leave_encashment';
          if (paramLower === 'opr cost' || paramLower === 'opr_cost') return 'opr_cost';
          if (paramLower === 'funding cost' || paramLower === 'funding_cost') return 'funding_cost';
          if (paramLower === 'rebate') return 'rebate';
          if (paramLower === 'passthrough') return 'passthrough';
          // Fallback: convert spaces to underscores for database field names
          return paramLower.replace(/\s+/g, '_');
        };
        
        const fieldName = getFieldName(parameter);
        
        // Current FY aggregation
        const currentFYMonthlyTotals: {[key: string]: number} = {};
        currentFYData.forEach(item => {
          const monthKey = `${item.month} ${item.year}`;
          if (!currentFYMonthlyTotals[monthKey]) {
            currentFYMonthlyTotals[monthKey] = 0;
          }
          currentFYMonthlyTotals[monthKey] += (item[fieldName] || 0);
        });
        currentFYActual = Object.values(currentFYMonthlyTotals).reduce((sum: number, val: number) => sum + val, 0);
        
        // Previous FY aggregation
        const previousFYMonthlyTotals: {[key: string]: number} = {};
        previousFYData.forEach(item => {
          const monthKey = `${item.month} ${item.year}`;
          if (!previousFYMonthlyTotals[monthKey]) {
            previousFYMonthlyTotals[monthKey] = 0;
          }
          previousFYMonthlyTotals[monthKey] += (item[fieldName] || 0);
        });
        previousFYTotal = Object.values(previousFYMonthlyTotals).reduce((sum: number, val: number) => sum + val, 0);

        // Debug: Show the difference between old and new calculation methods
        const oldCurrentFYActual = currentFYData.reduce((sum, item) => sum + (item[parameter] || 0), 0);
        const oldPreviousFYTotal = previousFYData.reduce((sum, item) => sum + (item[parameter] || 0), 0);
        
        // console.log(`🔍 Raw Database Values for ${parameter}:`, {
        //   currentFY,
        //   previousFY,
        //   currentFYActual,
        //   previousFYTotal
        // });
      }

      // Calculate growth percentage (current - previous) / previous * 100
      const growthPercentage = previousFYTotal > 0 
        ? ((currentFYActual - previousFYTotal) / previousFYTotal) * 100 
        : 0;

      return {
        currentFY: currentFYActual, // RAW DATABASE VALUE (or last month for HC)
        previousFY: previousFYTotal, // RAW DATABASE VALUE (or last month for HC)
        growthPercentage,
        isPositive: growthPercentage >= 0,
        period: (() => {
          if (compareType === 'quarter' && comparisonValues[0] && comparisonValues[1]) {
            return `${comparisonValues[0]} vs ${comparisonValues[1]}`;
          } else if (compareType === 'year' && comparisonValues[0] && comparisonValues[1]) {
            return `${comparisonValues[0]} vs ${comparisonValues[1]}`;
          } else {
            return `FY ${currentFY} vs FY ${previousFY}`;
          }
        })()
      };
    };

      return {
        Revenue: calculateParameterRaw('revenue'),
        GPM: calculateParameterRaw('gpm'),
        'Team Cost': calculateParameterRaw('team_cost'),
        NP: calculateParameterRaw('np') // Use 'np' field from database, not 'net_margin'
        // Removed unused KPIs: 'Salary Cost', 'Opr Cost', 'Funding Cost', 'Leave Encashment', 'HC'
      };
  };

  // Helper function to convert month name to number
  const getMonthNumber = (monthName: string): number => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.indexOf(monthName) + 1;
  };

  // KPI calculation function
  const calculateKPIs = (): Record<string, {
    currentFY: number;
    previousFY: number;
    growthPercentage: number;
    isPositive: boolean;
    monthsCompleted: number;
    monthsRemaining: number;
    period: string;
    currentFYActual: number;
    projectedAmount: number;
  }> => {
    if (!data || data.length === 0) return {};

    // Removed verbose debug logs for performance

    // If comparing by months and we have selected months
    if (compareType === 'month' && comparisonValues.some(v => v)) {
      // Removed verbose console.log for performance
      const currentMonth = comparisonValues[0];
      const previousMonth = comparisonValues[1];
      
      // Removed verbose console.log for performance
      
      if (!currentMonth || !previousMonth) return {};

      // Parse month and year from strings like "November 2023"
      const currentMonthMatch = currentMonth.match(/(\w+) (\d{4})/);
      const previousMonthMatch = previousMonth.match(/(\w+) (\d{4})/);
      
      if (!currentMonthMatch || !previousMonthMatch) return {};
      
      const currentMonthName = currentMonthMatch[1];
      const currentYear = parseInt(currentMonthMatch[2]);
      const previousMonthName = previousMonthMatch[1];
      const previousYear = parseInt(previousMonthMatch[2]);
      
      // Removed verbose debug logs for performance

      const calculateParameterKPI = (parameter: string) => {
        // Use the same logic as Growth Analysis for consistency
        // Removed verbose debug logs for performance
        
        const currentValue = getParameterValueUsingKPILogic(currentMonth, parameter);
        const previousValue = getParameterValueUsingKPILogic(previousMonth, parameter);

        const growthPercentage = previousValue > 0 
          ? ((currentValue - previousValue) / previousValue) * 100 
          : 0;

        // Removed verbose debug logs for performance

        return {
          currentFY: currentValue,
          previousFY: previousValue,
          growthPercentage,
          isPositive: growthPercentage >= 0,
          monthsCompleted: 1,
          monthsRemaining: 0,
          period: `${currentMonth} vs ${previousMonth}`,
          currentFYActual: currentValue,
          projectedAmount: 0
        };
      };

      const kpiResults = {
        Revenue: calculateParameterKPI('Revenue'),
        'Salary Cost': calculateParameterKPI('Salary Cost'),
        GPM: calculateParameterKPI('GPM'),
        NP: calculateParameterKPI('NP'), // Use 'NP' which maps to 'np' field
        'Leave Encashment': calculateParameterKPI('Leave Encashment'),
        'Team Cost': calculateParameterKPI('Team Cost'),
        'Opr Cost': calculateParameterKPI('Opr Cost'),
        'Funding Cost': calculateParameterKPI('Funding Cost'),
        Rebate: calculateParameterKPI('Rebate'),
        Passthrough: calculateParameterKPI('Passthrough'),
        HC: calculateParameterKPI('HC')
        // Removed GPM % and NP % from KPI dashboard
      };
      
      // console.log("🔍 Month KPI Results:", kpiResults);
      return kpiResults;
    }

    // If comparing by quarters and we have selected quarters
    if (compareType === 'quarter' && comparisonValues.some(v => v)) {
      const currentQuarter = comparisonValues[0];
      const previousQuarter = comparisonValues[1];
      
      if (!currentQuarter || !previousQuarter) return {};

      const currentQuarterMonths = getQuarterMonths(currentQuarter);
      const previousQuarterMonths = getQuarterMonths(previousQuarter);
      
      // Extract years from quarter strings
      const currentYearMatch = currentQuarter.match(/(\d{4})/);
      const previousYearMatch = previousQuarter.match(/(\d{4})/);
      
      if (!currentYearMatch || !previousYearMatch) return {};
      
      const currentYear = parseInt(currentYearMatch[1]);
      const previousYear = parseInt(previousYearMatch[1]);

      // Filter data for current quarter
      const currentQuarterData = data.filter(item => {
        const itemDate = parseDate(item.month, item.year);
        const itemYear = itemDate.getFullYear();
        const itemMonth = itemDate.getMonth() + 1;
        
        // For quarters, we need to handle financial year logic
        // Q1(Apr-Jun) 2025 = April 2025 to June 2025
        // Q4(Jan-Mar) 2025 = January 2026 to March 2026
        if (currentQuarterMonths.includes(1) || currentQuarterMonths.includes(2) || currentQuarterMonths.includes(3)) {
          // Q4: Jan-Mar belongs to next calendar year
          return itemYear === currentYear + 1 && currentQuarterMonths.includes(itemMonth);
        } else {
          // Q1, Q2, Q3: Apr-Dec belongs to same calendar year
          return itemYear === currentYear && currentQuarterMonths.includes(itemMonth);
        }
      });

      // Filter data for previous quarter
      const previousQuarterData = data.filter(item => {
        const itemDate = parseDate(item.month, item.year);
        const itemYear = itemDate.getFullYear();
        const itemMonth = itemDate.getMonth() + 1;
        
        // For quarters, we need to handle financial year logic
        if (previousQuarterMonths.includes(1) || previousQuarterMonths.includes(2) || previousQuarterMonths.includes(3)) {
          // Q4: Jan-Mar belongs to next calendar year
          return itemYear === previousYear + 1 && previousQuarterMonths.includes(itemMonth);
        } else {
          // Q1, Q2, Q3: Apr-Dec belongs to same calendar year
          return itemYear === previousYear && previousQuarterMonths.includes(itemMonth);
        }
      });

      const calculateParameterKPI = (parameter: string) => {
        const currentValue = currentQuarterData.reduce((sum, item) => sum + (item[parameter] || 0), 0);
        const previousValue = previousQuarterData.reduce((sum, item) => sum + (item[parameter] || 0), 0);

        const growthPercentage = previousValue > 0 
          ? ((currentValue - previousValue) / previousValue) * 100 
          : 0;

        return {
          currentFY: currentValue,
          previousFY: previousValue,
          growthPercentage,
          isPositive: growthPercentage >= 0,
          monthsCompleted: currentQuarterMonths.length,
          monthsRemaining: 0,
          period: `${currentQuarter} vs ${previousQuarter}`,
          currentFYActual: currentValue,
          projectedAmount: 0
        };
      };

      return {
        Revenue: calculateParameterKPI('revenue'),
        'Salary Cost': calculateParameterKPI('salary_cost'),
        GPM: calculateParameterKPI('gpm'),
        NP: calculateParameterKPI('np'), // Use 'np' field from database, not 'net_margin'
        'Leave Encashment': calculateParameterKPI('leave_encashment'),
        'Team Cost': calculateParameterKPI('team_cost'),
        'Opr Cost': calculateParameterKPI('opr_cost'),
        'Funding Cost': calculateParameterKPI('funding_cost'),
        Rebate: calculateParameterKPI('rebate'),
        Passthrough: calculateParameterKPI('passthrough'),
        HC: calculateParameterKPI('hc')
        // Removed GPM % and NP % from KPI dashboard
      };
    }

    // Default financial year calculation
    let currentFY = getCurrentFinancialYear();
    let previousFY = currentFY - 1;
    
    // If we have comparison values set, use them
    if (compareType === 'year' && comparisonValues.length >= 2 && comparisonValues[0] && comparisonValues[1]) {
      const currentFYMatch = comparisonValues[0].match(/FY (\d{4})/);
      const previousFYMatch = comparisonValues[1].match(/FY (\d{4})/);
      
      if (currentFYMatch) currentFY = parseInt(currentFYMatch[1]);
      if (previousFYMatch) previousFY = parseInt(previousFYMatch[1]);
    }
    
    const monthsCompleted = getMonthsCompletedInCurrentFY();
    const monthsRemaining = 12 - monthsCompleted;

      // Financial year calculation is working correctly

    // Filter data for current and previous financial years
    const currentFYData = data.filter(item => {
      const itemDate = parseDate(item.month, item.year);
      if (isNaN(itemDate.getTime())) return false;
      
      const itemYear = itemDate.getFullYear();
      const itemMonth = itemDate.getMonth() + 1;
      
      // Financial year filtering: FY 2025 = April 2025 to March 2026
      if (itemMonth >= 4) {
        // April to December: same calendar year
        return itemYear === currentFY;
      } else {
        // January to March: next calendar year
        return itemYear === currentFY + 1;
      }
    });

    const previousFYData = data.filter(item => {
      const itemDate = parseDate(item.month, item.year);
      if (isNaN(itemDate.getTime())) return false;
      
      const itemYear = itemDate.getFullYear();
      const itemMonth = itemDate.getMonth() + 1;
      
      // Financial year filtering: FY 2024 = April 2024 to March 2025
      if (itemMonth >= 4) {
        // April to December: same calendar year
        return itemYear === previousFY;
      } else {
        // January to March: next calendar year
        return itemYear === previousFY + 1;
      }
    });
    
    // Debug: Check what months are being included
    const currentFYMonths = currentFYData.map(item => `${item.month} ${item.year}`).sort();
    const previousFYMonths = previousFYData.map(item => `${item.month} ${item.year}`).sort();
    
    // console.log(`🔍 FINANCIAL YEAR DEBUG:`, {
    //   currentFY,
    //   previousFY,
    //   currentFYDataCount: currentFYData.length,
    //   previousFYDataCount: previousFYData.length
    // });

    const calculateParameterKPI = (parameter: string) => {
      let currentFYActual, currentFYProjected, previousFYTotal;

      // Special handling for HC - use sum of last available month's HC data for each FY
      if (parameter === 'hc') {
        // For current FY: get the last month's HC value and sum it
        if (currentFYData.length > 0) {
          // Filter out items with invalid dates first
          const validCurrentFYData = currentFYData.filter(item => {
            const itemDate = parseDate(item.month, item.year);
            return !isNaN(itemDate.getTime());
          });
          
          if (validCurrentFYData.length === 0) {
            currentFYActual = 0;
            currentFYProjected = 0;
          } else {
            const lastMonthCurrent = validCurrentFYData.reduce((latest, item) => {
              const itemDate = parseDate(item.month, item.year);
              const latestDate = parseDate(latest.month, latest.year);
              return itemDate > latestDate ? item : latest;
            });
            // Sum all HC values from that last month
            const lastMonthDate = parseDate(lastMonthCurrent.month, lastMonthCurrent.year);
            currentFYActual = validCurrentFYData
              .filter(item => {
                const itemDate = parseDate(item.month, item.year);
                return itemDate.getMonth() === lastMonthDate.getMonth() && 
                       itemDate.getFullYear() === lastMonthDate.getFullYear();
              })
              .reduce((sum, item) => sum + (item.hc || 0), 0);
            currentFYProjected = currentFYActual; // HC doesn't need projection
          }
       
          // console.log(`🔍 KPI HC Debug for Current FY ${currentFY}:`, {
          //   currentFYActual,
          //   currentFYDataCount: currentFYData.length,
          //   validCurrentFYDataCount: validCurrentFYData.length
          // });
        } else {
          currentFYActual = 0;
          currentFYProjected = 0;
        }

        // For previous FY: get the last month's HC value and sum it (March of next year for complete FY)
        if (previousFYData.length > 0) {
          // Filter out items with invalid dates first
          const validPreviousFYData = previousFYData.filter(item => {
            const itemDate = parseDate(item.month, item.year);
            return !isNaN(itemDate.getTime());
          });
          
          if (validPreviousFYData.length === 0) {
            previousFYTotal = 0;
          } else {
            const lastMonthPrevious = validPreviousFYData.reduce((latest, item) => {
              const itemDate = parseDate(item.month, item.year);
              const latestDate = parseDate(latest.month, latest.year);
              return itemDate > latestDate ? item : latest;
            });
            // Sum all HC values from that last month
            const lastMonthDate = parseDate(lastMonthPrevious.month, lastMonthPrevious.year);
            previousFYTotal = validPreviousFYData
              .filter(item => {
                const itemDate = parseDate(item.month, item.year);
                return itemDate.getMonth() === lastMonthDate.getMonth() && 
                       itemDate.getFullYear() === lastMonthDate.getFullYear();
              })
              .reduce((sum, item) => sum + (item.hc || 0), 0);
              
            // console.log(`🔍 KPI HC Debug for Previous FY ${previousFY}:`, {
            //   lastMonth: `${lastMonthPrevious.month} ${lastMonthPrevious.year}`,
            //   previousFYTotal,
            //   previousFYDataCount: previousFYData.length,
            //   validPreviousFYDataCount: validPreviousFYData.length
            // });
          }
        } else {
          previousFYTotal = 0;
        }
      } else {
        // For all other parameters: aggregate by month first, then sum
        // This prevents double-counting when there are multiple records per month
        const monthlyTotals: {[key: string]: number} = {};
        currentFYData.forEach(item => {
          const monthKey = `${item.month} ${item.year}`;
          if (!monthlyTotals[monthKey]) {
            monthlyTotals[monthKey] = 0;
          }
          
          // Get the value based on the parameter name - map display names to database fields
          let value = 0;
          const paramLower = parameter.toLowerCase();
          
          // Map display parameter names to database field names
          // Support both space-separated ('salary cost') and underscore-separated ('salary_cost') formats
          if (paramLower === 'revenue') value = item.revenue || 0;
          else if (paramLower === 'salary cost' || paramLower === 'salary_cost') value = item.salary_cost || 0;
          else if (paramLower === 'gpm') value = item.gpm || 0;
          else if (paramLower === 'gpm %' || paramLower === 'gpm_percentage') value = item.gpm_percentage || 0;
          else if (paramLower === 'team cost' || paramLower === 'team_cost') value = item.team_cost || 0;
          else if (paramLower === 'np' || paramLower === 'net margin' || paramLower === 'net_margin') value = item.np || item.net_margin || 0; // Use 'np' field from database
          else if (paramLower === 'np %' || paramLower === 'np_percentage') value = item.np_percentage || 0;
          else if (paramLower === 'leave encashment' || paramLower === 'leave_encashment') value = item.leave_encashment || 0;
          else if (paramLower === 'opr cost' || paramLower === 'opr_cost') value = item.opr_cost || 0;
          else if (paramLower === 'funding cost' || paramLower === 'funding_cost') value = item.funding_cost || 0;
          else if (paramLower === 'rebate') value = item.rebate || 0;
          else if (paramLower === 'passthrough') value = item.passthrough || 0;
          else if (paramLower === 'hc') value = item.hc || 0;
          else {
            // Try direct field access as fallback (convert spaces to underscores for database field names)
            const dbFieldName = paramLower.replace(/\s+/g, '_');
            value = item[parameter] || item[parameter.toLowerCase()] || item[dbFieldName] || item[paramLower] || 0;
          }
          
          monthlyTotals[monthKey] += value;
        });
        
        // Sum the monthly totals instead of all individual records
        currentFYActual = Object.values(monthlyTotals).reduce((sum: number, val: number) => sum + val, 0);
        
        // Debug logs disabled for performance
        
        // If we have data for current FY, project it for remaining months
        currentFYProjected = currentFYActual;
        if (Object.keys(monthlyTotals).length > 0) {
          // Find the last month with actual data (non-zero value)
          const monthKeys = Object.keys(monthlyTotals);
          let lastMonthWithData = null;
          let lastMonthValue = 0;
          
          // Sort months chronologically and find the last one with data
          const sortedMonths = monthKeys.sort((a, b) => {
            const [monthA, yearA] = a.split(' ');
            const [monthB, yearB] = b.split(' ');
            const dateA = parseDate(monthA, parseInt(yearA));
            const dateB = parseDate(monthB, parseInt(yearB));
            return dateA.getTime() - dateB.getTime();
          });
          
          // Find the last month with non-zero value
          for (let i = sortedMonths.length - 1; i >= 0; i--) {
            const monthKey = sortedMonths[i];
            const value = monthlyTotals[monthKey] || 0;
            if (value > 0) {
              lastMonthWithData = monthKey;
              lastMonthValue = value;
              break;
            }
          }
          
          if (lastMonthWithData && lastMonthValue > 0) {
            // Calculate actual remaining months based on data
            // Financial year months: Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec, Jan, Feb, Mar
            const financialYearMonths = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
            const fullMonthNames = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
            
            // Find the index of the last month with data
            const [lastMonth, lastYear] = lastMonthWithData.split(' ');
            let lastMonthIndex = financialYearMonths.indexOf(lastMonth);
            
            // If not found in abbreviated names, try full names
            if (lastMonthIndex === -1) {
              lastMonthIndex = fullMonthNames.indexOf(lastMonth);
            }
            
            // Calculate remaining months from the last month with data
            let actualMonthsRemaining = 12 - (lastMonthIndex + 1); // +1 because index is 0-based
            
            // Fallback: if month not found, use the old calculation
            if (lastMonthIndex === -1) {
              console.warn(`⚠️ Month "${lastMonth}" not found in financial year months, using fallback calculation`);
              actualMonthsRemaining = monthsRemaining;
            }
            
            // Multiply last month's total value by actual remaining months
            currentFYProjected = currentFYActual + (lastMonthValue * actualMonthsRemaining);
            
            // console.log(`🔍 ${parameter} PROJECTION DEBUG:`, {
            //   availableMonths: Object.keys(monthlyTotals),
            //   sortedMonths,
            //   lastMonthWithData,
            //   lastMonthValue,
            //   lastMonthIndex,
            //   actualMonthsRemaining,
            //   monthsRemaining, // Old calculation
            //   currentFYActual,
            //   currentFYProjected,
            //   projectionAmount: lastMonthValue * actualMonthsRemaining
            // });
          }
        }

        // Calculate previous FY total - also aggregate by month first
        const previousMonthlyTotals: {[key: string]: number} = {};
        previousFYData.forEach(item => {
          const monthKey = `${item.month} ${item.year}`;
          if (!previousMonthlyTotals[monthKey]) {
            previousMonthlyTotals[monthKey] = 0;
          }
          
          // Get the value based on the parameter name - map display names to database fields
          let value = 0;
          const paramLower = parameter.toLowerCase();
          
          // Map display parameter names to database field names
          // Support both space-separated ('salary cost') and underscore-separated ('salary_cost') formats
          if (paramLower === 'revenue') value = item.revenue || 0;
          else if (paramLower === 'salary cost' || paramLower === 'salary_cost') value = item.salary_cost || 0;
          else if (paramLower === 'gpm') value = item.gpm || 0;
          else if (paramLower === 'gpm %' || paramLower === 'gpm_percentage') value = item.gpm_percentage || 0;
          else if (paramLower === 'team cost' || paramLower === 'team_cost') value = item.team_cost || 0;
          else if (paramLower === 'np' || paramLower === 'net margin' || paramLower === 'net_margin') value = item.np || item.net_margin || 0; // Use 'np' field from database
          else if (paramLower === 'np %' || paramLower === 'np_percentage') value = item.np_percentage || 0;
          else if (paramLower === 'leave encashment' || paramLower === 'leave_encashment') value = item.leave_encashment || 0;
          else if (paramLower === 'opr cost' || paramLower === 'opr_cost') value = item.opr_cost || 0;
          else if (paramLower === 'funding cost' || paramLower === 'funding_cost') value = item.funding_cost || 0;
          else if (paramLower === 'rebate') value = item.rebate || 0;
          else if (paramLower === 'passthrough') value = item.passthrough || 0;
          else if (paramLower === 'hc') value = item.hc || 0;
          else {
            // Try direct field access as fallback (convert spaces to underscores for database field names)
            const dbFieldName = paramLower.replace(/\s+/g, '_');
            value = item[parameter] || item[parameter.toLowerCase()] || item[dbFieldName] || item[paramLower] || 0;
          }
          
          previousMonthlyTotals[monthKey] += value;
        });
        
        previousFYTotal = Object.values(previousMonthlyTotals).reduce((sum: number, val: number) => sum + val, 0);
        
        // Debug log removed for performance and to prevent toFixed errors
        // console.log(`🔍 ${parameter} KPI Dashboard Previous FY Debug:`, {
        //   parameter,
        //   previousFYTotal,
        //   monthlyBreakdown: Object.entries(previousMonthlyTotals).map(([month, total]) => ({
        //     month,
        //     total: typeof total === 'number' ? total.toFixed(2) : 'N/A'
        //   })),
        //   totalRecords: previousFYData.length
        // });
        
        // Previous FY calculation working correctly
      }

      // Calculate growth percentage (current - previous) / previous * 100
      const growthPercentage = previousFYTotal > 0 
        ? ((currentFYProjected - previousFYTotal) / previousFYTotal) * 100 
        : 0;

      const projectedAmount = currentFYProjected - currentFYActual;

      return {
        currentFY: currentFYProjected,
        previousFY: previousFYTotal,
        growthPercentage,
        isPositive: growthPercentage >= 0,
        monthsCompleted,
        monthsRemaining,
        period: (() => {
          if (compareType === 'quarter' && comparisonValues[0] && comparisonValues[1]) {
            return `${comparisonValues[0]} vs ${comparisonValues[1]}`;
          } else if (compareType === 'year' && comparisonValues[0] && comparisonValues[1]) {
            return `${comparisonValues[0]} vs ${comparisonValues[1]}`;
          } else {
            return `FY ${currentFY} vs FY ${previousFY}`;
          }
        })(),
        currentFYActual,
        projectedAmount
      };
    };

    return {
      Revenue: calculateParameterKPI('revenue'),
      'Salary Cost': calculateParameterKPI('salary_cost'),
      GPM: calculateParameterKPI('gpm'),
      NP: calculateParameterKPI('np'), // Use 'np' field from database, not 'net_margin'
      'Leave Encashment': calculateParameterKPI('leave_encashment'),
      'Team Cost': calculateParameterKPI('team_cost'),
      'Opr Cost': calculateParameterKPI('opr_cost'),
      'Funding Cost': calculateParameterKPI('funding_cost'),
      Rebate: calculateParameterKPI('rebate'),
      Passthrough: calculateParameterKPI('passthrough'),
      HC: calculateParameterKPI('hc')
      // Removed GPM % and NP % from KPI dashboard
    };
  };


  // State declarations with URL parameter defaults

  const [user, setUser] = useState<any>({});

  const [isBUHead, setIsBUHead] = useState(false);

  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string | null>(null);
  
  // State for single business unit selection in Parameter Data Chart
  const [selectedBusinessUnitsForChart, setSelectedBusinessUnitsForChart] = useState<string | null>(null);

  const [selectedClientName, setSelectedClientName] = useState<string | null>(null);

  const [selectedBUHead, setSelectedBUHead] = useState<string | null>(null);

  const [businessUnits, setBusinessUnits] = useState<string[]>([]);

  const [clientNames, setClientNames] = useState<string[]>([]);

  const [filteredClientNames, setFilteredClientNames] = useState<string[]>([]);

  const [buHeads, setBUHeads] = useState<string[]>([]);
  const [kpiData, setKpiData] = useState<Record<string, {
    currentFY: number;
    previousFY: number;
    growthPercentage: number;
    isPositive: boolean;
    monthsCompleted: number;
    monthsRemaining: number;
    period: string;
    currentFYActual: number;
    projectedAmount: number;
  }>>({});

  const [compareType, setCompareType] = useState<CompareType>(() => {
    // Force year comparison regardless of URL
    return "year";
  });
  const [comparisonValues, setComparisonValues] = useState<(string | null)[]>(() => {

    // Force year comparison values
    const currentFY = getCurrentFinancialYear();
    const previousFY = currentFY - 1;
    const yearValues = [`FY ${currentFY}`, `FY ${previousFY}`];
    return yearValues;
  });

  const [combinedPeriods, setCombinedPeriods] = useState<CombinedPeriod[]>([]);

  const [showCombinedModal, setShowCombinedModal] = useState<number | null>(null);

  const [selectedPeriodsForCombination, setSelectedPeriodsForCombination] = useState<string[]>([]);

  const [rawData, setRawData] = useState<ReportData[]>([]); // Store raw fetched data
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Increment to refetch (e.g. after normalize-percentages)
  const [routingData, setRoutingData] = useState<any[]>([]);

  // Helper function to check if a record has valid month data
  // Must be declared before useMemo that uses it
  const hasValidMonth = (item: any): boolean => {
    return item.month && item.month.trim() !== '';
  };

  // Helper function to safely parse numeric values from Excel (handles formulas, commas, parentheses, percentages)
  // Must be declared before useMemo that uses it
  const parseNumericValue = (value: any): number => {
    if (value === null || value === undefined || value === '') return 0;
    
    // If it's already a number, return it
    if (typeof value === 'number') return value;
    
    // Convert to string and clean it
    let stringValue = String(value).trim();
    
    // Handle empty strings and dashes
    if (stringValue === '' || stringValue === '-' || stringValue === '########') return 0;

    // Handle negative numbers in parentheses like (54,059) -> -54059
    if (stringValue.startsWith('(') && stringValue.endsWith(')')) {
      stringValue = '-' + stringValue.slice(1, -1);
    }

    // Remove percentage symbol if present
    if (stringValue.endsWith('%')) {
      stringValue = stringValue.replace('%', '');
    }

    // Remove commas (thousands separators)
    stringValue = stringValue.replace(/,/g, '');
    
    // Try to parse as number
    const parsed = parseFloat(stringValue);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Helper function to map Client MFS business unit names to MFS business unit names
  // Use centralized business unit utility functions (imported from utils)

  // Memoized filtered data - filters raw data in memory instead of refetching
  // This is declared early so it can be used throughout the component
  const data = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];

    let filtered = rawData.filter(hasValidMonth);

    // Apply all filters in a single pass for better performance
    filtered = filtered.filter((item: any) => {
      // Business unit filter (case-insensitive comparison)
      if (selectedBusinessUnit) {
        if (!compareBusinessUnits(item.business_unit, selectedBusinessUnit)) {
          return false;
        }
      }

      // Client name filter
      if (selectedClientName) {
        const normalizedBU = normalizeBusinessUnitName(selectedBusinessUnit);
        if (normalizedBU === 'MS' || selectedBusinessUnit === "Managed Services" || selectedBusinessUnit === "MS") {
          if (item.project_name !== selectedClientName) return false;
        } else {
          if (item.client_name !== selectedClientName) return false;
        }
      }

      // BU head filter
      if (selectedBUHead && item.bu_head !== selectedBUHead) {
        return false;
      }

      // User business unit filter (case-insensitive comparison for BU head login)
      if (isBUHead && user?.business_unit) {
        if (!compareBusinessUnits(item.business_unit, user.business_unit)) {
          return false;
        }
      }

      return true;
    });

    // Convert amounts to numbers and handle formatting
    return filtered.map((item: any) => {
      const numericFields = ['hc', 'revenue', 'gpm', 'team_cost', 'net_margin', 'np', 'np_percentage', 'salary_cost', 'gpm_percentage', 'leave_encashment', 'opr_cost', 'funding_cost', 'rebate', 'passthrough', 'year'];
      const processedItem = { ...item };
      
      for (const field of numericFields) {
        processedItem[field] = parseNumericValue(processedItem[field]);
      }

      // Handle 2-digit year conversion
      if (processedItem.year && processedItem.year < 100) {
        if (processedItem.year >= 0 && processedItem.year <= 99) {
          processedItem.year = 2000 + processedItem.year;
        }
      }

      return processedItem;
    }).filter(hasValidMonth);
  }, [rawData, selectedBusinessUnit, selectedClientName, selectedBUHead, isBUHead, user?.business_unit]);

  const [availableOptions, setAvailableOptions] = useState<string[]>([]);

  const [selectedParameters, setSelectedParameters] = useState<string[]>(() => {
    // Force default parameters (unchanged for other components)
    const defaultParams = ['Revenue', 'GPM', 'NP', 'Team Cost'];
    return defaultParams;
  });
  
  // Separate state for Parameter Data Chart parameter selection
  const [selectedParametersForChart, setSelectedParametersForChart] = useState<string[]>(() => {
    return ['Revenue'];
  });
  
  // Date filter state for Parameter Data Chart (independent from main comparison)
  const [chartFilterBy, setChartFilterBy] = useState<'year' | 'quarter' | 'month' | null>(null);
  const [chartFilterValue, setChartFilterValue] = useState<string[]>([]);
  
  // Sort order for chart data
  const [chartSortOrder, setChartSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [chartType, setChartType] = useState<'bar' | 'line' | 'combo'>(() => {
    // Default to bar chart for Parameter Data Chart
    return 'bar';
  });
  const [availableParameters, setAvailableParameters] = useState<string[]>([]);

  // State for showing all KPIs
  const [showAllKPIs, setShowAllKPIs] = useState<boolean>(false);
  const [showAllGrowthParams, setShowAllGrowthParams] = useState<boolean>(false);
  const [comparisonData, setComparisonData] = useState<{[key: string]: any}[]>([]);

  const [growthAnalysis, setGrowthAnalysis] = useState<GrowthAnalysis[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<string>('chart');

  const [showGrowthAnalysis, setShowGrowthAnalysis] = useState<boolean>(false);
  const [showSummaryReport, setShowSummaryReport] = useState<boolean>(true);
  const [showFullReport, setShowFullReport] = useState<boolean>(false);
  const [selectedSummaryClient, setSelectedSummaryClient] = useState<string | null>(null);
  const [useCurrentYearAsBaseline, setUseCurrentYearAsBaseline] = useState<boolean>(false);

  const [isActionDropdownOpen, setIsActionDropdownOpen] = useState(false);

  // Removed showAllParameters state - always show all parameters

  // Crore/Lakh toggle state
  const [isCroreMode, setIsCroreMode] = useState(true);

  // Utility function to format values based on toggle
  const formatValueWithToggle = (value: number, isLargeValue: boolean = true) => {
    // Ensure value is a valid number
    const numValue = typeof value === 'number' && !isNaN(value) ? value : 0;
    if (!isLargeValue) return numValue.toFixed(0);
    if (isCroreMode) {
      return `${(numValue / 10000000).toFixed(1)}Cr`;
    } else {
      return `${(numValue / 100000).toFixed(1)}L`;
    }
  };

  // Chart tab visibility state
  const [activeChartTab, setActiveChartTab] = useState<string>('none');

  // Enhanced date parser to handle various date formats
  // Now prioritizes month names (matching team_summary_report format) but still supports DATE format for backward compatibility
  const parseDate = (dateStr: string, year?: number): Date => {

    if (!dateStr || dateStr.trim() === '') {
      console.warn("⚠️ parseDate: No dateStr provided, returning invalid date");
      return new Date(NaN);
    }

    // Handle month name format first (e.g., "January", "April") - this is now the primary format
    
    // Fix common misspellings first
    const fixedDateStr = dateStr
      .replace(/^apri$/i, 'April')  // Fix "Apri" -> "April"
      .replace(/^janu$/i, 'January') // Fix "Janu" -> "January"
      .replace(/^febr$/i, 'February') // Fix "Febr" -> "February"
      .replace(/^marc$/i, 'March')   // Fix "Marc" -> "March"
      .replace(/^may$/i, 'May')      // Ensure "May" is correct
      .replace(/^june$/i, 'June')    // Ensure "June" is correct
      .replace(/^july$/i, 'July')   // Ensure "July" is correct
      .replace(/^augu$/i, 'August')  // Fix "Augu" -> "August"
      .replace(/^sept$/i, 'September') // Fix "Sept" -> "September"
      .replace(/^octo$/i, 'October') // Fix "Octo" -> "October"
      .replace(/^novem$/i, 'November') // Fix "Novem" -> "November"
      .replace(/^decem$/i, 'December'); // Fix "Decem" -> "December"
    
    // Log when we fix a misspelling
    if (fixedDateStr !== dateStr) {
      // Removed verbose console.log for performance
    }

    const monthNames = [

      'January', 'February', 'March', 'April', 'May', 'June',

      'July', 'August', 'September', 'October', 'November', 'December'

    ];

    const abbreviatedMonthNames = [

      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',

      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'

    ];

    
    
    // First try full month names
    let monthIndex = monthNames.findIndex(month => {
      const lowerDateStr = fixedDateStr.toLowerCase();
      const lowerMonth = month.toLowerCase();
      
      // Exact match or word boundary match to avoid false positives
      return lowerDateStr === lowerMonth || 
             lowerDateStr.includes(` ${lowerMonth} `) ||
             lowerDateStr.startsWith(`${lowerMonth} `) ||
             lowerDateStr.endsWith(` ${lowerMonth}`) ||
             lowerDateStr.includes(`${lowerMonth}-`) ||
             lowerDateStr.includes(`-${lowerMonth}`) ||
             lowerDateStr.includes(`${lowerMonth}_`) ||
             lowerDateStr.includes(`_${lowerMonth}`);
    });

    // If not found, try abbreviated month names
    if (monthIndex === -1) {
      monthIndex = abbreviatedMonthNames.findIndex(month => {
        const lowerDateStr = fixedDateStr.toLowerCase();
        const lowerMonth = month.toLowerCase();
        
        // Exact match for abbreviated names
        return lowerDateStr === lowerMonth || 
               lowerDateStr.startsWith(`${lowerMonth} `) ||
               lowerDateStr.endsWith(` ${lowerMonth}`) ||
               lowerDateStr.includes(`${lowerMonth}-`) ||
               lowerDateStr.includes(`-${lowerMonth}`) ||
               lowerDateStr.includes(`${lowerMonth}_`) ||
               lowerDateStr.includes(`_${lowerMonth}`);
      });
    }

    
    
    if (monthIndex !== -1) {

      // If we find a month name, create a date for the 1st of that month

      // Use the provided year - DO NOT use current year as fallback to prevent automatic data generation

      if (!year) {

        console.warn("⚠️ parseDate: No year provided for month:", dateStr, "Returning invalid date");

        return new Date(NaN); // Return invalid date instead of current year

      }

      // Debug: Log parsing issues for any month with invalid year
      if (!year || year < 2020 || year > 2030) {
        console.warn("⚠️ parseDate: Invalid year for month:", { dateStr, year, monthIndex });
        return new Date(NaN); // Return invalid date for invalid years
      }

      return new Date(year, monthIndex, 1);

    }

    
    
    // Handle ISO format (YYYY-MM-DD) or other standard formats

    const date = new Date(dateStr);

    if (!isNaN(date.getTime())) {

      return date;

    }

    
    
    // Fallback - return invalid date instead of current date to prevent automatic data generation
    console.warn("⚠️ parseDate: Unable to parse date:", dateStr, "Available month names:", monthNames.join(", "), "Available abbreviated:", abbreviatedMonthNames.join(", "));
    return new Date(NaN);

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

      financialYear = year - 1; // Q4 belongs to previous financial year (Jan-Mar of current calendar year belongs to previous FY)

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



  // DUPLICATE REMOVED - parseNumericValue moved above (line 1233) to be available for useMemo hook

  // Handle Excel import

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {

    const file = e.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = async (evt) => {

      const bstr = evt.target?.result;

      if (!bstr) return;

      
      
      // Read Excel with formula evaluation and proper date handling

      const workbook = XLSX.read(bstr, { 

        type: 'binary',

        cellFormula: true,

        cellHTML: false,

        cellNF: false,

        cellStyles: false,

        cellText: false,

        cellDates: true,

        dateNF: 'mm/dd/yyyy'

      });

      
      
      const sheetName = workbook.SheetNames[0];

      const worksheet = workbook.Sheets[sheetName];

      
      
      // Convert to JSON with raw values (formulas will be evaluated)
      // Use raw: false to get formatted dates as strings
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 

        raw: false,  // Changed to false to get formatted date strings instead of serial numbers

        defval: '',

        blankrows: false

      });
      
      // Log first few rows for debugging
      if (jsonData.length > 0) {
        // Removed verbose console.log for performance
      }

      
      
      // Debug: Log the first few rows and column names

      // Helper function to normalize business unit name (title case)
      const normalizeBusinessUnitName = (name: string | null): string | null => {
        if (!name) return null;
        const trimmed = String(name).trim();
        if (trimmed === '') return null;
        // Convert to title case: first letter uppercase, rest lowercase
        return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
      };
      
      const mappedData = jsonData.map((row: any) => {

        // Helper function to convert empty strings to null

        const stringOrNull = (value: any): string | null => {

          const str = String(value || '').trim();

          return str === '' ? null : str;

        };

        // Normalize month format - convert date strings to month names
        let monthValue = row['Month'] || row.month || '';
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'];
        
        if (monthValue) {
          // Convert to string first for consistent processing
          const monthStr = String(monthValue).trim();
          
          // Handle numeric month values FIRST (1-12 or 01-12) - this is the most common case
          if (/^\d+$/.test(monthStr)) {
            const monthNum = parseInt(monthStr, 10);
            if (monthNum >= 1 && monthNum <= 12) {
              monthValue = monthNames[monthNum - 1];
            } else {
              // Invalid numeric month, try other formats
              monthValue = monthStr;
            }
          }
          // Handle Excel date serial numbers (if month is stored as Excel date)
          else if (typeof monthValue === 'number' && monthValue > 1 && monthValue < 50000) {
            // Excel date serial number - convert to Date then to month name
            const excelEpoch = new Date(1900, 0, 1);
            const date = new Date(excelEpoch.getTime() + (monthValue - 2) * 24 * 60 * 60 * 1000);
            monthValue = monthNames[date.getMonth()];
          }
          // If it's a date string like "2024-01-01" or "2024/01/01", extract month name
          else if (monthStr.match(/^\d{4}-\d{2}-\d{2}/) || monthStr.match(/^\d{4}\/\d{2}\/\d{2}/)) {
            const date = new Date(monthStr);
            if (!isNaN(date.getTime())) {
              monthValue = monthNames[date.getMonth()];
            }
          }
          // If it's a Date object
          else if (monthValue instanceof Date) {
            monthValue = monthNames[monthValue.getMonth()];
          }
          // Keep the original value if it's already a valid month name or abbreviation
          else if (typeof monthStr === 'string') {
            const validMonths = ['January', 'February', 'March', 'April', 'May', 'June',
              'July', 'August', 'September', 'October', 'November', 'December',
              'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthAbbrMap: { [key: string]: string } = {
              'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April',
              'May': 'May', 'Jun': 'June', 'Jul': 'July', 'Aug': 'August',
              'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December'
            };
            
            const trimmedMonth = monthStr.trim();
            if (validMonths.includes(trimmedMonth)) {
              // If it's an abbreviation, convert to full name
              monthValue = monthAbbrMap[trimmedMonth] || trimmedMonth;
            } else {
              // Try to parse it as a date
              const date = new Date(monthStr);
              if (!isNaN(date.getTime())) {
                monthValue = monthNames[date.getMonth()];
              } else {
                // Keep original value - backend will handle conversion
                monthValue = monthStr;
              }
            }
          }
        }

        // Handle Business Unit and Client Name - try separate columns first, then combined column as fallback
        // normalizeBusinessUnitName already handles all mappings, so no need for separate mapping call
        let businessUnit = normalizeBusinessUnitName(stringOrNull(row['Business Unit'] || row['Business_Unit'] || row.business_unit));
        let clientName = stringOrNull(row['Client Name'] || row['Client_Name'] || row.client_name);
        
        // If Business_Client_Na exists (combined column), use it as fallback to split
        if ((!businessUnit || !clientName) && row['Business_Client_Na']) {
          const businessClientNa = String(row['Business_Client_Na'] || '').trim();
          if (businessClientNa) {
            // Try to split by "|" first
            if (businessClientNa.includes('|')) {
              const parts = businessClientNa.split('|').map((p: string) => p.trim()).filter((p: string) => p !== '');
              if (parts.length >= 1 && !businessUnit) {
                businessUnit = normalizeBusinessUnitName(stringOrNull(parts[0]));
              }
              if (parts.length >= 2 && !clientName) {
                // The part after | might contain client name, possibly with "-"
                const rightPart = parts[1].trim();
                if (rightPart.includes('-')) {
                  const subParts = rightPart.split('-').map((p: string) => p.trim()).filter((p: string) => p !== '');
                  if (subParts.length >= 1) clientName = stringOrNull(subParts[0]);
                } else {
                  clientName = stringOrNull(rightPart);
                }
              }
            } else if (businessClientNa.includes('-')) {
              // Split by "-" (handle cases like "BPO HTDenture - BPO /AO")
              const parts = businessClientNa.split('-').map((p: string) => p.trim()).filter((p: string) => p !== '');
              if (parts.length >= 1 && !businessUnit) {
                businessUnit = normalizeBusinessUnitName(stringOrNull(parts[0]));
              }
              if (parts.length >= 2 && !clientName) clientName = stringOrNull(parts[1]);
            } else if (!businessUnit) {
              // No separator found, use as business unit if not set
              businessUnit = normalizeBusinessUnitName(stringOrNull(businessClientNa));
            }
          }
        }

        // Handle year - can be 2-digit (23) or 4-digit (2023)
        let yearValue = parseNumericValue(row['Year'] || row.year) || null;
        if (yearValue && yearValue < 100) {
          // Convert 2-digit year to 4-digit (assume 2000s for years < 50, 1900s for years >= 50)
          yearValue = yearValue < 50 ? 2000 + yearValue : 1900 + yearValue;
        }

        return {

          business_unit: businessUnit,

          client_name: clientName,

          project_name: stringOrNull(row['Project Name'] || row['Project_Na'] || row['Project_Name'] || row.project_name),

          bu_head: stringOrNull(row['BU Head'] || row['BU_Head'] || row.bu_head),

          month: monthValue ? String(monthValue).trim() : null,

          year: yearValue,

          hc: parseNumericValue(row['HC'] || row.hc),

          revenue: parseNumericValue(row['Revenue'] || row.revenue),

          salary_cost: parseNumericValue(row['Salary Cost'] || row['Salary Cos'] || row['Salary_Cost'] || row.salary_cost),

          gpm: parseNumericValue(row['GPM'] || row.gpm),

          // Handle GPM percentage column - try multiple variations of column names
          gpm_percentage: parseNumericValue(
            row['GPM -%'] || 
            row['GPM-%'] || 
            row['GPM %'] || 
            row['GPM-%'] ||
            row['GPM%'] ||
            row['GPM_Percentage'] ||
            row['GPM_Percent'] ||
            row.gpm_percentage
          ),

          np: parseNumericValue(row['NP'] || row.np),

          // Handle NP percentage column - try multiple variations of column names
          np_percentage: parseNumericValue(
            row['NP %'] || 
            row['NP%'] || 
            row['NP_Percentage'] || 
            row['NP_Percent'] ||
            row['NP-%'] ||
            row['NP -%'] ||
            row.np_percentage
          ),

          leave_encashment: parseNumericValue(row['Leave Encsh'] || row['Leave Enc'] || row['Leave_Encsh'] || row['Leave Encashment'] || row.leave_encashment),

          team_cost: parseNumericValue(row['Team Cost'] || row['Team_Cost'] || row.team_cost),

          opr_cost: parseNumericValue(row['Opr Cost'] || row['Opr_Cost'] || row.opr_cost),

          funding_cost: parseNumericValue(row['Funding Cost'] || row['Funding C'] || row['Funding_Cost'] || row.funding_cost),

          rebate: parseNumericValue(row['Rebate'] || row.rebate),

          passthrough: parseNumericValue(row['Passthroug'] || row['Passthrough'] || row.passthrough),

        };

      }).filter((record: any) => {
        // Filter out completely empty rows (rows where month and year are both missing/null)
        return record.month !== null && record.month !== '' && record.year !== null && record.year !== 0;
      }).map((record: any) => {
        // Import-time auto-calculation by business unit. Does not touch existing data in DB.
        const rev = Number(record.revenue) || 0;
        const salary_cost = Number(record.salary_cost) || 0;
        const rebate = Number(record.rebate) || 0;
        const passthrough = Number(record.passthrough) || 0;
        const leave_encashment = Number(record.leave_encashment) || 0;
        const team_cost = Number(record.team_cost) || 0;
        const opr_cost = Number(record.opr_cost) || 0;
        const funding_cost = Number(record.funding_cost) || 0;

        let gpm: number;
        let np: number | null = null;

        if (compareBusinessUnits(record.business_unit, 'MS') || compareBusinessUnits(record.business_unit, 'Managed Services')) {
          // Managed Services / MS: GPM = Revenue - Salary_cost
          gpm = rev - salary_cost;
        } else if (compareBusinessUnits(record.business_unit, 'USA')) {
          // USA: GPM = Revenue - Salary Cost - Rebate - Passthrough
          gpm = rev - salary_cost - rebate - passthrough;
        } else if (compareBusinessUnits(record.business_unit, 'Japan') || compareBusinessUnits(record.business_unit, 'Canada') || compareBusinessUnits(record.business_unit, 'Singapore')) {
          // Japan, Canada, Singapore: GPM = Revenue - Salary_Cost
          gpm = rev - salary_cost;
        } else {
          // Other business units: GPM = Revenue - salary_cost - leave_encashment, NP = GPM - Team Cost - opr_cost - funding_cost
          gpm = rev - salary_cost - leave_encashment;
          np = gpm - team_cost - opr_cost - funding_cost;
        }

        const gpmPct = rev !== 0 ? (gpm / rev) * 100 : (record.gpm_percentage ?? null);
        const npPct = np !== null && rev !== 0 ? (np / rev) * 100 : (record.np_percentage ?? null);

        return {
          ...record,
          gpm,
          gpm_percentage: gpmPct,
          ...(np !== null ? { np, np_percentage: npPct } : {}),
        };
      });



      // Validate data before processing
      if (!mappedData || mappedData.length === 0) {
        message.error('No valid data found in the Excel file. Please check the file format.');
        return;
      }

      // Log first record and column names for debugging
      if (mappedData.length > 0) {
        console.log('=== IMPORT DEBUG INFO ===');
        console.log('Total records to import:', mappedData.length);
        console.log('Excel column names found:', Object.keys(jsonData[0] || {}));
        console.log('First record being sent:', JSON.stringify(mappedData[0], null, 2));
        console.log('Sample month values:', mappedData.slice(0, 3).map((r: any) => ({ 
          month: r.month, 
          monthType: typeof r.month,
          year: r.year,
          yearType: typeof r.year,
          business_unit: r.business_unit,
          client_name: r.client_name
        })));
        console.log('========================');
      }

      try {


        
        
        // Process in batches of 50 records to avoid server overload and timeout issues

        const batchSize = 50;

        const totalBatches = Math.ceil(mappedData.length / batchSize);

        let successCount = 0;

        let errorCount = 0;

        
        
        message.loading(`Importing ${mappedData.length} records... (0/${totalBatches} batches)`, 0);

        
        
        for (let i = 0; i < mappedData.length; i += batchSize) {

          const batch = mappedData.slice(i, i + batchSize);

          const batchNumber = Math.floor(i / batchSize) + 1;

          
          
          try {

            // Use longer timeout for bulk operations (60 seconds)
            await apiClient.post(`${API_ENDPOINT}/bulk`, { data: batch }, {
              timeout: 60000
            });

            successCount += batch.length;

            
            
            // Update progress message

            message.loading(`Importing ${mappedData.length} records... (${batchNumber}/${totalBatches} batches completed)`, 0);

            
            
            // Small delay to prevent overwhelming the server

            await new Promise(resolve => setTimeout(resolve, 100));
            
            
            
          } catch (batchErr: any) {

            console.error(`Batch ${batchNumber} failed:`, batchErr);
            console.error('=== ERROR DETAILS ===');
            console.error('Status:', batchErr.response?.status);
            console.error('Error message:', batchErr.response?.data?.error || batchErr.response?.data?.message || batchErr.message);
            console.error('Full error response:', batchErr.response?.data);
            console.error('Specific errors:', batchErr.response?.data?.errors);
            if (batchErr.response?.data?.errors && Array.isArray(batchErr.response?.data?.errors)) {
              console.error('Error details for each record:');
              batchErr.response.data.errors.forEach((err: string, index: number) => {
                console.error(`  Record ${index + 1}:`, err);
              });
            }
            console.error('Sample record from batch:', JSON.stringify(batch[0], null, 2));
            console.error('====================');

            errorCount += batch.length;

            
            
            // Continue with next batch instead of stopping completely
            const errorMessage = batchErr.response?.data?.error || batchErr.message || 'Unknown error';
            message.warning(`Batch ${batchNumber} failed: ${errorMessage.substring(0, 50)}...`, 5);

          }

        }

        
        
        // Clear loading message

        message.destroy();

        
        
        if (errorCount === 0) {

          message.success(`Successfully imported all ${successCount} records!`, 5);

        } else if (successCount > 0) {

          message.warning(`Imported ${successCount} records successfully, ${errorCount} records failed. Check console for details.`, 8);

        } else {

          message.error(`All batches failed to import. ${errorCount} records failed. Check console for error details.`, 8);

        }

        
        
        // Refresh data only if at least some records were successfully imported
        if (successCount > 0) {
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
        
        
        
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
      'Business Unit': row.business_unit || '',

      'Client Name': row.client_name || '',

      'Project Name': row.project_name || '',

      'BU Head': row.bu_head || '',

      'Year': row.year,

      'Month': row.month,

      'HC': row.hc || 0,

      'Revenue': row.revenue || 0,

      'Salary Cost': row.salary_cost || 0,

      'GPM': row.gpm || 0,

      'GPM -%': row.gpm_percentage || 0,

      'NP': row.np || 0,

      'NP %': row.np_percentage || 0,

      'Leave Encsh': row.leave_encashment || 0,

      'Team Cost': row.team_cost || 0,

      'Opr Cost': row.opr_cost || 0,

      'Funding Cost': row.funding_cost || 0,

      'Rebate': row.rebate || 0,

      'Passthrough': row.passthrough || 0,

    }));



    const worksheet = XLSX.utils.json_to_sheet(exportData);

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Client_MFS_Report");

    XLSX.writeFile(workbook, "Client_MFS_Report.xlsx");

  };



  // Handle Excel template download for team_report

  const handleDownloadTemplate = () => {

    // Create a template matching the exact Excel format shown
    // Separate columns for Business Unit, Client Name, Project Name

    const templateData = [

      {

        'Business Unit': '',  // e.g., "BPO | HTD"

        'Client Name': '',  // e.g., "ccenture - BPO PAYROLL" or "Accenture - BPO/AO"

        'Project Name': '',  // Can be empty

        'BU Head': '',  // e.g., "KD"

        'Year': '',  // Can be 2023 or 23

        'Month': '',  // e.g., "April"

        'HC': '',  // e.g., "103"

        'Revenue': '',  // e.g., "42,24,544" (comma-separated, can include commas)

        'Salary Cost': '',  // e.g., "40,10,044"

        'GPM': '',  // e.g., "1,37,594"

        'GPM -%': '',  // e.g., "3%" (can include % symbol)

        'NP': '',  // e.g., "(54,059)" for negative in parentheses or "99,022" for positive

        'NP %': '',  // e.g., "-1%" or "1%" (can include % symbol and negative sign)

        'Leave Encsh': '',  // e.g., "76,906"

        'Team Cost': '',  // Can be empty or "-" (dash) for null

        'Opr Cost': '',  // e.g., "91,653"

        'Funding Cost': '',  // e.g., "1,00,000"

        'Rebate': '',  // Can be empty

        'Passthrough': '',  // Can be empty

      }

    ];



    const worksheet = XLSX.utils.json_to_sheet(templateData);

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Client_MFS_Template");

    XLSX.writeFile(workbook, "Client_MFS_Template.xlsx");

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

      label: 'Download Client MFS Template',

      onClick: handleDownloadTemplate

    },

    {

      key: 'import',

      label: 'Import Client MFS',

      onClick: () => {

        const input = document.createElement('input');

        input.type = 'file';

        input.accept = '.xlsx, .xls';

        input.onchange = (e) => handleImportExcel(e as any);

        input.click();

      }

    },

    {

      key: 'normalize',

      label: 'Recalculate GPM% & NP% for all existing data',

      onClick: async () => {

        try {

          message.loading('Updating GPM% and NP% for all existing records...', 0);

          const res = await apiClient.post(`${API_ENDPOINT}/normalize-percentages`);

          message.destroy();

          const updated = (res.data && res.data.updatedRows) ?? 0;

          message.success(`Updated GPM% and NP% for ${updated} existing records.`, 5);

          setRefreshTrigger((t) => t + 1);

        } catch (err: any) {

          message.destroy();

          message.error(err?.response?.data?.error || err?.message || 'Failed to update existing data.', 5);

        }

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

    
    // If comparing by quarters and this is the first selection, auto-suggest corresponding quarter
    if (compareType === 'quarter' && index === 0 && value) {
      const correspondingQuarter = getCorrespondingPreviousQuarter(value);
      // console.log("🔍 Auto-selecting quarter:", {
      //   selectedQuarter: value,
      //   correspondingQuarter,
      //   availableOptions,
      //   isAvailable: correspondingQuarter && availableOptions.includes(correspondingQuarter)
      // });
      
      if (correspondingQuarter && availableOptions.includes(correspondingQuarter)) {
        newValues[1] = correspondingQuarter;
        message.success(`Auto-selected corresponding quarter: ${correspondingQuarter}`);
      } else {
        // console.log("🔍 Could not auto-select quarter:", {
        //   correspondingQuarter,
        //   availableOptions: availableOptions.slice(0, 10) // Show first 10 for debugging
        // });
      }
    }
    
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
          // Normalize URL business unit using centralized utility
          const normalizedBU = normalizeBusinessUnitName(buFromURL);
          setSelectedBusinessUnit(normalizedBU || buFromURL);
        } else if (userIsBUHead && parsedUser.business_unit) {
          // Normalize user's business unit for BU head login (case-insensitive)
          const normalizedBU = normalizeBusinessUnitName(parsedUser.business_unit);
          setSelectedBusinessUnit(normalizedBU || parsedUser.business_unit);
        }

      }

    } catch (error) {

      console.error("Failed to parse user data:", error);

    }

  }, []);

  // Update selectedBusinessUnitsForChart when user/isBUHead changes (for BU heads)
  useEffect(() => {
    if (isBUHead && user?.business_unit && businessUnits.length > 0 && !selectedBusinessUnitsForChart) {
      const normalizedBU = normalizeBusinessUnitName(user.business_unit);
      const matchingBU = businessUnits.find(bu => compareBusinessUnits(bu, normalizedBU || user.business_unit));
      if (matchingBU) {
        setSelectedBusinessUnitsForChart(matchingBU);
      } else {
        setSelectedBusinessUnitsForChart(normalizedBU || user.business_unit);
      }
    }
  }, [isBUHead, user?.business_unit, businessUnits]);

  

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



  // Extract available parameters - all financial columns from team_report
  // Set available parameters independently of data since we know the schema
  useEffect(() => {
    // Define available parameters - all financial columns from team_report
    const baseParameters = [
      'Revenue',
      'Salary Cost',
      'GPM',
      'GPM %',
      'NP',
      'NP %',
      'Leave Encashment',
      'Team Cost',
      'Opr Cost',
      'Funding Cost',
      'Rebate',
      'Passthrough',
      'HC',
      // Efficiency metrics from Efficiency Dashboard
      'Cost Efficiency',
      'Revenue per HC',
      'NP per Team Cost',
      'Team Cost % of Revenue',
      'GPM per HC'
    ];

    setAvailableParameters(baseParameters);
  }, []); // Run once on mount, not dependent on data



  useEffect(() => {

    if (data.length === 0) return;



    const periodMap = new Map<string, Date>();



    // Collect unique periods with their dates

    data.forEach(item => {

      const date = parseDate(item.month, item.year);

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


      
      
      const res = await apiClient.get(API_ENDPOINT);


      
      
      if (res.data && Array.isArray(res.data)) {


        
        
        // Extract business units, normalize them, and filter out null/undefined values
        const unitsSet = new Set<string>();
        
        res.data.forEach((item: any) => {
          if (item.business_unit) {
            const normalized = normalizeBusinessUnitName(item.business_unit);
            if (normalized) {
              unitsSet.add(normalized);
            }
          }
        });
        
        // Get unique business units (normalized names) and sort them
        const uniqueBusinessUnits = Array.from(unitsSet).sort() as string[];

        setBusinessUnits(uniqueBusinessUnits);
        
        // Initialize selectedBusinessUnitsForChart
        // For BU heads, only show their business unit; otherwise select first available
        if (!selectedBusinessUnitsForChart && uniqueBusinessUnits.length > 0) {
          if (isBUHead && user?.business_unit) {
            const normalizedBU = normalizeBusinessUnitName(user.business_unit);
            const matchingBU = uniqueBusinessUnits.find(bu => compareBusinessUnits(bu, normalizedBU || user.business_unit));
            if (matchingBU) {
              setSelectedBusinessUnitsForChart(matchingBU);
            } else {
              // Fallback: use normalized version if exact match not found
              setSelectedBusinessUnitsForChart(normalizedBU || user.business_unit);
            }
          } else {
            // Select first business unit by default
            setSelectedBusinessUnitsForChart(uniqueBusinessUnits[0]);
          }
        }

        
        
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



  // Sync selectedSummaryClient with selectedClientName when client/project is selected
  useEffect(() => {
    if (selectedClientName) {
      setSelectedSummaryClient(selectedClientName);
    } else {
      // When no client is selected, reset summary client filter
      setSelectedSummaryClient(null);
    }
  }, [selectedClientName]);

  // Fetch client names based on selected business unit

  const fetchClientNames = async (businessUnit: string | null) => {

    if (!businessUnit) {

      setClientNames([]);

      return;

    }

    
    
    try {

      // console.log(`🔍 Fetching client names for business unit: ${businessUnit}`);

      const res = await apiClient.get(API_ENDPOINT);

      
      
      // console.log(`🔍 Raw client data for ${businessUnit}:`, res.data);
      // console.log(`🔍 Total records for ${businessUnit}:`, res.data?.length || 0);

      
      
      if (res.data && Array.isArray(res.data)) {

        // Filter data by business unit first

        const filteredData = res.data.filter((item: any) => 

          item.business_unit === businessUnit

        );

        
        
          // console.log(`🔍 Filtered data for ${businessUnit}:`, filteredData);

        
        
        let uniqueNames: string[];

        const normalizedBU = normalizeBusinessUnitName(businessUnit);
        if (normalizedBU === 'MS' || businessUnit === "Managed Services" || businessUnit === "MS") {

          // For Managed Services, show project names

          const projectNames = filteredData

            .map((item: any) => item.project_name)

            .filter((name: any) => name && name.trim() !== '');

          // console.log(`🔍 Project names for ${businessUnit}:`, projectNames);

          uniqueNames = Array.from(new Set(projectNames)) as string[];

        } else {

          // For other business units, show client names

          const clientNames = filteredData

            .map((item: any) => item.client_name)

            .filter((name: any) => name && name.trim() !== '');

          // console.log(`🔍 Client names for ${businessUnit}:`, clientNames);

          uniqueNames = Array.from(new Set(clientNames)) as string[];

        }

        
        
        // console.log(`🔍 Unique names for ${businessUnit}:`, uniqueNames);

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

      // console.log(`🔍 Fetching BU heads for business unit: ${businessUnit}`);

      const res = await apiClient.get(API_ENDPOINT);

      
      
      // console.log(`🔍 Raw BU head data for ${businessUnit}:`, res.data);
      // console.log(`🔍 Total records for ${businessUnit}:`, res.data?.length || 0);

      
      
      if (res.data && Array.isArray(res.data)) {

        // Filter data by business unit first

        const filteredData = res.data.filter((item: any) => 

          item.business_unit === businessUnit

        );

        
        
        // Removed verbose debug logs for performance

        
        
        const buHeadsFromData = filteredData

          .map((item: any) => item.bu_head)

          .filter((head: any) => head && head.trim() !== '');

        // Removed verbose debug logs for performance

        const uniqueBUHeads = Array.from(new Set(buHeadsFromData)) as string[];

        // Removed verbose debug logs for performance

        
        
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

  // Log initial state for debugging
  useEffect(() => {
    // Component mounted with forced defaults
  }, []); // Run only on mount

  useEffect(() => {

    const fetchData = async () => {

      setIsLoading(true);

      try {


        
        
        // Always fetch all data and filter on frontend for better control

        const res = await apiClient.get(API_ENDPOINT);

        
        
        
        // Debug: Show ALL month data to understand the issue (disabled for performance)
        // if (res.data && Array.isArray(res.data)) {
        //   console.warn(`🔍 TOTAL RECORDS: ${res.data.length}`);
        //   // Only log errors, not verbose data
        // }

        
        
        // Store raw data - filtering and processing will be done in useMemo for better performance
        const rawDataFromAPI = res.data || [];
        
        // Convert amounts to numbers and handle formatting (minimal processing)
        const convertedData = rawDataFromAPI.map((item: any) => {

          // Convert numeric fields to numbers - include all fields from team_report

          const numericFields = ['hc', 'revenue', 'gpm', 'team_cost', 'net_margin', 'np', 'np_percentage', 'salary_cost', 'gpm_percentage', 'leave_encashment', 'opr_cost', 'funding_cost', 'rebate', 'passthrough', 'year'];

          
          
          const processedItem = { ...item };

          
          
          for (const field of numericFields) {
            // Use parseNumericValue to handle negative values in parentheses (e.g., (54,059) -> -54059)
            processedItem[field] = parseNumericValue(processedItem[field]);
          }

          // Handle 2-digit year conversion (e.g., 23 -> 2023, 24 -> 2024)
          if (processedItem.year && processedItem.year < 100) {
            // console.log(`🔍 Converting 2-digit year: ${processedItem.year} -> ${2000 + processedItem.year}`);
            if (processedItem.year >= 0 && processedItem.year <= 99) {
              // Assume years 0-99 map to 2000-2099
              processedItem.year = 2000 + processedItem.year;
            }
          }

          // Debug: Log processed item after year conversion (disabled for performance)
          // console.log(`🔍 Processed item after conversion:`, {
          //   month: processedItem.month,
          //   year: processedItem.year,
          //   business_unit: processedItem.business_unit
          // });

          

          // Month processing is handled by the backend during import - no need to process here

          // Commented out - backend already handles month processing
          if (false && processedItem.month && typeof processedItem.month === 'string') {

            const monthNames = [

              'January', 'February', 'March', 'April', 'May', 'June',

              'July', 'August', 'September', 'October', 'November', 'December'

            ];

            
            
            const monthIndex = monthNames.findIndex(month => {
              const lowerMonthStr = processedItem.month.toLowerCase();
              const lowerMonth = month.toLowerCase();
              
              // Exact match or word boundary match to avoid false positives
              return lowerMonthStr === lowerMonth || 
                     lowerMonthStr.includes(` ${lowerMonth} `) ||
                     lowerMonthStr.startsWith(`${lowerMonth} `) ||
                     lowerMonthStr.endsWith(` ${lowerMonth}`) ||
                     lowerMonthStr.includes(`${lowerMonth}-`) ||
                     lowerMonthStr.includes(`-${lowerMonth}`) ||
                     lowerMonthStr.includes(`${lowerMonth}_`) ||
                     lowerMonthStr.includes(`_${lowerMonth}`);
            });

            
            
            if (monthIndex !== -1 && processedItem.year) {

              // Create a proper date string using the year from the data

              const year = processedItem.year;
              if (!year) {
                console.warn("⚠️ No year provided for month processing, skipping");
                return;
              }

              processedItem.month = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;

            }

          }

          
          
          return processedItem;

        });

        
        
        // Filter out records with invalid month data
        const validData = convertedData.filter(hasValidMonth);
        setRawData(validData); // Store raw data - filtering will be done in useMemo

      } catch (error: any) {
        console.error("❌ Error fetching data:", error);
        // Set empty data on error to prevent blank page
        setRawData([]);
      } finally {

        setIsLoading(false);

      }

    };



    fetchData();

  }, [refreshTrigger]); // Refetch when refreshTrigger changes (e.g. after normalize-percentages)

  // Fetch routing data
  useEffect(() => {
    const fetchRoutingData = async () => {
      try {
        const response = await apiClient.get('/Alchemy_Routing');
        if (Array.isArray(response.data)) {
          setRoutingData(response.data);
        }
      } catch (error: any) {
        console.error("Error fetching routing data:", error);
      }
    };
    fetchRoutingData();
  }, []);

  // Helper function to parse billing month from routing data (similar to RoutingDashboard)
  const parseRoutingBillingMonth = (billingMonthStr: string): Date | null => {
    if (!billingMonthStr || billingMonthStr === 'N/A' || billingMonthStr === '') {
      return null;
    }
    
    // Handle DD-MM-YYYY format (e.g., "01-09-2024")
    if (/^\d{2}-\d{2}-\d{4}$/.test(billingMonthStr.trim())) {
      const [day, month, year] = billingMonthStr.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    
    // Handle Excel serial numbers (5-digit numbers)
    if (/^\d{5}$/.test(billingMonthStr.trim())) {
      const serialNumber = parseInt(billingMonthStr, 10);
      const excelEpoch = new Date(1899, 11, 30);
      let daysToAdd = serialNumber;
      if (serialNumber > 59) {
        daysToAdd = serialNumber + 1;
      }
      return new Date(excelEpoch.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    }
    
    // Handle MMM-YY format (e.g., "Sep-24", "Aug-24")
    if (billingMonthStr.includes('-') && billingMonthStr.length === 6) {
      const [monthStr, yearStr] = billingMonthStr.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthIndex = monthNames.indexOf(monthStr);
      if (monthIndex !== -1 && yearStr) {
        const year = 2000 + parseInt(yearStr);
        return new Date(year, monthIndex, 1);
      }
    }
    
    // Handle ISO date format
    if (billingMonthStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const date = new Date(billingMonthStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    
    // Try parsing as date string
    const date = new Date(billingMonthStr);
    if (!isNaN(date.getTime())) {
      return date;
    }
    
    return null;
  };

  // Helper function to get target months based on current comparison period
  const getTargetMonthsForRouting = (): { month: number; year: number }[] => {
    let targetMonths: { month: number; year: number }[] = [];
    
    if (compareType === 'month' && comparisonValues[0]) {
      // Single month comparison
      const monthMatch = comparisonValues[0].match(/(\w+) (\d{4})/);
      if (monthMatch) {
        const monthName = monthMatch[1];
        const year = parseInt(monthMatch[2]);
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];
        const monthIndex = monthNames.findIndex(m => m.toLowerCase().startsWith(monthName.toLowerCase()));
        if (monthIndex !== -1) {
          targetMonths = [{ month: monthIndex + 1, year }];
        }
      }
    } else if (compareType === 'quarter' && comparisonValues[0]) {
      // Quarter comparison
      const quarterMatch = comparisonValues[0].match(/Q(\d)/);
      const yearMatch = comparisonValues[0].match(/(\d{4})/);
      if (quarterMatch && yearMatch) {
        const quarter = parseInt(quarterMatch[1]);
        const year = parseInt(yearMatch[1]);
        const quarterMonthNames: { [key: number]: number[] } = {
          1: [4, 5, 6],   // Apr, May, Jun
          2: [7, 8, 9],   // Jul, Aug, Sep
          3: [10, 11, 12], // Oct, Nov, Dec
          4: [1, 2, 3]    // Jan, Feb, Mar
        };
        const monthsInQuarter = quarterMonthNames[quarter] || [];
        const displayYear = quarter === 4 ? year + 1 : year;
        targetMonths = monthsInQuarter.map(month => ({ month, year: displayYear }));
      }
    } else {
      // Default: Current FY (April to current month)
      const currentFY = getCurrentFinancialYear();
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();
      
      // FY months: April (4) to March (3)
      if (currentMonth >= 4) {
        // April to current month of current year
        for (let m = 4; m <= currentMonth; m++) {
          targetMonths.push({ month: m, year: currentYear });
        }
      } else {
        // April to December of previous year, then January to current month
        for (let m = 4; m <= 12; m++) {
          targetMonths.push({ month: m, year: currentFY });
        }
        for (let m = 1; m <= currentMonth; m++) {
          targetMonths.push({ month: m, year: currentFY + 1 });
        }
      }
    }
    
    return targetMonths;
  };

  // Calculate routing billing for the same period as revenue
  const calculateRoutingBilling = (): number => {
    if (!routingData || routingData.length === 0) return 0;

    const targetMonths = getTargetMonthsForRouting();

    // Filter routing data for target months
    let totalBilling = 0;
    routingData.forEach(item => {
      // Check both 'Billing Month' and 'Costing Date' fields
      const billingMonth = item['Billing Month'] || item['Costing Date'];
      if (!billingMonth) return;

      const billingDate = parseRoutingBillingMonth(String(billingMonth));
      if (!billingDate) return;

      const billingYear = billingDate.getFullYear();
      const billingMonthNum = billingDate.getMonth() + 1;

      // Check if this billing date matches any target month
      const matches = targetMonths.some(target => 
        target.month === billingMonthNum && target.year === billingYear
      );

      if (matches) {
        const billingValue = parseFloat(item['Alchemy Billing Value'] || 0);
        if (!isNaN(billingValue)) {
          totalBilling += billingValue;
        }
      }
    });

    return totalBilling;
  };

  // Calculate routing margin (Alchemy Billing - Vendor Invoice Amount) for GPM
  const calculateRoutingMargin = (): number => {
    if (!routingData || routingData.length === 0) return 0;

    const targetMonths = getTargetMonthsForRouting();

    // Filter routing data for target months
    let totalMargin = 0;
    routingData.forEach(item => {
      // Check both 'Billing Month' and 'Costing Date' fields
      const billingMonth = item['Billing Month'] || item['Costing Date'];
      if (!billingMonth) return;

      const billingDate = parseRoutingBillingMonth(String(billingMonth));
      if (!billingDate) return;

      const billingYear = billingDate.getFullYear();
      const billingMonthNum = billingDate.getMonth() + 1;

      // Check if this billing date matches any target month
      const matches = targetMonths.some(target => 
        target.month === billingMonthNum && target.year === billingYear
      );

      if (matches) {
        const billingValue = parseFloat(item['Alchemy Billing Value'] || 0);
        const vendorInvoice = parseFloat(item['Vendor Inv. Amount'] || item['Vendor Invoice Amount'] || 0);
        const margin = billingValue - vendorInvoice;
        if (!isNaN(margin)) {
          totalMargin += margin;
        }
      }
    });

    return totalMargin;
  };

  // Calculate routing net margin for NP
  const calculateRoutingNetMargin = (): number => {
    if (!routingData || routingData.length === 0) return 0;

    const targetMonths = getTargetMonthsForRouting();

    // Filter routing data for target months
    let totalNetMargin = 0;
    routingData.forEach(item => {
      // Check both 'Billing Month' and 'Costing Date' fields
      const billingMonth = item['Billing Month'] || item['Costing Date'];
      if (!billingMonth) return;

      const billingDate = parseRoutingBillingMonth(String(billingMonth));
      if (!billingDate) return;

      const billingYear = billingDate.getFullYear();
      const billingMonthNum = billingDate.getMonth() + 1;

      // Check if this billing date matches any target month
      const matches = targetMonths.some(target => 
        target.month === billingMonthNum && target.year === billingYear
      );

      if (matches) {
        const netMargin = parseFloat(item['Net Margin'] || 0);
        if (!isNaN(netMargin)) {
          totalNetMargin += netMargin;
        }
      }
    });

    return totalNetMargin;
  };

  // Fetch business units on component mount

  useEffect(() => {


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

  // Helper function to get filtered data using KPI dashboard logic
  const getFilteredDataByPeriod = useCallback((periodValue: string | null, compareType: string): any[] => {
    if (!periodValue) return [];
    
    return data.filter(item => {
      // Business unit filter (case-insensitive comparison)
      if (selectedBusinessUnit && !compareBusinessUnits(item.business_unit, selectedBusinessUnit)) {
        return false;
      }
      
      // BU head filter - ensure BU head only sees their business unit's data
      if (isBUHead && user?.business_unit) {
        if (!compareBusinessUnits(item.business_unit, user.business_unit)) {
          return false;
        }
      }
      
      // Client name/project name filter - enabled for team_report
      if (selectedClientName) {
        if (selectedBusinessUnit === "Managed Services" || selectedBusinessUnit === "MS") {
          if (item.project_name !== selectedClientName) return false;
        } else {
          if (item.client_name !== selectedClientName) return false;
        }
      }
      
      // Date parsing and period matching
      const date = parseDate(item.month, item.year);
      if (isNaN(date.getTime())) return false;
      
      let itemValue = "";
      
      switch (compareType) {
        case "year":
          // Handle both "2025" and "FY 2025" formats with financial year logic
          const yearStr = date.getFullYear().toString();
          const fyYearStr = `FY ${yearStr}`;
          itemValue = yearStr;
          
          // Extract target year from periodValue
          const targetYearMatch = periodValue.match(/(\d{4})/);
          if (!targetYearMatch) return false;
          
          const targetYear = parseInt(targetYearMatch[1]);
          const itemYear = date.getFullYear();
          const itemMonth = date.getMonth() + 1;
          
          // Financial year filtering: FY 2025 = April 2025 to March 2026
          const isInTargetFY = itemMonth >= 4 ? itemYear === targetYear : itemYear === targetYear + 1;
          
          // Debug Q4 2025 data for FY 2024 (commented out for performance)
          // if (targetYear === 2024 && itemYear === 2025 && (itemMonth === 1 || itemMonth === 2 || itemMonth === 3)) {
          //   console.log(`🔍 Q4 2025 Filtering Debug:`, {
          //     itemMonth,
          //     itemYear,
          //     targetYear,
          //     isInTargetFY,
          //     periodValue,
          //     item: { month: item.month, year: item.year },
          //     shouldInclude: isInTargetFY
          //   });
          // }
          
          return isInTargetFY;
          
        case "month":
          itemValue = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
          return itemValue === periodValue;
          
        case "quarter":
          itemValue = getFiscalQuarter(date).label;
          return itemValue === periodValue;
          
        default:
          return false;
      }
    });
  }, [data, selectedBusinessUnit, selectedClientName, compareType]);

  // Helper function to get parameter value using KPI dashboard logic
  const getParameterValueUsingKPILogic = useCallback((periodValue: string | null, parameter: string): number => {
    if (!periodValue) return 0;
    
    const filteredData = getFilteredDataByPeriod(periodValue, compareType);
    
    // Debug Q4 2025 data specifically for FY 2024
    if (periodValue === 'FY 2024' && parameter === 'Revenue') {
      // Check if Q4 2025 data exists in the raw dataset
      const q4DataInRawDataset = data.filter(item => {
        const itemDate = parseDate(item.month, item.year);
        const itemYear = itemDate.getFullYear();
        const itemMonth = itemDate.getMonth() + 1;
        return itemYear === 2025 && (itemMonth === 1 || itemMonth === 2 || itemMonth === 3);
      });
      
      // Removed verbose console.log for performance
    }
    
    if (filteredData.length === 0) return 0;
    
    // Special handling for HC - use sum of last available month's HC data
    if (parameter === 'HC') {
      // Filter out items with invalid dates first
      const validData = filteredData.filter(item => {
        const itemDate = parseDate(item.month, item.year);
        return !isNaN(itemDate.getTime());
      });
      
      if (validData.length === 0) return 0;
      
      const lastMonthData = validData.reduce((latest, item) => {
        const itemDate = parseDate(item.month, item.year);
        const latestDate = parseDate(latest.month, latest.year);
        return itemDate > latestDate ? item : latest;
      });
      
      // Sum all HC values from that last month
      const lastMonthDate = parseDate(lastMonthData.month, lastMonthData.year);
      return validData
        .filter(item => {
          const itemDate = parseDate(item.month, item.year);
          return itemDate.getMonth() === lastMonthDate.getMonth() && 
                 itemDate.getFullYear() === lastMonthDate.getFullYear();
        })
        .reduce((sum, item) => sum + (item.hc || 0), 0);
    } else {
      // GPM % and NP % must be (Total GPM/Total Revenue)*100 and (Total NP/Total Revenue)*100, not sum of percentages
      if (parameter === 'GPM %' || parameter === 'NP %') {
        const monthlyRevenue: {[key: string]: number} = {};
        const monthlyGpm: {[key: string]: number} = {};
        const monthlyNp: {[key: string]: number} = {};
        filteredData.forEach(item => {
          const monthKey = `${item.month} ${item.year}`;
          if (!monthlyRevenue[monthKey]) {
            monthlyRevenue[monthKey] = 0;
            monthlyGpm[monthKey] = 0;
            monthlyNp[monthKey] = 0;
          }
          monthlyRevenue[monthKey] += (item.revenue || 0);
          monthlyGpm[monthKey] += (item.gpm || 0);
          monthlyNp[monthKey] += (item.np || 0);
        });
        const totalRevenue = Object.values(monthlyRevenue).reduce((sum: number, val: number) => sum + val, 0);
        const totalGpm = Object.values(monthlyGpm).reduce((sum: number, val: number) => sum + val, 0);
        const totalNp = Object.values(monthlyNp).reduce((sum: number, val: number) => sum + val, 0);
        if (parameter === 'GPM %') return totalRevenue !== 0 ? (totalGpm / totalRevenue) * 100 : 0;
        if (parameter === 'NP %') return totalRevenue !== 0 ? (totalNp / totalRevenue) * 100 : 0;
      }
      // For all other parameters: aggregate by month first, then sum
      const monthlyTotals: {[key: string]: number} = {};
      filteredData.forEach(item => {
        const monthKey = `${item.month} ${item.year}`;
        if (!monthlyTotals[monthKey]) {
          monthlyTotals[monthKey] = 0;
        }
        // Map parameter names to database field names
        let fieldName = parameter.toLowerCase();
        if (parameter === 'Revenue') fieldName = 'revenue';
        if (parameter === 'Salary Cost') fieldName = 'salary_cost';
        if (parameter === 'GPM') fieldName = 'gpm';
        if (parameter === 'GPM %') fieldName = 'gpm_percentage';
        if (parameter === 'Team Cost') fieldName = 'team_cost';
        if (parameter === 'NP') fieldName = 'np'; // Use 'np' field from database
        if (parameter === 'Net Margin') fieldName = 'np'; // Map Net Margin to np as well
        if (parameter === 'NP %') fieldName = 'np_percentage';
        if (parameter === 'Leave Encashment') fieldName = 'leave_encashment';
        if (parameter === 'Opr Cost') fieldName = 'opr_cost';
        if (parameter === 'Funding Cost') fieldName = 'funding_cost';
        if (parameter === 'Rebate') fieldName = 'rebate';
        if (parameter === 'Passthrough') fieldName = 'passthrough';
        if (parameter === 'HC') fieldName = 'hc';
        
        // Debug Net Margin mapping
        if (parameter === 'Net Margin') {
          // Removed verbose console.log for performance
        }
        
        monthlyTotals[monthKey] += (item[fieldName] || 0);
      });
      return Object.values(monthlyTotals).reduce((sum: number, val: number) => sum + val, 0);
    }
  }, [getFilteredDataByPeriod, compareType]);

  // Helper function to get month range for a given FY - uses same logic as KPI calculations
  const getMonthRangeForFY = useCallback((fyPeriod: string) => {
    if (!fyPeriod || !data.length) return fyPeriod;
    
    // Extract year from FY period (e.g., "FY 2025" -> 2025)
    const yearMatch = fyPeriod.match(/FY (\d{4})/);
    if (!yearMatch) return fyPeriod;
    
    const targetYear = parseInt(yearMatch[1]);
    
    // Use the EXACT same filtering logic as calculateKPIs function
    const fyData = data.filter(item => {
      const itemDate = parseDate(item.month, item.year);
      if (isNaN(itemDate.getTime())) return false;
      
      const itemYear = itemDate.getFullYear();
      const itemMonth = itemDate.getMonth() + 1;
      
      // Financial year filtering: FY 2025 = April 2025 to March 2026
      if (itemMonth >= 4) {
        // April to December: same calendar year
        return itemYear === targetYear;
      } else {
        // January to March: next calendar year
        return itemYear === targetYear + 1;
      }
    });
    
    // Get unique months from the filtered data (same data used in KPI calculations)
    // Normalize month names to match monthOrder array format
    const monthNameMap: { [key: string]: string } = {
      'Jan': 'Jan', 'January': 'Jan',
      'Feb': 'Feb', 'February': 'Feb',
      'Mar': 'Mar', 'March': 'Mar',
      'Apr': 'Apr', 'April': 'Apr',
      'May': 'May',
      'Jun': 'Jun', 'June': 'Jun',
      'Jul': 'Jul', 'July': 'Jul',
      'Aug': 'Aug', 'August': 'Aug',
      'Sep': 'Sep', 'Sept': 'Sep', 'September': 'Sep',
      'Oct': 'Oct', 'October': 'Oct',
      'Nov': 'Nov', 'November': 'Nov',
      'Dec': 'Dec', 'December': 'Dec'
    };
    
    const uniqueMonths = Array.from(new Set(fyData.map(item => {
      const itemDate = parseDate(item.month, item.year);
      const monthShort = itemDate.toLocaleString('default', { month: 'short' });
      // Normalize month name to match monthOrder array
      return monthNameMap[monthShort] || monthShort;
    })));
    
    if (uniqueMonths.length === 0) {
      // If no data found, return the period without month range
      return fyPeriod;
    }
    
    // Sort months according to financial year order
    const monthOrder = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    const sortedMonths = uniqueMonths.sort((a, b) => {
      const aIndex = monthOrder.indexOf(a);
      const bIndex = monthOrder.indexOf(b);
      return aIndex - bIndex;
    });
    
    // Show the actual data range from database (same data used in KPI calculations)
    if (sortedMonths.length <= 2) {
      return `${fyPeriod} (${sortedMonths.join(', ')})`;
    } else {
      return `${fyPeriod} (${sortedMonths[0]} - ${sortedMonths[sortedMonths.length - 1]})`;
    }
  }, [data]);

  // Helper function to get base parameter value - moved to component level

  const getBaseParameterValue = useCallback((periodValue: string | null, index: number, parameter: string): number => {

    if (!periodValue) return 0;
    // Debug: Only log for July issues
    if (periodValue && periodValue.includes('July')) {
      console.warn(`⚠️ Processing July period: ${periodValue} for parameter: ${parameter}`);
    }

    
    
    // Check if this is a combined period

    const combinedPeriod = combinedPeriods[index];

    if (combinedPeriod && combinedPeriod.label === periodValue) {

      // Calculate total for combined periods

      return combinedPeriod.periods.reduce((total, period) => {

        const periodFiltered = data.filter(item => {

            // Business unit filter (case-insensitive comparison)
            if (selectedBusinessUnit && !compareBusinessUnits(item.business_unit, selectedBusinessUnit)) {

              return false;

            }
            
            // BU head filter - ensure BU head only sees their business unit's data
            if (isBUHead && user?.business_unit) {
              if (!compareBusinessUnits(item.business_unit, user.business_unit)) {
                return false;
              }
            }

            // Client name/project name filter - enabled for team_report
            if (selectedClientName) {
              if (selectedBusinessUnit === "Managed Services" || selectedBusinessUnit === "MS") {
                if (item.project_name !== selectedClientName) return false;
              } else {
                if (item.client_name !== selectedClientName) return false;
              }
            }

            // BU head filter disabled for team_summary_report (field doesn't exist)
            // if (selectedBUHead && item.bu_head !== selectedBUHead) {
            //   return false;
            // }

            
            
            const date = parseDate(item.month, item.year);

            if (isNaN(date.getTime())) return false;

            
            
            let itemValue = "";

            switch (compareType) {

              case "year":
                // Handle both "2025" and "FY 2025" formats with financial year logic
                const yearStr = date.getFullYear().toString();
                const fyYearStr = `FY ${yearStr}`;
                itemValue = yearStr;
                
                // Extract target year from period
                const targetYearMatch = period.match(/(\d{4})/);
                if (!targetYearMatch) return false;
                
                const targetYear = parseInt(targetYearMatch[1]);
                const itemYear = date.getFullYear();
                const itemMonth = date.getMonth() + 1;
                
                // Financial year filtering: FY 2025 = April 2025 to March 2026
                const isInTargetFY = itemMonth >= 4 ? itemYear === targetYear : itemYear === targetYear + 1;
                
                
                return isInTargetFY;

              case "month":

                itemValue = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;

                break;

              case "quarter":

                itemValue = getFiscalQuarter(date).label;

                break;

              default:

                return false;

            }

            
            
            // For non-year comparisons, use the original logic
            return itemValue === period;

          });

        // GPM % and NP %: use (Total GPM/Total Revenue)*100 and (Total NP/Total Revenue)*100, not sum of percentages
        if (parameter === 'GPM %' || parameter === 'NP %') {
          const totalRevenue = periodFiltered.reduce((s, i) => s + (i.revenue || 0), 0);
          const totalGpm = periodFiltered.reduce((s, i) => s + (i.gpm || 0), 0);
          const totalNp = periodFiltered.reduce((s, i) => s + (i.np || 0), 0);
          const pct = parameter === 'GPM %' ? (totalRevenue !== 0 ? (totalGpm / totalRevenue) * 100 : 0) : (totalRevenue !== 0 ? (totalNp / totalRevenue) * 100 : 0);
          return total + pct;
        }

        return total + periodFiltered.reduce((sum, item) => {

                  // Get the value based on the selected parameter

                  let value = 0;

                  switch (parameter) {
                    case 'Revenue': value = item.revenue || 0; break;
                    case 'Salary Cost': value = item.salary_cost || 0; break;
                    case 'GPM': value = item.gpm || 0; break;
                    case 'GPM %': value = item.gpm_percentage || 0; break;
                    case 'Net Margin': value = item.np || item.net_margin || 0; break; // Map to np field
                    case 'NP': value = item.np || 0; break; // Use 'np' field from database
                    case 'NP %': value = item.np_percentage || 0; break;
                    case 'Leave Encashment': value = item.leave_encashment || 0; break;
                    case 'Team Cost': value = item.team_cost || 0; break;
                    case 'Opr Cost': value = item.opr_cost || 0; break;
                    case 'Funding Cost': value = item.funding_cost || 0; break;
                    case 'Rebate': value = item.rebate || 0; break;
                    case 'Passthrough': value = item.passthrough || 0; break;
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

      // Business unit filter (case-insensitive comparison)

      if (selectedBusinessUnit && !compareBusinessUnits(item.business_unit, selectedBusinessUnit)) {

        return false;

      }
      
      // BU head filter - ensure BU head only sees their business unit's data
      if (isBUHead && user?.business_unit) {
        if (!compareBusinessUnits(item.business_unit, user.business_unit)) {
          return false;
        }
      }

      
      
      // Client name/project name filter - enabled for team_report
      if (selectedClientName) {
        if (selectedBusinessUnit === "Managed Services" || selectedBusinessUnit === "MS") {
          if (item.project_name !== selectedClientName) return false;
        } else {
          if (item.client_name !== selectedClientName) return false;
        }
      }

      
      
      // BU head filter disabled for team_summary_report (field doesn't exist)
      // if (selectedBUHead && item.bu_head !== selectedBUHead) {
      //   return false;
      // }

      
      
      // Date parsing and period matching

      const date = parseDate(item.month, item.year);

      if (isNaN(date.getTime())) {

        // Removed verbose console.log for performance

        return false;

      }

      
      
      let itemValue = "";

      switch (compareType) {

        case "year":
          // Handle both "2025" and "FY 2025" formats with financial year logic
          const yearStr = date.getFullYear().toString();
          const fyYearStr = `FY ${yearStr}`;
          itemValue = yearStr;
          
          // Extract target year from periodValue
          const targetYearMatch = periodValue.match(/(\d{4})/);
          if (!targetYearMatch) return false;
          
          const targetYear = parseInt(targetYearMatch[1]);
          const itemYear = date.getFullYear();
          const itemMonth = date.getMonth() + 1;
          
          // Financial year filtering: FY 2025 = April 2025 to March 2026
          const isInTargetFY = itemMonth >= 4 ? itemYear === targetYear : itemYear === targetYear + 1;
          
          
          return isInTargetFY;

        case "month":

          itemValue = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;

          break;

        case "quarter":

          itemValue = getFiscalQuarter(date).label;

          break;

        default:

          return false;

      }

      
      
      // For non-year comparisons, use the original logic
      const matches = itemValue === periodValue;

      if (matches) {
        // Removed verbose console.log for performance
      }

      
      
      return matches;

    });

    
    
    // Removed verbose console.log for performance

    
    
    // GPM % and NP %: use (Total GPM/Total Revenue)*100 and (Total NP/Total Revenue)*100, not sum of percentages
    if (parameter === 'GPM %' || parameter === 'NP %') {
      const totalRevenue = filteredData.reduce((s, i) => s + (i.revenue || 0), 0);
      const totalGpm = filteredData.reduce((s, i) => s + (i.gpm || 0), 0);
      const totalNp = filteredData.reduce((s, i) => s + (i.np || 0), 0);
      if (parameter === 'GPM %') return totalRevenue !== 0 ? (totalGpm / totalRevenue) * 100 : 0;
      if (parameter === 'NP %') return totalRevenue !== 0 ? (totalNp / totalRevenue) * 100 : 0;
    }

    return filteredData

      .reduce((sum, item) => {

        // Get the value based on the selected parameter

        let value = 0;

        switch (parameter) {
          case 'Revenue': value = item.revenue || 0; break;
          case 'Salary Cost': value = item.salary_cost || 0; break;
          case 'GPM': value = item.gpm || 0; break;
          case 'GPM %': value = item.gpm_percentage || 0; break;
          case 'Net Margin': value = item.np || item.net_margin || 0; break; // Map to np field
          case 'NP': value = item.np || 0; break; // Use 'np' field from database
          case 'NP %': value = item.np_percentage || 0; break;
          case 'Leave Encashment': value = item.leave_encashment || 0; break;
          case 'Team Cost': value = item.team_cost || 0; break;
          case 'Opr Cost': value = item.opr_cost || 0; break;
          case 'Funding Cost': value = item.funding_cost || 0; break;
          case 'Rebate': value = item.rebate || 0; break;
          case 'Passthrough': value = item.passthrough || 0; break;
          case 'HC': value = item.hc || 0; break;

          default: 
            console.warn(`🔍 Unknown parameter: ${parameter}`);
            value = 0;
        }

        
        
        // Removed verbose console.log for performance

        
        
        return sum + value;

      }, 0);

  }, [data, selectedBusinessUnit, selectedClientName, selectedBUHead, compareType, combinedPeriods]);



  // Calculate comparison data when selections change

  useEffect(() => {

    // Removed verbose console.log for performance

    
    
    if (selectedParameters.length === 0 || comparisonValues.every(v => !v)) {

      // Removed verbose console.log for performance

      return;

    }



    const getPeriodAmountForParameter = (periodValue: string | null, index: number, parameter: string): number => {

      if (!periodValue) return 0;

      // Use KPI dashboard logic for consistent data calculation
      const value = getParameterValueUsingKPILogic(periodValue, parameter);

      // Removed verbose console.log for performance

      return value;

    };

    
    
    // Create data structure for multiple parameters

    const periods = comparisonValues.filter(Boolean);

    // Removed verbose console.log for performance

    
    
    const newComparisonData = periods.map((periodValue, index) => {

      const dataPoint: any = { period: periodValue as string };

      
      
      // Add amount for each parameter

      selectedParameters.forEach(parameter => {

        const value = getPeriodAmountForParameter(periodValue, index, parameter);

        dataPoint[parameter] = value;

        // Removed verbose console.log for performance

      });

      
      
      return dataPoint;

    });



    // Removed verbose debug logs for performance

    setComparisonData(newComparisonData);

  }, [comparisonValues, data, compareType, selectedBusinessUnit, selectedClientName, selectedBUHead, selectedParameters, combinedPeriods]);



  // Calculate growth analysis when selections change

  useEffect(() => {

    // Removed verbose debug logs for performance

    
    
    if (comparisonValues.filter(Boolean).length < 2) {

      // Removed verbose console.log for performance

      setGrowthAnalysis([]);

      return;

    }



    const calculateGrowth = (): GrowthAnalysis[] => {
      // Removed verbose console.log for performance
      
      // Efficiency metrics to exclude from growth analysis (only show in parameter bar chart)
      const efficiencyMetrics = [
        'Cost Efficiency',
        'Revenue per HC',
        'NP per Team Cost',
        'Team Cost % of Revenue',
        'GPM per HC'
      ];
      
      // Filter out only efficiency metrics from growth analysis
      // Team Cost is needed for efficiency dashboard calculations, but will be filtered from table display
      const growthAnalysisParams = availableParameters.filter(param => 
        !efficiencyMetrics.includes(param)
      );
      
      return growthAnalysisParams.map(param => {
        const periodAmounts = comparisonValues.map((periodValue, index) => {

          if (!periodValue) return null;

          
          
          // Handle calculated metrics - these are now direct fields in our new structure

          // No need for complex calculations since we have direct percentage fields

          
          
          // Check if this is a combined period

          const combinedPeriod = combinedPeriods[index];

          if (combinedPeriod && combinedPeriod.label === periodValue) {

            // Special handling for HC - use sum of last available month's HC data
            if (param === 'HC') {
              const allPeriodData = combinedPeriod.periods.flatMap(period => 
                data.filter(item => {
                  // Business unit filter (case-insensitive comparison)
                  if (selectedBusinessUnit && !compareBusinessUnits(item.business_unit, selectedBusinessUnit)) return false;
                  
                  // BU head filter - ensure BU head only sees their business unit's data
                  if (isBUHead && user?.business_unit) {
                    if (!compareBusinessUnits(item.business_unit, user.business_unit)) return false;
                  }
                  // Client name/project name filter - enabled for team_report
                  if (selectedClientName) {
                    if (selectedBusinessUnit === "Managed Services" || selectedBusinessUnit === "MS") {
                      if (item.project_name !== selectedClientName) return false;
                    } else {
                      if (item.client_name !== selectedClientName) return false;
                    }
                  }
                  // BU head filter disabled for team_summary_report (field doesn't exist)
                  // if (selectedBUHead && item.bu_head !== selectedBUHead) return false;
                  
                  const date = parseDate(item.month, item.year);
                  if (isNaN(date.getTime())) return false;
                  
                  let itemValue = "";
                  switch (compareType) {
                    case "year": 
                      const yearStr = date.getFullYear().toString();
                      const fyYearStr = `FY ${yearStr}`;
                      itemValue = yearStr; 
                      
                      // Financial year filtering: FY 2025 = April 2025 to March 2026
                      if (period === yearStr || period === fyYearStr) {
                        const itemYear = date.getFullYear();
                        const itemMonth = date.getMonth() + 1;
                        const targetYear = parseInt(yearStr);
                        
                        if (itemMonth >= 4) {
                          // April to December: same calendar year
                          return itemYear === targetYear;
                        } else {
                          // January to March: next calendar year
                          return itemYear === targetYear + 1;
                        }
                      }
                      return false;
                    case "month": itemValue = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`; break;
                    case "quarter": itemValue = getFiscalQuarter(date).label; break;
                    default: return false;
                  }
                  return itemValue === period;
                })
              );
              
              // Find the last month's HC value across all periods
              if (allPeriodData.length > 0) {
                // Filter out items with invalid dates first
                const validAllPeriodData = allPeriodData.filter(item => {
                  const itemDate = parseDate(item.month, item.year);
                  return !isNaN(itemDate.getTime());
                });
                
                if (validAllPeriodData.length === 0) {
                  return 0;
                }
                
                const lastMonthData = validAllPeriodData.reduce((latest, item) => {
                  const itemDate = parseDate(item.month, item.year);
                  const latestDate = parseDate(latest.month, latest.year);
                  return itemDate > latestDate ? item : latest;
                });
                // Sum all HC values from that last month
                const lastMonthDate = parseDate(lastMonthData.month, lastMonthData.year);
                const hcValue = validAllPeriodData
                  .filter(item => {
                    const itemDate = parseDate(item.month, item.year);
                    return itemDate.getMonth() === lastMonthDate.getMonth() && 
                           itemDate.getFullYear() === lastMonthDate.getFullYear();
                  })
                  .reduce((sum, item) => sum + (item.hc || 0), 0);
                
                // Removed verbose debug logs for performance
                
                return hcValue;
              }
              return 0;
            }

            // For all other parameters: sum all months
            return combinedPeriod.periods.reduce((total, period) => {

              const periodFiltered = data.filter(item => {

                  // Business unit filter (case-insensitive comparison)
                  if (selectedBusinessUnit && !compareBusinessUnits(item.business_unit, selectedBusinessUnit)) return false;
                  
                  // BU head filter - ensure BU head only sees their business unit's data
                  if (isBUHead && user?.business_unit) {
                    if (!compareBusinessUnits(item.business_unit, user.business_unit)) return false;
                  }

                  // Filter by client name/project name if selected

                  if (selectedClientName) {

                    if (selectedBusinessUnit === "Managed Services" || selectedBusinessUnit === "MS") {

                      if (item.project_name !== selectedClientName) return false;

                    } else {

                      if (item.client_name !== selectedClientName) return false;

                    }

                  }

                  // BU head filter disabled for team_summary_report (field doesn't exist)
                  // if (selectedBUHead && item.bu_head !== selectedBUHead) {
                  //   return false;
                  // }

                  
                  
                  const date = parseDate(item.month, item.year);

                  if (isNaN(date.getTime())) return false;

                  
                  
                  let itemValue = "";

                  switch (compareType) {

                    case "year": 
                      // Handle both "2025" and "FY 2025" formats
                      const yearStr = date.getFullYear().toString();
                      const fyYearStr = `FY ${yearStr}`;
                      itemValue = yearStr; 
                      
                      // Financial year filtering: FY 2025 = April 2025 to March 2026
                      if (period === yearStr || period === fyYearStr) {
                        const itemYear = date.getFullYear();
                        const itemMonth = date.getMonth() + 1;
                        const targetYear = parseInt(yearStr);
                        
                        if (itemMonth >= 4) {
                          // April to December: same calendar year
                          return itemYear === targetYear;
                        } else {
                          // January to March: next calendar year
                          return itemYear === targetYear + 1;
                        }
                      }
                      return false;

                    case "month": itemValue = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`; break;

                    case "quarter": itemValue = getFiscalQuarter(date).label; break;

                    default: return false;

                  }

                  
                  
                  // For non-year comparisons, use the original logic
                  return itemValue === period;

                });

              // GPM % and NP %: use (Total GPM/Total Revenue)*100 and (Total NP/Total Revenue)*100, not sum of percentages
              if (param === 'GPM %' || param === 'NP %') {
                const totalRevenue = periodFiltered.reduce((s, i) => s + (i.revenue || 0), 0);
                const totalGpm = periodFiltered.reduce((s, i) => s + (i.gpm || 0), 0);
                const totalNp = periodFiltered.reduce((s, i) => s + (i.np || 0), 0);
                const pct = param === 'GPM %' ? (totalRevenue !== 0 ? (totalGpm / totalRevenue) * 100 : 0) : (totalRevenue !== 0 ? (totalNp / totalRevenue) * 100 : 0);
                return total + pct;
              }

              return total + periodFiltered.reduce((sum, item) => {

                  // Get the value based on the selected parameter

                  let value = 0;

                  switch (param) {
                    case 'Revenue': value = item.revenue || 0; break;
                    case 'Salary Cost': value = item.salary_cost || 0; break;
                    case 'GPM': value = item.gpm || 0; break;
                    case 'GPM %': value = item.gpm_percentage || 0; break;
                    case 'Net Margin': value = item.np || item.net_margin || 0; break; // Map to np field
                    case 'NP': value = item.np || 0; break; // Use 'np' field from database
                    case 'NP %': value = item.np_percentage || 0; break;
                    case 'Leave Encashment': value = item.leave_encashment || 0; break;
                    case 'Team Cost': value = item.team_cost || 0; break;
                    case 'Opr Cost': value = item.opr_cost || 0; break;
                    case 'Funding Cost': value = item.funding_cost || 0; break;
                    case 'Rebate': value = item.rebate || 0; break;
                    case 'Passthrough': value = item.passthrough || 0; break;
                    case 'HC': value = item.hc || 0; break;

                    default: value = 0;
                  }

                  return sum + value;

                }, 0);

            }, 0);

          }

          
          
          // Single period calculation

          const filteredData = data.filter(item => {

              // Business unit filter (case-insensitive comparison)
              if (selectedBusinessUnit && !compareBusinessUnits(item.business_unit, selectedBusinessUnit)) return false;

              // BU head filter - ensure BU head only sees their business unit's data
              if (isBUHead && user?.business_unit) {
                if (!compareBusinessUnits(item.business_unit, user.business_unit)) return false;
              }

              // Filter by client name/project name if selected

              if (selectedClientName) {

                const normalizedBU = normalizeBusinessUnitName(selectedBusinessUnit);
                if (normalizedBU === 'MS' || selectedBusinessUnit === "Managed Services" || selectedBusinessUnit === "MS") {

                  if (item.project_name !== selectedClientName) return false;

                } else {

                  if (item.client_name !== selectedClientName) return false;

                }

              }

              // BU head filter disabled for team_summary_report (field doesn't exist)
              // if (selectedBUHead && item.bu_head !== selectedBUHead) {
              //   return false;
              // }

              
              
              const date = parseDate(item.month, item.year);

              if (isNaN(date.getTime())) return false;

              
              
              let itemValue = "";

              switch (compareType) {

                case "year": 
                  // Handle both "2025" and "FY 2025" formats
                  const yearStr = date.getFullYear().toString();
                  const fyYearStr = `FY ${yearStr}`;
                  itemValue = yearStr; 
                  
                  // Financial year filtering: FY 2025 = April 2025 to March 2026
                  if (periodValue === yearStr || periodValue === fyYearStr) {
                    const itemYear = date.getFullYear();
                    const itemMonth = date.getMonth() + 1;
                    const targetYear = parseInt(yearStr);
                    
                    if (itemMonth >= 4) {
                      // April to December: same calendar year
                      return itemYear === targetYear;
                    } else {
                      // January to March: next calendar year
                      return itemYear === targetYear + 1;
                    }
                  }
                  return false;

                case "month": itemValue = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`; break;

                case "quarter": itemValue = getFiscalQuarter(date).label; break;

                default: return false;

              }

              
              
              // For non-year comparisons, use the original logic
              return itemValue === periodValue;

            });

          // Use the unified KPI dashboard logic for all parameters
          return getParameterValueUsingKPILogic(periodValue, param);


        }).map(amount => amount !== null && amount !== undefined ? amount : 0);



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



        // Calculate projection for first period (current year) if it's a year comparison
        let predictedAmount = 0;
        const firstPeriodAmount = periodAmounts[0] || 0;
        const firstPeriodActual = typeof firstPeriodAmount === 'number' ? firstPeriodAmount : parseFloat(String(firstPeriodAmount)) || 0;
        let sumAmount = firstPeriodActual; // Initialize with actual value
        
        // Only calculate projection for year comparisons and if we have actual data
        if (compareType === 'year' && firstPeriodActual > 0 && comparisonValues[0]) {
          // Use existing kpiData state instead of recalculating - this avoids redundant calculations
          // Map parameter names to match KPI keys
          let paramKey = param;
          if (param === 'Net Margin') paramKey = 'NP';
          // Also handle GPM % and NP % if needed
          
          const kpiForParam = kpiData[paramKey];
          
          if (kpiForParam && kpiForParam.projectedAmount !== undefined && kpiForParam.projectedAmount > 0) {
            // Use the same projection logic from KPI dashboard (already calculated)
            predictedAmount = kpiForParam.projectedAmount || 0;
            sumAmount = kpiForParam.currentFY || firstPeriodActual; // currentFY is the projected value
          } else {
            // Fallback: calculate projection manually if KPI data not available
            // This uses the same logic as calculateKPIs
            const currentFY = getCurrentFinancialYear();
            const currentFYData = data.filter(item => {
              // Business unit filter (case-insensitive comparison)
              if (selectedBusinessUnit && !compareBusinessUnits(item.business_unit, selectedBusinessUnit)) return false;
              
              // BU head filter - ensure BU head only sees their business unit's data
              if (isBUHead && user?.business_unit) {
                if (!compareBusinessUnits(item.business_unit, user.business_unit)) return false;
              }
              if (selectedClientName) {
                if (selectedBusinessUnit === "Managed Services" || selectedBusinessUnit === "MS") {
                  if (item.project_name !== selectedClientName) return false;
                } else {
                  if (item.client_name !== selectedClientName) return false;
                }
              }
              const date = parseDate(item.month, item.year);
              if (isNaN(date.getTime())) return false;
              const itemYear = date.getFullYear();
              const itemMonth = date.getMonth() + 1;
              if (itemMonth >= 4) {
                return itemYear === currentFY;
              } else {
                return itemYear === currentFY + 1;
              }
            });
            
            // Skip projection for HC and percentage parameters (they don't need projection)
            if (param !== 'HC' && !param.includes('%') && currentFYData.length > 0) {
              // Calculate monthly totals
              const monthlyTotals: {[key: string]: number} = {};
              currentFYData.forEach(item => {
                const monthKey = `${item.month} ${item.year}`;
                if (!monthlyTotals[monthKey]) {
                  monthlyTotals[monthKey] = 0;
                }
                
                let value = 0;
                switch (param) {
                  case 'Revenue': value = item.revenue || 0; break;
                  case 'Salary Cost': value = item.salary_cost || 0; break;
                  case 'GPM': value = item.gpm || 0; break;
                  case 'NP':
                  case 'Net Margin': value = item.np || 0; break;
                  case 'Leave Encashment': value = item.leave_encashment || 0; break;
                  case 'Team Cost': value = item.team_cost || 0; break;
                  case 'Opr Cost': value = item.opr_cost || 0; break;
                  case 'Funding Cost': value = item.funding_cost || 0; break;
                  case 'Rebate': value = item.rebate || 0; break;
                  case 'Passthrough': value = item.passthrough || 0; break;
                  default: value = 0;
                }
                monthlyTotals[monthKey] += value;
              });
              
              // Find last month with data (same logic as KPI dashboard)
              if (Object.keys(monthlyTotals).length > 0) {
                const monthKeys = Object.keys(monthlyTotals);
                const sortedMonths = monthKeys.sort((a, b) => {
                  const [monthA, yearA] = a.split(' ');
                  const [monthB, yearB] = b.split(' ');
                  const dateA = parseDate(monthA, parseInt(yearA));
                  const dateB = parseDate(monthB, parseInt(yearB));
                  return dateA.getTime() - dateB.getTime();
                });
                
                // Find the last month with non-zero value (same logic as KPI dashboard)
                let lastMonthWithData = null;
                let lastMonthValue = 0;
                for (let i = sortedMonths.length - 1; i >= 0; i--) {
                  const monthKey = sortedMonths[i];
                  const value = monthlyTotals[monthKey] || 0;
                  if (value > 0) {
                    lastMonthWithData = monthKey;
                    lastMonthValue = value;
                    break;
                  }
                }
                
                if (lastMonthWithData && lastMonthValue > 0) {
                  const financialYearMonths = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
                  const fullMonthNames = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
                  const [lastMonth, lastYear] = lastMonthWithData.split(' ');
                  let lastMonthIndex = financialYearMonths.indexOf(lastMonth);
                  if (lastMonthIndex === -1) {
                    lastMonthIndex = fullMonthNames.indexOf(lastMonth);
                  }
                  
                  if (lastMonthIndex !== -1) {
                    // Calculate remaining months from the last month with data (+1 because index is 0-based)
                    const actualMonthsRemaining = 12 - (lastMonthIndex + 1);
                    // Project: actual + (last month value * remaining months)
                    const currentFYProjected = firstPeriodActual + (lastMonthValue * actualMonthsRemaining);
                    predictedAmount = currentFYProjected - firstPeriodActual;
                    sumAmount = currentFYProjected;
                  }
                }
              }
            }
          }
        }

        return {

          parameter: param,

          periodValues: comparisonValues.map((period, i) => {
            // Ensure amount is a valid number, not null/undefined
            const amountValue = periodAmounts[i];
            let amount = 0;
            if (amountValue !== null && amountValue !== undefined) {
              if (typeof amountValue === 'number') {
                amount = amountValue;
              } else if (typeof amountValue === 'string') {
                amount = parseFloat(amountValue) || 0;
              } else {
                amount = parseFloat(String(amountValue)) || 0;
              }
            }
            return {
              period,
              amount
            };
          }),

          changes,
          
          // Add projection values for first period
          predictedAmount: predictedAmount,
          sumAmount: sumAmount > 0 ? sumAmount : firstPeriodActual

        };

      }).filter(item => item.periodValues.length > 0);

    };



    // Use the calculateGrowth function which properly handles multiple periods
    // Note: kpiData is used in calculateGrowth, so we need to wait for it to be calculated first
    // This ensures we reuse the already-calculated projections instead of recalculating
    const chartData = calculateGrowth();
    // Removed verbose debug logs for performance
    setGrowthAnalysis(chartData);
  }, [availableParameters, comparisonValues, data, compareType, selectedBusinessUnit, selectedClientName, selectedBUHead, kpiData]);

  // Calculate KPIs when data or comparison values change
  useEffect(() => {
    // Removed verbose console.log for performance
    
    if (data.length === 0) {
      setKpiData({});
      return;
    }
    
    const kpis = calculateKPIs();
    // Removed verbose console.log for performance
    setKpiData(kpis);
  }, [data, comparisonValues, compareType, selectedBusinessUnit, selectedClientName, selectedBUHead]);

  // Calculate growth percentages for chart data
  const calculateGrowthData = () => {
    if (comparisonData.length === 0 || selectedParameters.length === 0) return [];
    
    // Removed verbose console.log for performance
    
    return comparisonData.map(periodData => {
      const growthData: any = { period: periodData.period };
      
      selectedParameters.forEach(parameter => {
        const currentValue = periodData[parameter] || 0;
        
        // For quarter comparison, we need to find the corresponding previous quarter
        if (compareType === 'quarter' && comparisonValues.length >= 2) {
          const currentQuarter = comparisonValues[0];
          const previousQuarter = comparisonValues[1];
          
          if (currentQuarter && previousQuarter) {
            // Find the previous quarter data
            const previousPeriodData = comparisonData.find(p => p.period === previousQuarter);
            const previousValue = previousPeriodData ? previousPeriodData[parameter] || 0 : 0;
            
            const growthPercentage = previousValue > 0 
              ? ((currentValue - previousValue) / previousValue) * 100 
              : 0;
            
            growthData[parameter] = growthPercentage;
          }
        } else {
          // For year comparison, use the selected comparison values
          if (compareType === 'year' && comparisonValues.length >= 2) {
            const currentYear = comparisonValues[0];
            const previousYear = comparisonValues[1];
            
            // Removed verbose debug logs for performance
            
            if (currentYear && previousYear) {
              // Find previous year data
              const previousPeriodData = comparisonData.find(p => p.period === previousYear);
              const previousValue = previousPeriodData ? previousPeriodData[parameter] || 0 : 0;
              
              const growthPercentage = previousValue > 0 
                ? ((currentValue - previousValue) / previousValue) * 100 
                : 0;
              
              // Removed verbose console.log for performance
              
              growthData[parameter] = growthPercentage;
            }
          } else {
            // Fallback to default year calculation - use actual comparison values
            const currentYear = getCurrentFinancialYear();
            const previousYear = currentYear - 1;
            
            // Find previous year data
            const previousPeriodData = comparisonData.find(p => 
              p.period.includes(previousYear.toString())
            );
            const previousValue = previousPeriodData ? previousPeriodData[parameter] || 0 : 0;
            
            const growthPercentage = previousValue > 0 
              ? ((currentValue - previousValue) / previousValue) * 100 
              : 0;
            
            growthData[parameter] = growthPercentage;
          }
        }
      });
      
      return growthData;
    });
  };


  // Render comparison chart

  useEffect(() => {

    // Removed verbose console.log for performance
    
    if (data.length === 0 || selectedParametersForChart.length === 0 || !selectedBusinessUnitsForChart || activeChartTab !== 'growth') {
      // Removed verbose console.log for performance
      return;
    }
    
    
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

          categoryField: "businessUnit",

          renderer: am5xy.AxisRendererX.new(root, {}),

          tooltip: am5.Tooltip.new(root, {})

        })

      );

      xAxis.get("renderer").labels.template.setAll({

        fill: am5.color(0x000000),
        fontSize: 10

      });



      const yAxis = chart.yAxes.push(

        am5xy.ValueAxis.new(root, {

          renderer: am5xy.AxisRendererY.new(root, {}),

          tooltip: am5.Tooltip.new(root, {})

        })

      );

      yAxis.get("renderer").labels.template.setAll({

        fill: am5.color(0x000000),
        fontSize: 10

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



      // Helper function to get format for parameter (now showing actual values)
      const getParameterFormat = (param: string) => {
        if (param === 'Revenue' || param === 'GPM' || param === 'NP' || param === 'Team Cost' || 
            param === 'Salary Cost' || param === 'Opr Cost' || param === 'Funding Cost' || 
            param === 'Leave Encashment') {
          return {
            prefix: '',
            suffix: '',
            format: '#,##0'
          };
        } else if (param === 'GPM %' || param === 'NP %' || param === 'Team Cost % of Revenue') {
          return {
            prefix: '',
            suffix: '%',
            format: '#,##0.0'
          };
        } else if (param === 'HC') {
          return {
            prefix: '',
            suffix: '',
            format: '#,##0'
          };
        } else if (param === 'Cost Efficiency' || param === 'Revenue per HC' || param === 'NP per Team Cost' || param === 'GPM per HC') {
          // Efficiency metrics - show as decimal numbers
          return {
            prefix: '',
            suffix: '',
            format: '#,##0.00'
          };
        }
        return {
          prefix: '',
          suffix: '',
          format: '#,##0'
        };
      };

      // Helper function to get parameter value for a specific business unit and period
      // This bypasses the global selectedBusinessUnit filter to allow multiple business units in the chart
      const getParameterValueForBU = (businessUnit: string, periodValue: string | null, parameter: string): number => {
        if (!periodValue) return 0;
        
        // Filter data directly by business unit and period (without using global selectedBusinessUnit filter)
        let filteredData = data.filter(item => {
          // Filter by specific business unit
          const normalizedBU = normalizeBusinessUnitName(item.business_unit);
          if (!compareBusinessUnits(normalizedBU, businessUnit)) {
            return false;
          }
          
          // Apply client/BU head filters if set (for consistency with other components)
          if (selectedClientName) {
            if (selectedBusinessUnit === "Managed Services" || selectedBusinessUnit === "MS") {
              if (item.project_name !== selectedClientName) return false;
            } else {
              if (item.client_name !== selectedClientName) return false;
            }
          }
          
          if (isBUHead && user?.business_unit) {
            if (!compareBusinessUnits(item.business_unit, user.business_unit)) {
              return false;
            }
          }
          
          // Date parsing and period matching
          // Use chartFilterBy if set, otherwise use compareType
          const effectiveCompareType = chartFilterBy || compareType;
          const date = parseDate(item.month, item.year);
          if (isNaN(date.getTime())) return false;
          
          // Handle different period formats
          if (periodValue.includes('FY ')) {
            // Financial year format: FY 2025
            const targetYearMatch = periodValue.match(/(\d{4})/);
            if (!targetYearMatch) return false;
            
            const targetYear = parseInt(targetYearMatch[1]);
            const itemYear = date.getFullYear();
            const itemMonth = date.getMonth() + 1;
            
            // Financial year filtering: FY 2025 = April 2025 to March 2026
            return itemMonth >= 4 ? itemYear === targetYear : itemYear === targetYear + 1;
          } else if (periodValue.includes('Q')) {
            // Quarter format: Q1(Apr-Jun) 2025
            const quarterValue = getFiscalQuarter(date).label;
            return quarterValue === periodValue;
          } else {
            // Month format: January 2025
            const itemValue = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
            return itemValue === periodValue;
          }
        });
        
        if (filteredData.length === 0) return 0;
        
        // Handle efficiency metrics (calculated metrics)
        if (parameter === 'Cost Efficiency') {
          // Cost Efficiency = Team Cost / Net Margin (or NP)
          const totalTeamCost = filteredData.reduce((sum, item) => sum + (Number(item.team_cost) || 0), 0);
          const totalNP = filteredData.reduce((sum, item) => sum + (Number(item.np) || 0), 0);
          return totalNP !== 0 ? totalTeamCost / totalNP : 0;
        } else if (parameter === 'Revenue per HC') {
          // Revenue per HC = Revenue / HC
          const totalRevenue = filteredData.reduce((sum, item) => sum + (Number(item.revenue) || 0), 0);
          const totalHC = filteredData.reduce((sum, item) => sum + (Number(item.hc) || 0), 0);
          return totalHC !== 0 ? totalRevenue / totalHC : 0;
        } else if (parameter === 'NP per Team Cost') {
          // NP per Team Cost = NP / Team Cost
          const totalNP = filteredData.reduce((sum, item) => sum + (Number(item.np) || 0), 0);
          const totalTeamCost = filteredData.reduce((sum, item) => sum + (Number(item.team_cost) || 0), 0);
          return totalTeamCost !== 0 ? totalNP / totalTeamCost : 0;
        } else if (parameter === 'Team Cost % of Revenue') {
          // Team Cost % of Revenue = (Team Cost / Revenue) * 100
          const totalTeamCost = filteredData.reduce((sum, item) => sum + (Number(item.team_cost) || 0), 0);
          const totalRevenue = filteredData.reduce((sum, item) => sum + (Number(item.revenue) || 0), 0);
          return totalRevenue !== 0 ? (totalTeamCost / totalRevenue) * 100 : 0;
        } else if (parameter === 'GPM per HC') {
          // GPM per HC = GPM / HC
          const totalGPM = filteredData.reduce((sum, item) => sum + (Number(item.gpm) || 0), 0);
          const totalHC = filteredData.reduce((sum, item) => sum + (Number(item.hc) || 0), 0);
          return totalHC !== 0 ? totalGPM / totalHC : 0;
        }
        
        // For regular parameters, get parameter key and sum values
        const paramKey = parameter.toLowerCase().replace(/\s+/g, '_');
        
        // Sum values for this parameter
        return filteredData.reduce((sum, item) => {
          return sum + (parseFloat(item[paramKey]) || 0);
        }, 0);
      };

      // Get comparison periods - use chart filter if set, otherwise use main comparison values
      let periods: string[] = [];
      
      if (chartFilterBy && chartFilterValue.length > 0) {
        // Use chart-specific filter with multiple selection support
        if (chartFilterBy === 'year') {
          // For year filter, use selected years directly (no auto-comparison)
          periods = chartFilterValue.map(year => `FY ${year}`);
        } else if (chartFilterBy === 'quarter') {
          // For quarter filter, use selected quarters directly
          periods = chartFilterValue;
        } else if (chartFilterBy === 'month') {
          // For month filter, use selected months directly
          periods = chartFilterValue;
        }
      } else {
        // Default: use main comparison values (current FY vs previous FY)
        periods = comparisonValues.filter(Boolean) as string[];
      }
      
      // Prepare data: group by business unit, show periods as series
      // Only show selected business unit (single selection)
      if (!selectedBusinessUnitsForChart) {
        return;
      }
      
      // For BU heads, ensure only their business unit is shown
      const businessUnitToShow = isBUHead && user?.business_unit
        ? (() => {
            const normalizedBU = normalizeBusinessUnitName(user.business_unit);
            return compareBusinessUnits(selectedBusinessUnitsForChart, normalizedBU || user.business_unit) 
              ? selectedBusinessUnitsForChart 
              : (normalizedBU || user.business_unit);
          })()
        : selectedBusinessUnitsForChart;
      
      const chartData: any[] = [];
      const bu = businessUnitToShow;
      const dataPoint: any = { businessUnit: bu };
      
      // Calculate total value for sorting (sum across all periods and parameters)
      let totalValue = 0;
      
      // For each selected parameter, create a data point with values for each period
      selectedParametersForChart.forEach(parameter => {
        periods.forEach((period, periodIndex) => {
          const value = getParameterValueForBU(bu, period, parameter);
          // Create a field name like "FY 2025_Revenue" for each period-parameter combination
          dataPoint[`${period}_${parameter}`] = value;
          totalValue += Math.abs(value); // Use absolute value for sorting
        });
      });
      
      dataPoint._totalValue = totalValue; // Store total for sorting
      chartData.push(dataPoint);
      
      // Sort chart data if sort order is specified
      if (chartSortOrder) {
        chartData.sort((a, b) => {
          if (chartSortOrder === 'asc') {
            return a._totalValue - b._totalValue;
          } else {
            return b._totalValue - a._totalValue;
          }
        });
      }
      
      // Set X-axis data (business units)
      xAxis.data.setAll(chartData.map(item => ({ businessUnit: item.businessUnit })));
      
      // Create series: one series per period-parameter combination
      // For bar chart, we'll show one series per period (grouping parameters)
      if (chartType === 'bar' || chartType === 'combo') {
        periods.forEach((period, periodIndex) => {
          selectedParametersForChart.forEach((parameter, paramIndex) => {
            const format = getParameterFormat(parameter);
            const seriesKey = `${period}_${parameter}`;
            const seriesColor = colors[(periodIndex * selectedParametersForChart.length + paramIndex) % colors.length];
            
            const series = chart.series.push(
              am5xy.ColumnSeries.new(root, {
                name: `${period} - ${parameter}`,
                xAxis: xAxis,
                yAxis: yAxis,
                valueYField: seriesKey,
                categoryXField: "businessUnit"
              })
            );

            series.columns.template.setAll({
              width: am5.percent(80 / (periods.length * selectedParametersForChart.length)),
              strokeOpacity: 0,
              cornerRadiusTL: 5,
              cornerRadiusTR: 5,
              tooltipY: 0,
              fill: seriesColor
            });

            series.columns.template.states.create("hover", {
              fill: seriesColor,
              stroke: am5.color(0x1890ff)
            });

            // Add data labels to bars showing only values in crore/lakh format
            series.bullets.push(() => {
              const label = am5.Label.new(root, {
                text: "{valueY}",
                fill: am5.color(0x000000),
                centerX: am5.p50,
                centerY: am5.p100,
                populateText: true,
                fontSize: 10,
                fontWeight: "500",
                dy: -5
              });
              
              // Adapter to format value in crore/lakh
              label.adapters.add("text", (text: string | undefined, target: any) => {
                if (!text) return text || "";
                const dataItem = target.dataItem;
                if (dataItem) {
                  const dataContext = dataItem.dataContext as any;
                  if (dataContext) {
                    const seriesKey = `${period}_${parameter}`;
                    const value = dataContext[seriesKey];
                    if (value != null && !isNaN(Number(value))) {
                      const numValue = Number(value);
                      // Check if this parameter should use crore/lakh formatting
                      const shouldFormat = parameter === 'Revenue' || parameter === 'GPM' || parameter === 'NP' || 
                                         parameter === 'Team Cost' || 
                                         parameter === 'Salary Cost' || parameter === 'Opr Cost' || 
                                         parameter === 'Funding Cost' || parameter === 'Leave Encashment';
                      
                      if (shouldFormat && Math.abs(numValue) >= 100000) {
                        // Format in crore/lakh based on toggle
                        if (isCroreMode) {
                          return `${(numValue / 10000000).toFixed(1)}Cr`;
                        } else {
                          return `${(numValue / 100000).toFixed(1)}L`;
                        }
                      } else if (shouldFormat) {
                        // For smaller values, show as is
                        return numValue.toLocaleString('en-IN', { maximumFractionDigits: 0 });
                      } else {
                        // For other parameters (HC, percentages, etc.), use original format
                        return `${format.prefix}${numValue.toLocaleString('en-IN', { 
                          minimumFractionDigits: format.format.includes('.') ? 2 : 0,
                          maximumFractionDigits: format.format.includes('.') ? 2 : 0
                        })}${format.suffix}`;
                      }
                    }
                  }
                }
                return text;
              });
              
              return am5.Bullet.new(root, { sprite: label });
            });

            series.appear(1000, 100 * (periodIndex * selectedParametersForChart.length + paramIndex));
          });
        });
      }

      if (chartType === 'line' || chartType === 'combo') {
        periods.forEach((period, periodIndex) => {
          selectedParametersForChart.forEach((parameter, paramIndex) => {
            const format = getParameterFormat(parameter);
            const seriesKey = `${period}_${parameter}`;
            const seriesColor = colors[(periodIndex * selectedParametersForChart.length + paramIndex) % colors.length];
            
            const lineSeries = chart.series.push(
              am5xy.LineSeries.new(root, {
                name: `${period} - ${parameter}`,
                xAxis: xAxis,
                yAxis: yAxis,
                valueYField: seriesKey,
                categoryXField: "businessUnit"
              })
            );

          lineSeries.strokes.template.setAll({
            strokeWidth: 3,
            stroke: seriesColor
          });

          lineSeries.bullets.push(() => {
            return am5.Bullet.new(root, {
              sprite: am5.Circle.new(root, {
                radius: 5,
                fill: seriesColor,
                stroke: am5.color(0xffffff),
                strokeWidth: 2
              })
            });
          });

          lineSeries.bullets.push(() => {
            const label = am5.Label.new(root, {
              text: "{valueY}",
              fill: am5.color(0x000000),
              centerX: am5.p50,
              centerY: am5.p100,
              populateText: true,
              fontSize: 10,
              fontWeight: "500",
              dy: -10
            });
            
            // Adapter to format value in crore/lakh
            label.adapters.add("text", (text: string | undefined, target: any) => {
              if (!text) return text || "";
              const dataItem = target.dataItem;
              if (dataItem) {
                const dataContext = dataItem.dataContext as any;
                if (dataContext) {
                  const seriesKey = `${period}_${parameter}`;
                  const value = dataContext[seriesKey];
                  if (value != null && !isNaN(Number(value))) {
                    const numValue = Number(value);
                    // Check if this parameter should use crore/lakh formatting
                    const shouldFormat = parameter === 'Revenue' || parameter === 'GPM' || parameter === 'NP' || 
                                       parameter === 'Team Cost' || 
                                       parameter === 'Salary Cost' || parameter === 'Opr Cost' || 
                                       parameter === 'Funding Cost' || parameter === 'Leave Encashment';
                    
                    if (shouldFormat && Math.abs(numValue) >= 100000) {
                      // Format in crore/lakh based on toggle
                      if (isCroreMode) {
                        return `${(numValue / 10000000).toFixed(1)}Cr`;
                      } else {
                        return `${(numValue / 100000).toFixed(1)}L`;
                      }
                    } else if (shouldFormat) {
                      // For smaller values, show as is
                      return numValue.toLocaleString('en-IN', { maximumFractionDigits: 0 });
                    } else {
                      // For other parameters (HC, percentages, etc.), use original format
                      return `${format.prefix}${numValue.toLocaleString('en-IN', { 
                        minimumFractionDigits: format.format.includes('.') ? 2 : 0,
                        maximumFractionDigits: format.format.includes('.') ? 2 : 0
                      })}${format.suffix}`;
                    }
                  }
                }
              }
              return text;
            });
            
            return am5.Bullet.new(root, { sprite: label });
          });

          lineSeries.strokes.template.states.create("hover", {
            strokeWidth: 4,
            stroke: seriesColor
          });

          lineSeries.appear(1000, 100 * (periodIndex * selectedParametersForChart.length + paramIndex));

          });

        });

      }



      // Add legend at the bottom, shifted to the right to avoid logo
      const legend = chart.children.push(
        am5.Legend.new(root, {
          x: am5.percent(10),
          y: am5.p100,
          layout: root.horizontalLayout,
          width: am5.percent(90),
          marginTop: 20,
          marginBottom: 10
        })
      );

      legend.labels.template.setAll({
        fill: am5.color(0x000000),
        fontSize: 10
      });

      legend.markers.template.setAll({
        width: 12,
        height: 12
      });

      legend.data.setAll(chart.series.values);

      // Add chart animation
      chart.appear(1000, 100);
      
      // Set chart data after all series are created (using sorted chartData)
      chart.series.values.forEach((series) => {
        series.data.setAll(chartData);
      });

    }, 100); // 100ms delay



    return () => {

      clearTimeout(timer);

      am5.array.each(am5.registry.rootElements, (root) => {

        if (root && root.dom && root.dom.id === "comparisonChart") root.dispose();

      });

    };

  }, [data, selectedParametersForChart, selectedBusinessUnitsForChart, chartType, activeChartTab, compareType, comparisonValues, isBUHead, user?.business_unit, selectedClientName, selectedBusinessUnit, chartFilterBy, chartFilterValue, chartSortOrder, isCroreMode]);


  // Render Waterfall Chart
  useEffect(() => {

    if (growthAnalysis.length === 0 || selectedParameters.length === 0 || activeChartTab !== 'waterfall') return;


    const timer = setTimeout(() => {

      const waterfallElement = document.getElementById("waterfallChart");
      if (!waterfallElement) {
        console.warn("Waterfall chart element not found");
        return;
      }
      
        // Cleanup existing chart

        am5.array.each(am5.registry.rootElements, (root) => {

        if (root && root.dom && root.dom.id === "waterfallChart") root.dispose();
        });



      const root = am5.Root.new("waterfallChart");
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



      // Get KPI data for waterfall
      const kpiDataForWaterfall = kpiData;
      
      // Create waterfall data
      const waterfallData = selectedParameters.map(parameter => {
        const kpi = kpiDataForWaterfall[parameter];
        if (!kpi) return null;
        
        return {
          category: parameter,
          value: kpi.currentFY - kpi.previousFY, // Growth amount
          previousValue: kpi.previousFY,
          currentValue: kpi.currentFY,
          color: kpi.isPositive ? am5.color(0x52c41a) : am5.color(0xff4d4f)
        };
      }).filter(Boolean);

      // Removed verbose console.log for performance

      // Create series
          const series = chart.series.push(

            am5xy.ColumnSeries.new(root, {

          name: "Growth Amount",
              xAxis: xAxis,

              yAxis: yAxis,

              valueYField: "value",

              categoryXField: "category",

              tooltip: am5.Tooltip.new(root, {

                pointerOrientation: "horizontal",

            labelText: "{categoryX}: {valueY.formatNumber('#,##0.00')}L",
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

                <div style="font-weight: 500; margin-bottom: 2px; color: #666666; font-size: 11px;">Growth Amount</div>
                <div style="font-weight: 700; color: #000000; font-size: 13px;">{valueY.formatNumber('#,##0.00')}L</div>
                  </div>

                `

              })

            })

          );



      // Configure columns
          series.columns.template.setAll({

            width: am5.percent(80),

            strokeOpacity: 0,

            cornerRadiusTL: 5,

            cornerRadiusTR: 5,

            tooltipY: 0

          });



      // Set colors based on positive/negative growth
          series.columns.template.adapters.add("fill", (fill, target) => {

            const dataItem = target.dataItem;

            if (dataItem && dataItem.dataContext) {

              return (dataItem.dataContext as any).color;

            }

            return fill;

          });



      // Set data
          xAxis.data.setAll(waterfallData);

          series.data.setAll(waterfallData);


      // Add animation
      series.appear(1000);
      chart.appear(1000, 100);
    }, 100);



    return () => {

      clearTimeout(timer);

        am5.array.each(am5.registry.rootElements, (root) => {

        if (root && root.dom && root.dom.id === "waterfallChart") root.dispose();
      });

    };

  }, [growthAnalysis, selectedParameters, activeChartTab]);


  return (

    <div style={{ padding: '0 8px', backgroundColor: '#e8f4f8', minHeight: '100vh', color: '#000000' }}>

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

          body, html {

            overflow-x: hidden !important;

            max-width: 100vw !important;

          }

          .ant-select {

            font-size: 10px !important;

          }

          .ant-select-selector {

            height: 28px !important;

            min-height: 28px !important;

          }

          .ant-select-selection-item {

            font-size: 10px !important;

            line-height: 26px !important;

          }

          .ant-select-selection-placeholder {

            font-size: 10px !important;

            line-height: 26px !important;

          }

          .ant-input {

            height: 28px !important;

            font-size: 10px !important;

          }

          .ant-select-dropdown {

            font-size: 10px !important;

          }

          .ant-select-item {

            font-size: 10px !important;

            padding: 4px 8px !important;

          }

        `}

      </style>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0.5rem 0.5rem 0.5rem 0.5rem', maxWidth: '100vw', overflow: 'hidden', minHeight: '60px' }}>

        <h2 style={{ 

          backgroundColor: '#000000', 

          color: '#ffffff', 

          padding: '6px 12px', 

          borderRadius: 4, 

          fontSize: 12, 

          fontWeight: 700, 

          margin: 0, 

          zIndex: 1,
          whiteSpace: 'nowrap'

        }}>Client MFS Comparison</h2>

        <div className="auth-buttons-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginRight: '20px' }}>

          <div style={{ display: 'flex', gap: '8px' }}>
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

            <button className="auth-button" onClick={() => navigate('/team-report/compare')}>
              MFS comparison
            </button>
            <button className="auth-button" onClick={() => navigate('/client-mfs-data')}>
              Data
            </button>
          </div>


        </div>

      </div>



      <div style={{ margin: "2px 8px 8px 8px", paddingTop: "0rem" }}>


        {/* Filters Section */}
  <div style={{ 

          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 4,
          marginBottom: 16,
          padding: 4,
          backgroundColor: '#f8f9fa',
          borderRadius: 8,
          border: '1px solid #e9ecef',
          minHeight: '60px'
  }}>

    {/* Business Unit Filter */}

          <div>
            <div style={{ 
              color: '#000000', 
              fontWeight: 600, 
              marginBottom: 4,
              fontSize: '10px'
            }}>
              Business Unit
            </div>
      <Select

        value={selectedBusinessUnit || ''}

        onChange={(value) => setSelectedBusinessUnit(value || null)}

              style={{ width: '100%' }}
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



    {/* Client Name / Project Name Filter - Enabled for team_report */}
          <div>
            <div style={{ 
              color: '#000000', 
              fontWeight: 600, 
              marginBottom: 4,
              fontSize: '10px'
            }}>
              {selectedBusinessUnit === "Managed Services" || selectedBusinessUnit === "MS" ? "Project Name" : "Client Name"}
            </div>
      <AutoComplete

        value={selectedClientName || ''}

        onChange={(value) => setSelectedClientName(value || null)}

        onSearch={handleClientNameSearch}

              style={{ width: '100%' }}
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



    {/* BU Head Filter - DISABLED for team_summary_report */}
    {/* 
          <div>
            <div style={{ 
              color: '#000000', 
              fontWeight: 600, 
              marginBottom: 4,
              fontSize: '10px'
            }}>
              BU Head
            </div>
      <Select

        value={selectedBUHead || ''}

        onChange={(value) => setSelectedBUHead(value || null)}

              style={{ width: '100%' }}
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
    */}

    
    
    {/* Parameter Selector */}

          <div>
            <div style={{ 
              color: '#000000', 
              fontWeight: 600, 
              marginBottom: 4,
              fontSize: '10px'
            }}>
              Compare Parameters
            </div>
      <Select

        mode="multiple"

        value={selectedParameters}

        onChange={(value) => setSelectedParameters(value)}

              style={{ width: '100%' }}
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

          <div>
            <div style={{ 
              color: '#000000', 
              fontWeight: 600, 
              marginBottom: 4,
              fontSize: '10px'
            }}>
              Chart Type
            </div>
      <Select

        value={chartType}

        onChange={(value: 'bar' | 'line' | 'combo') => setChartType(value)}

              style={{ width: '100%' }}
      >

        <Option value="bar">Bar Chart</Option>

        <Option value="line">Line Chart</Option>

        <Option value="combo">Combo Chart</Option>

      </Select>

    </div>



    {/* Compare Type Selector */}

          <div>
            <div style={{ 
              color: '#000000', 
              fontWeight: 600, 
              marginBottom: 4,
              fontSize: '10px'
            }}>
              Compare by
            </div>
      <Select

        value={compareType}

        onChange={(value: CompareType) => {

          setCompareType(value);

          setComparisonValues([null, null]);

        }}

              style={{ width: '100%' }}
        disabled={isLoading}

      >

        <Option value="year">Year</Option>

        <Option value="quarter">Quarter</Option>

        <Option value="month">Month</Option>

      </Select>

    </div>

  </div>

       
         {/* Period Selectors */}

  <div style={{ marginBottom: 16, marginTop: 1 }}>

    <label style={{ color: '#000000', fontSize: '10px' }}>Comparison Periods ({compareType}):</label>

    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4, alignItems: 'center' }}>

      {comparisonValues.map((value, index) => (

        <div key={index} style={{ display: 'flex', alignItems: 'center', minWidth: 200, width: '200px' }}>

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


      {/* KPI Stats Dashboard */}
      {data.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          {/* KPI Dashboard Header */}
          <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div>
              <div style={{ 
                backgroundColor: '#000000', 
                color: '#ffffff', 
                padding: '6px 12px', 
                borderRadius: 4, 
                fontSize: 10, 
                fontWeight: 700,
                display: 'inline-block',
                marginBottom: 4
              }}>
                KPI Dashboard
              </div>
              <div style={{ 
                width: 100, 
                height: 3, 
                backgroundColor: '#ff6b35',
                borderRadius: 2
              }} />
            </div>
            
            {/* Crore/Lakh Toggle Button */}
            <button 
              onClick={() => setIsCroreMode(!isCroreMode)}
              style={{
                padding: '4px 8px',
                fontSize: '10px',
                backgroundColor: isCroreMode ? '#1890ff' : '#52c41a',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '600',
                height: 'fit-content'
              }}
            >
              {isCroreMode ? 'Crore' : 'Lakh'}
            </button>
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
            marginBottom: 16
          }}>
            {(() => {
              const kpis = kpiData;
              const mainKPIs = ['Revenue', 'GPM', 'Team Cost', 'NP'];
              // Filter out GPM % and NP % from all KPIs
              // Always show only the 4 main KPIs (no "Show More" button)
              const displayKPIs = mainKPIs;
              
              return (
                <>
                  {displayKPIs.map((kpiName) => {
                const kpi = kpis[kpiName];
                if (!kpi) return null;
                
                const formatValue = (value: number) => {
                  // Ensure value is a valid number
                  const numValue = typeof value === 'number' && !isNaN(value) ? value : 0;
                  
                  // Format large values (currency-like) with toggle
                  const largeValueParams = ['Revenue', 'GPM', 'Team Cost', 'NP', 'Salary Cost', 'Leave Encashment', 'Opr Cost', 'Funding Cost', 'Rebate', 'Passthrough'];
                  if (largeValueParams.includes(kpiName)) {
                    return formatValueWithToggle(numValue, true);
                  }
                  // Format percentages
                  if (kpiName === 'GPM %' || kpiName === 'NP %') {
                    return `${numValue.toFixed(2)}%`;
                  }
                  // Format HC as integer
                  if (kpiName === 'HC') {
                    return numValue.toFixed(0);
                  }
                  return numValue.toFixed(2);
                };
                
                return (
                  <div key={kpiName} style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 8,
                    padding: 8,
                    border: '1px solid #d9d9d9',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    position: 'relative'
                  }}>
                    {/* Black Label with Orange Line */}
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ 
                        backgroundColor: '#000000', 
                        color: '#ffffff', 
                        padding: '4px 8px', 
                        borderRadius: 4, 
                        fontSize: 12, 
                        fontWeight: 600,
                        display: 'inline-block',
                        marginBottom: 2
                      }}>
                        {kpiName} Analysis
                      </div>
                      <div style={{ 
                        width: 60, 
                        height: 2, 
                        backgroundColor: '#ff6b35',
                        borderRadius: 1
                      }} />
                    </div>

                    {/* Green Arrow Icon */}
                    <div style={{
                      position: 'absolute',
                      top: 20,
                      right: 20,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center'
                    }}>
                      <div style={{
                        width: 0,
                        height: 0,
                        borderLeft: '8px solid transparent',
                        borderRight: '8px solid transparent',
                        borderBottom: '12px solid #4ade80',
                        marginBottom: 2
                      }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <div style={{ width: 8, height: 1, backgroundColor: '#4ade80', borderRadius: 1 }} />
                        <div style={{ width: 6, height: 1, backgroundColor: '#4ade80', borderRadius: 1 }} />
                        <div style={{ width: 4, height: 1, backgroundColor: '#4ade80', borderRadius: 1 }} />
                      </div>
                    </div>

                    {/* Main Growth Percentage */}
                    <div style={{ 
                      fontSize: 12, 
                      fontWeight: 700, 
                      color: kpi.growthPercentage >= 0 ? '#4ade80' : '#ff4d4f', 
                      marginBottom: 4,
                      textAlign: 'center'
                    }}>
                      {(() => {
                        const growth = typeof kpi.growthPercentage === 'number' && !isNaN(kpi.growthPercentage) ? kpi.growthPercentage : 0;
                        return `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}% Growth`;
                      })()}
                    </div>

                    {/* Change in Value */}
                    <div style={{ 
                      fontSize: 12, 
                      fontWeight: 600, 
                      color: kpi.currentFY - kpi.previousFY >= 0 ? '#4ade80' : '#ff4d4f', 
                      marginBottom: 4,
                      textAlign: 'center'
                    }}>
                      {kpi.currentFY - kpi.previousFY >= 0 ? '+' : ''}{formatValue(kpi.currentFY - kpi.previousFY)}
                    </div>

                    {/* Dynamic comparison period text */}
                    <div style={{ 
                      fontSize: 8, 
                      color: '#666666', 
                      marginBottom: 8,
                      textAlign: 'center'
                    }}>
                      {(() => {
                        if (compareType === 'quarter' && comparisonValues[1]) {
                          return `vs ${comparisonValues[1]}`;
                        } else if (compareType === 'year' && comparisonValues[1]) {
                          return `vs ${comparisonValues[1]}`;
                        } else {
                          return `vs ${comparisonValues[1] || 'Previous Period'}`;
                        }
                      })()}
                    </div>

                    {/* KPI Label */}
                    <div style={{ 
                      display: 'flex',
                      gap: 8,
                      marginBottom: 12,
                      alignItems: 'center',
                      flexWrap: 'wrap'
                    }}>
                      <div style={{ 
                        backgroundColor: '#f5f5f5', 
                        color: '#666666', 
                        padding: '4px 8px', 
                        borderRadius: 4, 
                        fontSize: 10, 
                        fontWeight: 500,
                        display: 'inline-block'
                      }}>
                        {kpiName}
                      </div>
                      {kpiName === 'Revenue' && (
                        <div style={{ 
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          <div style={{ 
                            backgroundColor: '#f5f5f5', 
                            color: '#666666', 
                            padding: '4px 8px', 
                            borderRadius: 4, 
                            fontSize: 10, 
                            fontWeight: 500,
                            display: 'inline-block'
                          }}>
                            Routing
                          </div>
                          <span style={{ fontSize: 8, color: '#666666' }}>(Alchemy Billing)</span>
                        </div>
                      )}
                      {kpiName === 'GPM' && (
                        <div style={{ 
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          <div style={{ 
                            backgroundColor: '#f5f5f5', 
                            color: '#666666', 
                            padding: '4px 8px', 
                            borderRadius: 4, 
                            fontSize: 10, 
                            fontWeight: 500,
                            display: 'inline-block'
                          }}>
                            Routing
                          </div>
                          <span style={{ fontSize: 8, color: '#666666' }}>(Alchemy billing - Vendor invoice amount)</span>
                        </div>
                      )}
                      {kpiName === 'NP' && (
                        <div style={{ 
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          <div style={{ 
                            backgroundColor: '#f5f5f5', 
                            color: '#666666', 
                            padding: '4px 8px', 
                            borderRadius: 4, 
                            fontSize: 10, 
                            fontWeight: 500,
                            display: 'inline-block'
                          }}>
                            Routing
                          </div>
                          <span style={{ fontSize: 8, color: '#666666' }}>(Net Margin)</span>
                        </div>
                      )}
                    </div>

                    {/* Period line at top: FY 2025 (Apr - Nov) (Projected) | 186.8Cr FY 2024 - so layman understands comparison */}
                    <div style={{ 
                      fontSize: 11, 
                      fontWeight: 600,
                      color: '#333333', 
                      marginBottom: 8,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'nowrap'
                    }}>
                      <span style={{ whiteSpace: 'nowrap' }}>{(() => {
                        if (compareType === 'month' && comparisonValues[0]) {
                          return `${comparisonValues[0]} (Projected)`;
                        } else if (compareType === 'quarter' && comparisonValues[0]) {
                          return `${comparisonValues[0]} (Projected)`;
                        } else {
                          return `${getMonthRangeForFY(comparisonValues[0] || 'FY 2025')} (Projected)`;
                        }
                      })()}</span>
                      <span style={{ whiteSpace: 'nowrap' }}>{formatValue(kpi.previousFY)} {(() => {
                        if (compareType === 'month' && comparisonValues[1]) {
                          return comparisonValues[1];
                        } else if (compareType === 'quarter' && comparisonValues[1]) {
                          return comparisonValues[1];
                        } else {
                          return 'FY 2024';
                        }
                      })()}</span>
                    </div>

                    {/* Current FY Value */}
                    <div style={{ 
                      fontSize: 12, 
                      fontWeight: 700, 
                      color: '#333333', 
                      marginBottom: 2
                    }}>
                      {formatValue(kpi.currentFY)}
                      {kpiName === 'Revenue' && (() => {
                        const routingBilling = calculateRoutingBilling();
                        const total = kpi.currentFY + routingBilling;
                        return (
                          <>
                            {' '}+ {formatValue(routingBilling)} = {formatValue(total)}
                          </>
                        );
                      })()}
                      {kpiName === 'GPM' && (() => {
                        const routingMargin = calculateRoutingMargin();
                        const total = kpi.currentFY + routingMargin;
                        return (
                          <>
                            {' '}+ {formatValue(routingMargin)} = {formatValue(total)}
                          </>
                        );
                      })()}
                      {kpiName === 'NP' && (() => {
                        const routingNetMargin = calculateRoutingNetMargin();
                        const total = kpi.currentFY + routingNetMargin;
                        return (
                          <>
                            {' '}+ {formatValue(routingNetMargin)} = {formatValue(total)}
                          </>
                        );
                      })()}
                    </div>

                    {/* Projection Details */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: 8
                    }}>
                      <div style={{ 
                        width: 8, 
                        height: 8, 
                        borderRadius: '50%', 
                        backgroundColor: '#4ade80'
                      }} />
                      <div style={{ 
                        fontSize: 8, 
                        color: '#666666'
                      }}>
                        {(() => {
                          if (compareType === 'quarter') {
                            return comparisonValues[0] || 'Quarter data';
                          } else if (compareType === 'year') {
                            return comparisonValues[0] || 'Year data';
                          } else {
                            return kpi.monthsRemaining > 0 ? `Projected for 7 months` : 'Full year data';
                          }
                        })()}
                      </div>
                    </div>

                    {/* Actual + Predicted = Metric (one row, no wrap) */}
                    {kpi.monthsRemaining > 0 && (
                      <div style={{ 
                        fontSize: 11, 
                        fontWeight: 600,
                        color: '#333333',
                        marginBottom: 8,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        Actual ({formatValue(kpi.currentFYActual)}) + Predicted ({formatValue(kpi.projectedAmount)}) = {kpiName} ({formatValue(kpi.currentFY)})
                      </div>
                    )}

                    {/* Progress Bar */}
                    <div style={{ marginBottom: 4 }}>
                      <div style={{
                        width: '100%',
                        height: 6,
                        backgroundColor: '#e5e5e5',
                        borderRadius: 3,
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${(kpi.monthsCompleted / 12) * 100}%`,
                          height: '100%',
                          backgroundColor: '#4ade80',
                          borderRadius: 3
                        }} />
                      </div>
                    </div>

                    {/* Months Completed */}
                    <div style={{ 
                      fontSize: 8, 
                      color: '#666666',
                      textAlign: 'center'
                    }}>
                    </div>
                  </div>
                );
                  })}
                  {/* Show More KPIs button removed - only 4 main KPIs are always shown */}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {isLoading ? (

        <div style={{ textAlign: 'center', padding: 40, color: '#000000' }}>Loading data...</div>

      ) : selectedParameters.length > 0 && comparisonValues.some(v => v) ? (

        comparisonData.length > 0 ? (

          <>

            {/* Chart Tabs */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ 
                display: 'flex', 
                borderBottom: '2px solid #e8e8e8',
                marginBottom: 20
              }}>
                <button
                  onClick={() => setActiveChartTab('growth')}
                  style={{
                    padding: '12px 24px',
                    border: 'none',
                    backgroundColor: activeChartTab === 'growth' ? '#1890ff' : 'transparent',
                    color: activeChartTab === 'growth' ? 'white' : '#666',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: activeChartTab === 'growth' ? 'bold' : 'normal',
                    borderTopLeftRadius: '6px',
                    borderTopRightRadius: '6px',
                    marginRight: '2px'
                  }}
                >
                  Parameter Data Chart
                </button>
                <button
                  onClick={() => setActiveChartTab('waterfall')}
                  style={{
                    padding: '12px 24px',
                    border: 'none',
                    backgroundColor: activeChartTab === 'waterfall' ? '#1890ff' : 'transparent',
                    color: activeChartTab === 'waterfall' ? 'white' : '#666',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: activeChartTab === 'waterfall' ? 'bold' : 'normal',
                    borderTopLeftRadius: '6px',
                    borderTopRightRadius: '6px',
                    marginRight: '2px'
                  }}
                >
                  Waterfall Analysis
                </button>
              </div>

              {/* Parameter Data Chart */}
              {activeChartTab === 'growth' && (
            <div style={{ width: "100%" }}>
                  {/* Filter Dropdowns */}
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
                    {/* Business Unit Filter */}
                    <div style={{ flex: '1', minWidth: '200px' }}>
                      <div style={{ 
                        color: '#000000', 
                        fontWeight: 600, 
                        marginBottom: 4,
                        fontSize: '12px'
                      }}>
                        Business Unit
                      </div>
                      <Select
                        value={selectedBusinessUnitsForChart}
                        onChange={(value) => setSelectedBusinessUnitsForChart(value)}
                        style={{ width: '100%' }}
                        placeholder="Select business unit"
                        loading={isLoading}
                        allowClear={!isBUHead}
                        disabled={isBUHead}
                        showSearch
                        filterOption={(input, option) =>
                          (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                        }
                        optionFilterProp="children"
                      >
                        {(isBUHead && user?.business_unit 
                          ? businessUnits.filter(bu => {
                              const normalizedBU = normalizeBusinessUnitName(user.business_unit);
                              return compareBusinessUnits(bu, normalizedBU || user.business_unit);
                            })
                          : businessUnits
                        ).map((bu: string) => (
                          <Option key={bu} value={bu}>{bu}</Option>
                        ))}
                      </Select>
                    </div>
                    
                    {/* Parameter Filter */}
                    <div style={{ flex: '1', minWidth: '200px' }}>
                      <div style={{ 
                        color: '#000000', 
                        fontWeight: 600, 
                        marginBottom: 4,
                        fontSize: '12px'
                      }}>
                        Parameter
                      </div>
                      <Select
                        mode="multiple"
                        value={selectedParametersForChart}
                        onChange={(value) => setSelectedParametersForChart(value)}
                        style={{ width: '100%' }}
                        placeholder="Select parameters"
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
                    
                    {/* Date Filter - Filter By */}
                    <div style={{ flex: '1', minWidth: '200px' }}>
                      <div style={{ 
                        color: '#000000', 
                        fontWeight: 600, 
                        marginBottom: 4,
                        fontSize: '12px'
                      }}>
                        Filter By
                      </div>
                      <Select
                        value={chartFilterBy}
                        onChange={(value) => {
                          setChartFilterBy(value);
                          setChartFilterValue([]); // Reset filter value when filter type changes
                        }}
                        style={{ width: '100%' }}
                        placeholder="Select filter type"
                        allowClear
                      >
                        <Option value="year">Year</Option>
                        <Option value="quarter">Quarter</Option>
                        <Option value="month">Month</Option>
                      </Select>
                    </div>
                    
                    {/* Date Filter - Filter Value */}
                    {chartFilterBy && (
                      <div style={{ flex: '1', minWidth: '200px' }}>
                        <div style={{ 
                          color: '#000000', 
                          fontWeight: 600, 
                          marginBottom: 4,
                          fontSize: '12px'
                        }}>
                          {chartFilterBy === 'year' ? 'Year' : chartFilterBy === 'quarter' ? 'Quarter' : 'Month'}
                        </div>
                        <Select
                          mode="multiple"
                          value={chartFilterValue}
                          onChange={(value) => setChartFilterValue(value || [])}
                          style={{ width: '100%' }}
                          placeholder={`Select ${chartFilterBy}(s)`}
                          allowClear
                        >
                          {chartFilterBy === 'year' && getAvailableYears().map(year => (
                            <Option key={year} value={String(year)}>FY {year}</Option>
                          ))}
                          {chartFilterBy === 'quarter' && getAvailableQuarters().map(quarter => (
                            <Option key={quarter} value={quarter}>{quarter}</Option>
                          ))}
                          {chartFilterBy === 'month' && getAvailableMonths().map(month => (
                            <Option key={month} value={month}>{month}</Option>
                          ))}
                        </Select>
                      </div>
                    )}
                    
                    {/* Sort Buttons */}
                    <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'flex-end' }}>
                      <div style={{ 
                        color: '#000000', 
                        fontWeight: 600, 
                        marginBottom: 4,
                        fontSize: '12px',
                        height: '20px'
                      }}>
                        Sort
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => setChartSortOrder(chartSortOrder === 'asc' ? null : 'asc')}
                          style={{
                            padding: '4px 8px',
                            border: '1px solid #d9d9d9',
                            backgroundColor: chartSortOrder === 'asc' ? '#1890ff' : '#ffffff',
                            color: chartSortOrder === 'asc' ? '#ffffff' : '#000000',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: chartSortOrder === 'asc' ? 'bold' : 'normal'
                          }}
                          title="Sort ascending (smallest to largest)"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => setChartSortOrder(chartSortOrder === 'desc' ? null : 'desc')}
                          style={{
                            padding: '4px 8px',
                            border: '1px solid #d9d9d9',
                            backgroundColor: chartSortOrder === 'desc' ? '#1890ff' : '#ffffff',
                            color: chartSortOrder === 'desc' ? '#ffffff' : '#000000',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: chartSortOrder === 'desc' ? 'bold' : 'normal'
                          }}
                          title="Sort descending (largest to smallest)"
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <h3 style={{ color: '#000000', marginBottom: '10px' }}>
                    {selectedParametersForChart.length > 0 ? selectedParametersForChart.join(', ') : 'Revenue'} Data Visualization
                  </h3>
              <div id="comparisonChart" style={{ width: "100%", height: "350px" }} />
            </div>
              )}

              {/* Waterfall Chart */}
              {activeChartTab === 'waterfall' && (
                <div style={{ width: "100%", height: "500px" }}>
                  <h3 style={{ color: '#000000' }}>Growth Amount Analysis (L)</h3>
                  <div id="waterfallChart" style={{ width: "100%", height: "100%" }} />
                </div>
              )}
            </div>


            {/* Growth Analysis Dashboard */}

            {comparisonValues.filter(Boolean).length >= 2 && growthAnalysis.length > 0 && (

              <div style={{ marginTop: 20 }}>

                <div style={{ 
                  backgroundColor: '#000000', 
                  color: '#ffffff', 
                  padding: '8px 16px', 
                  borderRadius: 4, 
                  fontSize: 12, 
                  fontWeight: 700,
                  display: 'inline-block',
                  marginBottom: 8,
                  borderBottom: '3px solid #ff8c00'
                }}>
                  Growth Analysis Report
                </div>

<p style={{ marginBottom: 8, color: '#000000', fontSize: 10 }}>

  Comparing {comparisonValues.filter(Boolean).join(' vs ')} for {selectedBusinessUnit || "All Business Units"}

  {selectedClientName && ` - ${selectedBusinessUnit === "Managed Services" || selectedBusinessUnit === "MS" ? "Project" : "Client"}: ${selectedClientName}`}

  {selectedBUHead && ` - BU Head: ${selectedBUHead}`}

</p>



<div style={{

  border: '1px solid #d9d9d9',

  borderRadius: 4,

  overflow: 'hidden',

  backgroundColor: '#e8f4f8'

}}>

  <table style={{ width: '100%', borderCollapse: 'collapse' }}>

    <thead>

      <tr style={{ backgroundColor: '#d8e8f0' }}>

        <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #d9d9d9', color: '#000000', fontSize: '10px' }}>Parameter</th>

        {comparisonValues.filter(Boolean).map((period, i) => {
          // Check if this is the default year comparison (current year vs previous year)
          const isDefaultYearComparison = compareType === 'year' && 
            comparisonValues.filter(Boolean).length === 2 &&
            i === 0; // Only show for first period (current year)
          
          // Check if this is the current FY period - use dynamic year detection
          const currentYear = getCurrentFinancialYear();
          const periodStr = period || '';
          const isCurrentFY = periodStr.includes(String(currentYear)) || 
                             (compareType === 'year' && i === 0 && periodStr.length > 0);
          
          return (
            <React.Fragment key={i}>
              <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #d9d9d9', color: '#000000', fontSize: '10px' }}>
                {isCurrentFY ? getMonthRangeForFY(period || '') : period || ''}
              </th>
              {/* Add Predicted and Sum columns only for default year comparison (current year vs previous year) */}
              {isDefaultYearComparison && isCurrentFY && (
                <>
                  <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #d9d9d9', color: '#000000', fontSize: '10px' }}>
                    Predicted
                  </th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #d9d9d9', color: '#000000', fontSize: '10px' }}>
                    Sum (Actual + Predicted)
                  </th>
                </>
              )}
            </React.Fragment>
          );
        })}

        <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #d9d9d9', color: '#000000', fontSize: '10px' }}>Absolute Change</th>

        <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #d9d9d9', color: '#000000', fontSize: '10px' }}>Growth %</th>


      </tr>

    </thead>

    <tbody>

      {(() => {
        const mainGrowthParams = ['HC', 'Revenue', 'GPM', 'NP']; // Show 4 main parameters initially
        // Exclude Team Cost, efficiency metrics, and NP % from growth analysis table
        // NP % is already displayed below NP values, so no need for separate row
        const efficiencyMetrics = [
          'Cost Efficiency',
          'Revenue per HC',
          'NP per Team Cost',
          'Team Cost % of Revenue',
          'GPM per HC'
        ];
        const allGrowthParams = growthAnalysis.filter(item => 
          item.parameter !== 'Team Cost' && 
          item.parameter !== 'NP %' && 
          !efficiencyMetrics.includes(item.parameter)
        );
        const additionalGrowthParams = allGrowthParams.filter(item => !mainGrowthParams.includes(item.parameter));
        const displayGrowthParams = showAllGrowthParams ? allGrowthParams : allGrowthParams.filter(item => mainGrowthParams.includes(item.parameter));
        
        return (
          <>
            {displayGrowthParams.map((item, index) => {

        // Calculate growth between current and previous period for each parameter
        // periodValues array matches comparisonValues order: [0] = first period, [1] = second period, etc.
        // Get all periodValues that have a period (amount can be 0, which is valid)
        const validPeriods = item.periodValues.filter(pv => pv.period);
        
        // For absolute change calculation, use Sum (Actual + Predicted) for current period
        // If we have 2 periods: [0] = FY 2025, [1] = FY 2024
        // Current = Sum amount (if available) or first period, Previous = last period (index length-1)
        let currentPeriodAmount = 0;
        let previousPeriodAmount = 0;
        
        // Use Sum amount if available (for year comparisons), otherwise use actual amount
        const sumAmount = (compareType === 'year' && item.sumAmount) ? item.sumAmount : 0;
        const firstPeriodActual = validPeriods[0]?.amount || 0;
        const firstAmount = sumAmount > 0 ? sumAmount : firstPeriodActual;
        
        if (validPeriods.length >= 2) {
          // We have at least 2 periods
          // Use Sum (Actual + Predicted) for current period if available
          currentPeriodAmount = typeof firstAmount === 'number' && !isNaN(firstAmount) ? firstAmount : 
                                (firstAmount !== null && firstAmount !== undefined ? parseFloat(String(firstAmount)) || 0 : 0);
          
          const lastAmount = validPeriods[validPeriods.length - 1]?.amount;
          previousPeriodAmount = typeof lastAmount === 'number' && !isNaN(lastAmount) ? lastAmount : 
                                 (lastAmount !== null && lastAmount !== undefined ? parseFloat(String(lastAmount)) || 0 : 0);
        } else if (validPeriods.length === 1) {
          // Only one period available
          currentPeriodAmount = typeof firstAmount === 'number' && !isNaN(firstAmount) ? firstAmount : 
                               (firstAmount !== null && firstAmount !== undefined ? parseFloat(String(firstAmount)) || 0 : 0);
          previousPeriodAmount = 0;
        }
        
        // Absolute change: current (Sum) - previous
        const absoluteChange = currentPeriodAmount - previousPeriodAmount;

        const growthPercentage = previousPeriodAmount !== 0 

          ? ((absoluteChange) / previousPeriodAmount) * 100 

          : currentPeriodAmount !== 0 ? Infinity : 0;

        const isPositive = absoluteChange >= 0;
        
        
        // Debug absolute change calculation (disabled for performance, enable if needed)
        // console.log(`🔍 Absolute Change Debug for ${item.parameter}:`, {
        //   parameter: item.parameter,
        //   currentPeriodAmount,
        //   previousPeriodAmount,
        //   absoluteChange,
        //   growthPercentage,
        //   isPositive,
        //   periodValues: item.periodValues.map(pv => ({ period: pv.period, amount: pv.amount }))
        // });



        return (

          <tr key={item.parameter} style={{ 

            backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9f9f9',

            borderBottom: '1px solid #d9d9d9',

            color: '#000000'

          }}>

            <td style={{ padding: '6px 8px', fontWeight: 500, color: '#000000', fontSize: '10px' }}>{item.parameter}</td>

            {item.periodValues.filter(pv => pv.period).map((pv, i) => {
              // Check if this is the default year comparison (current year vs previous year)
              const isDefaultYearComparison = compareType === 'year' && 
                comparisonValues.filter(Boolean).length === 2 &&
                i === 0; // Only show for first period (current year)
              
              // Check if this is the current FY period - use dynamic year detection
              const currentYear = getCurrentFinancialYear();
              const periodStr = pv.period || '';
              const isCurrentFY = periodStr.includes(String(currentYear)) || 
                                 (compareType === 'year' && i === 0 && periodStr.length > 0);
              
              return (
                <React.Fragment key={i}>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: '#000000', fontSize: '10px' }}>
                    <div>
                      {formatValueForTable(pv.amount, item.parameter)}
                    </div>
                    {item.parameter === 'GPM' && (
                      <div style={{ fontSize: '9px', color: '#666666', marginTop: '2px' }}>
                        {(() => {
                          const revenueItem = growthAnalysis.find(g => g.parameter === 'Revenue');
                          const revenue = revenueItem?.periodValues[i]?.amount || 0;
                          const revenueNum = typeof revenue === 'number' && !isNaN(revenue) ? revenue : 0;
                          const amountNum = typeof pv.amount === 'number' && !isNaN(pv.amount) ? pv.amount : 0;
                          const percentage = revenueNum > 0 ? ((amountNum / revenueNum) * 100).toFixed(2) : '0.00';
                          return `GPM %: ${percentage}%`;
                        })()}
                      </div>
                    )}
                    {item.parameter === 'Net Margin' && (
                      <div style={{ fontSize: '9px', color: '#666666', marginTop: '2px' }}>
                        {(() => {
                          const revenueItem = growthAnalysis.find(g => g.parameter === 'Revenue');
                          const revenue = revenueItem?.periodValues[i]?.amount || 0;
                          const revenueNum = typeof revenue === 'number' && !isNaN(revenue) ? revenue : 0;
                          const amountNum = typeof pv.amount === 'number' && !isNaN(pv.amount) ? pv.amount : 0;
                          const percentage = revenueNum > 0 ? ((amountNum / revenueNum) * 100).toFixed(2) : '0.00';
                          return `Net Margin %: ${percentage}%`;
                        })()}
                      </div>
                    )}
                    {item.parameter === 'NP' && (
                      <div style={{ fontSize: '9px', color: '#666666', marginTop: '2px' }}>
                        {(() => {
                          const npPercentageItem = growthAnalysis.find(g => g.parameter === 'NP %');
                          const npPercentage = npPercentageItem?.periodValues[i]?.amount || 0;
                          const npPercentageNum = typeof npPercentage === 'number' && !isNaN(npPercentage) ? npPercentage : 0;
                          return `NP %: ${npPercentageNum.toFixed(2)}%`;
                        })()}
                      </div>
                    )}
                  </td>
                  {/* Add Predicted and Sum columns only for default year comparison (current year vs previous year) */}
                  {isDefaultYearComparison && isCurrentFY && (
                    <>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: '#000000', fontSize: '10px' }}>
                        <div>
                          {formatValueForTable(item.predictedAmount || 0, item.parameter)}
                        </div>
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: '#000000', fontSize: '10px' }}>
                        <div>
                          {formatValueForTable(item.sumAmount || pv.amount, item.parameter)}
                        </div>
                      </td>
                    </>
                  )}
                </React.Fragment>
              );
            })}

            <td style={{ 

              padding: '6px 8px', 

              textAlign: 'right',

              color: isPositive ? '#4ade80' : '#f87171',
              fontSize: '10px',
              fontWeight: 'bold'

            }}>

              {isPositive ? '+' : ''}

              {formatValueForTable(absoluteChange, item.parameter)}

            </td>

            <td style={{ 

              padding: '6px 8px', 

              textAlign: 'right',

              color: isPositive ? '#4ade80' : '#f87171',

              fontWeight: 600,
              fontSize: '10px'

            }}>

              {isPositive ? '+' : ''}

              {(() => {
                const growth = typeof growthPercentage === 'number' && !isNaN(growthPercentage) && growthPercentage !== Infinity ? growthPercentage : 0;
                return growthPercentage === Infinity ? '∞' : growth.toFixed(2);
              })()}%

            </td>


          </tr>

        );

            })}
            {additionalGrowthParams.length > 0 && (
              <tr>
                <td colSpan={comparisonValues.filter(Boolean).length + 3} style={{ padding: '12px', textAlign: 'center', borderTop: '2px solid #d9d9d9' }}>
                  <button
                    onClick={() => setShowAllGrowthParams(!showAllGrowthParams)}
                    style={{
                      padding: '8px 24px',
                      fontSize: '12px',
                      fontWeight: 600,
                      backgroundColor: showAllGrowthParams ? '#ff6b35' : '#1890ff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    {showAllGrowthParams ? 'Show Less Parameters' : `Show More Parameters (${additionalGrowthParams.length} more)`}
                  </button>
                </td>
              </tr>
            )}
          </>
        );
      })()}

    </tbody>

  </table>

</div>



{/* Client Report - displays just after Growth Analysis, before button and Efficiency Dashboard */}
{showSummaryReport && (
  <div style={{ marginTop: 20, marginBottom: 20 }}>
    <div style={{
      backgroundColor: '#000000', 
      color: '#ffffff', 
      padding: '6px 12px', 
      borderRadius: 4, 
      fontSize: 10, 
      fontWeight: 700,
      display: 'inline-block',
      marginBottom: 8,
      borderBottom: '3px solid #ff8c00'
    }}>
      {selectedBusinessUnit ? `Client Report - ${selectedBusinessUnit}${selectedSummaryClient ? ` - ${selectedSummaryClient}` : ' - All Clients'}` : 'Client Report - All Business Units'}
    </div>
    
    {(() => {
      // If a business unit is selected, show client summaries; otherwise show business unit summaries
      if (selectedBusinessUnit) {
        // Get client names for the selected business unit
        const clientNamesForBU = Array.from(new Set(
          data
            .filter(item => compareBusinessUnits(item.business_unit, selectedBusinessUnit))
            .map(item => {
              // For MS business unit, use project_name, otherwise use client_name
              if (selectedBusinessUnit === 'MS' || selectedBusinessUnit === 'Managed Services') {
                return item.project_name;
              }
              return item.client_name;
            })
            .filter(Boolean)
        )).sort();
        
        // Filter by selected client if one is selected
        const clientsToShow = selectedSummaryClient 
          ? [selectedSummaryClient]
          : clientNamesForBU;
        
        if (clientsToShow.length === 0) {
          return <div style={{ color: '#000000', padding: 16, textAlign: 'center' }}>
            No client data available for selected business unit
          </div>;
        }
        
        // Helper function to get parameter value for specific client
        const getParameterValueForClient = (period: string, parameter: string, clientName: string) => {
          const filteredData = getFilteredDataByPeriod(period, compareType).filter(item => {
            // Business unit filter (case-insensitive comparison)
            if (!compareBusinessUnits(item.business_unit, selectedBusinessUnit)) return false;
            
            // BU head filter - ensure BU head only sees their business unit's data
            if (isBUHead && user?.business_unit) {
              if (!compareBusinessUnits(item.business_unit, user.business_unit)) return false;
            }
            // For MS, match project_name; otherwise match client_name
            if (selectedBusinessUnit === 'MS' || selectedBusinessUnit === 'Managed Services') {
              return item.project_name === clientName;
            }
            return item.client_name === clientName;
          });
          
          if (filteredData.length === 0) return 0;
          
          // Use the same logic as getParameterValueForBusinessUnit
          if (parameter === 'HC') {
            const validData = filteredData.filter(item => {
              const itemDate = parseDate(item.month, item.year);
              return !isNaN(itemDate.getTime());
            });
            
            if (validData.length === 0) return 0;
            
            const lastMonthData = validData.reduce((latest, item) => {
              const itemDate = parseDate(item.month, item.year);
              const latestDate = parseDate(latest.month, latest.year);
              return itemDate > latestDate ? item : latest;
            });
            
            const lastMonthDate = parseDate(lastMonthData.month, lastMonthData.year);
            return validData
              .filter(item => {
                const itemDate = parseDate(item.month, item.year);
                return itemDate.getMonth() === lastMonthDate.getMonth() && 
                       itemDate.getFullYear() === lastMonthDate.getFullYear();
              })
              .reduce((sum, item) => sum + (item.hc || 0), 0);
          }
          
          // GPM % and NP %: compute as (Total GPM/Total Revenue)*100 and (Total NP/Total Revenue)*100 per client
          if (parameter === 'GPM %' || parameter === 'NP %') {
            const monthlyRevenue: {[key: string]: number} = {};
            const monthlyGpm: {[key: string]: number} = {};
            const monthlyNp: {[key: string]: number} = {};
            filteredData.forEach(item => {
              const monthKey = `${item.month} ${item.year}`;
              if (!monthlyRevenue[monthKey]) {
                monthlyRevenue[monthKey] = 0;
                monthlyGpm[monthKey] = 0;
                monthlyNp[monthKey] = 0;
              }
              monthlyRevenue[monthKey] += (item.revenue || 0);
              monthlyGpm[monthKey] += (item.gpm || 0);
              monthlyNp[monthKey] += (item.np || 0);
            });
            const totalRevenue = Object.values(monthlyRevenue).reduce((sum: number, val: number) => sum + val, 0);
            const totalGpm = Object.values(monthlyGpm).reduce((sum: number, val: number) => sum + val, 0);
            const totalNp = Object.values(monthlyNp).reduce((sum: number, val: number) => sum + val, 0);
            if (parameter === 'GPM %') return totalRevenue !== 0 ? (totalGpm / totalRevenue) * 100 : 0;
            if (parameter === 'NP %') return totalRevenue !== 0 ? (totalNp / totalRevenue) * 100 : 0;
          }
          // For other parameters: aggregate by month first, then sum
          const monthlyTotals: {[key: string]: number} = {};
          filteredData.forEach(item => {
            const monthKey = `${item.month} ${item.year}`;
            if (!monthlyTotals[monthKey]) {
              monthlyTotals[monthKey] = 0;
            }
            
            // Map parameter names to database field names
            let fieldName = parameter.toLowerCase();
            if (parameter === 'Revenue') fieldName = 'revenue';
            if (parameter === 'Salary Cost') fieldName = 'salary_cost';
            if (parameter === 'GPM') fieldName = 'gpm';
            if (parameter === 'GPM %') fieldName = 'gpm_percentage';
            if (parameter === 'Team Cost') fieldName = 'team_cost';
            if (parameter === 'NP' || parameter === 'Net Margin') fieldName = 'np';
            if (parameter === 'NP %') fieldName = 'np_percentage';
            if (parameter === 'Leave Encashment') fieldName = 'leave_encashment';
            if (parameter === 'Opr Cost') fieldName = 'opr_cost';
            if (parameter === 'Funding Cost') fieldName = 'funding_cost';
            if (parameter === 'Rebate') fieldName = 'rebate';
            if (parameter === 'Passthrough') fieldName = 'passthrough';
            if (parameter === 'HC') fieldName = 'hc';
            
            monthlyTotals[monthKey] += (item[fieldName] || 0);
          });
          return Object.values(monthlyTotals).reduce((sum: number, val: number) => sum + val, 0);
        };
        
        // Calculate summary data for each client
        const clientSummaries = clientsToShow.filter((clientName): clientName is string => Boolean(clientName)).map(clientName => {
          const periods = comparisonValues.filter((p): p is string => Boolean(p));
          const periodData = periods.map((period: string) => {
            const revenue = getParameterValueForClient(period, 'Revenue', clientName);
            const gpm = getParameterValueForClient(period, 'GPM', clientName);
            const np = getParameterValueForClient(period, 'NP', clientName);
            const hc = getParameterValueForClient(period, 'HC', clientName);
            
            return { period, revenue, gpm, np, hc };
          });
          
          // Calculate growth metrics
          const currentPeriod = periodData[0];
          const previousPeriod = periodData[periodData.length - 1];
          
          // Calculate projections for each parameter (only for default year comparison)
          const isDefaultYearComparison = compareType === 'year' && periods.length === 2;
          let revenuePredicted = 0, revenueSum = currentPeriod.revenue;
          let gpmPredicted = 0, gpmSum = currentPeriod.gpm;
          let npPredicted = 0, npSum = currentPeriod.np;
          let hcPredicted = 0, hcSum = currentPeriod.hc;
          
          if (isDefaultYearComparison) {
            // Calculate projections for this specific client using the same logic as calculateKPIs
            const currentFY = getCurrentFinancialYear();
            const currentFYData = data.filter(item => {
              // Business unit filter (case-insensitive comparison)
              if (!compareBusinessUnits(item.business_unit, selectedBusinessUnit)) return false;
              
              // BU head filter - ensure BU head only sees their business unit's data
              if (isBUHead && user?.business_unit) {
                if (!compareBusinessUnits(item.business_unit, user.business_unit)) return false;
              }
              // For MS, match project_name; otherwise match client_name
              if (selectedBusinessUnit === 'MS' || selectedBusinessUnit === 'Managed Services') {
                if (item.project_name !== clientName) return false;
              } else {
                if (item.client_name !== clientName) return false;
              }
              const date = parseDate(item.month, item.year);
              if (isNaN(date.getTime())) return false;
              const itemYear = date.getFullYear();
              const itemMonth = date.getMonth() + 1;
              if (itemMonth >= 4) {
                return itemYear === currentFY;
              } else {
                return itemYear === currentFY + 1;
              }
            });
            
            // Calculate projections for each parameter (same logic as TeamReportCompare)
            const calculateProjection = (paramName: string) => {
              if (paramName === 'HC') {
                // HC doesn't need projection - use actual value
                return { predicted: 0, sum: currentPeriod.hc };
              }
              
              // Calculate monthly totals
              const monthlyTotals: {[key: string]: number} = {};
              currentFYData.forEach(item => {
                const monthKey = `${item.month} ${item.year}`;
                if (!monthlyTotals[monthKey]) {
                  monthlyTotals[monthKey] = 0;
                }
                
                let value = 0;
                switch (paramName) {
                  case 'Revenue': value = item.revenue || 0; break;
                  case 'GPM': value = item.gpm || 0; break;
                  case 'NP': value = item.np || 0; break;
                  default: value = 0;
                }
                monthlyTotals[monthKey] += value;
              });
              
              const actual = Object.values(monthlyTotals).reduce((sum: number, val: number) => sum + val, 0);
              
              if (Object.keys(monthlyTotals).length > 0) {
                const monthKeys = Object.keys(monthlyTotals);
                const sortedMonths = monthKeys.sort((a, b) => {
                  const [monthA, yearA] = a.split(' ');
                  const [monthB, yearB] = b.split(' ');
                  const dateA = parseDate(monthA, parseInt(yearA));
                  const dateB = parseDate(monthB, parseInt(yearB));
                  return dateA.getTime() - dateB.getTime();
                });
                
                // Find the last month with non-zero value (same logic as KPI dashboard)
                let lastMonthWithData = null;
                let lastMonthValue = 0;
                for (let i = sortedMonths.length - 1; i >= 0; i--) {
                  const monthKey = sortedMonths[i];
                  const value = monthlyTotals[monthKey] || 0;
                  if (value > 0) {
                    lastMonthWithData = monthKey;
                    lastMonthValue = value;
                    break;
                  }
                }
                
                if (lastMonthWithData && lastMonthValue > 0) {
                  // Use parseDate to handle month name variations (same as KPI dashboard)
                  const [lastMonthName, lastYearStr] = lastMonthWithData.split(' ');
                  const lastMonthDate = parseDate(lastMonthName, parseInt(lastYearStr));
                  
                  if (!isNaN(lastMonthDate.getTime())) {
                    // Financial year months: Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec, Jan, Feb, Mar (0-11 index)
                    const financialYearMonths = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
                    const monthIndex = lastMonthDate.getMonth(); // 0-11 (Jan=0, Dec=11)
                    
                    // Map calendar month to financial year month index
                    // Apr (month 3) = index 0, May (month 4) = index 1, ..., Mar (month 2) = index 11
                    let financialYearIndex = -1;
                    if (monthIndex >= 3) {
                      // Apr-Dec (months 3-11) map to indices 0-8
                      financialYearIndex = monthIndex - 3;
                    } else {
                      // Jan-Mar (months 0-2) map to indices 9-11
                      financialYearIndex = monthIndex + 9;
                    }
                    
                    // Calculate remaining months from the last month with data (+1 because index is 0-based)
                    const actualMonthsRemaining = 12 - (financialYearIndex + 1);
                    
                    // Project: actual + (last month value * remaining months)
                    const projected = actual + (lastMonthValue * actualMonthsRemaining);
                    return { predicted: projected - actual, sum: projected };
                  }
                  
                  // Fallback: if date parsing fails, calculate based on months completed
                  const monthsCompleted = Object.keys(monthlyTotals).length;
                  const actualMonthsRemaining = Math.max(0, 12 - monthsCompleted);
                  const projected = actual + (lastMonthValue * actualMonthsRemaining);
                  return { predicted: projected - actual, sum: projected };
                }
              }
              
              // If no projection can be calculated, return 0 predicted and actual as sum
              return { predicted: 0, sum: actual };
            };
            
            const revenueProj = calculateProjection('Revenue');
            revenuePredicted = revenueProj.predicted;
            revenueSum = revenueProj.sum;
            
            const gpmProj = calculateProjection('GPM');
            gpmPredicted = gpmProj.predicted;
            gpmSum = gpmProj.sum;
            
            const npProj = calculateProjection('NP');
            npPredicted = npProj.predicted;
            npSum = npProj.sum;
            
            // HC doesn't need projection
            hcPredicted = 0;
            hcSum = currentPeriod.hc;
          }
          
          // Use Sum values for change calculations when available
          const revenueChange = (isDefaultYearComparison && revenueSum > 0 ? revenueSum : currentPeriod.revenue) - previousPeriod.revenue;
          const gpmChange = (isDefaultYearComparison && gpmSum > 0 ? gpmSum : currentPeriod.gpm) - previousPeriod.gpm;
          const npChange = (isDefaultYearComparison && npSum > 0 ? npSum : currentPeriod.np) - previousPeriod.np;
          const hcChange = (isDefaultYearComparison && hcSum > 0 ? hcSum : currentPeriod.hc) - previousPeriod.hc;
          
          const revenueGrowth = previousPeriod.revenue > 0 ? (revenueChange / previousPeriod.revenue) * 100 : 0;
          const gpmGrowth = previousPeriod.gpm > 0 ? (gpmChange / previousPeriod.gpm) * 100 : 0;
          const npGrowth = previousPeriod.np > 0 ? (npChange / previousPeriod.np) * 100 : 0;
          const hcGrowth = previousPeriod.hc > 0 ? (hcChange / previousPeriod.hc) * 100 : 0;
          
          return {
            clientName,
            currentPeriod,
            previousPeriod,
            revenueChange,
            gpmChange,
            npChange,
            hcChange,
            revenueGrowth,
            gpmGrowth,
            npGrowth,
            hcGrowth,
            // Projection values
            revenuePredicted,
            revenueSum,
            gpmPredicted,
            gpmSum,
            npPredicted,
            npSum,
            hcPredicted,
            hcSum
          };
        });
        
        return (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse', 
              backgroundColor: '#ffffff',
              border: '2px solid #004a7a',
              fontSize: '10px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#d8e8f0' }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #d9d9d9', color: '#000000', fontSize: '10px' }}>Client Name</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #d9d9d9', color: '#000000', fontSize: '10px' }}>Parameter</th>
                  {comparisonValues.filter(Boolean).map((period, i) => {
                    // Check if this is the default year comparison
                    const isDefaultYearComparison = compareType === 'year' && 
                      comparisonValues.filter(Boolean).length === 2 &&
                      i === 0; // Only show for first period (current year)
                    
                    // Check if this is the current FY period - use dynamic year detection
                    const currentYear = getCurrentFinancialYear();
                    const periodStr = period || '';
                    const isCurrentFY = periodStr.includes(String(currentYear)) || 
                                       (compareType === 'year' && i === 0 && periodStr.length > 0);
                    
                    return (
                      <React.Fragment key={i}>
                        <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #d9d9d9', color: '#000000', fontSize: '10px' }}>
                          {isCurrentFY ? getMonthRangeForFY(period || '') : period || ''}
                        </th>
                        {/* Add Predicted and Sum columns only for default year comparison */}
                        {isDefaultYearComparison && isCurrentFY && (
                          <>
                            <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #d9d9d9', color: '#000000', fontSize: '10px' }}>
                              Predicted
                            </th>
                            <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #d9d9d9', color: '#000000', fontSize: '10px' }}>
                              Sum (Actual + Predicted)
                            </th>
                          </>
                        )}
                      </React.Fragment>
                    );
                  })}
                  <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #d9d9d9', color: '#000000', fontSize: '10px' }}>Absolute Change</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #d9d9d9', color: '#000000', fontSize: '10px' }}>Growth %</th>
                </tr>
              </thead>
              <tbody>
                {clientSummaries.map((summary, index) => {
                  const isDefaultYearComparison = compareType === 'year' && comparisonValues.filter(Boolean).length === 2;
                  
                  const parameters = [
                    { 
                      name: 'Revenue', 
                      current: summary.currentPeriod.revenue, 
                      previous: summary.previousPeriod.revenue, 
                      change: summary.revenueChange, 
                      growth: summary.revenueGrowth,
                      predicted: summary.revenuePredicted || 0,
                      sum: summary.revenueSum || summary.currentPeriod.revenue
                    },
                    { 
                      name: 'GPM', 
                      current: summary.currentPeriod.gpm, 
                      previous: summary.previousPeriod.gpm, 
                      change: summary.gpmChange, 
                      growth: summary.gpmGrowth,
                      predicted: summary.gpmPredicted || 0,
                      sum: summary.gpmSum || summary.currentPeriod.gpm
                    },
                    { 
                      name: 'NP', 
                      current: summary.currentPeriod.np, 
                      previous: summary.previousPeriod.np, 
                      change: summary.npChange, 
                      growth: summary.npGrowth,
                      predicted: summary.npPredicted || 0,
                      sum: summary.npSum || summary.currentPeriod.np
                    },
                    { 
                      name: 'HC', 
                      current: summary.currentPeriod.hc, 
                      previous: summary.previousPeriod.hc, 
                      change: summary.hcChange, 
                      growth: summary.hcGrowth,
                      predicted: summary.hcPredicted || 0,
                      sum: summary.hcSum || summary.currentPeriod.hc
                    }
                  ];
                  
                  return parameters.map((param, paramIndex) => {
                    const isEvenRow = (index * 4 + paramIndex) % 2 === 0;
                    const isPositive = param.change >= 0;
                    return (
                      <tr key={`${summary.clientName}-${param.name}`} style={{ 
                        backgroundColor: isEvenRow ? '#ffffff' : '#f9f9f9',
                        borderBottom: paramIndex === parameters.length - 1 ? '2px solid #004a7a' : '1px solid #d9d9d9',
                        color: '#000000'
                      }}>
                        {paramIndex === 0 && (
                          <td rowSpan={parameters.length} style={{ 
                            padding: '6px 8px', 
                            textAlign: 'left',
                            fontWeight: 'bold',
                            verticalAlign: 'top',
                            backgroundColor: '#e6f3ff',
                            borderRight: '2px solid #004a7a'
                          }}>
                            {summary.clientName}
                          </td>
                        )}
                        <td style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 'bold' }}>
                          {param.name}
                        </td>
                        {comparisonValues.filter(Boolean).map((period, i) => {
                          const isDefaultYearComparison = compareType === 'year' && 
                            comparisonValues.filter(Boolean).length === 2 &&
                            i === 0;
                          // Check if this is the current FY period - use dynamic year detection
                          const currentYear = getCurrentFinancialYear();
                          const periodStr = period || '';
                          const isCurrentFY = periodStr.includes(String(currentYear)) || 
                                             (compareType === 'year' && i === 0 && periodStr.length > 0);
                          
                          return (
                            <React.Fragment key={i}>
                              <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                                <div>
                                  {formatValueForTable(i === 0 ? param.current : param.previous, param.name)}
                                </div>
                                {param.name === 'GPM' && i === 0 && (
                                  <div style={{ fontSize: '9px', color: '#666666', marginTop: '2px' }}>
                                    {(() => {
                                      const revenue = summary.currentPeriod.revenue;
                                      const revenueNum = typeof revenue === 'number' && !isNaN(revenue) ? revenue : 0;
                                      const currentNum = typeof param.current === 'number' && !isNaN(param.current) ? param.current : 0;
                                      const percentage = revenueNum > 0 ? ((currentNum / revenueNum) * 100).toFixed(2) : '0.00';
                                      return `GPM %: ${percentage}%`;
                                    })()}
                                  </div>
                                )}
                                {param.name === 'NP' && i === 0 && (
                                  <div style={{ fontSize: '9px', color: '#666666', marginTop: '2px' }}>
                                    {(() => {
                                      // Calculate NP % from revenue and NP for this client and period
                                      const revenue = i === 0 ? summary.currentPeriod.revenue : summary.previousPeriod.revenue;
                                      const np = i === 0 ? summary.currentPeriod.np : summary.previousPeriod.np;
                                      const revenueNum = typeof revenue === 'number' && !isNaN(revenue) ? revenue : 0;
                                      const npNum = typeof np === 'number' && !isNaN(np) ? np : 0;
                                      const percentage = revenueNum > 0 ? ((npNum / revenueNum) * 100).toFixed(2) : '0.00';
                                      return `NP %: ${percentage}%`;
                                    })()}
                                  </div>
                                )}
                              </td>
                              {/* Add Predicted and Sum columns only for default year comparison */}
                              {isDefaultYearComparison && isCurrentFY && (
                                <>
                                  <td style={{ padding: '6px 8px', textAlign: 'right', color: '#000000', fontSize: '10px' }}>
                                    <div>
                                      {formatValueForTable(param.predicted, param.name)}
                                    </div>
                                  </td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right', color: '#000000', fontSize: '10px' }}>
                                    <div>
                                      {formatValueForTable(param.sum, param.name)}
                                    </div>
                                  </td>
                                </>
                              )}
                            </React.Fragment>
                          );
                        })}
                        <td style={{ 
                          padding: '6px 8px', 
                          textAlign: 'right',
                          color: isPositive ? '#4ade80' : '#f87171',
                          fontWeight: 'bold'
                        }}>
                          {isPositive ? '+' : ''}
                          {formatValueForTable(param.change, param.name)}
                        </td>
                        <td style={{ 
                          padding: '6px 8px', 
                          textAlign: 'right',
                          color: isPositive ? '#4ade80' : '#f87171',
                          fontWeight: 'bold'
                        }}>
                          {isPositive ? '+' : ''}
                          {(() => {
                            const growth = typeof param.growth === 'number' && !isNaN(param.growth) ? param.growth : 0;
                            return growth.toFixed(2);
                          })()}%
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        );
      }
      
      // Default: Show business unit summaries (when no business unit is selected)
      // Get all unique business units
      const allBusinessUnitsSet = new Set<string>();
      data.forEach(item => {
        if (item.business_unit) {
          const normalized = normalizeBusinessUnitName(item.business_unit);
          if (normalized) {
            allBusinessUnitsSet.add(normalized);
          }
        }
      });
      const allBusinessUnits = Array.from(allBusinessUnitsSet).sort();
      
      if (allBusinessUnits.length === 0) {
        return <div style={{ color: '#000000', padding: 16, textAlign: 'center' }}>
          No business unit data available
        </div>;
      }
      
      // Helper function to get parameter value for specific business unit using unified logic
      const getParameterValueForBusinessUnit = (period: string, parameter: string, businessUnit: string) => {
        const filteredData = getFilteredDataByPeriod(period, compareType).filter(item => item.business_unit === businessUnit);
        
        if (filteredData.length === 0) return 0;
        
        // Use the same logic as getParameterValueUsingKPILogic but for specific business unit
        if (parameter === 'HC') {
          const validData = filteredData.filter(item => {
            const itemDate = parseDate(item.month, item.year);
            return !isNaN(itemDate.getTime());
          });
          
          if (validData.length === 0) return 0;
          
          const lastMonthData = validData.reduce((latest, item) => {
            const itemDate = parseDate(item.month, item.year);
            const latestDate = parseDate(latest.month, latest.year);
            return itemDate > latestDate ? item : latest;
          });
          
          const lastMonthDate = parseDate(lastMonthData.month, lastMonthData.year);
          return validData
            .filter(item => {
              const itemDate = parseDate(item.month, item.year);
              return itemDate.getMonth() === lastMonthDate.getMonth() && 
                     itemDate.getFullYear() === lastMonthDate.getFullYear();
            })
            .reduce((sum, item) => sum + (item.hc || 0), 0);
        }
        
        // GPM % and NP %: compute as (Total GPM/Total Revenue)*100 and (Total NP/Total Revenue)*100 per BU
        if (parameter === 'GPM %' || parameter === 'NP %') {
          const monthlyRevenue: {[key: string]: number} = {};
          const monthlyGpm: {[key: string]: number} = {};
          const monthlyNp: {[key: string]: number} = {};
          filteredData.forEach(item => {
            const monthKey = `${item.month} ${item.year}`;
            if (!monthlyRevenue[monthKey]) {
              monthlyRevenue[monthKey] = 0;
              monthlyGpm[monthKey] = 0;
              monthlyNp[monthKey] = 0;
            }
            monthlyRevenue[monthKey] += (item.revenue || 0);
            monthlyGpm[monthKey] += (item.gpm || 0);
            monthlyNp[monthKey] += (item.np || 0);
          });
          const totalRevenue = Object.values(monthlyRevenue).reduce((sum: number, val: number) => sum + val, 0);
          const totalGpm = Object.values(monthlyGpm).reduce((sum: number, val: number) => sum + val, 0);
          const totalNp = Object.values(monthlyNp).reduce((sum: number, val: number) => sum + val, 0);
          if (parameter === 'GPM %') return totalRevenue !== 0 ? (totalGpm / totalRevenue) * 100 : 0;
          if (parameter === 'NP %') return totalRevenue !== 0 ? (totalNp / totalRevenue) * 100 : 0;
        }
        // For other parameters: aggregate by month first, then sum
        const monthlyTotals: {[key: string]: number} = {};
        filteredData.forEach(item => {
          const monthKey = `${item.month} ${item.year}`;
          if (!monthlyTotals[monthKey]) {
            monthlyTotals[monthKey] = 0;
          }
          
          // Map parameter names to database field names
          let fieldName = parameter.toLowerCase();
          if (parameter === 'Revenue') fieldName = 'revenue';
          if (parameter === 'Salary Cost') fieldName = 'salary_cost';
          if (parameter === 'GPM') fieldName = 'gpm';
          if (parameter === 'GPM %') fieldName = 'gpm_percentage';
          if (parameter === 'Team Cost') fieldName = 'team_cost';
          if (parameter === 'NP' || parameter === 'Net Margin') fieldName = 'np';
          if (parameter === 'NP %') fieldName = 'np_percentage';
          if (parameter === 'Leave Encashment') fieldName = 'leave_encashment';
          if (parameter === 'Opr Cost') fieldName = 'opr_cost';
          if (parameter === 'Funding Cost') fieldName = 'funding_cost';
          if (parameter === 'Rebate') fieldName = 'rebate';
          if (parameter === 'Passthrough') fieldName = 'passthrough';
          if (parameter === 'HC') fieldName = 'hc';
          
          monthlyTotals[monthKey] += (item[fieldName] || 0);
        });
        return Object.values(monthlyTotals).reduce((sum: number, val: number) => sum + val, 0);
      };
      
      // Calculate summary data for each business unit using unified KPI dashboard logic
      const businessUnitSummaries = allBusinessUnits.map(businessUnit => {
        // Calculate metrics for each period using unified logic
        const periods = comparisonValues.filter(Boolean);
        const periodData = periods.map(period => {
          // Use the unified KPI dashboard logic for each parameter and business unit
          const revenue = getParameterValueForBusinessUnit(period || '', 'Revenue', businessUnit);
          const gpm = getParameterValueForBusinessUnit(period || '', 'GPM', businessUnit);
          const np = getParameterValueForBusinessUnit(period || '', 'NP', businessUnit);
          const hc = getParameterValueForBusinessUnit(period || '', 'HC', businessUnit);
          
          return { period, revenue, gpm, np, hc };
        });
        
        // Calculate growth metrics
        const currentPeriod = periodData[0];
        const previousPeriod = periodData[periodData.length - 1];
        
        // Calculate projections for each parameter (only for default year comparison)
        const isDefaultYearComparison = compareType === 'year' && periods.length === 2;
        let revenuePredicted = 0, revenueSum = currentPeriod.revenue;
        let gpmPredicted = 0, gpmSum = currentPeriod.gpm;
        let npPredicted = 0, npSum = currentPeriod.np;
        let hcPredicted = 0, hcSum = currentPeriod.hc;
        
        if (isDefaultYearComparison) {
          // Calculate projections for this specific business unit using the same logic as calculateKPIs
          const currentFY = getCurrentFinancialYear();
          const currentFYData = data.filter(item => {
            if (item.business_unit !== businessUnit) return false;
            if (selectedClientName) {
              if (selectedBusinessUnit === "Managed Services" || selectedBusinessUnit === "MS") {
                if (item.project_name !== selectedClientName) return false;
              } else {
                if (item.client_name !== selectedClientName) return false;
              }
            }
            const date = parseDate(item.month, item.year);
            if (isNaN(date.getTime())) return false;
            const itemYear = date.getFullYear();
            const itemMonth = date.getMonth() + 1;
            if (itemMonth >= 4) {
              return itemYear === currentFY;
            } else {
              return itemYear === currentFY + 1;
            }
          });
          
          // Calculate projections for each parameter (same logic as TeamReportCompare)
          const calculateProjection = (paramName: string) => {
            if (paramName === 'HC') {
              // HC doesn't need projection - use actual value
              return { predicted: 0, sum: currentPeriod.hc };
            }
            
            // Calculate monthly totals
            const monthlyTotals: {[key: string]: number} = {};
            currentFYData.forEach(item => {
              const monthKey = `${item.month} ${item.year}`;
              if (!monthlyTotals[monthKey]) {
                monthlyTotals[monthKey] = 0;
              }
              
              let value = 0;
              switch (paramName) {
                case 'Revenue': value = item.revenue || 0; break;
                case 'GPM': value = item.gpm || 0; break;
                case 'NP': value = item.np || 0; break;
                default: value = 0;
              }
              monthlyTotals[monthKey] += value;
            });
            
            const actual = Object.values(monthlyTotals).reduce((sum: number, val: number) => sum + val, 0);
            
            if (Object.keys(monthlyTotals).length > 0) {
              const monthKeys = Object.keys(monthlyTotals);
              const sortedMonths = monthKeys.sort((a, b) => {
                const [monthA, yearA] = a.split(' ');
                const [monthB, yearB] = b.split(' ');
                const dateA = parseDate(monthA, parseInt(yearA));
                const dateB = parseDate(monthB, parseInt(yearB));
                return dateA.getTime() - dateB.getTime();
              });
              
              // Find the last month with non-zero value (same logic as KPI dashboard)
              let lastMonthWithData = null;
              let lastMonthValue = 0;
              for (let i = sortedMonths.length - 1; i >= 0; i--) {
                const monthKey = sortedMonths[i];
                const value = monthlyTotals[monthKey] || 0;
                if (value > 0) {
                  lastMonthWithData = monthKey;
                  lastMonthValue = value;
                  break;
                }
              }
              
              if (lastMonthWithData && lastMonthValue > 0) {
                // Use parseDate to handle month name variations (same as KPI dashboard)
                const [lastMonthName, lastYearStr] = lastMonthWithData.split(' ');
                const lastMonthDate = parseDate(lastMonthName, parseInt(lastYearStr));
                
                if (!isNaN(lastMonthDate.getTime())) {
                  // Financial year months: Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec, Jan, Feb, Mar (0-11 index)
                  const monthIndex = lastMonthDate.getMonth(); // 0-11 (Jan=0, Dec=11)
                  
                  // Map calendar month to financial year month index
                  // Apr (month 3) = index 0, May (month 4) = index 1, ..., Mar (month 2) = index 11
                  let financialYearIndex = -1;
                  if (monthIndex >= 3) {
                    // Apr-Dec (months 3-11) map to indices 0-8
                    financialYearIndex = monthIndex - 3;
                  } else {
                    // Jan-Mar (months 0-2) map to indices 9-11
                    financialYearIndex = monthIndex + 9;
                  }
                  
                  // Calculate remaining months from the last month with data (+1 because index is 0-based)
                  const actualMonthsRemaining = 12 - (financialYearIndex + 1);
                  
                  // Project: actual + (last month value * remaining months)
                  const projected = actual + (lastMonthValue * actualMonthsRemaining);
                  return { predicted: projected - actual, sum: projected };
                }
                
                // Fallback: if date parsing fails, calculate based on months completed
                const monthsCompleted = Object.keys(monthlyTotals).length;
                const actualMonthsRemaining = Math.max(0, 12 - monthsCompleted);
                const projected = actual + (lastMonthValue * actualMonthsRemaining);
                return { predicted: projected - actual, sum: projected };
              }
            }
            
            // If no projection can be calculated, return 0 predicted and actual as sum
            return { predicted: 0, sum: actual };
          };
          
          const revenueProj = calculateProjection('Revenue');
          revenuePredicted = revenueProj.predicted;
          revenueSum = revenueProj.sum;
          
          const gpmProj = calculateProjection('GPM');
          gpmPredicted = gpmProj.predicted;
          gpmSum = gpmProj.sum;
          
          const npProj = calculateProjection('NP');
          npPredicted = npProj.predicted;
          npSum = npProj.sum;
          
          // HC doesn't need projection
          hcPredicted = 0;
          hcSum = currentPeriod.hc;
        }
        
        // Use Sum values for change calculations when available
        const revenueChange = (isDefaultYearComparison && revenueSum > 0 ? revenueSum : currentPeriod.revenue) - previousPeriod.revenue;
        const gpmChange = (isDefaultYearComparison && gpmSum > 0 ? gpmSum : currentPeriod.gpm) - previousPeriod.gpm;
        const npChange = (isDefaultYearComparison && npSum > 0 ? npSum : currentPeriod.np) - previousPeriod.np;
        const hcChange = (isDefaultYearComparison && hcSum > 0 ? hcSum : currentPeriod.hc) - previousPeriod.hc;
        
        const revenueGrowth = previousPeriod.revenue > 0 ? (revenueChange / previousPeriod.revenue) * 100 : 0;
        const gpmGrowth = previousPeriod.gpm > 0 ? (gpmChange / previousPeriod.gpm) * 100 : 0;
        const npGrowth = previousPeriod.np > 0 ? (npChange / previousPeriod.np) * 100 : 0;
        const hcGrowth = previousPeriod.hc > 0 ? (hcChange / previousPeriod.hc) * 100 : 0;
        
        return {
          businessUnit,
          currentPeriod,
          previousPeriod,
          revenueChange,
          gpmChange,
          npChange,
          hcChange,
          revenueGrowth,
          gpmGrowth,
          npGrowth,
          hcGrowth,
          // Projection values
          revenuePredicted,
          revenueSum,
          gpmPredicted,
          gpmSum,
          npPredicted,
          npSum,
          hcPredicted,
          hcSum
        };
      });
      
      return (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse', 
            backgroundColor: '#ffffff',
            border: '2px solid #004a7a',
            fontSize: '10px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#d8e8f0' }}>
                <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #d9d9d9', color: '#000000', fontSize: '10px' }}>Business Unit</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #d9d9d9', color: '#000000', fontSize: '10px' }}>Parameter</th>
                {comparisonValues.filter(Boolean).map((period, i) => {
                  // Check if this is the default year comparison
                  const isDefaultYearComparison = compareType === 'year' && 
                    comparisonValues.filter(Boolean).length === 2 &&
                    i === 0; // Only show for first period (current year)
                  
                  // Check if this is the current FY period - use dynamic year detection
                  const currentYear = getCurrentFinancialYear();
                  const periodStr = period || '';
                  const isCurrentFY = periodStr.includes(String(currentYear)) || 
                                     (compareType === 'year' && i === 0 && periodStr.length > 0);
                  
                  return (
                    <React.Fragment key={i}>
                      <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #d9d9d9', color: '#000000', fontSize: '10px' }}>
                        {isCurrentFY ? getMonthRangeForFY(period || '') : period || ''}
                      </th>
                      {/* Add Predicted and Sum columns only for default year comparison */}
                      {isDefaultYearComparison && isCurrentFY && (
                        <>
                          <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #d9d9d9', color: '#000000', fontSize: '10px' }}>
                            Predicted
                          </th>
                          <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #d9d9d9', color: '#000000', fontSize: '10px' }}>
                            Sum (Actual + Predicted)
                          </th>
                        </>
                      )}
                    </React.Fragment>
                  );
                })}
                <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #d9d9d9', color: '#000000', fontSize: '10px' }}>Absolute Change</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #d9d9d9', color: '#000000', fontSize: '10px' }}>Growth %</th>
              </tr>
            </thead>
            <tbody>
              {businessUnitSummaries.map((summary, index) => {
                const isDefaultYearComparison = compareType === 'year' && comparisonValues.filter(Boolean).length === 2;
                
                const parameters = [
                  { 
                    name: 'Revenue', 
                    current: summary.currentPeriod.revenue, 
                    previous: summary.previousPeriod.revenue, 
                    change: summary.revenueChange, 
                    growth: summary.revenueGrowth,
                    predicted: summary.revenuePredicted || 0,
                    sum: summary.revenueSum || summary.currentPeriod.revenue
                  },
                  { 
                    name: 'GPM', 
                    current: summary.currentPeriod.gpm, 
                    previous: summary.previousPeriod.gpm, 
                    change: summary.gpmChange, 
                    growth: summary.gpmGrowth,
                    predicted: summary.gpmPredicted || 0,
                    sum: summary.gpmSum || summary.currentPeriod.gpm
                  },
                  { 
                    name: 'NP', 
                    current: summary.currentPeriod.np, 
                    previous: summary.previousPeriod.np, 
                    change: summary.npChange, 
                    growth: summary.npGrowth,
                    predicted: summary.npPredicted || 0,
                    sum: summary.npSum || summary.currentPeriod.np
                  },
                  { 
                    name: 'HC', 
                    current: summary.currentPeriod.hc, 
                    previous: summary.previousPeriod.hc, 
                    change: summary.hcChange, 
                    growth: summary.hcGrowth,
                    predicted: summary.hcPredicted || 0,
                    sum: summary.hcSum || summary.currentPeriod.hc
                  }
                ];
                
                // Use alternating grey pattern like Growth Analysis
                
                return parameters.map((param, paramIndex) => {
                  const isEvenRow = (index * 4 + paramIndex) % 2 === 0;
                  return (
                  <tr key={`${summary.businessUnit}-${param.name}`} style={{ 
                    backgroundColor: isEvenRow ? '#ffffff' : '#f9f9f9',
                    borderBottom: paramIndex === parameters.length - 1 ? '2px solid #004a7a' : '1px solid #d9d9d9',
                    color: '#000000'
                  }}>
                    {paramIndex === 0 && (
                      <td rowSpan={parameters.length} style={{ 
                        padding: '6px 8px', 
                        textAlign: 'left',
                        fontWeight: 'bold',
                        verticalAlign: 'top',
                        backgroundColor: '#e6f3ff',
                        borderRight: '2px solid #004a7a'
                      }}>
                        {summary.businessUnit}
                      </td>
                    )}
                    <td style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 'bold' }}>
                      {param.name}
                    </td>
                    {comparisonValues.filter(Boolean).map((period, i) => {
                      const isDefaultYearComparison = compareType === 'year' && 
                        comparisonValues.filter(Boolean).length === 2 &&
                        i === 0;
                      // Check if this is the current FY period - use dynamic year detection
                      const currentYear = getCurrentFinancialYear();
                      const periodStr = period || '';
                      const isCurrentFY = periodStr.includes(String(currentYear)) || 
                                         (compareType === 'year' && i === 0 && periodStr.length > 0);
                      
                      return (
                        <React.Fragment key={i}>
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                            <div>
                              {formatValueForTable(i === 0 ? param.current : param.previous, param.name)}
                            </div>
                            {param.name === 'GPM' && i === 0 && (
                              <div style={{ fontSize: '9px', color: '#666666', marginTop: '2px' }}>
                                {(() => {
                                  const revenue = summary.currentPeriod.revenue;
                                  const revenueNum = typeof revenue === 'number' && !isNaN(revenue) ? revenue : 0;
                                  const currentNum = typeof param.current === 'number' && !isNaN(param.current) ? param.current : 0;
                                  const percentage = revenueNum > 0 ? ((currentNum / revenueNum) * 100).toFixed(2) : '0.00';
                                  return `GPM %: ${percentage}%`;
                                })()}
                              </div>
                            )}
                            {param.name === 'NP' && i === 0 && (
                              <div style={{ fontSize: '9px', color: '#666666', marginTop: '2px' }}>
                                {(() => {
                                  // Calculate NP % from revenue and NP
                                  const revenue = summary.currentPeriod.revenue;
                                  const np = summary.currentPeriod.np;
                                  const revenueNum = typeof revenue === 'number' && !isNaN(revenue) ? revenue : 0;
                                  const npNum = typeof np === 'number' && !isNaN(np) ? np : 0;
                                  const percentage = revenueNum > 0 ? ((npNum / revenueNum) * 100).toFixed(2) : '0.00';
                                  return `NP %: ${percentage}%`;
                                })()}
                              </div>
                            )}
                            {param.name === 'GPM' && i > 0 && (
                              <div style={{ fontSize: '9px', color: '#666666', marginTop: '2px' }}>
                                {(() => {
                                  const revenue = summary.previousPeriod.revenue;
                                  const revenueNum = typeof revenue === 'number' && !isNaN(revenue) ? revenue : 0;
                                  const previousNum = typeof param.previous === 'number' && !isNaN(param.previous) ? param.previous : 0;
                                  const percentage = revenueNum > 0 ? ((previousNum / revenueNum) * 100).toFixed(2) : '0.00';
                                  return `GPM %: ${percentage}%`;
                                })()}
                              </div>
                            )}
                            {param.name === 'NP' && i > 0 && (
                              <div style={{ fontSize: '9px', color: '#666666', marginTop: '2px' }}>
                                {(() => {
                                  // Calculate NP % for previous period
                                  const revenue = summary.previousPeriod.revenue;
                                  const np = summary.previousPeriod.np;
                                  const revenueNum = typeof revenue === 'number' && !isNaN(revenue) ? revenue : 0;
                                  const npNum = typeof np === 'number' && !isNaN(np) ? np : 0;
                                  const percentage = revenueNum > 0 ? ((npNum / revenueNum) * 100).toFixed(2) : '0.00';
                                  return `NP %: ${percentage}%`;
                                })()}
                              </div>
                            )}
                          </td>
                          {/* Add Predicted and Sum columns only for default year comparison */}
                          {isDefaultYearComparison && isCurrentFY && (
                            <>
                              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#000000', fontSize: '10px' }}>
                                <div>
                                  {formatValueForTable(param.predicted, param.name)}
                                </div>
                              </td>
                              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#000000', fontSize: '10px' }}>
                                <div>
                                  {formatValueForTable(param.sum, param.name)}
                                </div>
                              </td>
                            </>
                          )}
                        </React.Fragment>
                      );
                    })}
                    <td style={{ 
                      padding: '6px 8px', 
                      textAlign: 'right',
                      color: param.change >= 0 ? '#4ade80' : '#f87171',
                      fontWeight: 'bold'
                    }}>
                      {param.change >= 0 ? '+' : ''}
                      {formatValueForTable(param.change, param.name)}
                    </td>
                    <td style={{ 
                      padding: '6px 8px', 
                      textAlign: 'right',
                      color: param.change >= 0 ? '#4ade80' : '#f87171',
                      fontWeight: 'bold'
                    }}>
                      {param.change >= 0 ? '+' : ''}
                      {(() => {
                        const growth = typeof param.growth === 'number' && !isNaN(param.growth) ? param.growth : 0;
                        return growth.toFixed(2);
                      })()}%
                    </td>
                  </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      );
    })()}
  </div>
)}

{/* Show Client Report button - toggles Client Report (above) */}
<div style={{ textAlign: 'center', marginTop: 16, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
  <button
    onClick={() => setShowSummaryReport(!showSummaryReport)}
    style={{ 
      backgroundColor: '#004a7a',
      color: '#ffffff',
      border: 'none',
      padding: '8px 16px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: 'bold',
      cursor: 'pointer',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}
  >
    {showSummaryReport ? 'Hide Client Report' : 'Show Client Report'}
  </button>
  {showSummaryReport && selectedBusinessUnit && (() => {
    const clientNamesForBU = Array.from(new Set(
      data
        .filter(item => compareBusinessUnits(item.business_unit, selectedBusinessUnit))
        .map(item => {
          if (selectedBusinessUnit === 'MS' || selectedBusinessUnit === 'Managed Services') {
            return item.project_name;
          }
          return item.client_name;
        })
        .filter(Boolean)
    )).sort();
    return (
      <select
        value={selectedSummaryClient || ''}
        onChange={(e) => setSelectedSummaryClient(e.target.value || null)}
        style={{
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: '12px',
          border: '1px solid #d9d9d9',
          backgroundColor: '#ffffff',
          cursor: 'pointer',
          minWidth: '200px'
        }}
      >
        <option value="">All Clients</option>
        {clientNamesForBU.map(clientName => (
          <option key={clientName} value={clientName}>{clientName}</option>
        ))}
      </select>
    );
  })()}
  <button
    onClick={() => setShowFullReport(!showFullReport)}
    style={{ 
      backgroundColor: '#ff8c00',
      color: '#ffffff',
      border: 'none',
      padding: '8px 16px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: 'bold',
      cursor: 'pointer',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}
  >
    {showFullReport ? 'Hide Full Report' : 'Show Full Report'}
  </button>
</div>

{/* Full Report - displays right after Show Full Report button when clicked */}
{showFullReport && (
  <div style={{ marginTop: 12, marginBottom: 20 }}>
    <div style={{
      backgroundColor: '#000000', 
      color: '#ffffff', 
      padding: '6px 12px', 
      borderRadius: 4, 
      fontSize: 10, 
      fontWeight: 700,
      display: 'inline-block',
      marginBottom: 8,
      borderBottom: '3px solid #ff8c00'
    }}>
      Full Report - All Business Units
    </div>
    <div style={{ padding: 16, border: '1px solid #d9d9d9', borderRadius: 4, backgroundColor: '#f9f9f9', color: '#000000', fontSize: 12 }}>
      Same client / business unit summary as Client Report above. Use Client Report for the main view.
    </div>
  </div>
)}

<div style={{

  backgroundColor: '#ffffff',

  borderRadius: 8,

  padding: 16,

  boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',

  marginTop: 16,

  width: '100%',

  border: '1px solid #d9d9d9'

}}>

  <div style={{ 
    backgroundColor: '#000000', 
    color: '#ffffff', 
    padding: '6px 12px', 
    borderRadius: 4, 
    fontSize: 10, 
    fontWeight: 700,
    display: 'inline-block',
    marginBottom: 8,
    borderBottom: '3px solid #ff8c00'
  }}>
    Efficiency Dashboard
  </div>
  
  {/* Baseline Toggle Switch */}
  <div style={{ 
    display: 'flex', 
    alignItems: 'center', 
    gap: '8px', 
    marginBottom: '12px',
    fontSize: '11px',
    color: '#000000'
  }}>
    <span>Baseline:</span>
    <label style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '4px', 
      cursor: 'pointer',
      userSelect: 'none'
    }}>
      <input
        type="checkbox"
        checked={useCurrentYearAsBaseline}
        onChange={(e) => setUseCurrentYearAsBaseline(e.target.checked)}
        style={{ margin: 0 }}
      />
      <span style={{ 
        color: useCurrentYearAsBaseline ? '#004a7a' : '#666666',
        fontWeight: useCurrentYearAsBaseline ? 'bold' : 'normal'
      }}>
        {useCurrentYearAsBaseline ? 'Current Year (FY 2025)' : 'Previous Year (FY 2024)'}
      </span>
    </label>
  </div>

  
  
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

      // Debug Efficiency Dashboard data
      // Removed verbose debug logs for performance

      return {

        period,

        hc: periodData.find(i => i.parameter === "HC")?.amount || 0,

        teamCost: periodData.find(i => i.parameter === "Team Cost")?.amount || 0,

        revenue: periodData.find(i => i.parameter === "Revenue")?.amount || 0,

        gpm: periodData.find(i => i.parameter === "GPM")?.amount || 0,

        netMargin: periodData.find(i => i.parameter === "Net Margin")?.amount || 0,

        np: periodData.find(i => i.parameter === "NP")?.amount || 0

      };

    });



    const baseline = useCurrentYearAsBaseline ? metrics[0] : metrics[metrics.length - 1];

    
    
    // Key efficiency metrics to track

    const metricDefinitions = [

      {

        name: "Cost Efficiency",

        calculate: (m: typeof metrics[0]) => m.teamCost / (m.np || 1),

        ideal: 'decrease',

        unit: ''

      },

      {

        name: "Revenue per HC",

        calculate: (m: typeof metrics[0]) => m.revenue / (m.hc || 1),

        ideal: 'increase',

        unit: ''

      },

      {

        name: "NP per Team Cost",

        calculate: (m: typeof metrics[0]) => m.np / (m.teamCost || 1),

        ideal: 'increase',

        unit: ''

      },

      {

        name: "Team Cost % of Revenue",

        calculate: (m: typeof metrics[0]) => (m.teamCost / (m.revenue || 1)) * 100,

        ideal: 'decrease',

        unit: '%'

      },

      {

        name: "GPM per HC",

        calculate: (m: typeof metrics[0]) => m.gpm / (m.hc || 1),

        ideal: 'increase',

        unit: ''

      }

    ];



    return (

      <div>

       {/* Summary Trend Cards */}

<div style={{ 

  display: 'grid',

  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',  // Fit 5 metrics in one row

  gap: 8,  // Reduced gap from 16px to 8px

  marginBottom: 12  // Reduced margin from 24px to 12px

}}>

  {metricDefinitions.map((metric, i) => {

    const currentValue = useCurrentYearAsBaseline ? metric.calculate(metrics[metrics.length - 1]) : metric.calculate(metrics[0]);

    const baselineValue = metric.calculate(baseline);

    const change = currentValue - baselineValue;

    const percentageChange = baselineValue !== 0 ? (change / Math.abs(baselineValue)) * 100 : 0;

    const isPositive = metric.ideal === 'increase' ? change >= 0 : change <= 0;

    
    
    return (

      <div key={i} style={{

        backgroundColor: '#ffffff',

        borderRadius: 8,  // Increased from 6px

        padding: 8,  // Reduced from 16px

        borderLeft: `4px solid ${isPositive ? '#4ade80' : '#f87171'}`,

        minHeight: '60px',  // Reduced from 100px

        display: 'flex',

        flexDirection: 'column',

        justifyContent: 'space-between',

        border: '1px solid #d9d9d9'

      }}>

        <div style={{ 

          fontWeight: 600, 

          fontSize: 10,

          marginBottom: 4,  // Reduced margin

          color: '#000000'

        }}>

          {metric.name}

        </div>

        <div style={{ 

          fontSize: 10,  // Decreased to 10px

          fontWeight: 700,

          margin: '4px 0',  // Reduced margin

          color: '#000000'

        }}>

          {metric.name === "Revenue per HC" 

            ? `${currentValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

            : `${currentValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${metric.unit}`

          }

        </div>

        {/* Note for Cost Efficiency */}
        {metric.name === "Cost Efficiency" && (
          <div style={{
            fontSize: 8,
            color: '#666666',
            fontWeight: 'normal',
            marginTop: 2,
            marginBottom: 4,
            lineHeight: 1.3
          }}>
            Formula: Team Cost ÷ Net Margin. Lower values indicate better cost efficiency (less team cost per unit of net margin).
          </div>
        )}

        <div style={{ 

          fontSize: 10,  // Decreased to 10px

          color: isPositive ? '#4ade80' : '#f87171',

          display: 'flex',

          alignItems: 'center',

          gap: 4

        }}>

          <span style={{ fontSize: 10 }}>

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

        <div style={{ overflowX: 'auto', backgroundColor: '#e8f4f8', border: '1px solid #d9d9d9', borderRadius: 4 }}>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>

            <thead>

              <tr style={{ backgroundColor: '#d8e8f0' }}>

                <th style={{ padding: '6px 8px', textAlign: 'left', color: '#000000', fontSize: '10px' }}>Metric</th>

                {metrics.map((m, i) => (

                  <th key={i} style={{ padding: '6px 8px', textAlign: 'right', color: '#000000', fontSize: '10px' }}>

                    {getMonthRangeForFY(m.period || '')}

                    {((useCurrentYearAsBaseline && i === 0) || (!useCurrentYearAsBaseline && i === metrics.length - 1)) && <div style={{ fontSize: 10, fontWeight: 400, color: '#000000' }}>(Baseline)</div>}

                  </th>

                ))}

                <th style={{ padding: '6px 8px', textAlign: 'right', color: '#000000', fontSize: '10px' }}>Change vs Baseline</th>

                <th style={{ padding: '6px 8px', textAlign: 'right', color: '#000000', fontSize: '10px' }}>Trend</th>

              </tr>

            </thead>

            <tbody>

              {metricDefinitions.map((metric, i) => (

                <tr key={i} style={{ 

                  borderBottom: '1px solid #d9d9d9',

                  backgroundColor: i % 2 === 0 ? '#ffffff' : '#f9f9f9',

                  color: '#000000'

                }}>

                  <td style={{ padding: '6px 8px', fontWeight: 500, color: '#000000', fontSize: '10px' }}>{metric.name}</td>

                  
                  
                  {metrics.map((m, j) => {

                    const value = metric.calculate(m);

                    const baselineValue = metric.calculate(baseline);

                    const change = value - baselineValue;

                    const isPositive = metric.ideal === 'increase' ? change >= 0 : change <= 0;

                    
                    
                    return (

                      <td key={j} style={{ padding: '6px 8px', textAlign: 'right', color: '#000000', fontSize: '10px' }}>

                        <div style={{ color: '#000000' }}>

                          {metric.name === "Revenue per HC" 

                            ? `${value.toFixed(2)}`

                            : `${value.toFixed(2)}${metric.unit}`

                          }

                        </div>

                        {j > 0 && (

                          <div style={{ 

                            fontSize: 10,

                            color: isPositive ? '#4ade80' : '#f87171'

                          }}>

                            {isPositive ? '+' : ''}

                            {metric.name === "Revenue per HC" 

                              ? `${change.toFixed(2)}`

                              : `${change.toFixed(2)}${metric.unit}`

                            }

                          </div>

                        )}

                      </td>

                    );

                  })}
                  
                  
                  
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '10px' }}>

                    {(() => {

                      const current = useCurrentYearAsBaseline ? metric.calculate(metrics[metrics.length - 1]) : metric.calculate(metrics[0]);

                      const baselineValue = metric.calculate(baseline);

                      const change = current - baselineValue;

                      const pctChange = baselineValue !== 0 ? (change / Math.abs(baselineValue)) * 100 : 0;

                      const isPositive = metric.ideal === 'increase' ? change >= 0 : change <= 0;

                      
                      
                      return (

                        <div style={{ color: isPositive ? '#4ade80' : '#f87171' }}>

                          {isPositive ? '+' : ''}

                          {metric.name === "Revenue per HC" 

                            ? `${change.toFixed(2)}`

                            : `${change.toFixed(2)}${metric.unit}`

                          } ({pctChange.toFixed(2)}%)

                        </div>

                      );

                    })()}

                  </td>
                  
                  
                  
                  <td style={{ padding: '6px 8px', textAlign: 'center', fontSize: '10px' }}>

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

        <div style={{ 
          backgroundColor: '#000000', 
          color: '#ffffff', 
          padding: '6px 12px', 
          borderRadius: 4, 
          fontSize: 12, 
          fontWeight: 700,
          display: 'inline-block',
          marginBottom: 8,
          borderBottom: '3px solid #ff8c00'
        }}>
          Period-to-Period Changes
        </div>

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

                <h4 style={{ marginTop: 0, borderBottom: '1px solid #d9d9d9', paddingBottom: 8, color: '#000000', fontSize: 12 }}>

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

                        <span style={{ color: '#000000', fontSize: 10 }}>{def.name}:</span>

                        <span style={{ 

                          fontWeight: 600,

                          color: isPositive ? '#4ade80' : '#f87171',

                          fontSize: 10

                        }}>

                          {isPositive ? '+' : ''}

                          {def.name === "Revenue per HC" 

                            ? `${change.toFixed(2)}`

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





      {/* Target Tracking Chart - Always visible */}

      <ClientParameterTrackingChart

        selectedBusinessUnit={selectedBusinessUnit}

        selectedPeriod={comparisonValues[0]}

        compareType={compareType}

        actualData={comparisonData.map(item => ({

          revenue: item.amount,

          netMargin: item.amount * 0.15, // Assuming 15% net margin for demo

          period: item.period

        }))}

        data={data}

        availableParameters={availableParameters}

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

export default ClientMFSCompare;
