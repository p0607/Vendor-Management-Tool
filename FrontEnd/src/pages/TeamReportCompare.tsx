import React, { useState, useEffect, useCallback, useMemo } from "react";

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

import { compareBusinessUnits, normalizeBusinessUnitName } from '../utils/businessUnitUtils';

import apiClient from '../config/api';


import * as XLSX from 'xlsx';



const { Option } = Select;



interface ReportData {

  id?: number;

  business_unit: string;

  month: string;

  year: number;

  hc: number;

  revenue: number;

  gpm: number;

  team_cost: number;

  net_margin: number;

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



const TeamReportCompare: React.FC = () => {

  const navigate = useNavigate();

  const location = useLocation();

  
  // Clear URL parameters immediately to prevent them from overriding defaults
  const currentUrl = new URL(window.location.href);
  const paramsToRemove = ['compareType', 'selectedParameters', 'chartType', 'defaultFinancialYear'];
  
  paramsToRemove.forEach(param => {
    if (currentUrl.searchParams.has(param)) {
      console.log(`🔍 Removing URL parameter: ${param}=${currentUrl.searchParams.get(param)}`);
      currentUrl.searchParams.delete(param);
    }
  });
  
  // Update URL without the problematic parameters
  if (paramsToRemove.some(param => window.location.search.includes(param))) {
    window.history.replaceState({}, '', currentUrl.toString());
    console.log("🔍 URL cleaned, parameters removed");
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
          
          // Current quarter aggregation
          const currentMonthlyTotals: {[key: string]: number} = {};
          currentQuarterData.forEach(item => {
            const monthKey = `${item.month} ${item.year}`;
            if (!currentMonthlyTotals[monthKey]) {
              currentMonthlyTotals[monthKey] = 0;
            }
            currentMonthlyTotals[monthKey] += (item[parameter] || 0);
          });
          currentValue = Object.values(currentMonthlyTotals).reduce((sum: number, val: number) => sum + val, 0);
          
          // Previous quarter aggregation
          const previousMonthlyTotals: {[key: string]: number} = {};
          previousQuarterData.forEach(item => {
            const monthKey = `${item.month} ${item.year}`;
            if (!previousMonthlyTotals[monthKey]) {
              previousMonthlyTotals[monthKey] = 0;
            }
            previousMonthlyTotals[monthKey] += (item[parameter] || 0);
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
        NP: calculateParameterRaw('net_margin')
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

        console.log(`🔍 HC Raw Database Values (Sum of Last Available Month):`, {
          currentFY,
          previousFY,
          currentFYActual, // SUM OF LAST MONTH HC VALUE
          previousFYTotal, // SUM OF LAST MONTH HC VALUE (March for complete FY)
          currentFYDataLength: currentFYData.length,
          previousFYDataLength: previousFYData.length,
          calculation: `Sum of last available month HC data for each FY`
        });
      } else {
        // For all other parameters: aggregate by month first, then sum (ACTUAL DATA ONLY - NO PROJECTIONS)
        // This prevents double-counting when there are multiple records per month
        
        // Current FY aggregation
        const currentFYMonthlyTotals: {[key: string]: number} = {};
        currentFYData.forEach(item => {
          const monthKey = `${item.month} ${item.year}`;
          if (!currentFYMonthlyTotals[monthKey]) {
            currentFYMonthlyTotals[monthKey] = 0;
          }
          currentFYMonthlyTotals[monthKey] += (item[parameter] || 0);
        });
        currentFYActual = Object.values(currentFYMonthlyTotals).reduce((sum: number, val: number) => sum + val, 0);
        
        // Previous FY aggregation
        const previousFYMonthlyTotals: {[key: string]: number} = {};
        previousFYData.forEach(item => {
          const monthKey = `${item.month} ${item.year}`;
          if (!previousFYMonthlyTotals[monthKey]) {
            previousFYMonthlyTotals[monthKey] = 0;
          }
          previousFYMonthlyTotals[monthKey] += (item[parameter] || 0);
        });
        previousFYTotal = Object.values(previousFYMonthlyTotals).reduce((sum: number, val: number) => sum + val, 0);

        // Debug: Show the difference between old and new calculation methods
        const oldCurrentFYActual = currentFYData.reduce((sum, item) => sum + (item[parameter] || 0), 0);
        const oldPreviousFYTotal = previousFYData.reduce((sum, item) => sum + (item[parameter] || 0), 0);
        
        console.log(`🔍 Raw Database Values for ${parameter}:`, {
          currentFY,
          previousFY,
          currentFYActual, // NEW: Monthly aggregated value
          previousFYTotal, // NEW: Monthly aggregated value
          oldCurrentFYActual, // OLD: Sum of all records
          oldPreviousFYTotal, // OLD: Sum of all records
          difference: currentFYActual - oldCurrentFYActual,
          currentFYDataLength: currentFYData.length,
          previousFYDataLength: previousFYData.length,
          calculation: `Monthly aggregation for ${parameter}`,
          sampleCurrentFYData: currentFYData.slice(0, 3).map(item => ({
            month: item.month,
            year: item.year,
            [parameter]: item[parameter]
          })),
          samplePreviousFYData: previousFYData.slice(0, 3).map(item => ({
            month: item.month,
            year: item.year,
            [parameter]: item[parameter]
          }))
        });
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
        NP: calculateParameterRaw('net_margin')
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

    console.log("🔍 calculateKPIs called with:", {
      compareType,
      comparisonValues,
      dataLength: data.length,
      isMonthComparison: compareType === 'month',
      hasComparisonValues: comparisonValues.some(v => v)
    });

    // If comparing by months and we have selected months
    if (compareType === 'month' && comparisonValues.some(v => v)) {
      console.log("🔍 Month comparison logic triggered!");
      const currentMonth = comparisonValues[0];
      const previousMonth = comparisonValues[1];
      
      console.log("🔍 Month comparison values:", { currentMonth, previousMonth });
      
      if (!currentMonth || !previousMonth) return {};

      // Parse month and year from strings like "November 2023"
      const currentMonthMatch = currentMonth.match(/(\w+) (\d{4})/);
      const previousMonthMatch = previousMonth.match(/(\w+) (\d{4})/);
      
      if (!currentMonthMatch || !previousMonthMatch) return {};
      
      const currentMonthName = currentMonthMatch[1];
      const currentYear = parseInt(currentMonthMatch[2]);
      const previousMonthName = previousMonthMatch[1];
      const previousYear = parseInt(previousMonthMatch[2]);
      
      console.log("🔍 Parsed month values:", {
        currentMonthName,
        currentYear,
        previousMonthName,
        previousYear
      });

      const calculateParameterKPI = (parameter: string) => {
        // Use the same logic as Growth Analysis for consistency
        console.log(`🔍 Calling getParameterValueUsingKPILogic for ${parameter}:`, {
          currentMonth,
          previousMonth,
          compareType
        });
        
        const currentValue = getParameterValueUsingKPILogic(currentMonth, parameter);
        const previousValue = getParameterValueUsingKPILogic(previousMonth, parameter);

        const growthPercentage = previousValue > 0 
          ? ((currentValue - previousValue) / previousValue) * 100 
          : 0;

        console.log(`🔍 Month KPI Debug for ${parameter}:`, {
          parameter,
          currentMonth,
          previousMonth,
          currentValue,
          previousValue,
          growthPercentage
        });

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
        GPM: calculateParameterKPI('GPM'),
        'Team Cost': calculateParameterKPI('Team Cost'),
        NP: calculateParameterKPI('Net Margin')
      };
      
      console.log("🔍 Month KPI Results:", kpiResults);
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
        GPM: calculateParameterKPI('gpm'),
        'Team Cost': calculateParameterKPI('team_cost'),
        NP: calculateParameterKPI('net_margin')
        // Removed unused KPIs: 'Salary Cost', 'Opr Cost', 'Funding Cost', 'Leave Encashment', 'HC'
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
    
    console.log(`🔍 FINANCIAL YEAR DEBUG:`, {
      currentFY,
      previousFY,
      currentFYDataCount: currentFYData.length,
      previousFYDataCount: previousFYData.length,
      currentFYMonths: Array.from(new Set(currentFYMonths)),
      previousFYMonths: Array.from(new Set(previousFYMonths)),
      currentFYUniqueMonths: Array.from(new Set(currentFYMonths)).length,
      previousFYUniqueMonths: Array.from(new Set(previousFYMonths)).length
    });
    
    // Debug April 2024 data specifically
    const april2024Data = data.filter(item => item.month === 'April' && item.year === 2024);
    console.log("🔍 April 2024 Data:", april2024Data.length, "records");
    if (april2024Data.length > 0) {
      console.log("🔍 April 2024 Sample:", april2024Data[0]);
    }
    
    // Debug what months are actually in the data
    const allMonthsInData = Array.from(new Set(data.map(item => `${item.month} ${item.year}`))).sort();
    console.log("🔍 All months in database:", allMonthsInData);
    
    // Debug what months are in previousFYData
    const previousFYMonthsInData = Array.from(new Set(previousFYData.map(item => `${item.month} ${item.year}`))).sort();
    console.log("🔍 Previous FY months in filtered data:", previousFYMonthsInData);
    
    // Debug what months are in currentFYData
    const currentFYMonthsInData = Array.from(new Set(currentFYData.map(item => `${item.month} ${item.year}`))).sort();
    console.log("🔍 Current FY months in filtered data:", currentFYMonthsInData);
    
    // Debug what months are in previousFYData with HC values
    const previousFYMonthsWithHC = previousFYData
      .filter(item => item.hc && item.hc > 0)
      .map(item => `${item.month} ${item.year} (HC: ${item.hc})`)
      .sort();
    console.log("🔍 Previous FY months with HC data:", previousFYMonthsWithHC);

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
       
          console.log(`🔍 KPI HC Debug for Current FY ${currentFY}:`, {
            currentFYActual,
            currentFYDataCount: currentFYData.length,
            validCurrentFYDataCount: validCurrentFYData.length
          });
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
              
            console.log(`🔍 KPI HC Debug for Previous FY ${previousFY}:`, {
              lastMonth: `${lastMonthPrevious.month} ${lastMonthPrevious.year}`,
              previousFYTotal,
              previousFYDataCount: previousFYData.length,
              validPreviousFYDataCount: validPreviousFYData.length
            });
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
          
          // Get the value based on the parameter name
          let value = 0;
          switch (parameter) {
            case 'revenue': value = item.revenue || 0; break;
            case 'gpm': value = item.gpm || 0; break;
            case 'team_cost': value = item.team_cost || 0; break;
            case 'net_margin': value = item.net_margin || 0; break;
            default: value = 0;
          }
          
          monthlyTotals[monthKey] += value;
        });
        
        // Sum the monthly totals instead of all individual records
        currentFYActual = Object.values(monthlyTotals).reduce((sum: number, val: number) => sum + val, 0);
        
        // Debug: Check what data is being summed
        console.log(`🔍 ${parameter} DEBUG - Current FY Data Analysis:`, {
          totalRecords: currentFYData.length,
          parameterValue: parameter,
          currentFYActual,
          sampleRecords: currentFYData.slice(0, 5).map(item => ({
            month: item.month,
            year: item.year,
            business_unit: item.business_unit,
            [parameter]: item[parameter],
            client_name: item.client_name
          }))
        });
        
        // Debug: Show the difference between old and new calculation methods
        const debugMonthlyTotals: {[key: string]: number} = {};
        currentFYData.forEach(item => {
          const monthKey = `${item.month} ${item.year}`;
          if (!debugMonthlyTotals[monthKey]) {
            debugMonthlyTotals[monthKey] = 0;
          }
          debugMonthlyTotals[monthKey] += (item[parameter] || 0);
        });
        
        const debugMonthlyAggregatedTotal = Object.values(debugMonthlyTotals).reduce((sum: number, val: number) => sum + val, 0);
        
        console.log(`🔍 ${parameter} MONTHLY AGGREGATION DEBUG:`, {
          monthlyTotals: debugMonthlyTotals,
          monthlyAggregatedTotal: debugMonthlyAggregatedTotal,
          difference: currentFYActual - debugMonthlyAggregatedTotal,
          shouldUseMonthlyAggregation: Math.abs(currentFYActual - debugMonthlyAggregatedTotal) > 0.01
        });
        
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
            
            console.log(`🔍 ${parameter} PROJECTION DEBUG:`, {
              availableMonths: Object.keys(monthlyTotals),
              sortedMonths,
              lastMonthWithData,
              lastMonthValue,
              lastMonthIndex,
              actualMonthsRemaining,
              monthsRemaining, // Old calculation
              currentFYActual,
              currentFYProjected,
              projectionAmount: lastMonthValue * actualMonthsRemaining
            });
          }
        }

        // Calculate previous FY total - also aggregate by month first
        const previousMonthlyTotals: {[key: string]: number} = {};
        previousFYData.forEach(item => {
          const monthKey = `${item.month} ${item.year}`;
          if (!previousMonthlyTotals[monthKey]) {
            previousMonthlyTotals[monthKey] = 0;
          }
          
          // Get the value based on the parameter name
          let value = 0;
          switch (parameter) {
            case 'revenue': value = item.revenue || 0; break;
            case 'gpm': value = item.gpm || 0; break;
            case 'team_cost': value = item.team_cost || 0; break;
            case 'net_margin': value = item.net_margin || 0; break;
            default: value = 0;
          }
          
          previousMonthlyTotals[monthKey] += value;
        });
        
        previousFYTotal = Object.values(previousMonthlyTotals).reduce((sum: number, val: number) => sum + val, 0);
        
        console.log(`🔍 ${parameter} KPI Dashboard Previous FY Debug:`, {
          parameter,
          previousFYTotal,
          monthlyBreakdown: Object.entries(previousMonthlyTotals).map(([month, total]) => ({
            month,
            total: total.toFixed(2)
          })),
          totalRecords: previousFYData.length
        });
        
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
      GPM: calculateParameterKPI('gpm'),
      'Team Cost': calculateParameterKPI('team_cost'),
      NP: calculateParameterKPI('net_margin')
      // Removed unused KPIs: 'Salary Cost', 'Opr Cost', 'Funding Cost', 'Leave Encashment', 'HC'
    };
  };


  // State declarations with URL parameter defaults

  const [user, setUser] = useState<any>({});

  const [isBUHead, setIsBUHead] = useState(false);

  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string | null>(null);
  
  // State for multiple business unit selection in Parameter Data Chart
  // For BU heads: single string, for admin: array of strings (all by default)
  const [selectedBusinessUnitsForChart, setSelectedBusinessUnitsForChart] = useState<string | string[] | null>(null);
  
  // State for Client MFS data (for client-level visualization)
  const [clientMFSData, setClientMFSData] = useState<any[]>([]);
  const [isLoadingClientMFS, setIsLoadingClientMFS] = useState<boolean>(false);

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

  const [data, setData] = useState<ReportData[]>([]);
  const [routingData, setRoutingData] = useState<any[]>([]);
  const [ctsSummaryData, setCtsSummaryData] = useState<any[]>([]);

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

  // Removed showAllKPIs state - only 5 KPIs available
  const [comparisonData, setComparisonData] = useState<{[key: string]: any}[]>([]);

  const [growthAnalysis, setGrowthAnalysis] = useState<GrowthAnalysis[]>([]);

  const [isLoading, setIsLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<string>('chart');

  const [showGrowthAnalysis, setShowGrowthAnalysis] = useState<boolean>(false);
  const [showSummaryReport, setShowSummaryReport] = useState<boolean>(false);
  const [showClientData, setShowClientData] = useState<boolean>(false);
  const [useCurrentYearAsBaseline, setUseCurrentYearAsBaseline] = useState<boolean>(false);
  
  // Client Data table filters
  const [clientDataPeriodFilter, setClientDataPeriodFilter] = useState<string>('year'); // 'year', 'quarter', or 'month'
  const [clientDataPeriodValue, setClientDataPeriodValue] = useState<string>(String(getCurrentFinancialYear()));
  const [clientDataSelectedMonths, setClientDataSelectedMonths] = useState<string[]>([]);
  const [clientDataSelectedParameters, setClientDataSelectedParameters] = useState<string[]>([]);
  const [clientDataSelectedClients, setClientDataSelectedClients] = useState<string[]>([]); // [] = All clients

  const [isActionDropdownOpen, setIsActionDropdownOpen] = useState(false);

  // Removed showAllParameters state - always show all parameters

  // Crore/Lakh toggle state
  const [isCroreMode, setIsCroreMode] = useState(true);

  // KPI Dashboard: show/hide Team Cost Analysis card
  const [showTeamCostKPI, setShowTeamCostKPI] = useState(true);

  // Utility function to format values based on toggle
  const formatValueWithToggle = (value: number, isLargeValue: boolean = true) => {
    if (!isLargeValue) return value.toFixed(0);
    
    if (isCroreMode) {
      return `${(value / 10000000).toFixed(1)}Cr`;
    } else {
      return `${(value / 100000).toFixed(1)}L`;
    }
  };

  // Chart tab visibility state
  const [activeChartTab, setActiveChartTab] = useState<string>('none');



  // Helper function to check if a record has valid month data
  const hasValidMonth = (item: any): boolean => {
    return item.month && item.month.trim() !== '';
  };

  // Enhanced date parser to handle various date formats
  const parseDate = (dateStr: string, year?: number): Date => {

    if (!dateStr || dateStr.trim() === '') {
      console.warn("⚠️ parseDate: No dateStr provided, returning invalid date");
      return new Date(NaN);
    }

    // Handle ISO date format (YYYY-MM-DD) - this is what the database returns
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // Handle month name format (e.g., "April")
    
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
      console.log(`🔧 parseDate: Fixed misspelling "${dateStr}" -> "${fixedDateStr}"`);
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


      
      
      // Use centralized normalizeBusinessUnitName function (imported from utils)

      const mappedData = jsonData.map((row: any) => {

        // Helper function to convert empty strings to null

        const stringOrNull = (value: any): string | null => {

          const str = String(value || '').trim();

          return str === '' ? null : str;

        };



        return {

          business_unit: normalizeBusinessUnitName(stringOrNull(row['Business_Unit'] || row['Business Unit'] || row.business_unit)),

          month: stringOrNull(row['Month'] || row.month),

          year: parseNumericValue(row['Year'] || row.year) || null,

          hc: parseNumericValue(row['HC'] || row.hc),

          revenue: parseNumericValue(row['Revenue'] || row.revenue),

          gpm: parseNumericValue(row['GPM'] || row.gpm),

          team_cost: parseNumericValue(row['Team Cost'] || row['Team_Cost'] || row.team_cost),

          net_margin: parseNumericValue(row['Net Margin'] || row['Net_Margin'] || row.net_margin),

        };

      });



      try {


        
        
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


            await apiClient.post("/team-summary-report/bulk", { data: batch });

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

        
        
        // Refresh data - let the main fetchData function handle data processing
        // This ensures consistent data processing and avoids duplicate processing
        
        
        
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

      'Revenue': row.revenue,

      'GPM': row.gpm,

      'GPM %': row.gpm_percentage,

      'Loan Encash': row.leave_encashment,

      'Team Cost': row.team_cost,

      'Opr Cost': row.opr_cost,

      'Funding Cost': row.funding_cost,

      'Net Margin': row.net_margin,

      'NP %': row.np_percentage,

      'Month': row.month,

      'Year': row.year,

    }));



    const worksheet = XLSX.utils.json_to_sheet(exportData);

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "TeamReport");

    XLSX.writeFile(workbook, "TeamReport.xlsx");

  };



  // Handle Excel template download for team_summary_report

  const handleDownloadTemplate = () => {

    // Create a template with only headers for the new simplified structure

    const templateData = [

      {

        'Business_Unit': '',

        'Month': '',

        'Year': '',

        'HC': '',

        'Revenue': '',

        'GPM': '',

        'Team Cost': '',

        'Net Margin': '',

      }

    ];



    const worksheet = XLSX.utils.json_to_sheet(templateData);

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "MFS_Summary_Template");

    XLSX.writeFile(workbook, "MFS_Summary_Template.xlsx");

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

      label: 'Download MFS Template',

      onClick: handleDownloadTemplate

    },

    {

      key: 'import',

      label: 'Import MFS',

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

    
    // If comparing by quarters and this is the first selection, auto-suggest corresponding quarter
    if (compareType === 'quarter' && index === 0 && value) {
      const correspondingQuarter = getCorrespondingPreviousQuarter(value);
      console.log("🔍 Auto-selecting quarter:", {
        selectedQuarter: value,
        correspondingQuarter,
        availableOptions,
        isAvailable: correspondingQuarter && availableOptions.includes(correspondingQuarter)
      });
      
      if (correspondingQuarter && availableOptions.includes(correspondingQuarter)) {
        newValues[1] = correspondingQuarter;
        message.success(`Auto-selected corresponding quarter: ${correspondingQuarter}`);
      } else {
        console.log("🔍 Could not auto-select quarter:", {
          correspondingQuarter,
          availableOptions: availableOptions.slice(0, 10) // Show first 10 for debugging
        });
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

  // Fetch Client MFS data when admin selects a single business unit OR for BU heads
  useEffect(() => {
    const fetchClientMFSData = async () => {
      // Priority: selectedBusinessUnit (main view) > selectedBusinessUnitsForChart (chart view) > user.business_unit (BU head)
      let selectedBU: string | null = null;
      
      if (isBUHead && user?.business_unit) {
        // BU head: use their business unit
        const normalizedBU = normalizeBusinessUnitName(user.business_unit);
        selectedBU = normalizedBU || user.business_unit;
      } else if (selectedBusinessUnit) {
        // Main comparison view: use selectedBusinessUnit if set
        selectedBU = selectedBusinessUnit;
      } else if (selectedBusinessUnitsForChart) {
        // Chart view: check if single BU is selected
        selectedBU = Array.isArray(selectedBusinessUnitsForChart) 
          ? (selectedBusinessUnitsForChart.length === 1 ? selectedBusinessUnitsForChart[0] : null)
          : selectedBusinessUnitsForChart;
      }

      if (!selectedBU) {
        setClientMFSData([]);
        return;
      }

      setIsLoadingClientMFS(true);
      try {
        // Fetch all team-report data (same as ClientMFSCompare does)
        // Using /team-report endpoint which queries team_report table (has client_name, project_name)
        // This is the Client MFS data source, NOT team-summary-report (MFS)
        const res = await apiClient.get("/team-report");

        if (res.data && Array.isArray(res.data)) {
          console.log(`🔍 Fetched ${res.data.length} total records from /team-report (Client MFS)`);
          console.log(`🔍 Sample record structure:`, res.data[0]);
          
          // Filter by business unit on frontend (using normalized comparison)
          const filteredData = res.data.filter((item: any) => {
            return compareBusinessUnits(item.business_unit, selectedBU);
          });
          
          console.log(`🔍 Filtered to ${filteredData.length} records for BU: ${selectedBU}`);
          console.log(`🔍 Sample filtered records:`, filteredData.slice(0, 3));
          console.log(`🔍 Records with client_name:`, filteredData.filter((item: any) => item.client_name).length);
          console.log(`🔍 Records with project_name:`, filteredData.filter((item: any) => item.project_name).length);
          
          setClientMFSData(filteredData);
        } else {
          console.warn(`⚠️ No data received from /team-report API`);
          setClientMFSData([]);
        }
      } catch (error: any) {
        console.error("❌ Error fetching Client MFS data:", error);
        setClientMFSData([]);
      } finally {
        setIsLoadingClientMFS(false);
      }
    };

    fetchClientMFSData();
  }, [selectedBusinessUnit, selectedBusinessUnitsForChart, isBUHead, user?.business_unit]);

  // Helper function to check if a specific business unit is selected (for showing Client Data button)
  // Check both selectedBusinessUnit (main view) and selectedBusinessUnitsForChart (chart view)
  const isSpecificBusinessUnitSelected = useMemo(() => {
    // BU head always has their specific BU
    if (isBUHead && user?.business_unit) {
      return true;
    }
    
    // Check main comparison view business unit selection
    if (selectedBusinessUnit) {
      return true;
    }
    
    // Check chart view business unit selection
    if (!selectedBusinessUnitsForChart) return false;
    
    // For admin: check if it's a single business unit (string or array with 1 element)
    if (Array.isArray(selectedBusinessUnitsForChart)) {
      return selectedBusinessUnitsForChart.length === 1;
    }
    
    return typeof selectedBusinessUnitsForChart === 'string';
  }, [selectedBusinessUnit, selectedBusinessUnitsForChart, isBUHead, user?.business_unit]);

  // Get the selected business unit for Client Data table
  // Priority: selectedBusinessUnit (main view) > selectedBusinessUnitsForChart (chart view) > user.business_unit (BU head)
  const getSelectedBUForClientData = useMemo(() => {
    // BU head: use their business unit
    if (isBUHead && user?.business_unit) {
      const normalizedBU = normalizeBusinessUnitName(user.business_unit);
      return normalizedBU || user.business_unit;
    }
    
    // Main comparison view: use selectedBusinessUnit if set
    if (selectedBusinessUnit) {
      return selectedBusinessUnit;
    }
    
    // Chart view: use selectedBusinessUnitsForChart if it's a single BU
    if (!selectedBusinessUnitsForChart) return null;
    
    if (Array.isArray(selectedBusinessUnitsForChart)) {
      return selectedBusinessUnitsForChart.length === 1 ? selectedBusinessUnitsForChart[0] : null;
    }
    
    return selectedBusinessUnitsForChart;
  }, [selectedBusinessUnit, selectedBusinessUnitsForChart, isBUHead, user?.business_unit]);

  // Define all available parameters for Client Data table
  const allClientDataParameters = [
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
  const clientDataParameters = useMemo(() => {
    if (clientDataSelectedParameters.length === 0) {
      return allClientDataParameters;
    }
    return allClientDataParameters.filter(p => clientDataSelectedParameters.includes(p.key));
  }, [clientDataSelectedParameters]);

  // Helper functions for Client Data table
  const normalizeToFullMonthName = (monthName: any): string => {
    if (!monthName) return '';
    const str = String(monthName).trim();
    const fullMonthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    // Handle date strings from API (e.g. "2025-04-01", "04-01-2025")
    const dateMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); // YYYY-MM-DD
    if (dateMatch) {
      const monthNum = parseInt(dateMatch[2], 10);
      if (monthNum >= 1 && monthNum <= 12) return fullMonthNames[monthNum - 1];
    }
    const dmyMatch = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})$/); // DD-MM-YYYY or MM-DD-YYYY
    if (dmyMatch) {
      const first = parseInt(dmyMatch[1], 10);
      const second = parseInt(dmyMatch[2], 10);
      const monthNum = (first <= 12 && second > 12) ? first : (second <= 12 ? second : first);
      if (monthNum >= 1 && monthNum <= 12) return fullMonthNames[monthNum - 1];
    }
    const abbreviationMap: { [key: string]: string } = {
      'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April',
      'May': 'May', 'Jun': 'June', 'Jul': 'July', 'Aug': 'August',
      'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December'
    };
    const normalized = str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    return abbreviationMap[normalized] || normalized;
  };

  const getClientDataMonthNumber = (monthName: string): number => {
    const fullMonthName = normalizeToFullMonthName(monthName);
    const months: { [key: string]: number } = {
      'January': 1, 'February': 2, 'March': 3, 'April': 4, 'May': 5, 'June': 6,
      'July': 7, 'August': 8, 'September': 9, 'October': 10, 'November': 11, 'December': 12
    };
    return months[fullMonthName] || 0;
  };

  const getClientDataMonthKey = (month: string, year: number): string => {
    const fullMonthName = normalizeToFullMonthName(month);
    const monthNum = getClientDataMonthNumber(fullMonthName);
    return `${year}-${String(monthNum).padStart(2, '0')}`;
  };

  // When the business unit selected in the filter changes, default Client Data to current FY for that BU
  useEffect(() => {
    if (getSelectedBUForClientData) {
      setClientDataPeriodFilter('year');
      setClientDataPeriodValue(String(getCurrentFinancialYear()));
      setClientDataSelectedMonths([]);
      setClientDataSelectedClients([]);
    }
  }, [getSelectedBUForClientData]);

  // Filter Client MFS Data based on filters
  const filteredClientMFSData = useMemo(() => {
    if (!getSelectedBUForClientData) {
      console.log('🔍 Client Data: No selected BU');
      return [];
    }
    
    if (!clientMFSData.length) {
      console.log('🔍 Client Data: No clientMFSData available');
      return [];
    }
    
    console.log(`🔍 Client Data: Filtering ${clientMFSData.length} records for BU: ${getSelectedBUForClientData}`);
    
    let filtered = clientMFSData.filter((item: any) => {
      return compareBusinessUnits(item.business_unit, getSelectedBUForClientData);
    });
    
    console.log(`🔍 Client Data: Filtered to ${filtered.length} records`);

    // Filter by period
    if (clientDataPeriodFilter === 'year' && clientDataPeriodValue) {
      const fyStartYear = parseInt(clientDataPeriodValue);
      const fyEndYear = fyStartYear + 1;
      filtered = filtered.filter((item: any) => {
        if (!item.month || !item.year) return false;
        const monthName = normalizeToFullMonthName(item.month);
        const monthNum = getClientDataMonthNumber(monthName);
        // FY: April (4) to December (12) of start year, January (1) to March (3) of end year
        if (monthNum >= 4) {
          return item.year === fyStartYear;
        } else {
          return item.year === fyEndYear;
        }
      });
    } else if (clientDataPeriodFilter === 'quarter' && clientDataPeriodValue) {
      const quarterMatch = clientDataPeriodValue.match(/Q(\d)/);
      const yearMatch = clientDataPeriodValue.match(/(\d{4})/);
      if (quarterMatch && yearMatch) {
        const quarter = parseInt(quarterMatch[1]);
        const year = parseInt(yearMatch[1]);
        const quarterMonths: { [key: number]: number[] } = {
          1: [4, 5, 6],   // Q1: Apr, May, Jun
          2: [7, 8, 9],   // Q2: Jul, Aug, Sep
          3: [10, 11, 12], // Q3: Oct, Nov, Dec
          4: [1, 2, 3]    // Q4: Jan, Feb, Mar
        };
        const monthsInQuarter = quarterMonths[quarter] || [];
        const displayYear = quarter === 4 ? year + 1 : year;
        filtered = filtered.filter((item: any) => {
          if (!item.month || !item.year) return false;
          const monthName = normalizeToFullMonthName(item.month);
          const monthNum = getClientDataMonthNumber(monthName);
          return item.year === displayYear && monthsInQuarter.includes(monthNum);
        });
      }
    } else if (clientDataPeriodFilter === 'month' && clientDataSelectedMonths.length > 0) {
      filtered = filtered.filter((item: any) => {
        if (!item.month || !item.year) return false;
        const monthName = normalizeToFullMonthName(item.month);
        const monthKey = getClientDataMonthKey(monthName, item.year);
        const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const [year, monthNum] = monthKey.split('-');
        const displayMonth = `${monthNames[parseInt(monthNum)]} ${year}`;
        return clientDataSelectedMonths.includes(displayMonth);
      });
    }

    return filtered;
  }, [clientMFSData, getSelectedBUForClientData, clientDataPeriodFilter, clientDataPeriodValue, clientDataSelectedMonths]);

  // Get unique clients from filtered data (for the selected BU)
  const clientDataClients = useMemo(() => {
    const clientSet = new Set<string>();
    filteredClientMFSData.forEach((item: any) => {
      if (item.client_name) {
        clientSet.add(item.client_name);
      }
    });
    return Array.from(clientSet).sort();
  }, [filteredClientMFSData]);

  // Clients to show in table: selected ones or all
  const clientDataClientsToShow = useMemo(() => {
    if (!clientDataSelectedClients.length) return clientDataClients;
    return clientDataSelectedClients.filter(c => clientDataClients.includes(c));
  }, [clientDataSelectedClients, clientDataClients]);

  // Get unique months from filtered data
  const clientDataMonths = useMemo(() => {
    const monthSet = new Set<string>();
    filteredClientMFSData.forEach((item: any) => {
      if (item.month && item.year) {
        const monthName = normalizeToFullMonthName(item.month);
        const monthKey = getClientDataMonthKey(monthName, item.year);
        const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const [year, monthNum] = monthKey.split('-');
        const displayMonth = `${monthNames[parseInt(monthNum)]} ${year}`;
        monthSet.add(displayMonth);
      }
    });
    return Array.from(monthSet).sort();
  }, [filteredClientMFSData]);

  // Generate quarter options
  const clientDataQuarterOptions = useMemo(() => {
    const options: string[] = [];
    const currentFY = getCurrentFinancialYear();
    for (let i = 0; i < 3; i++) {
      const year = currentFY - i;
      options.push(`Q1(Apr-Jun) ${year}`);
      options.push(`Q2(Jul-Sep) ${year}`);
      options.push(`Q3(Oct-Dec) ${year}`);
      options.push(`Q4(Jan-Mar) ${year + 1}`);
    }
    return options;
  }, []);

  // Generate year options
  const clientDataYearOptions = useMemo(() => {
    const options: number[] = [];
    const currentFY = getCurrentFinancialYear();
    for (let i = 0; i < 5; i++) {
      options.push(currentFY - i);
    }
    return options;
  }, []);

  // Build table data: clients as rows, parameters x months as columns
  const clientDataTableData = useMemo(() => {
    if (!clientDataClientsToShow.length || !clientDataMonths.length) return [];
    
    const rows: Array<{ client: string; [key: string]: any }> = [];
    
    clientDataClientsToShow.forEach(client => {
      const row: any = { client };
      
      clientDataMonths.forEach(monthDisplay => {
        const [monthName, yearStr] = monthDisplay.split(' ');
        const year = parseInt(yearStr);
        const monthNames: { [key: string]: string } = {
          'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April',
          'May': 'May', 'Jun': 'June', 'Jul': 'July', 'Aug': 'August',
          'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December'
        };
        const fullMonthName = monthNames[monthName] || monthName;
        const monthKey = getClientDataMonthKey(fullMonthName, year);
        
                        clientDataParameters.forEach(param => {
                          const cellKey = `${param.key}_${monthKey}`;
                          // Sum all matching records (multiple rows per client/month e.g. per project)
                          const matchingRecords = filteredClientMFSData.filter((item: any) => {
                            const itemYear = item.year != null ? Number(item.year) : null;
                            if (itemYear !== year) return false;
                            return item.client_name === client &&
                              normalizeToFullMonthName(item.month) === fullMonthName;
                          });
                          if (matchingRecords.length === 0) {
                            row[cellKey] = null; // not available -> show "-"
                            return;
                          }
                          const hasAnyValue = matchingRecords.some((item: any) => {
                            const v = item[param.key];
                            return v != null && v !== '';
                          });
                          if (!hasAnyValue) {
                            row[cellKey] = null; // no value in any record -> show "-"
                            return;
                          }
                          const numValue = matchingRecords.reduce((sum: number, item: any) => {
                            const raw = item[param.key];
                            return sum + parseNumericValue(raw);
                          }, 0);
                          row[cellKey] = numValue;
                        });
      });
      
      rows.push(row);
    });
    
    return rows;
  }, [clientDataClientsToShow, clientDataMonths, clientDataParameters, filteredClientMFSData]);

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

      'Revenue',

      'GPM',

      'Team Cost',

      'Net Margin',

      // Efficiency metrics from Efficiency Dashboard

      'Cost Efficiency',

      'Revenue per HC',

      'Margin per Team Cost',

      'Team Cost % of Revenue',

      'Net Margin %',

      'Net Margin per HC'

    ];

    
    
    setAvailableParameters(baseParameters);

  }, [data]);



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


      
      
      const res = await apiClient.get("/team-summary-report");


      
      
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
        
        const uniqueBusinessUnits = Array.from(unitsSet).sort() as string[];


        
        
        setBusinessUnits(uniqueBusinessUnits);
        
        // Initialize selectedBusinessUnitsForChart
        // For BU heads, only show their business unit; for admin, show all business units by default
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
            // For admin users, select all business units by default
            setSelectedBusinessUnitsForChart(uniqueBusinessUnits);
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



  // Fetch client names based on selected business unit

  const fetchClientNames = async (businessUnit: string | null) => {

    if (!businessUnit) {

      setClientNames([]);

      return;

    }

    
    
    try {

      console.log(`🔍 Fetching client names for business unit: ${businessUnit}`);

      const res = await apiClient.get("/team-summary-report");

      
      
      console.log(`🔍 Raw client data for ${businessUnit}:`, res.data);

      console.log(`🔍 Total records for ${businessUnit}:`, res.data?.length || 0);

      
      
      if (res.data && Array.isArray(res.data)) {

        // Filter data by business unit first (using normalized comparison)

        const filteredData = res.data.filter((item: any) => 

          compareBusinessUnits(item.business_unit, businessUnit)

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

      const res = await apiClient.get("/team-summary-report");

      
      
      console.log(`🔍 Raw BU head data for ${businessUnit}:`, res.data);

      console.log(`🔍 Total records for ${businessUnit}:`, res.data?.length || 0);

      
      
      if (res.data && Array.isArray(res.data)) {

        // Filter data by business unit first (using normalized comparison)

        const filteredData = res.data.filter((item: any) => 

          compareBusinessUnits(item.business_unit, businessUnit)

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

  // Log initial state for debugging
  useEffect(() => {
    // Component mounted with forced defaults
  }, []); // Run only on mount

  useEffect(() => {

    const fetchData = async () => {

      setIsLoading(true);

      try {


        
        
        // Always fetch all data and filter on frontend for better control

        const res = await apiClient.get("/team-summary-report");

        
        
        
        // Debug: Show ALL month data to understand the issue
        if (res.data && Array.isArray(res.data)) {
          console.warn(`🔍 TOTAL RECORDS: ${res.data.length}`);
          console.log("🔍 Raw API response:", res.data);
          console.log("🔍 Number of records:", res.data?.length || 0);
          if (res.data.length > 0) {
            console.log("🔍 First record sample:", res.data[0]);
            console.log("🔍 Year values in data:", res.data.map((item: any) => item.year));
          }
          
          // Show all unique month values
          const uniqueMonths = Array.from(new Set(res.data.map(item => item.month)));
          console.warn(`🔍 UNIQUE MONTHS:`, uniqueMonths);
          
          // Check a few months to see if the issue is July-specific
          const testMonths = ['2023-06-01', '2023-07-01', '2023-08-01', '2024-06-01', '2024-07-01', '2024-08-01'];
          
          testMonths.forEach(testMonth => {
            const monthRecords = res.data.filter((item: any) => item.month === testMonth);
            if (monthRecords.length > 0) {
              const totalRevenue = monthRecords.reduce((sum: number, item: any) => sum + (item.revenue || 0), 0);
              console.warn(`🔍 ${testMonth}: ${monthRecords.length} records, total revenue: ${totalRevenue}`);
            }
          });
          
          // Show July records specifically (handle both DATE format and text format)
          const julyRecords = res.data.filter((item: any) => {
            const month = item.month || '';
            // Handle DATE format (YYYY-MM-DD)
            if (month.match(/^\d{4}-\d{2}-\d{2}$/)) {
              return month.includes('-07-01'); // July 1st
            }
            // Handle text format
            return month.toLowerCase().includes('july');
          });
          console.warn(`🔍 JULY RECORDS FOUND: ${julyRecords.length}`);
          
          if (julyRecords.length > 0) {
            julyRecords.forEach((record, index) => {
              console.warn(`🔍 July Record ${index + 1}:`, {
                month: record.month,
                year: record.year,
                revenue: record.revenue,
                business_unit: record.business_unit,
                client_name: record.client_name
              });
            });
            
            // Calculate totals by year
            const julyByYear = julyRecords.reduce((acc: any, item: any) => {
              const year = item.year;
              if (!acc[year]) acc[year] = { records: [], total: 0 };
              acc[year].records.push(item);
              acc[year].total += item.revenue || 0;
              return acc;
            }, {});
            
            Object.keys(julyByYear).forEach(year => {
              console.warn(`🔍 July ${year}: ${julyByYear[year].records.length} records, total: ${julyByYear[year].total}`);
              
              // Check for duplicate business units or clients
              const businessUnits = Array.from(new Set(julyByYear[year].records.map((r: any) => r.business_unit)));
              const clients = Array.from(new Set(julyByYear[year].records.map((r: any) => r.client_name)));
              
              if (businessUnits.length > 1) {
                console.warn(`🔍 July ${year} has multiple business units:`, businessUnits);
              }
              if (clients.length > 1) {
                console.warn(`🔍 July ${year} has multiple clients:`, clients);
              }
            });
          }
        }

        
        
        // Filter data on frontend

        let filteredData = (res.data || []).filter(hasValidMonth);

        
        
        if (selectedBusinessUnit) {

          filteredData = filteredData.filter((item: any) => 

            compareBusinessUnits(item.business_unit, selectedBusinessUnit)

          );


        }

        
        
        if (selectedClientName) {

          const normalizedBU = normalizeBusinessUnitName(selectedBusinessUnit);
          if (normalizedBU === 'MS' || selectedBusinessUnit === "Managed Services" || selectedBusinessUnit === "MS") {

            filteredData = filteredData.filter((item: any) => 

              item.project_name === selectedClientName

            );


          } else {

            filteredData = filteredData.filter((item: any) => 

              item.client_name === selectedClientName

            );


          }

        }

        
        
        if (selectedBUHead) {

          filteredData = filteredData.filter((item: any) => 

            item.bu_head === selectedBUHead

          );


        }

        
        
        if (isBUHead && user.business_unit) {

          filteredData = filteredData.filter((item: any) => 

            compareBusinessUnits(item.business_unit, user.business_unit)

          );


        }

        
        
        
        // Debug: Check what years are in the data
        const yearsInData = Array.from(new Set(filteredData.map((item: any) => {
          const date = parseDate(item.month, item.year);
          return date ? date.getFullYear() : null;
        }).filter((year: any) => year !== null))).sort();
        

        
        
        // Convert amounts to numbers and handle formatting

        const convertedData = filteredData.map((item: any) => {

          // Convert numeric fields to numbers

          const numericFields = ['hc', 'revenue', 'gpm', 'team_cost', 'net_margin', 'year'];

          
          
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

          // Handle 2-digit year conversion (e.g., 23 -> 2023, 24 -> 2024)
          if (processedItem.year && processedItem.year < 100) {
            console.log(`🔍 Converting 2-digit year: ${processedItem.year} -> ${2000 + processedItem.year}`);
            if (processedItem.year >= 0 && processedItem.year <= 99) {
              // Assume years 0-99 map to 2000-2099
              processedItem.year = 2000 + processedItem.year;
            }
          }

          // Debug: Log processed item after year conversion
          console.log(`🔍 Processed item after conversion:`, {
            month: processedItem.month,
            year: processedItem.year,
            business_unit: processedItem.business_unit
          });

          

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
        setData(validData);

      } catch (error: any) {

        console.error("Error fetching data:", error);

      } finally {

        setIsLoading(false);

      }

    };



    fetchData();

  }, [selectedBusinessUnit, selectedClientName, selectedBUHead, isBUHead, user?.business_unit]);

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

  // Fetch CTS Summary data for Revenue KPI card
  useEffect(() => {
    const fetchCTSSummary = async () => {
      try {
        const response = await apiClient.get('/CTS-Summary');
        if (Array.isArray(response.data)) {
          setCtsSummaryData(response.data);
        }
      } catch (error: any) {
        console.error("Error fetching CTS Summary:", error);
      }
    };
    fetchCTSSummary();
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

  // Get the last month's row from CTS Summary (most recent month present in target period)
  const getLastMonthCTSRow = (): any | null => {
    if (!ctsSummaryData || ctsSummaryData.length === 0) return null;

    const targetMonths = getTargetMonthsForRouting();
    const matching = ctsSummaryData
      .map((item: any) => {
        const itemYear = typeof item.year === 'number' ? item.year : parseInt(item.year, 10);
        const itemMonth = typeof item.month === 'number' ? item.month : parseInt(item.month, 10);
        if (isNaN(itemYear) || isNaN(itemMonth)) return null;
        const matches = targetMonths.some(
          (t: { month: number; year: number }) => t.month === itemMonth && t.year === itemYear
        );
        return matches ? { ...item, _year: itemYear, _month: itemMonth } : null;
      })
      .filter(Boolean) as any[];

    if (matching.length === 0) return null;
    // Sort descending by year then month; first = last month
    matching.sort((a, b) => (b._year !== a._year ? b._year - a._year : b._month - a._month));
    return matching[0];
  };

  // Revenue KPI: CTS = last month's Current PO Value from CTS Summary
  const calculateCTSValue = (): number => {
    const row = getLastMonthCTSRow();
    if (!row) return 0;
    const val = row["Current PO Value"];
    const num = typeof val === 'number' ? val : parseFloat(val);
    return !isNaN(num) ? num : 0;
  };

  // GPM & NP KPI: CTS = last month's Current Margin from CTS Summary
  const calculateCTSMargin = (): number => {
    const row = getLastMonthCTSRow();
    if (!row) return 0;
    const val = row["Current Margin"];
    const num = typeof val === 'number' ? val : parseFloat(val);
    return !isNaN(num) ? num : 0;
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
      // Business unit filter
      if (selectedBusinessUnit && !compareBusinessUnits(item.business_unit, selectedBusinessUnit)) {
        return false;
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
          
          // Debug Q4 2025 data for FY 2024
          if (targetYear === 2024 && itemYear === 2025 && (itemMonth === 1 || itemMonth === 2 || itemMonth === 3)) {
            console.log(`🔍 Q4 2025 Filtering Debug:`, {
              itemMonth,
              itemYear,
              targetYear,
              isInTargetFY,
              periodValue,
              item: { month: item.month, year: item.year },
              shouldInclude: isInTargetFY
            });
          }
          
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
  }, [data, selectedBusinessUnit, compareType]);

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
      
      console.log(`🔍 Q4 2025 Debug for FY 2024:`, {
        periodValue,
        parameter,
        filteredDataCount: filteredData.length,
        q4DataInRawDataset: q4DataInRawDataset.length,
        q4DataInFiltered: filteredData.filter(item => {
          const itemDate = parseDate(item.month, item.year);
          const itemYear = itemDate.getFullYear();
          const itemMonth = itemDate.getMonth() + 1;
          return itemYear === 2025 && (itemMonth === 1 || itemMonth === 2 || itemMonth === 3);
        }).length,
        allMonths: filteredData.map(item => `${item.month} ${item.year}`).sort(),
        q4SampleData: q4DataInRawDataset.slice(0, 3)
      });
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
      // For all other parameters: aggregate by month first, then sum
      const monthlyTotals: {[key: string]: number} = {};
      filteredData.forEach(item => {
        const monthKey = `${item.month} ${item.year}`;
        if (!monthlyTotals[monthKey]) {
          monthlyTotals[monthKey] = 0;
        }
        // Map parameter names to database field names
        let fieldName = parameter.toLowerCase();
        if (parameter === 'Team Cost') fieldName = 'team_cost';
        if (parameter === 'NP' || parameter === 'Net Margin') fieldName = 'net_margin';
        if (parameter === 'GPM') fieldName = 'gpm';
        if (parameter === 'Revenue') fieldName = 'revenue';
        
        // Debug Net Margin mapping
        if (parameter === 'Net Margin') {
          console.log(`🔍 Net Margin Debug:`, {
            parameter,
            fieldName,
            itemValue: item[fieldName],
            monthKey
          });
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

        return total + data

          .filter(item => {

            if (selectedBusinessUnit && !compareBusinessUnits(item.business_unit, selectedBusinessUnit)) {

              return false;

            }

            // Client name/project name filter disabled for team_summary_report (fields don't exist)
            // if (selectedClientName) {
            //   if (selectedBusinessUnit === "Managed Services" || selectedBusinessUnit === "MS") {
            //     if (item.project_name !== selectedClientName) return false;
            //   } else {
            //     if (item.client_name !== selectedClientName) return false;
            //   }
            // }

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

          })

          .reduce((sum, item) => {

                  // Get the value based on the selected parameter

                  let value = 0;

                  switch (parameter) {

                    case 'Revenue': value = item.revenue || 0; break;

                    case 'GPM': value = item.gpm || 0; break;

                    case 'Net Margin': value = item.net_margin || 0; break;
                    case 'NP': value = item.net_margin || 0; break; // NP maps to net_margin

                    case 'Team Cost': value = item.team_cost || 0; break;

                    // Old fields removed for team_summary_report structure
                    // case 'Opr Cost': value = item.opr_cost || 0; break;
                    // case 'Funding Cost': value = item.funding_cost || 0; break;
                    // case 'Leave Encashment': value = item.leave_encashment || 0; break;

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

      if (selectedBusinessUnit && !compareBusinessUnits(item.business_unit, selectedBusinessUnit)) {

        return false;

      }

      
      
      // Client name/project name filter disabled for team_summary_report (fields don't exist)
      // if (selectedClientName) {
      //   if (selectedBusinessUnit === "Managed Services" || selectedBusinessUnit === "MS") {
      //     if (item.project_name !== selectedClientName) return false;
      //   } else {
      //     if (item.client_name !== selectedClientName) return false;
      //   }
      // }

      
      
      // BU head filter disabled for team_summary_report (field doesn't exist)
      // if (selectedBUHead && item.bu_head !== selectedBUHead) {
      //   return false;
      // }

      
      
      // Date parsing and period matching

      const date = parseDate(item.month, item.year);

      if (isNaN(date.getTime())) {

        console.log(`🔍 Invalid date for item:`, item.month, item);

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

          case 'Revenue': value = item.revenue || 0; break;

          case 'GPM': value = item.gpm || 0; break;

          case 'Net Margin': value = item.net_margin || 0; break;
          case 'NP': value = item.net_margin || 0; break; // NP maps to net_margin

          case 'Team Cost': value = item.team_cost || 0; break;

          // Old fields removed for team_summary_report structure
          // case 'Opr Cost': value = item.opr_cost || 0; break;
          // case 'Funding Cost': value = item.funding_cost || 0; break;
          // case 'Leave Encashment': value = item.leave_encashment || 0; break;

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

      // Use KPI dashboard logic for consistent data calculation
      const value = getParameterValueUsingKPILogic(periodValue, parameter);

      console.log(`🔍 Parameter ${parameter} for period ${periodValue} (using KPI logic): ${value}`);

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
    console.log("🔍 availableParameters:", availableParameters);
    console.log("🔍 availableParameters length:", availableParameters.length);
    console.log("🔍 selectedParameters:", selectedParameters);
    console.log("🔍 selectedParameters length:", selectedParameters.length);
    // Removed showAllParameters logging
    console.log("🔍 comparisonValues:", comparisonValues);
    console.log("🔍 data length:", data.length);

    
    
    if (comparisonValues.filter(Boolean).length < 2) {

      console.log("🔍 Not enough periods for growth analysis, skipping");

      setGrowthAnalysis([]);

      return;

    }



    const calculateGrowth = (): GrowthAnalysis[] => {
      console.log("🔍 calculateGrowth called with availableParameters:", availableParameters);
      
      // Efficiency metrics to exclude from growth analysis (only show in parameter bar chart)
      const efficiencyMetrics = [
        'Cost Efficiency',
        'Revenue per HC',
        'Margin per Team Cost',
        'Team Cost % of Revenue',
        'Net Margin per HC'
      ];
      
      // Filter out efficiency metrics and Net Margin % from growth analysis
      // Net Margin % is already displayed below Net Margin values, so no need for separate row
      // Team Cost is needed for efficiency dashboard calculations, but will be filtered from table display
      const growthAnalysisParams = availableParameters.filter(param => 
        param !== 'Net Margin %' && 
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
                  if (selectedBusinessUnit && !compareBusinessUnits(item.business_unit, selectedBusinessUnit)) return false;
                  // Client name/project name filter disabled for team_summary_report (fields don't exist)
                  // if (selectedClientName) {
                  //   if (selectedBusinessUnit === "Managed Services" || selectedBusinessUnit === "MS") {
                  //     if (item.project_name !== selectedClientName) return false;
                  //   } else {
                  //     if (item.client_name !== selectedClientName) return false;
                  //   }
                  // }
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
                
                console.log(`🔍 Growth Analysis Combined Period HC Debug for ${periodValue}:`, {
                  lastMonth: `${lastMonthData.month} ${lastMonthData.year}`,
                  hcValue,
                  allPeriodDataCount: allPeriodData.length,
                  lastMonthDataCount: allPeriodData.filter(item => {
                    const itemDate = parseDate(item.month, item.year);
                    return itemDate.getMonth() === lastMonthDate.getMonth() && 
                           itemDate.getFullYear() === lastMonthDate.getFullYear();
                  }).length,
                  sampleAllPeriodData: allPeriodData.slice(0, 3).map(item => ({
                    month: item.month,
                    year: item.year,
                    business_unit: item.business_unit,
                    hc: item.hc
                  }))
                });
                
                return hcValue;
              }
              return 0;
            }

            // For all other parameters: sum all months
            return combinedPeriod.periods.reduce((total, period) => {

              return total + data

                .filter(item => {

                  if (selectedBusinessUnit && !compareBusinessUnits(item.business_unit, selectedBusinessUnit)) return false;

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

                })

                .reduce((sum, item) => {

                  // Get the value based on the selected parameter

                  let value = 0;

                  switch (param) {

                    case 'Revenue': value = item.revenue || 0; break;

                    case 'GPM': value = item.gpm || 0; break;

                    case 'Net Margin': value = item.net_margin || 0; break;

                    case 'Team Cost': value = item.team_cost || 0; break;

                    // Old fields removed for team_summary_report structure
                    // case 'Opr Cost': value = item.opr_cost || 0; break;
                    // case 'Funding Cost': value = item.funding_cost || 0; break;
                    // case 'Leave Encashment': value = item.leave_encashment || 0; break;

                    case 'HC': value = item.hc || 0; break;

                    default: value = 0;

                  }

                  return sum + value;

                }, 0);

            }, 0);

          }

          
          
          // Single period calculation

          const filteredData = data.filter(item => {

              if (selectedBusinessUnit && !compareBusinessUnits(item.business_unit, selectedBusinessUnit)) return false;

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



        // Calculate projection for first period (current year) if it's a year comparison
        let predictedAmount = 0;
        let sumAmount = 0;
        const firstPeriodAmount = periodAmounts[0] || 0;
        const firstPeriodActual = typeof firstPeriodAmount === 'number' ? firstPeriodAmount : parseFloat(String(firstPeriodAmount)) || 0;
        
        // Only calculate projection for year comparisons and if we have actual data
        if (compareType === 'year' && firstPeriodActual > 0 && comparisonValues[0]) {
          // Get KPI data for this parameter to use the same projection logic
          const kpiDataForParam = calculateKPIs();
          // Map parameter name to KPI key (KPI uses 'NP' for 'Net Margin')
          const paramKey = param === 'Net Margin' ? 'NP' : param;
          const kpiForParam = kpiDataForParam[paramKey];
          
          if (kpiForParam) {
            // Use the same projection logic from KPI dashboard
            predictedAmount = kpiForParam.projectedAmount || 0;
            sumAmount = kpiForParam.currentFY || firstPeriodActual; // currentFY is the projected value
          } else {
            // Fallback: calculate projection manually if KPI data not available
            const currentFY = getCurrentFinancialYear();
            const currentFYData = data.filter(item => {
              if (selectedBusinessUnit && !compareBusinessUnits(item.business_unit, selectedBusinessUnit)) return false;
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
            
            if (param !== 'HC' && currentFYData.length > 0) {
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
                  case 'GPM': value = item.gpm || 0; break;
                  case 'Net Margin': value = item.net_margin || 0; break;
                  case 'Team Cost': value = item.team_cost || 0; break;
                  default: value = 0;
                }
                monthlyTotals[monthKey] += value;
              });
              
              // Find last month with data
              if (Object.keys(monthlyTotals).length > 0) {
                const monthKeys = Object.keys(monthlyTotals);
                const sortedMonths = monthKeys.sort((a, b) => {
                  const [monthA, yearA] = a.split(' ');
                  const [monthB, yearB] = b.split(' ');
                  const dateA = parseDate(monthA, parseInt(yearA));
                  const dateB = parseDate(monthB, parseInt(yearB));
                  return dateA.getTime() - dateB.getTime();
                });
                
                let lastMonthValue = 0;
                for (let i = sortedMonths.length - 1; i >= 0; i--) {
                  const monthKey = sortedMonths[i];
                  const value = monthlyTotals[monthKey] || 0;
                  if (value > 0) {
                    lastMonthValue = value;
                    break;
                  }
                }
                
                if (lastMonthValue > 0) {
                  const financialYearMonths = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
                  const fullMonthNames = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
                  const lastMonthKey = sortedMonths[sortedMonths.length - 1];
                  const [lastMonth, lastYear] = lastMonthKey.split(' ');
                  let lastMonthIndex = financialYearMonths.indexOf(lastMonth);
                  if (lastMonthIndex === -1) {
                    lastMonthIndex = fullMonthNames.indexOf(lastMonth);
                  }
                  
                  if (lastMonthIndex !== -1) {
                    const actualMonthsRemaining = 12 - (lastMonthIndex + 1);
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
    const chartData = calculateGrowth();
    console.log("🔍 Growth Analysis Chart data (multi-period):", chartData);

    console.log("🔍 Final growth analysis data (multi-period):", chartData);
    console.log("🔍 Chart data length:", chartData.length);
    console.log("🔍 Chart data parameters:", chartData.map(item => item.parameter));
    console.log("🔍 Setting growthAnalysis state with multi-period data:", chartData.length, "items");
    setGrowthAnalysis(chartData);
  }, [availableParameters, comparisonValues, data, compareType, selectedBusinessUnit, selectedClientName, selectedBUHead]);

  // Calculate KPIs when data or comparison values change
  useEffect(() => {
    console.log("🔍 Calculating KPIs...");
    console.log("🔍 comparisonValues:", comparisonValues);
    console.log("🔍 compareType:", compareType);
    console.log("🔍 data length:", data.length);
    
    if (data.length === 0) {
      setKpiData({});
      return;
    }
    
    const kpis = calculateKPIs();
    console.log("🔍 Calculated KPIs:", kpis);
    setKpiData(kpis);
  }, [data, comparisonValues, compareType, selectedBusinessUnit, selectedClientName, selectedBUHead]);

  // Calculate growth percentages for chart data
  const calculateGrowthData = () => {
    if (comparisonData.length === 0 || selectedParameters.length === 0) return [];
    
    console.log("🔍 calculateGrowthData called with:", {
      comparisonData,
      selectedParameters,
      compareType,
      comparisonValues
    });
    
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
            
            console.log(`🔍 Year comparison for ${parameter}:`, {
              currentYear,
              previousYear,
              currentValue,
              periodData
            });
            
            if (currentYear && previousYear) {
              // Find previous year data
              const previousPeriodData = comparisonData.find(p => p.period === previousYear);
              const previousValue = previousPeriodData ? previousPeriodData[parameter] || 0 : 0;
              
              const growthPercentage = previousValue > 0 
                ? ((currentValue - previousValue) / previousValue) * 100 
                : 0;
              
              console.log(`🔍 Growth calculation for ${parameter}:`, {
                currentValue,
                previousValue,
                growthPercentage
              });
              
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

    console.log("🔍 Chart useEffect triggered with:", {
      dataLength: data.length,
      selectedParametersLength: selectedParameters.length,
      compareType: compareType,
      activeChartTab: activeChartTab
    });
    
    if (data.length === 0 || selectedParametersForChart.length === 0 || !selectedBusinessUnitsForChart || 
        (Array.isArray(selectedBusinessUnitsForChart) && selectedBusinessUnitsForChart.length === 0) ||
        activeChartTab !== 'growth') {
      console.log("🔍 Chart useEffect: Not enough data or tab not active, skipping chart render");
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



      // Determine if we should enable horizontal scrolling (for client view with many clients)
      // Note: shouldShowClients is defined later, so we'll update chart settings after data is prepared
      
      const chart = root.container.children.push(

        am5xy.XYChart.new(root, {

          panX: false, // Will be updated if showing clients

          panY: false,

          wheelX: "none", // Will be updated if showing clients

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
            param === 'Leave Encashment' || param === 'Net Margin') {
          return {
            prefix: '',
            suffix: '',
            format: '#,##0'
          };
        } else if (param === 'GPM %' || param === 'NP %' || param === 'Team Cost % of Revenue' || param === 'Net Margin %') {
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
        } else if (param === 'Cost Efficiency' || param === 'Revenue per HC' || param === 'Margin per Team Cost' || param === 'Net Margin per HC') {
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
          // Cost Efficiency = Team Cost / Net Margin
          const totalTeamCost = filteredData.reduce((sum, item) => sum + (Number(item.team_cost) || 0), 0);
          const totalNetMargin = filteredData.reduce((sum, item) => sum + (Number(item.net_margin) || 0), 0);
          return totalNetMargin !== 0 ? totalTeamCost / totalNetMargin : 0;
        } else if (parameter === 'Revenue per HC') {
          // Revenue per HC = Revenue / HC
          const totalRevenue = filteredData.reduce((sum, item) => sum + (Number(item.revenue) || 0), 0);
          const totalHC = filteredData.reduce((sum, item) => sum + (Number(item.hc) || 0), 0);
          return totalHC !== 0 ? totalRevenue / totalHC : 0;
        } else if (parameter === 'Margin per Team Cost') {
          // Margin per Team Cost = Net Margin / Team Cost
          const totalNetMargin = filteredData.reduce((sum, item) => sum + (Number(item.net_margin) || 0), 0);
          const totalTeamCost = filteredData.reduce((sum, item) => sum + (Number(item.team_cost) || 0), 0);
          return totalTeamCost !== 0 ? totalNetMargin / totalTeamCost : 0;
        } else if (parameter === 'Team Cost % of Revenue') {
          // Team Cost % of Revenue = (Team Cost / Revenue) * 100
          const totalTeamCost = filteredData.reduce((sum, item) => sum + (Number(item.team_cost) || 0), 0);
          const totalRevenue = filteredData.reduce((sum, item) => sum + (Number(item.revenue) || 0), 0);
          return totalRevenue !== 0 ? (totalTeamCost / totalRevenue) * 100 : 0;
        } else if (parameter === 'Net Margin %') {
          // Net Margin % = (Net Margin / Revenue) * 100
          const totalNetMargin = filteredData.reduce((sum, item) => sum + (Number(item.net_margin) || 0), 0);
          const totalRevenue = filteredData.reduce((sum, item) => sum + (Number(item.revenue) || 0), 0);
          return totalRevenue !== 0 ? (totalNetMargin / totalRevenue) * 100 : 0;
        } else if (parameter === 'Net Margin per HC') {
          // Net Margin per HC = Net Margin / HC
          const totalNetMargin = filteredData.reduce((sum, item) => sum + (Number(item.net_margin) || 0), 0);
          const totalHC = filteredData.reduce((sum, item) => sum + (Number(item.hc) || 0), 0);
          return totalHC !== 0 ? totalNetMargin / totalHC : 0;
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
      
      // Prepare data: group by business unit OR client (if conditions met)
      // When a single BU is selected, show that BU's client-wise data (from /team-report), not BU-level aggregate
      const isSingleBU = Array.isArray(selectedBusinessUnitsForChart) 
        ? selectedBusinessUnitsForChart.length === 1
        : selectedBusinessUnitsForChart !== null && selectedBusinessUnitsForChart !== undefined;
      
      // Prefer client view when single BU is selected (use clientMFSData from /team-report); fall back to BU view only when multiple BUs
      const shouldShowClients = selectedBusinessUnitsForChart && (isBUHead || isSingleBU);

      if (!selectedBusinessUnitsForChart) {
        return;
      }

      const chartData: any[] = [];
      
      if (shouldShowClients) {
        // Show clients for the selected business unit (data from /team-report has client_name/project_name)
        const selectedBU = isBUHead && user?.business_unit
          ? (normalizeBusinessUnitName(user.business_unit) || user.business_unit)
          : (Array.isArray(selectedBusinessUnitsForChart) ? selectedBusinessUnitsForChart[0] : selectedBusinessUnitsForChart);
        const selectedParameter = selectedParametersForChart[0]; // Use first selected parameter
        
        // Map parameter names to database field names
        const parameterMap: { [key: string]: string } = {
          'Revenue': 'revenue',
          'HC': 'hc',
          'Salary Cost': 'salary_cost',
          'GPM': 'gpm',
          'GPM %': 'gpm_percentage',
          'NP': 'np',
          'NP %': 'np_percentage',
          'Leave Encashment': 'leave_encashment',
          'Team Cost': 'team_cost',
          'Opr Cost': 'opr_cost',
          'Funding Cost': 'funding_cost',
          'Rebate': 'rebate',
          'Passthrough': 'passthrough',
          'Net Margin': 'net_margin'
        };

        const dbFieldName = parameterMap[selectedParameter] || 'revenue';
        const isMS = selectedBU === 'MS' || selectedBU === 'Managed Services';
        
        // Helper function to parse date
        const parseDate = (month: string, year: number): Date => {
          const monthMap: { [key: string]: number } = {
            'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
            'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
          };
          const monthNum = monthMap[month] || 1;
          return new Date(year, monthNum - 1);
        };

        // Group data by client (or project for MS)
        const clientDataMap = new Map<string, number>();

        console.log(`🔍 Processing client data for BU: ${selectedBU}, Total records: ${clientMFSData.length}`);

        clientMFSData.forEach((item: any) => {
          // Filter by business unit (data is already filtered, but double-check)
          if (!compareBusinessUnits(item.business_unit, selectedBU)) {
            return;
          }

          // Apply period filter if set
          if (chartFilterBy && chartFilterValue.length > 0) {
            const date = parseDate(item.month, item.year);
            if (isNaN(date.getTime())) return;

            let matchesFilter = false;
            if (chartFilterBy === 'year') {
              const itemFY = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
              matchesFilter = chartFilterValue.some((year: string) => {
                const filterYear = parseInt(year);
                return itemFY === filterYear;
              });
            } else if (chartFilterBy === 'quarter') {
              const month = date.getMonth() + 1;
              matchesFilter = chartFilterValue.some((quarter: string) => {
                if (quarter.includes('Q1')) return month >= 4 && month <= 6;
                else if (quarter.includes('Q2')) return month >= 7 && month <= 9;
                else if (quarter.includes('Q3')) return month >= 10 && month <= 12;
                else if (quarter.includes('Q4')) return month >= 1 && month <= 3;
                return false;
              });
            } else if (chartFilterBy === 'month') {
              const monthStr = date.toLocaleDateString('en-US', { month: 'short' });
              const yearStr = date.getFullYear().toString();
              matchesFilter = chartFilterValue.some((monthFilter: string) => {
                return monthFilter.includes(monthStr) && monthFilter.includes(yearStr);
              });
            }
            if (!matchesFilter) return;
          }

          const clientKey = isMS ? item.project_name : item.client_name;
          if (!clientKey || clientKey.trim() === '') {
            console.log(`⚠️ Skipping item with empty client/project name:`, item);
            return;
          }

          const value = parseFloat(item[dbFieldName]) || 0;
          const currentValue = clientDataMap.get(clientKey) || 0;
          clientDataMap.set(clientKey, currentValue + value);
        });

        console.log(`🔍 Client data map size: ${clientDataMap.size}, Clients:`, Array.from(clientDataMap.keys()));

        // When specific clients are selected (Client Data filter), show only those clients; otherwise show all clients in BU
        const clientsToChart = clientDataSelectedClients.length > 0
          ? Array.from(clientDataMap.keys()).filter(client => clientDataSelectedClients.includes(client))
          : Array.from(clientDataMap.keys());

        // Convert to chart data format
        clientsToChart.forEach((client) => {
          const value = clientDataMap.get(client) ?? 0;
          const dataPoint: any = { businessUnit: client }; // Using businessUnit field for consistency
          dataPoint[`${periods[0] || 'Total'}_${selectedParameter}`] = value;
          dataPoint._totalValue = Math.abs(value);
          chartData.push(dataPoint);
        });
      } else {
        // Show business units (original logic)
        let businessUnitsToShow: string[] = [];
        if (isBUHead && user?.business_unit) {
          const normalizedBU = normalizeBusinessUnitName(user.business_unit);
          const selectedBU = Array.isArray(selectedBusinessUnitsForChart) 
            ? selectedBusinessUnitsForChart[0] 
            : selectedBusinessUnitsForChart;
          businessUnitsToShow = [normalizedBU || user.business_unit];
        } else {
          businessUnitsToShow = Array.isArray(selectedBusinessUnitsForChart) 
            ? selectedBusinessUnitsForChart 
            : [selectedBusinessUnitsForChart];
        }
        
        // Create data point for each business unit
        businessUnitsToShow.forEach(bu => {
          const dataPoint: any = { businessUnit: bu };
          
          let totalValue = 0;
          
          selectedParametersForChart.forEach(parameter => {
            periods.forEach((period, periodIndex) => {
              const value = getParameterValueForBU(bu, period, parameter);
              dataPoint[`${period}_${parameter}`] = value;
              totalValue += Math.abs(value);
            });
          });
          
          dataPoint._totalValue = totalValue;
          chartData.push(dataPoint);
        });
      }
      
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
      
      // Set X-axis data (business units or clients) - use sorted order
      const xAxisData = chartData.map(item => ({ businessUnit: item.businessUnit }));
      xAxis.data.setAll(xAxisData);
      
      if (shouldShowClients) {
        console.log(`🔍 Setting X-axis with ${xAxisData.length} client names:`, xAxisData.map((d: any) => d.businessUnit));
      }
      
      // Configure X-axis renderer for better label display when showing clients
      if (shouldShowClients) {
        // Enable horizontal scrolling/panning for client view
        chart.set("panX", true);
        chart.set("wheelX", "panX");
        
        const xAxisRenderer = xAxis.get("renderer") as am5xy.AxisRendererX;
        // Update labels template to show all client names
        xAxisRenderer.labels.template.setAll({
          fill: am5.color(0x000000),
          fontSize: 9,
          rotation: -45, // Rotate client names for better visibility
          centerY: am5.p100,
          centerX: am5.p50,
          paddingTop: 15,
          textAlign: "center"
        });
        // Remove any width restrictions to show full client names
        xAxisRenderer.labels.template.set("maxWidth", undefined);
        xAxisRenderer.labels.template.set("width", undefined);
        // Ensure all labels are shown (disable label hiding)
        xAxisRenderer.labels.template.set("forceHidden", false);
        // Disable label hiding when there are too many
        xAxisRenderer.labels.template.adapters.add("visible", () => {
          return true; // Always show all labels
        });
        // Make sure the axis shows all categories
        xAxis.set("startLocation", 0);
        xAxis.set("endLocation", 1);
      }
      
      // Create series: one series per period-parameter combination
      // For bar chart, we'll show one series per period (grouping parameters)
      // When showing clients, show single series with single parameter
      if (shouldShowClients) {
        // Show single series for clients
        const selectedParameter = selectedParametersForChart[0];
        const format = getParameterFormat(selectedParameter);
        const seriesKey = `${periods[0] || 'Total'}_${selectedParameter}`;
        const seriesColor = colors[0];
        
        const series = chart.series.push(
          am5xy.ColumnSeries.new(root, {
            name: selectedParameter,
            xAxis: xAxis,
            yAxis: yAxis,
            valueYField: seriesKey,
            categoryXField: "businessUnit"
          })
        );

        series.columns.template.setAll({
          width: am5.percent(80),
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
                const value = dataContext[seriesKey];
                if (value != null && !isNaN(Number(value))) {
                  const numValue = Number(value);
                  // Check if this parameter should use crore/lakh formatting
                  const shouldFormat = selectedParameter === 'Revenue' || selectedParameter === 'GPM' || selectedParameter === 'NP' || 
                                     selectedParameter === 'Team Cost' || selectedParameter === 'Net Margin' || 
                                     selectedParameter === 'Salary Cost' || selectedParameter === 'Opr Cost' || 
                                     selectedParameter === 'Funding Cost' || selectedParameter === 'Leave Encashment';
                  
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
            return text || "";
          });
          
          return am5.Bullet.new(root, { sprite: label });
        });

        series.appear(1000, 100);
      } else if (chartType === 'bar' || chartType === 'combo') {
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
                                         parameter === 'Team Cost' || parameter === 'Net Margin' || 
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
                return text || "";
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
                                         parameter === 'Team Cost' || parameter === 'Net Margin' || 
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
                return text || "";
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
      
      // Set chart data after all series are created
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

  }, [data, selectedParametersForChart, selectedBusinessUnitsForChart, chartType, activeChartTab, compareType, comparisonValues, isBUHead, user?.business_unit, selectedClientName, selectedBusinessUnit, chartFilterBy, chartFilterValue, chartSortOrder, isCroreMode, clientMFSData, clientDataSelectedClients]);

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

      console.log("🔍 Waterfall chart data:", waterfallData);

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

        }}>MFS Comparison</h2>

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

            <button className="auth-button" onClick={() => navigate('/client-mfs/compare')}>
              Client MFS comparison
            </button>

            <button className="auth-button" onClick={() => navigate('/mfs-data')}>
              Data
            </button>

            <button className="auth-button" onClick={() => navigate('/HomePage')}>

              Home

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



    {/* Client Name / Project Name Filter - DISABLED for team_summary_report */}
    {/* 
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
    */}



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
            gridTemplateColumns: showTeamCostKPI 
              ? 'repeat(4, minmax(260px, 1fr))' 
              : 'repeat(3, minmax(320px, 1fr))',
            gap: 16,
            marginBottom: 16
          }}>
            {(() => {
              const kpis = kpiData;
              const mainKPIs = ['Revenue', 'GPM', ...(showTeamCostKPI ? ['Team Cost'] : []), 'NP'];
              const displayKPIs = mainKPIs;
              
              return displayKPIs.map((kpiName) => {
                const kpi = kpis[kpiName];
                if (!kpi) return null;
                
                const formatValue = (value: number) => {
                  if (kpiName === 'Revenue' || kpiName === 'GPM' || kpiName === 'Team Cost' || kpiName === 'NP' || kpiName === 'HC') {
                    return formatValueWithToggle(value, true);
                  }
                  return value.toFixed(0);
                };
                
                return (
                  <div key={kpiName} style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 8,
                    padding: 12,
                    minHeight: 220,
                    border: '1px solid #d9d9d9',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    position: 'relative'
                  }}>
                    {/* Title row: KPI name on left, growth arrow at top right */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                      <div>
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
                        <div style={{ width: 60, height: 2, backgroundColor: '#ff6b35', borderRadius: 1 }} />
                      </div>
                      {/* Growth arrow at top right */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 2 }}>
                          <div style={{
                            width: 0,
                            height: 0,
                            borderLeft: '8px solid transparent',
                            borderRight: '8px solid transparent',
                            borderBottom: '12px solid #4ade80'
                          }} />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <div style={{ width: 8, height: 1, backgroundColor: '#4ade80', borderRadius: 1 }} />
                            <div style={{ width: 6, height: 1, backgroundColor: '#4ade80', borderRadius: 1 }} />
                            <div style={{ width: 4, height: 1, backgroundColor: '#4ade80', borderRadius: 1 }} />
                          </div>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: kpi.growthPercentage >= 0 ? '#4ade80' : '#ff4d4f', textAlign: 'right' }}>
                          {kpi.growthPercentage >= 0 ? '+' : ''}{kpi.growthPercentage.toFixed(1)}% Growth
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: kpi.currentFY - kpi.previousFY >= 0 ? '#4ade80' : '#ff4d4f', textAlign: 'right' }}>
                          {kpi.currentFY - kpi.previousFY >= 0 ? '+' : ''}{formatValue(kpi.currentFY - kpi.previousFY)}
                        </div>
                        <div style={{ fontSize: 8, color: '#666666', textAlign: 'right' }}>
                          {comparisonValues[1] ? `vs ${comparisonValues[1]}` : 'vs Previous Period'}
                        </div>
                      </div>
                    </div>

                    {/* Two-column layout: current period | previous period (labels from comparison filter) */}
                    {(() => {
                      const currentPeriodLabel = (() => {
                        if (compareType === 'month' && comparisonValues[0]) return comparisonValues[0];
                        if (compareType === 'quarter' && comparisonValues[0]) return comparisonValues[0];
                        return getMonthRangeForFY(comparisonValues[0] || 'FY 2025');
                      })();
                      const previousPeriodLabel = comparisonValues[1] || 'Previous Period';
                      const colBorder = '1px solid #e0e0e0';
                      return (
                    <div style={{ display: 'flex', gap: 0, marginBottom: 0, flexWrap: 'wrap', borderBottom: colBorder }}>
                      <div style={{ flex: 1, minWidth: 140, paddingRight: 12, borderRight: colBorder }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#666', marginBottom: 4 }}>{currentPeriodLabel}</div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#333333', marginBottom: 6 }}>
                          {currentPeriodLabel}
                        </div>
                        {kpi.monthsRemaining > 0 && (
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#333333', marginBottom: 4 }}>
                            Actual ({formatValue(kpi.currentFYActual)}) + Predicted ({formatValue(kpi.projectedAmount)}) =
                          </div>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 100, paddingLeft: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#666', marginBottom: 4 }}>{previousPeriodLabel}</div>
                        {kpi.monthsRemaining > 0 && (
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#333333', marginBottom: 6 }}>
                            {formatValue(kpi.previousFY)}
                          </div>
                        )}
                      </div>
                    </div>
                      );
                    })()}

                    {/* Metric rows: Revenue =, Routing =, CTS =, total — two columns with row/column borders */}
                    <div style={{ marginTop: 8, marginBottom: 0 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {kpiName === 'Revenue' && (() => {
                          const rowBorder = '1px solid #e0e0e0';
                          const colBorder = '1px solid #e0e0e0';
                          return (
                            <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap' }}>
                              <div style={{ flex: 1, minWidth: 140, paddingRight: 12, borderRight: colBorder }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#333333', padding: '6px 0', borderBottom: rowBorder }}>
                                  Revenue = {formatValue(kpi.currentFY)}
                                </div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#333333', padding: '6px 0', borderBottom: rowBorder }}>
                                  Routing = {formatValue(calculateRoutingBilling())}
                                </div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#333333', padding: '6px 0', borderBottom: rowBorder }}>
                                  CTS = {formatValue(calculateCTSValue())}
                                </div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#333333', padding: '6px 0' }}>
                                  Revenue + Routing + CTS = {formatValue(kpi.currentFY + calculateRoutingBilling() + calculateCTSValue())}
                                </div>
                              </div>
                              <div style={{ flex: 1, minWidth: 100, paddingLeft: 12 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#333333', padding: '6px 0', borderBottom: rowBorder }}>
                                  Revenue = {formatValue(kpi.previousFY)}
                                </div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#333333', padding: '6px 0', borderBottom: rowBorder }}>Routing = -</div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#333333', padding: '6px 0', borderBottom: rowBorder }}>CTS = -</div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#333333', padding: '6px 0' }}>
                                  Revenue + Routing + CTS = {formatValue(kpi.previousFY)}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                        {kpiName === 'GPM' && (() => {
                          const routingMargin = calculateRoutingMargin();
                          const ctsMargin = calculateCTSMargin();
                          const total = kpi.currentFY + routingMargin + ctsMargin;
                          const rowBorder = '1px solid #e0e0e0';
                          const colBorder = '1px solid #e0e0e0';
                          return (
                            <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap' }}>
                              <div style={{ flex: 1, minWidth: 140, paddingRight: 12, borderRight: colBorder }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#333333', padding: '6px 0', borderBottom: rowBorder }}>
                                  GPM = {formatValue(kpi.currentFY)}
                                </div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#333333', padding: '6px 0', borderBottom: rowBorder }}>
                                  Routing = {formatValue(routingMargin)}
                                </div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#333333', padding: '6px 0', borderBottom: rowBorder }}>
                                  CTS = {formatValue(ctsMargin)}
                                </div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#333333', padding: '6px 0' }}>
                                  GPM + Routing + CTS = {formatValue(total)}
                                </div>
                              </div>
                              <div style={{ flex: 1, minWidth: 100, paddingLeft: 12 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#333333', padding: '6px 0', borderBottom: rowBorder }}>
                                  GPM = {formatValue(kpi.previousFY)}
                                </div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#333333', padding: '6px 0', borderBottom: rowBorder }}>Routing = -</div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#333333', padding: '6px 0', borderBottom: rowBorder }}>CTS = -</div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#333333', padding: '6px 0' }}>GPM + Routing + CTS = {formatValue(kpi.previousFY)}</div>
                              </div>
                            </div>
                          );
                        })()}
                        {kpiName === 'Team Cost' && (() => {
                          const rowBorder = '1px solid #e0e0e0';
                          const colBorder = '1px solid #e0e0e0';
                          return (
                            <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap' }}>
                              <div style={{ flex: 1, minWidth: 140, paddingRight: 12, borderRight: colBorder }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#333333', padding: '6px 0' }}>
                                  Team Cost = {formatValue(kpi.currentFY)}
                                </div>
                              </div>
                              <div style={{ flex: 1, minWidth: 100, paddingLeft: 12 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#333333', padding: '6px 0' }}>
                                  Team Cost = {formatValue(kpi.previousFY)}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                        {kpiName === 'NP' && (() => {
                          const routingNetMargin = calculateRoutingNetMargin();
                          const ctsMargin = calculateCTSMargin();
                          const total = kpi.currentFY + routingNetMargin + ctsMargin;
                          const rowBorder = '1px solid #e0e0e0';
                          const colBorder = '1px solid #e0e0e0';
                          return (
                            <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap' }}>
                              <div style={{ flex: 1, minWidth: 140, paddingRight: 12, borderRight: colBorder }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#333333', padding: '6px 0', borderBottom: rowBorder }}>
                                  NP = {formatValue(kpi.currentFY)}
                                </div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#333333', padding: '6px 0', borderBottom: rowBorder }}>
                                  Routing = {formatValue(routingNetMargin)}
                                </div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#333333', padding: '6px 0', borderBottom: rowBorder }}>
                                  CTS = {formatValue(ctsMargin)}
                                </div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#333333', padding: '6px 0' }}>
                                  NP + Routing + CTS = {formatValue(total)}
                                </div>
                              </div>
                              <div style={{ flex: 1, minWidth: 100, paddingLeft: 12 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#333333', padding: '6px 0', borderBottom: rowBorder }}>
                                  NP = {formatValue(kpi.previousFY)}
                                </div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#333333', padding: '6px 0', borderBottom: rowBorder }}>Routing = -</div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#333333', padding: '6px 0', borderBottom: rowBorder }}>CTS = -</div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#333333', padding: '6px 0' }}>NP + Routing + CTS = {formatValue(kpi.previousFY)}</div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          {/* Toggle Team Cost Analysis visibility - small button after NP Analysis */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -8, marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setShowTeamCostKPI(!showTeamCostKPI)}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                backgroundColor: showTeamCostKPI ? '#d9d9d9' : '#1890ff',
                color: showTeamCostKPI ? '#333' : '#fff',
                border: '1px solid #bbb',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 600,
              }}
              title={showTeamCostKPI ? 'Hide Team Cost Analysis card' : 'Show Team Cost Analysis card'}
            >
              {showTeamCostKPI ? 'Hide Team Cost' : 'Show Team Cost'}
            </button>
          </div>
          
          {/* Show More/Less Button */}
          <div style={{ textAlign: 'center' }}>
            {/* Removed Show More KPIs button - only 5 KPIs available */}
          </div>
        </div>
      )}

      {isLoading ? (

        <div style={{ textAlign: 'center', padding: 40, color: '#000000' }}>Loading data...</div>

      ) : selectedParameters.length > 0 && comparisonValues.some(v => v) ? (

        (() => {
          const hasData = comparisonData.length > 0 || (comparisonValues.filter(Boolean).length >= 2 && growthAnalysis.length > 0);
          return hasData ? (
          <React.Fragment>

            {/* Chart Tabs */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ 
                display: 'flex', 
                borderBottom: '2px solid #e8e8e8',
                marginBottom: 20
              }}>
                <button
                  onClick={() => {
                    if (activeChartTab === 'growth') {
                      setActiveChartTab('none');
                    } else {
                      setShowClientData(false);
                      setActiveChartTab('growth');
                    }
                  }}
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
                  onClick={() => {
                    if (activeChartTab === 'waterfall') {
                      setActiveChartTab('none');
                    } else {
                      setShowClientData(false);
                      setActiveChartTab('waterfall');
                    }
                  }}
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
                {selectedBusinessUnit && (
                  <button
                    onClick={() => {
                      if (!showClientData) {
                        setClientDataPeriodFilter('year');
                        setClientDataPeriodValue(String(getCurrentFinancialYear()));
                        setClientDataSelectedMonths([]);
                        setActiveChartTab('none');
                      }
                      setShowClientData(!showClientData);
                    }}
                    style={{
                      padding: '12px 24px',
                      border: 'none',
                      backgroundColor: showClientData ? '#1890ff' : 'transparent',
                      color: showClientData ? 'white' : '#666',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: showClientData ? 'bold' : 'normal',
                      borderTopLeftRadius: '6px',
                      borderTopRightRadius: '6px',
                      marginRight: '2px'
                    }}
                  >
                    {showClientData ? 'Hide Client Data' : 'Show Client Data'}
                  </button>
                )}
              </div>

              {/* Parameter Data Chart */}
              {activeChartTab === 'growth' && (
            <div style={{ width: "100%", position: 'relative' }}>
                  {/* Close Button */}
                  <button
                    onClick={() => setActiveChartTab('none')}
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      background: 'transparent',
                      border: 'none',
                      fontSize: '20px',
                      cursor: 'pointer',
                      color: '#666',
                      fontWeight: 'bold',
                      zIndex: 10,
                      padding: '4px 8px',
                      borderRadius: '4px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f0f0f0';
                      e.currentTarget.style.color = '#000';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#666';
                    }}
                    title="Close Parameter Data Chart"
                  >
                    ×
                  </button>
                  
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
                        mode={isBUHead ? undefined : "multiple"}
                        value={selectedBusinessUnitsForChart}
                        onChange={(value) => setSelectedBusinessUnitsForChart(value)}
                        style={{ width: '100%' }}
                        placeholder={isBUHead ? "Select business unit" : "Select business units"}
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
              
              {/* Client-level visualization for admin when single BU is selected */}
              {!isBUHead && selectedBusinessUnitsForChart && 
               !Array.isArray(selectedBusinessUnitsForChart) && 
               selectedParametersForChart.length > 0 && 
               clientMFSData.length > 0 && (
                <div style={{ marginTop: '40px', width: "100%" }}>
                  <h3 style={{ color: '#000000', marginBottom: '10px' }}>
                    {selectedParametersForChart[0]} by Client - {selectedBusinessUnitsForChart}
                  </h3>
                  <div id="clientChart" style={{ width: "100%", height: "350px" }} />
                </div>
              )}
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
          const isDefaultYearComparison = compareType === 'year' && comparisonValues.filter(Boolean).length === 2 && i === 0;
          const isCurrentFY = period?.includes('2025') || (compareType === 'year' && i === 0);
          const periodLabel = isCurrentFY ? getMonthRangeForFY(period || '') : period || '';
          return (
            <React.Fragment key={i}>
              <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #d9d9d9', color: '#000000', fontSize: '10px' }}>{periodLabel}</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #d9d9d9', color: '#000000', fontSize: '10px' }}>GPM %</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #d9d9d9', color: '#000000', fontSize: '10px' }}>NP %</th>
              {isDefaultYearComparison && isCurrentFY && (
                <>
                  <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #d9d9d9', color: '#000000', fontSize: '10px' }}>Predicted</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #d9d9d9', color: '#000000', fontSize: '10px' }}>Sum (Actual + Predicted)</th>
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

      {growthAnalysis.filter(item => {
        // Exclude Team Cost, efficiency metrics, and Net Margin % from growth analysis table
        // Net Margin % is already displayed below Net Margin values, so no need for separate row
        const efficiencyMetrics = [
          'Cost Efficiency',
          'Revenue per HC',
          'Margin per Team Cost',
          'Team Cost % of Revenue',
          'Net Margin per HC'
        ];
        return item.parameter !== 'Team Cost' && 
               item.parameter !== 'Net Margin %' && 
               !efficiencyMetrics.includes(item.parameter);
      }).map((item, index) => {

        // Calculate growth between current and previous period for each parameter
        // For absolute change calculation, use Sum (Actual + Predicted) for current period
        // If we have 2 periods: [0] = FY 2025, [1] = FY 2024
        // Current = Sum amount (if available) or first period, Previous = last period (index length-1)
        const validPeriods = item.periodValues.filter(pv => pv.period);
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



        return (

          <tr key={item.parameter} style={{ 

            backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9f9f9',

            borderBottom: '1px solid #d9d9d9',

            color: '#000000'

          }}>

            <td style={{ padding: '6px 8px', fontWeight: 500, color: '#000000', fontSize: '10px' }}>{item.parameter}</td>

            {item.periodValues.filter(pv => pv.period).map((pv, i) => {
              const isDefaultYearComparison = compareType === 'year' && comparisonValues.filter(Boolean).length === 2 && i === 0;
              const isCurrentFY = pv.period?.includes('2025') || (compareType === 'year' && i === 0);
              const isLastPeriod = i === validPeriods.length - 1; // FY 2024 (or last comparison period) - value used for comparison
              const revenueItem = growthAnalysis.find(g => g.parameter === 'Revenue');
              const revenue = revenueItem?.periodValues[i]?.amount ?? 0;
              const gpmPct = item.parameter === 'GPM' && revenue != null && Number(revenue) > 0
                ? ((Number(pv.amount) / Number(revenue)) * 100).toFixed(2) + '%'
                : '-';
              const npPct = item.parameter === 'Net Margin' && revenue != null && Number(revenue) > 0
                ? ((Number(pv.amount) / Number(revenue)) * 100).toFixed(2) + '%'
                : '-';
              return (
                <React.Fragment key={i}>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: '#000000', fontSize: '10px', fontWeight: isLastPeriod ? 'bold' : undefined }}>
                    {formatValueForTable(pv.amount, item.parameter)}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: '#000000', fontSize: '10px' }}>{gpmPct}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: '#000000', fontSize: '10px' }}>{npPct}</td>
                  {isDefaultYearComparison && isCurrentFY && (
                    <>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: '#000000', fontSize: '10px' }}>
                        {formatValueForTable(item.predictedAmount || 0, item.parameter)}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: '#000000', fontSize: '10px', fontWeight: 'bold' }}>
                        {formatValueForTable(item.sumAmount || pv.amount, item.parameter)}
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

              {growthPercentage === Infinity ? '∞' : growthPercentage.toFixed(2)}%

            </td>


          </tr>

        );

      })}

    </tbody>

  </table>

</div>

            {/* Client Data - just below Growth Analysis Report */}
            {showClientData && selectedBusinessUnit && isSpecificBusinessUnitSelected && getSelectedBUForClientData && (
              <div style={{ marginTop: 20, marginBottom: 20 }}>
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
                  Client Data - {getSelectedBUForClientData}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: 4 }}>
                  <div style={{ minWidth: '200px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold', color: '#000000' }}>Parameters:</label>
                    <Select mode="multiple" value={clientDataSelectedParameters} onChange={(values) => setClientDataSelectedParameters(values)} placeholder="Select Parameters" style={{ width: '100%' }} allowClear>
                      {allClientDataParameters.map(param => (<Select.Option key={param.key} value={param.key}>{param.label}</Select.Option>))}
                    </Select>
                  </div>
                  <div style={{ minWidth: '200px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold', color: '#000000' }}>Client:</label>
                    <Select
                      mode="multiple"
                      value={clientDataSelectedClients}
                      onChange={(values: string[]) => setClientDataSelectedClients(values)}
                      placeholder="All clients"
                      style={{ width: '100%' }}
                      allowClear
                    >
                      {clientDataClients.map(c => (<Select.Option key={c} value={c}>{c}</Select.Option>))}
                    </Select>
                  </div>
                  <div style={{ minWidth: '150px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold', color: '#000000' }}>Period Type:</label>
                    <select value={clientDataPeriodFilter} onChange={(e) => { setClientDataPeriodFilter(e.target.value); if (e.target.value === 'year') { setClientDataPeriodValue(String(getCurrentFinancialYear())); } else { setClientDataPeriodValue(''); } setClientDataSelectedMonths([]); }} style={{ width: '100%', padding: '4px', fontSize: '12px' }}>
                      <option value="year">Year</option>
                      <option value="quarter">Quarter</option>
                      <option value="month">Month</option>
                    </select>
                  </div>
                  {clientDataPeriodFilter === 'year' && (
                    <div style={{ minWidth: '120px' }}>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold', color: '#000000' }}>Year:</label>
                      <select value={clientDataPeriodValue} onChange={(e) => setClientDataPeriodValue(e.target.value)} style={{ width: '100%', padding: '4px', fontSize: '12px' }}>
                        <option value="">Select Year</option>
                        {clientDataYearOptions.map(year => (<option key={year} value={String(year)}>{year}</option>))}
                      </select>
                    </div>
                  )}
                  {clientDataPeriodFilter === 'quarter' && (
                    <div style={{ minWidth: '200px' }}>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold', color: '#000000' }}>Quarter:</label>
                      <select value={clientDataPeriodValue} onChange={(e) => setClientDataPeriodValue(e.target.value)} style={{ width: '100%', padding: '4px', fontSize: '12px' }}>
                        <option value="">Select Quarter</option>
                        {clientDataQuarterOptions.map(quarter => (<option key={quarter} value={quarter}>{quarter}</option>))}
                      </select>
                    </div>
                  )}
                  {clientDataPeriodFilter === 'month' && (
                    <div style={{ minWidth: '200px' }}>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold', color: '#000000' }}>Months:</label>
                      <Select mode="multiple" value={clientDataSelectedMonths} onChange={(values) => setClientDataSelectedMonths(values)} placeholder="Select Months" style={{ width: '100%' }} allowClear>
                        {clientDataMonths.map(month => (<Select.Option key={month} value={month}>{month}</Select.Option>))}
                      </Select>
                    </div>
                  )}
                </div>
                {clientDataTableData.length > 0 ? (
                  <div style={{ overflowX: 'auto', backgroundColor: '#ffffff', border: '1px solid #d9d9d9', borderRadius: 4 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#d8e8f0' }}>
                          <th style={{ padding: '6px 8px', textAlign: 'left', color: '#000000', fontWeight: 'bold', position: 'sticky', left: 0, backgroundColor: '#d8e8f0', zIndex: 10 }}>Client</th>
                          {clientDataMonths.map(month => (
                            <th key={month} colSpan={clientDataParameters.length} style={{ padding: '6px 8px', textAlign: 'center', color: '#000000', fontWeight: 'bold', borderLeft: '1px solid #d9d9d9' }}>{month}</th>
                          ))}
                        </tr>
                        {clientDataParameters.length > 1 && (
                          <tr style={{ backgroundColor: '#d8e8f0' }}>
                            <th style={{ padding: '6px 8px', position: 'sticky', left: 0, backgroundColor: '#d8e8f0', zIndex: 10 }}></th>
                            {clientDataMonths.map(month => clientDataParameters.map(param => (
                              <th key={`${month}_${param.key}`} style={{ padding: '6px 8px', textAlign: 'center', color: '#000000', fontSize: '9px', borderLeft: '1px solid #d9d9d9' }}>{param.label}</th>
                            )))}
                          </tr>
                        )}
                      </thead>
                      <tbody>
                        {clientDataTableData.map((row, rowIndex) => (
                          <tr key={row.client} style={{ backgroundColor: rowIndex % 2 === 0 ? '#ffffff' : '#f9f9f9' }}>
                            <td style={{ padding: '6px 8px', fontWeight: 'bold', position: 'sticky', left: 0, backgroundColor: rowIndex % 2 === 0 ? '#ffffff' : '#f9f9f9', zIndex: 5 }}>{row.client}</td>
                            {clientDataMonths.map(monthDisplay => {
                              const [monthName, yearStr] = monthDisplay.split(' ');
                              const year = parseInt(yearStr);
                              const monthNames: { [key: string]: string } = { 'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April', 'May': 'May', 'Jun': 'June', 'Jul': 'July', 'Aug': 'August', 'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December' };
                              const fullMonthName = monthNames[monthName] || monthName;
                              const monthKey = getClientDataMonthKey(fullMonthName, year);
                              return clientDataParameters.map(param => {
                                const cellKey = `${param.key}_${monthKey}`;
                                const value = row[cellKey];
                                const formatValue = (val: any, key: string) => {
                                  if (val == null || (typeof val === 'number' && isNaN(val))) return '-';
                                  if (typeof val !== 'number') return '-';
                                  if (val === 0) return '-';
                                  if (key.includes('percentage') || key.includes('_percentage')) return `${val.toFixed(2)}%`;
                                  if (key === 'hc') return val.toFixed(0);
                                  return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                };
                                return (<td key={`${monthDisplay}_${param.key}`} style={{ padding: '6px 8px', textAlign: 'right', borderLeft: '1px solid #d9d9d9' }}>{formatValue(value, param.key)}</td>);
                              });
                            })}
                          </tr>
                        ))}
                        <tr style={{ backgroundColor: '#e6f3ff', fontWeight: 'bold' }}>
                          <td style={{ padding: '6px 8px', position: 'sticky', left: 0, backgroundColor: '#e6f3ff', zIndex: 5 }}>Total</td>
                          {clientDataMonths.map(monthDisplay => {
                            const [monthName, yearStr] = monthDisplay.split(' ');
                            const year = parseInt(yearStr);
                            const monthNames: { [key: string]: string } = { 'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April', 'May': 'May', 'Jun': 'June', 'Jul': 'July', 'Aug': 'August', 'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December' };
                            const fullMonthName = monthNames[monthName] || monthName;
                            const monthKey = getClientDataMonthKey(fullMonthName, year);
                            return clientDataParameters.map(param => {
                              const cellKey = `${param.key}_${monthKey}`;
                              let totalValue = 0;
                              let hasAnyValue = false;
                              clientDataTableData.forEach(r => {
                                const v = r[cellKey];
                                if (v != null && typeof v === 'number' && !isNaN(v)) {
                                  totalValue += v;
                                  hasAnyValue = true;
                                }
                              });
                              const formatValue = (val: any, key: string) => {
                                if (val == null || !hasAnyValue || (typeof val === 'number' && isNaN(val))) return '-';
                                if (typeof val !== 'number') return '-';
                                if (val === 0) return '-';
                                if (key.includes('percentage') || key.includes('_percentage')) return `${val.toFixed(2)}%`;
                                if (key === 'hc') return val.toFixed(0);
                                return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                              };
                              return (<td key={`total_${monthDisplay}_${param.key}`} style={{ padding: '6px 8px', textAlign: 'right', borderLeft: '1px solid #d9d9d9' }}>{formatValue(hasAnyValue ? totalValue : null, param.key)}</td>);
                            });
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                    {isLoadingClientMFS ? 'Loading client data...' : (
                      <div>
                        <div>No client data available for the selected filters</div>
                        {getSelectedBUForClientData && (
                          <div style={{ fontSize: '11px', marginTop: '8px', color: '#999' }}>
                            Selected BU: {getSelectedBUForClientData} | Total records: {clientMFSData.length} | Filtered records: {filteredClientMFSData.length}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

      {/* Show Full Summary Report Button */}
      <div style={{ textAlign: 'center', marginTop: 16, marginBottom: 16 }}>
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
          {showSummaryReport ? 'Hide Full Summary Report' : 'Show Full Summary Report'}
        </button>
        
        {/* Client Data Button - Only show when specific business unit is selected */}
        {isSpecificBusinessUnitSelected && (
          <button
            onClick={() => {
              if (!showClientData) {
                setClientDataPeriodFilter('year');
                setClientDataPeriodValue(String(getCurrentFinancialYear()));
                setClientDataSelectedMonths([]);
              }
              setShowClientData(!showClientData);
            }}
            style={{ 
              backgroundColor: '#004a7a',
              color: '#ffffff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              marginLeft: '8px'
            }}
          >
            {showClientData ? 'Hide Client Data' : 'Show Client Data'}
          </button>
        )}
      </div>

      {/* Full Summary Report */}
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
      Full Summary Report - All Business Units
    </div>
    
    {(() => {
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
        const filteredData = getFilteredDataByPeriod(period, compareType).filter(item => compareBusinessUnits(item.business_unit, businessUnit));
        
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
        
        // For other parameters: aggregate by month first, then sum
        const monthlyTotals: {[key: string]: number} = {};
        filteredData.forEach(item => {
          const monthKey = `${item.month} ${item.year}`;
          if (!monthlyTotals[monthKey]) {
            monthlyTotals[monthKey] = 0;
          }
          
          // Map parameter names to database field names
          let fieldName = parameter.toLowerCase();
          if (parameter === 'Team Cost') fieldName = 'team_cost';
          if (parameter === 'NP' || parameter === 'Net Margin') fieldName = 'net_margin';
          if (parameter === 'GPM') fieldName = 'gpm';
          if (parameter === 'Revenue') fieldName = 'revenue';
          
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
          const netMargin = getParameterValueForBusinessUnit(period || '', 'Net Margin', businessUnit);
          const hc = getParameterValueForBusinessUnit(period || '', 'HC', businessUnit);
          
          return { period, revenue, gpm, netMargin, hc };
        });
        
        // Calculate growth metrics
        const currentPeriod = periodData[0];
        const previousPeriod = periodData[periodData.length - 1];
        
        // Calculate projections for each parameter (only for default year comparison)
        const isDefaultYearComparison = compareType === 'year' && periods.length === 2;
        let revenuePredicted = 0, revenueSum = currentPeriod.revenue;
        let gpmPredicted = 0, gpmSum = currentPeriod.gpm;
        let netMarginPredicted = 0, netMarginSum = currentPeriod.netMargin;
        let hcPredicted = 0, hcSum = currentPeriod.hc;
        
        if (isDefaultYearComparison) {
          // Calculate projections for this specific business unit using the same logic as calculateKPIs
          const currentFY = getCurrentFinancialYear();
          const currentFYData = data.filter(item => {
            if (!compareBusinessUnits(item.business_unit, businessUnit)) return false;
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
          
          // Calculate projections for each parameter (same logic as calculateKPIs)
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
                case 'Net Margin': value = item.net_margin || 0; break;
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
                  const projected = actual + (lastMonthValue * actualMonthsRemaining);
                  return { predicted: projected - actual, sum: projected };
                }
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
          
          const netMarginProj = calculateProjection('Net Margin');
          netMarginPredicted = netMarginProj.predicted;
          netMarginSum = netMarginProj.sum;
          
          // HC doesn't need projection
          hcPredicted = 0;
          hcSum = currentPeriod.hc;
        }
        
        // Use Sum values for change calculations when available
        const revenueChange = (isDefaultYearComparison && revenueSum > 0 ? revenueSum : currentPeriod.revenue) - previousPeriod.revenue;
        const gpmChange = (isDefaultYearComparison && gpmSum > 0 ? gpmSum : currentPeriod.gpm) - previousPeriod.gpm;
        const netMarginChange = (isDefaultYearComparison && netMarginSum > 0 ? netMarginSum : currentPeriod.netMargin) - previousPeriod.netMargin;
        const hcChange = (isDefaultYearComparison && hcSum > 0 ? hcSum : currentPeriod.hc) - previousPeriod.hc;
        
        const revenueGrowth = previousPeriod.revenue > 0 ? (revenueChange / previousPeriod.revenue) * 100 : 0;
        const gpmGrowth = previousPeriod.gpm > 0 ? (gpmChange / previousPeriod.gpm) * 100 : 0;
        const netMarginGrowth = previousPeriod.netMargin > 0 ? (netMarginChange / previousPeriod.netMargin) * 100 : 0;
        const hcGrowth = previousPeriod.hc > 0 ? (hcChange / previousPeriod.hc) * 100 : 0;
        
        return {
          businessUnit,
          currentPeriod,
          previousPeriod,
          revenueChange,
          gpmChange,
          netMarginChange,
          hcChange,
          revenueGrowth,
          gpmGrowth,
          netMarginGrowth,
          hcGrowth,
          // Projection values
          revenuePredicted,
          revenueSum,
          gpmPredicted,
          gpmSum,
          netMarginPredicted,
          netMarginSum,
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
                  // Check if this is the default year comparison (current year vs previous year)
                  const isDefaultYearComparison = compareType === 'year' && 
                    comparisonValues.filter(Boolean).length === 2 &&
                    i === 0; // Only show for first period (current year)
                  
                  const isCurrentFY = period?.includes('2025') || (compareType === 'year' && i === 0);
                  
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
                <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #d9d9d9', color: '#000000', fontSize: '10px' }}>GPM %</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #d9d9d9', color: '#000000', fontSize: '10px' }}>NP %</th>
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
                    predicted: isDefaultYearComparison ? summary.revenuePredicted : 0,
                    sum: isDefaultYearComparison ? summary.revenueSum : summary.currentPeriod.revenue
                  },
                  { 
                    name: 'GPM', 
                    current: summary.currentPeriod.gpm, 
                    previous: summary.previousPeriod.gpm, 
                    change: summary.gpmChange, 
                    growth: summary.gpmGrowth,
                    predicted: isDefaultYearComparison ? summary.gpmPredicted : 0,
                    sum: isDefaultYearComparison ? summary.gpmSum : summary.currentPeriod.gpm
                  },
                  { 
                    name: 'Net Margin', 
                    current: summary.currentPeriod.netMargin, 
                    previous: summary.previousPeriod.netMargin, 
                    change: summary.netMarginChange, 
                    growth: summary.netMarginGrowth,
                    predicted: isDefaultYearComparison ? summary.netMarginPredicted : 0,
                    sum: isDefaultYearComparison ? summary.netMarginSum : summary.currentPeriod.netMargin
                  },
                  { 
                    name: 'HC', 
                    current: summary.currentPeriod.hc, 
                    previous: summary.previousPeriod.hc, 
                    change: summary.hcChange, 
                    growth: summary.hcGrowth,
                    predicted: isDefaultYearComparison ? summary.hcPredicted : 0,
                    sum: isDefaultYearComparison ? summary.hcSum : summary.currentPeriod.hc
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
                    {comparisonValues.filter(Boolean).map((period, periodIndex) => {
                      const isDefaultYearComparison = compareType === 'year' && 
                        comparisonValues.filter(Boolean).length === 2 &&
                        periodIndex === 0; // Only show for first period (current year)
                      
                      const isCurrentFY = period?.includes('2025') || (compareType === 'year' && periodIndex === 0);
                      const isFirstPeriod = periodIndex === 0;
                      const value = isFirstPeriod ? param.current : param.previous;
                      const revenue = isFirstPeriod ? summary.currentPeriod.revenue : summary.previousPeriod.revenue;
                      
                      return (
                        <React.Fragment key={periodIndex}>
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                            <div>
                              {formatValueForTable(value, param.name)}
                            </div>
                            {isFirstPeriod && param.name === 'GPM' && (
                              <div style={{ fontSize: '9px', color: '#666666', marginTop: '2px' }}>
                                {(() => {
                                  const percentage = revenue > 0 ? ((param.current / revenue) * 100).toFixed(2) : '0.00';
                                  return `GPM %: ${percentage}%`;
                                })()}
                              </div>
                            )}
                            {isFirstPeriod && param.name === 'Net Margin' && (
                              <div style={{ fontSize: '9px', color: '#666666', marginTop: '2px' }}>
                                {(() => {
                                  const percentage = revenue > 0 ? ((param.current / revenue) * 100).toFixed(2) : '0.00';
                                  return `Net Margin %: ${percentage}%`;
                                })()}
                              </div>
                            )}
                            {!isFirstPeriod && param.name === 'GPM' && (
                              <div style={{ fontSize: '9px', color: '#666666', marginTop: '2px' }}>
                                {(() => {
                                  const percentage = revenue > 0 ? ((param.previous / revenue) * 100).toFixed(2) : '0.00';
                                  return `GPM %: ${percentage}%`;
                                })()}
                              </div>
                            )}
                            {!isFirstPeriod && param.name === 'Net Margin' && (
                              <div style={{ fontSize: '9px', color: '#666666', marginTop: '2px' }}>
                                {(() => {
                                  const percentage = revenue > 0 ? ((param.previous / revenue) * 100).toFixed(2) : '0.00';
                                  return `Net Margin %: ${percentage}%`;
                                })()}
                              </div>
                            )}
                          </td>
                          {/* Add Predicted and Sum columns only for default year comparison (current year vs previous year) */}
                          {isDefaultYearComparison && isCurrentFY && isFirstPeriod && (
                            <>
                              <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                                <div>
                                  {formatValueForTable(param.predicted || 0, param.name)}
                                </div>
                              </td>
                              <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                                <div>
                                  {formatValueForTable(param.sum || param.current, param.name)}
                                </div>
                              </td>
                            </>
                          )}
                        </React.Fragment>
                      );
                    })}
                    {/* GPM % column: only GPM row shows GPM percentage (FY25 / FY24) */}
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                      {param.name === 'GPM' ? (() => {
                        const currentPct = summary.currentPeriod.revenue > 0 ? ((param.current / summary.currentPeriod.revenue) * 100).toFixed(2) : '0.00';
                        const previousPct = summary.previousPeriod.revenue > 0 ? ((param.previous / summary.previousPeriod.revenue) * 100).toFixed(2) : '0.00';
                        return (
                          <>
                            <div>{currentPct}%</div>
                            <div style={{ fontSize: '9px', color: '#666666', marginTop: '2px' }}>{previousPct}%</div>
                          </>
                        );
                      })() : '—'}
                    </td>
                    {/* NP % column: only Net Margin row shows Net Margin percentage (FY25 / FY24) */}
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                      {param.name === 'Net Margin' ? (() => {
                        const currentPct = summary.currentPeriod.revenue > 0 ? ((param.current / summary.currentPeriod.revenue) * 100).toFixed(2) : '0.00';
                        const previousPct = summary.previousPeriod.revenue > 0 ? ((param.previous / summary.previousPeriod.revenue) * 100).toFixed(2) : '0.00';
                        return (
                          <>
                            <div>{currentPct}%</div>
                            <div style={{ fontSize: '9px', color: '#666666', marginTop: '2px' }}>{previousPct}%</div>
                          </>
                        );
                      })() : '—'}
                    </td>
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
                      {param.growth.toFixed(2)}%
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
      console.log(`🔍 Efficiency Dashboard Debug for ${period}:`, {
        period,
        periodData: periodData.map(pd => ({ parameter: pd.parameter, amount: pd.amount })),
        netMargin: periodData.find(i => i.parameter === "Net Margin")?.amount || 0,
        revenue: periodData.find(i => i.parameter === "Revenue")?.amount || 0,
        hc: periodData.find(i => i.parameter === "HC")?.amount || 0
      });

      return {

        period,

        hc: periodData.find(i => i.parameter === "HC")?.amount || 0,

        teamCost: periodData.find(i => i.parameter === "Team Cost")?.amount || 0,

        revenue: periodData.find(i => i.parameter === "Revenue")?.amount || 0,

        gpm: periodData.find(i => i.parameter === "GPM")?.amount || 0,

        netMargin: periodData.find(i => i.parameter === "Net Margin")?.amount || 0

      };

    });



    const baseline = useCurrentYearAsBaseline ? metrics[0] : metrics[metrics.length - 1];

    
    
    // Key efficiency metrics to track

    const metricDefinitions = [

      {

        name: "Cost Efficiency",

        calculate: (m: typeof metrics[0]) => m.teamCost / (m.netMargin || 1),

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

        name: "Margin per Team Cost",

        calculate: (m: typeof metrics[0]) => m.netMargin / (m.teamCost || 1),

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

        name: "Net Margin %",

        calculate: (m: typeof metrics[0]) => (m.netMargin / (m.revenue || 1)) * 100,

        ideal: 'increase',

        unit: '%'

      },

      {

        name: "Net Margin per HC",

        calculate: (m: typeof metrics[0]) => m.netMargin / (m.hc || 1),

        ideal: 'increase',

        unit: ''

      }

    ];



    return (

      <div>

       {/* Summary Trend Cards */}

<div style={{ 

  display: 'grid',

  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',  // Reduced to fit 6 metrics in one row

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
            Team Cost ÷ Net Margin. Lower values indicate better cost efficiency (less team cost per unit of net margin).
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

      </div>

    );

  })()}

        </div>

        </div>

      )}

      </React.Fragment>
      ) : (
        <div style={{ textAlign: 'center', padding: 40, color: '#000000' }}>No data available for the selected filters</div>
      );
        })()
      ) : null}

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
                  {Array.isArray(selectedPeriodsForCombination) && selectedPeriodsForCombination.length > 0
                    ? selectedPeriodsForCombination.join(' + ')
                    : null}
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


