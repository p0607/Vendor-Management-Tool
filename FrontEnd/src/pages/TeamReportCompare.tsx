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

  // Helper function to get corresponding quarter from previous year
  const getCorrespondingPreviousQuarter = (quarter: string) => {
    const yearMatch = quarter.match(/(\d{4})/);
    if (!yearMatch) return null;
    
    const currentYear = parseInt(yearMatch[1]);
    const previousYear = currentYear - 1;
    
    if (quarter.includes('Q1')) return `Q1(Apr-Jun) ${previousYear}`;
    if (quarter.includes('Q2')) return `Q2(Jul-Sep) ${previousYear}`;
    if (quarter.includes('Q3')) return `Q3(Oct-Dec) ${previousYear}`;
    if (quarter.includes('Q4')) return `Q4(Jan-Mar) ${previousYear}`;
    
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
          // For all other parameters: sum all months
          currentValue = currentQuarterData.reduce((sum, item) => sum + (item[parameter] || 0), 0);
          previousValue = previousQuarterData.reduce((sum, item) => sum + (item[parameter] || 0), 0);
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
        'Net Margin': calculateParameterRaw('net_margin'),
        HC: calculateParameterRaw('hc'),
        'Opr Cost': calculateParameterRaw('opr_cost'),
        'Funding Cost': calculateParameterRaw('funding_cost'),
        'Leave Encashment': calculateParameterRaw('leave_encashment')
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
      
      // Simple calendar year filtering: 2025 = Jan 2025 to Dec 2025
      return itemYear === currentFY;
    });

    const previousFYData = data.filter(item => {
      const itemDate = parseDate(item.month, item.year);
      if (isNaN(itemDate.getTime())) return false;
      
      const itemYear = itemDate.getFullYear();
      const itemMonth = itemDate.getMonth() + 1;
      
      // Simple calendar year filtering: 2024 = Jan 2024 to Dec 2024
      return itemYear === previousFY;
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
        // For all other parameters: sum all months (ACTUAL DATA ONLY - NO PROJECTIONS)
        currentFYActual = currentFYData.reduce((sum, item) => sum + (item[parameter] || 0), 0);
        previousFYTotal = previousFYData.reduce((sum, item) => sum + (item[parameter] || 0), 0);

        console.log(`🔍 Raw Database Values for ${parameter}:`, {
          currentFY,
          previousFY,
          currentFYActual, // RAW DATABASE VALUE
          previousFYTotal, // RAW DATABASE VALUE
          currentFYDataLength: currentFYData.length,
          previousFYDataLength: previousFYData.length,
          calculation: `Sum of all months for ${parameter}`,
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
        period: `FY ${currentFY} vs FY ${previousFY}`
      };
    };

    return {
      Revenue: calculateParameterRaw('sales'),
      GPM: calculateParameterRaw('gpm'),
      'Team Cost': calculateParameterRaw('team_cost'),
      NP: calculateParameterRaw('np'),
      HC: calculateParameterRaw('hc'),
      'Salary Cost': calculateParameterRaw('salary_cost'),
      'Opr Cost': calculateParameterRaw('opr_cost'),
      'Funding Cost': calculateParameterRaw('funding_cost'),
      'Leave Encashment': calculateParameterRaw('leave_encashment')
    };
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
        Revenue: calculateParameterKPI('sales'),
        GPM: calculateParameterKPI('gpm'),
        'Team Cost': calculateParameterKPI('team_cost'),
        NP: calculateParameterKPI('np'),
        HC: calculateParameterKPI('hc'),
        'Salary Cost': calculateParameterKPI('salary_cost'),
        'Opr Cost': calculateParameterKPI('opr_cost'),
        'Funding Cost': calculateParameterKPI('funding_cost'),
        'Leave Encashment': calculateParameterKPI('leave_encashment')
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

    // Filter data for current and previous financial years
    const currentFYData = data.filter(item => {
      const itemDate = parseDate(item.month, item.year);
      if (isNaN(itemDate.getTime())) return false;
      
      const itemYear = itemDate.getFullYear();
      const itemMonth = itemDate.getMonth() + 1;
      
      // Simple calendar year filtering: 2025 = Jan 2025 to Dec 2025
      return itemYear === currentFY;
    });

    const previousFYData = data.filter(item => {
      const itemDate = parseDate(item.month, item.year);
      if (isNaN(itemDate.getTime())) return false;
      
      const itemYear = itemDate.getFullYear();
      const itemMonth = itemDate.getMonth() + 1;
      
      // Simple calendar year filtering: 2024 = Jan 2024 to Dec 2024
      return itemYear === previousFY;
    });

    const calculateParameterKPI = (parameter: string) => {
      let currentFYActual, currentFYProjected, previousFYTotal;

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
          currentFYProjected = currentFYActual; // HC doesn't need projection
        } else {
          currentFYActual = 0;
          currentFYProjected = 0;
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
      } else {
        // For all other parameters: sum all months and apply projection
        currentFYActual = currentFYData.reduce((sum, item) => sum + (item[parameter] || 0), 0);
        
        // If we have data for current FY, project it for remaining months
        currentFYProjected = currentFYActual;
        if (currentFYData.length > 0 && monthsRemaining > 0) {
          // Find the last available month's data
          const lastMonthData = currentFYData.reduce((latest, item) => {
            const itemDate = parseDate(item.month, item.year);
            const latestDate = parseDate(latest.month, latest.year);
            return itemDate > latestDate ? item : latest;
          });
          
          const lastMonthValue = lastMonthData[parameter] || 0;
          // Multiply last month's value by remaining months
          currentFYProjected = currentFYActual + (lastMonthValue * monthsRemaining);
        }

        // Calculate previous FY total
        previousFYTotal = previousFYData.reduce((sum, item) => sum + (item[parameter] || 0), 0);
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
        period: `FY ${currentFY} vs FY ${previousFY}`,
        currentFYActual,
        projectedAmount
      };
    };

    return {
      Revenue: calculateParameterKPI('sales'),
      GPM: calculateParameterKPI('gpm'),
      'Team Cost': calculateParameterKPI('team_cost'),
      NP: calculateParameterKPI('np'),
      HC: calculateParameterKPI('hc'),
      'Salary Cost': calculateParameterKPI('salary_cost'),
      'Opr Cost': calculateParameterKPI('opr_cost'),
      'Funding Cost': calculateParameterKPI('funding_cost'),
      'Leave Encashment': calculateParameterKPI('leave_encashment')
    };
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

  const [availableOptions, setAvailableOptions] = useState<string[]>([]);

  const [selectedParameters, setSelectedParameters] = useState<string[]>(() => {

    // Force default parameters
    const defaultParams = ['Revenue', 'GPM', 'NP', 'Team Cost'];
    return defaultParams;
  });
  const [chartType, setChartType] = useState<'bar' | 'line' | 'combo'>(() => {
    // Force line chart
    return 'line';
  });
  const [availableParameters, setAvailableParameters] = useState<string[]>([]);

  const [showAllKPIs, setShowAllKPIs] = useState(false);
  const [comparisonData, setComparisonData] = useState<{[key: string]: any}[]>([]);

  const [growthAnalysis, setGrowthAnalysis] = useState<GrowthAnalysis[]>([]);

  const [isLoading, setIsLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<string>('chart');

  const [showGrowthAnalysis, setShowGrowthAnalysis] = useState<boolean>(false);

  const [isActionDropdownOpen, setIsActionDropdownOpen] = useState(false);

  const [showAllParameters, setShowAllParameters] = useState(false);

  // Crore/Lakh toggle state
  const [isCroreMode, setIsCroreMode] = useState(true);

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
      const lowerDateStr = dateStr.toLowerCase();
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
        const lowerDateStr = dateStr.toLowerCase();
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


      
      
      const mappedData = jsonData.map((row: any) => {

        // Helper function to convert empty strings to null

        const stringOrNull = (value: any): string | null => {

          const str = String(value || '').trim();

          return str === '' ? null : str;

        };



        return {

          business_unit: stringOrNull(row['Business_Unit'] || row['Business Unit'] || row.business_unit),

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

      label: 'Download Summary Sheet Template',

      onClick: handleDownloadTemplate

    },

    {

      key: 'import',

      label: 'Upload Summary Sheet',

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
      if (correspondingQuarter && availableOptions.includes(correspondingQuarter)) {
        newValues[1] = correspondingQuarter;
        message.success(`Auto-selected corresponding quarter: ${correspondingQuarter}`);
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

      'Revenue',

      'GPM',

      'Team Cost',

      'Net Margin'

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


        
        
        // Extract business units and filter out null/undefined values

        const businessUnitsFromData = res.data

          .map((item: any) => item.business_unit)

          .filter((bu: any) => bu && bu.trim() !== '');
        
        
        

        
        
        const uniqueBusinessUnits = Array.from(new Set(businessUnitsFromData)) as string[];


        
        
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

      const res = await apiClient.get("/team-summary-report");

      
      
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

      const res = await apiClient.get("/team-summary-report");

      
      
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
                sales: record.sales,
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

            item.business_unit === selectedBusinessUnit

          );


        }

        
        
        if (selectedClientName) {

          if (selectedBusinessUnit === "Managed Services" || selectedBusinessUnit === "MS") {

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

            item.business_unit === user.business_unit

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

            if (selectedBusinessUnit && item.business_unit !== selectedBusinessUnit) {

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
                // Handle both "2025" and "FY 2025" formats
                const yearStr = date.getFullYear().toString();
                const fyYearStr = `FY ${yearStr}`;
                itemValue = yearStr;
                // Check if period matches either format
                return period === yearStr || period === fyYearStr;

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

      if (selectedBusinessUnit && item.business_unit !== selectedBusinessUnit) {

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
          // Handle both "2025" and "FY 2025" formats
          const yearStr = date.getFullYear().toString();
          const fyYearStr = `FY ${yearStr}`;
          itemValue = yearStr;
          // Check if periodValue matches either format
          const matches = periodValue === yearStr || periodValue === fyYearStr;
          return matches;

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
    console.log("🔍 availableParameters:", availableParameters);
    console.log("🔍 availableParameters length:", availableParameters.length);
    console.log("🔍 selectedParameters:", selectedParameters);
    console.log("🔍 selectedParameters length:", selectedParameters.length);
    console.log("🔍 showAllParameters:", showAllParameters);
    console.log("🔍 comparisonValues:", comparisonValues);
    console.log("🔍 data length:", data.length);

    
    
    if (comparisonValues.filter(Boolean).length < 2) {

      console.log("🔍 Not enough periods for growth analysis, skipping");

      setGrowthAnalysis([]);

      return;

    }



    const calculateGrowth = (): GrowthAnalysis[] => {
      console.log("🔍 calculateGrowth called with availableParameters:", availableParameters);
      
      return availableParameters.map(param => {
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
                  if (selectedBusinessUnit && item.business_unit !== selectedBusinessUnit) return false;
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
                      return period === yearStr || period === fyYearStr;
                    case "month": itemValue = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`; break;
                    case "quarter": itemValue = getFiscalQuarter(date).label; break;
                    default: return false;
                  }
                  return itemValue === period;
                })
              );
              
              // Find the last month's HC value across all periods
              if (allPeriodData.length > 0) {
                const lastMonthData = allPeriodData.reduce((latest, item) => {
                  const itemDate = parseDate(item.month, item.year);
                  const latestDate = parseDate(latest.month, latest.year);
                  return itemDate > latestDate ? item : latest;
                });
                // Sum all HC values from that last month
                const lastMonthDate = parseDate(lastMonthData.month, lastMonthData.year);
                return allPeriodData
                  .filter(item => {
                    const itemDate = parseDate(item.month, item.year);
                    return itemDate.getMonth() === lastMonthDate.getMonth() && 
                           itemDate.getFullYear() === lastMonthDate.getFullYear();
                  })
                  .reduce((sum, item) => sum + (item.hc || 0), 0);
              }
              return 0;
            }

            // For all other parameters: sum all months
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
                      // Check if period matches either format
                      return period === yearStr || period === fyYearStr;

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

              if (selectedBusinessUnit && item.business_unit !== selectedBusinessUnit) return false;

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
                  // Check if periodValue matches either format
                  return periodValue === yearStr || periodValue === fyYearStr;

                case "month": itemValue = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`; break;

                case "quarter": itemValue = getFiscalQuarter(date).label; break;

                default: return false;

              }

              
              
              // For non-year comparisons, use the original logic
              return itemValue === periodValue;

            });

          // Special handling for HC - use sum of last available month's HC data
          if (param === 'HC') {
            if (filteredData.length > 0) {
              const lastMonthData = filteredData.reduce((latest, item) => {
                const itemDate = parseDate(item.month, item.year);
                const latestDate = parseDate(latest.month, latest.year);
                return itemDate > latestDate ? item : latest;
              });
              // Sum all HC values from that last month
              const lastMonthDate = parseDate(lastMonthData.month, lastMonthData.year);
              return filteredData
                .filter(item => {
                  const itemDate = parseDate(item.month, item.year);
                  return itemDate.getMonth() === lastMonthDate.getMonth() && 
                         itemDate.getFullYear() === lastMonthDate.getFullYear();
                })
                .reduce((sum, item) => sum + (item.hc || 0), 0);
            }
            return 0;
          }

          // For all other parameters: sum all months
          return filteredData.reduce((sum, item) => {

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



    // Use the calculateGrowth function which properly handles multiple periods
    const chartData = calculateGrowth();
    console.log("🔍 Growth Analysis Chart data (multi-period):", chartData);

    console.log("🔍 Final growth analysis data (multi-period):", chartData);
    console.log("🔍 Chart data length:", chartData.length);
    console.log("🔍 Chart data parameters:", chartData.map(item => item.parameter));
    console.log("🔍 Setting growthAnalysis state with multi-period data:", chartData.length, "items");
    setGrowthAnalysis(chartData);
  }, [availableParameters, comparisonValues, data, compareType, selectedBusinessUnit, selectedClientName, selectedBUHead, showAllParameters]);

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
    
    if (data.length === 0 || selectedParameters.length === 0 || activeChartTab !== 'growth') {
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
        } else if (param === 'GPM %' || param === 'NP %') {
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
        }
        return {
          prefix: '',
          suffix: '',
          format: '#,##0'
        };
      };

      // Add series based on chart type - one series per parameter for growth analysis
      if (chartType === 'bar' || chartType === 'combo') {

        selectedParameters.forEach((parameter, index) => {

          const format = getParameterFormat(parameter);
          const series = chart.series.push(

            am5xy.ColumnSeries.new(root, {

              name: parameter,

              xAxis: xAxis,

              yAxis: yAxis,

              valueYField: "value",
              categoryXField: "period",

              tooltip: am5.Tooltip.new(root, {

                pointerOrientation: "horizontal",

                labelText: `{categoryX}: ${format.prefix}{valueY.formatNumber('${format.format}')}${format.suffix}`,
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

                    <div style="font-weight: 500; margin-bottom: 2px; color: #666666; font-size: 11px;">{parameter}</div>
                    <div style="font-weight: 700; color: #000000; font-size: 13px;">${format.prefix}{valueY.formatNumber('${format.format}')}${format.suffix}</div>

                  </div>

                `

              })

            })

          );



          // Configure column appearance

          series.columns.template.setAll({

            width: am5.percent(60 / selectedParameters.length),
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

            stroke: am5.color(0x1890ff)
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

              valueYField: "value",
              categoryXField: "period",

              tooltip: am5.Tooltip.new(root, {

                pointerOrientation: "horizontal",

                labelText: `{categoryX}: ${format.prefix}{valueY.formatNumber('${format.format}')}${format.suffix}`,
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

                    <div style="font-weight: 500; margin-bottom: 2px; color: #666666; font-size: 11px;">{parameter}</div>
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



      // Set data for Parameter Data Visualization
      // Create data points for each parameter showing actual values over time
      const parameterChartData: any[] = [];
      
      // Use the same data structure as other components - default to year comparison
      const currentFY = getCurrentFinancialYear();
      const previousFY = currentFY - 1;
      
      // Get periods based on comparison type (default to year)
      let periods: string[] = [];
      if (compareType === 'quarter') {
        // Use quarter comparison if available
        const currentQuarter = comparisonValues[0] || `Q1(Apr-Jun) ${currentFY}`;
        const previousQuarter = comparisonValues[1] || `Q1(Apr-Jun) ${previousFY}`;
        periods = [currentQuarter, previousQuarter];
      } else {
        // Default to year comparison
        periods = [`FY ${currentFY}`, `FY ${previousFY}`];
      }
      
      // Create data for each parameter and period
      selectedParameters.forEach(parameter => {
        periods.forEach(period => {
          // Get the actual value for this parameter and period from the data
          let value = 0;
          
          // Filter data based on period (same logic as KPI calculations)
          let filteredData: any[] = [];
          
          if (compareType === 'quarter' && period.includes('Q')) {
            // Quarter comparison
            const quarterMonths = getQuarterMonths(period);
            const yearMatch = period.match(/(\d{4})/);
            const year = yearMatch ? parseInt(yearMatch[1]) : currentFY;
            
            filteredData = data.filter(item => {
              const itemDate = parseDate(item.month, item.year);
              const itemYear = itemDate.getFullYear();
              const itemMonth = itemDate.getMonth() + 1;
              
              // For quarters, we need to handle financial year logic
              // Q1(Apr-Jun) 2025 = April 2025 to June 2025
              // Q4(Jan-Mar) 2025 = January 2026 to March 2026
              if (quarterMonths.includes(1) || quarterMonths.includes(2) || quarterMonths.includes(3)) {
                // Q4: Jan-Mar belongs to next calendar year
                return itemYear === year + 1 && quarterMonths.includes(itemMonth);
              } else {
                // Q1, Q2, Q3: Apr-Dec belongs to same calendar year
                return itemYear === year && quarterMonths.includes(itemMonth);
              }
            });
          } else {
            // Year comparison (default)
            const yearMatch = period.match(/(\d{4})/);
            const year = yearMatch ? parseInt(yearMatch[1]) : currentFY;
            
            filteredData = data.filter(item => {
              const itemDate = parseDate(item.month, item.year);
              const itemYear = itemDate.getFullYear();
              const itemMonth = itemDate.getMonth() + 1;
              
              // Simple calendar year filtering
              return itemYear === year;
            });
          }
          
          // Sum up the values for this parameter across all filtered data
          value = filteredData.reduce((sum, item) => {
            const paramKey = parameter.toLowerCase().replace(/\s+/g, '_');
            return sum + (item[paramKey] || 0);
          }, 0);
          
          parameterChartData.push({
            period: period,
            value: value,
            parameter: parameter
          });
        });
      });
      
      console.log("🔍 Parameter Data Chart data:", parameterChartData);
      console.log("🔍 Compare type:", compareType);
      console.log("🔍 Chart element found:", !!chartElement);
      console.log("🔍 Chart type:", chartType);
      
      // Create unique periods for x-axis (only two periods: FY 2024 and FY 2025)
      const uniquePeriods = periods.map(period => ({ period }));
      xAxis.data.setAll(uniquePeriods);
      
      // Set data for each series (one line per parameter)
      chart.series.values.forEach((series, index) => {
        const parameterName = selectedParameters[index];
        const seriesData = parameterChartData.filter(item => item.parameter === parameterName);
        console.log(`🔍 Setting data for series ${parameterName}:`, seriesData);
        series.data.setAll(seriesData);
      });

    }, 100); // 100ms delay



    return () => {

      clearTimeout(timer);

      am5.array.each(am5.registry.rootElements, (root) => {

        if (root && root.dom && root.dom.id === "comparisonChart") root.dispose();

      });

    };

  }, [data, selectedParameters, chartType, activeChartTab, compareType, comparisonValues]);


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
      const kpiData = calculateKPIs();
      
      // Create waterfall data
      const waterfallData = selectedParameters.map(parameter => {
        const kpi = kpiData[parameter];
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

            <button className="auth-button" onClick={() => navigate('/HomePage')}>

              Home

            </button>
          </div>


        </div>

      </div>



      <div style={{ margin: "20px 8px 8px 8px", paddingTop: "0rem" }}>

        {/* Crore/Lakh Toggle Button */}
        <div style={{ marginBottom: '0px', display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            onClick={() => setIsCroreMode(!isCroreMode)}
            style={{
              padding: '6px 12px',
              fontSize: '11px',
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

  <div style={{ marginBottom: 16 }}>

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
            gridTemplateColumns: showAllKPIs ? 'repeat(auto-fit, minmax(280px, 1fr))' : 'repeat(4, 1fr)',
            gap: 16,
            marginBottom: 16
          }}>
            {(() => {
              const kpis = calculateKPIs();
              const mainKPIs = ['Revenue', 'GPM', 'Team Cost', 'NP'];
              const additionalKPIs = ['HC', 'Salary Cost', 'OPR Cost', 'Funding Cost', 'Leave Encashment'];
              const displayKPIs = showAllKPIs ? [...mainKPIs, ...additionalKPIs] : mainKPIs;
              
              return displayKPIs.map((kpiName) => {
                const kpi = kpis[kpiName];
                if (!kpi) return null;
                
                const formatValue = (value: number) => {
                  if (kpiName === 'Revenue' || kpiName === 'GPM' || kpiName === 'Team Cost' || kpiName === 'NP' || 
                      kpiName === 'Salary Cost' || kpiName === 'OPR Cost' || kpiName === 'Funding Cost' || kpiName === 'Leave Encashment') {
                    return formatValueWithToggle(value, true);
                  }
                  return value.toFixed(0);
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
                      {kpi.growthPercentage >= 0 ? '+' : ''}{kpi.growthPercentage.toFixed(1)}% Growth
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

                    {/* vs FY 2024 */}
                    <div style={{ 
                      fontSize: 8, 
                      color: '#666666', 
                      marginBottom: 8,
                      textAlign: 'center'
                    }}>
                      vs FY 2024
                    </div>

                    {/* KPI Label */}
                    <div style={{ 
                      backgroundColor: '#f5f5f5', 
                      color: '#666666', 
                      padding: '4px 8px', 
                      borderRadius: 4, 
                      fontSize: 10, 
                      fontWeight: 500,
                      display: 'inline-block',
                      marginBottom: 12
                    }}>
                      {kpiName}
                    </div>

                    {/* Current FY Value */}
                    <div style={{ 
                      fontSize: 12, 
                      fontWeight: 700, 
                      color: '#333333', 
                      marginBottom: 2
                    }}>
                      {formatValue(kpi.currentFY)}
                    </div>

                    {/* FY Projected and Actual on same row */}
                    <div style={{ 
                      fontSize: 10, 
                      color: '#666666', 
                      marginBottom: 8,
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}>
                      <span>FY 2025 (Projected)</span>
                      <span>{formatValue(kpi.previousFY)} Actual</span>
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
                        {kpi.monthsRemaining > 0 ? `Projected for ${kpi.monthsRemaining} months` : 'Full year data'}
                      </div>
                    </div>

                    {/* Original vs Projected Breakdown */}
                    {kpi.monthsRemaining > 0 && (
                      <div style={{ 
                        fontSize: 8, 
                        color: '#666666',
                        marginBottom: 8,
                        lineHeight: '1.2'
                      }}>
                        <div>Actual: {formatValue(kpi.currentFYActual)}</div>
                        <div>+ Projected: {formatValue(kpi.projectedAmount)}</div>
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
                      {kpi.monthsCompleted}/12 months completed
                    </div>
                  </div>
                );
              });
            })()}
          </div>
          
          {/* Show More/Less Button */}
          <div style={{ textAlign: 'center' }}>
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => setShowAllKPIs(!showAllKPIs)}
              style={{
                color: '#000000',
                borderColor: '#004a7a',
                backgroundColor: '#ffffff'
              }}
            >
              {showAllKPIs ? 'Show Less' : '+ Show More KPIs'}
            </Button>
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
            <div style={{ width: "100%", height: "500px" }}>
                  <h3 style={{ color: '#000000' }}>{selectedParameters.join(', ')} Data Visualization</h3>
              <div id="comparisonChart" style={{ width: "100%", height: "100%" }} />
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

        {comparisonValues.filter(Boolean).map((period, i) => (

          <th key={i} style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #d9d9d9', color: '#000000', fontSize: '10px' }}>

            {period}

          </th>

        ))}

        <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #d9d9d9', color: '#000000', fontSize: '10px' }}>Absolute Change</th>

        <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #d9d9d9', color: '#000000', fontSize: '10px' }}>Growth %</th>

      </tr>

    </thead>

    <tbody>

      {(showAllParameters ? growthAnalysis : growthAnalysis.filter(item => selectedParameters.includes(item.parameter))).map((item, index) => {

        // Calculate growth between first and last period for each parameter

        const firstPeriodAmount = item.periodValues[0]?.amount || 0;

        const lastPeriodAmount = item.periodValues[item.periodValues.length - 1]?.amount || 0;

        const absoluteChange = lastPeriodAmount - firstPeriodAmount;

        const growthPercentage = firstPeriodAmount !== 0 

          ? ((absoluteChange) / firstPeriodAmount) * 100 

          : lastPeriodAmount !== 0 ? Infinity : 0;

        const isPositive = absoluteChange >= 0;



        return (

          <tr key={item.parameter} style={{ 

            backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9f9f9',

            borderBottom: '1px solid #d9d9d9',

            color: '#000000'

          }}>

            <td style={{ padding: '6px 8px', fontWeight: 500, color: '#000000', fontSize: '10px' }}>{item.parameter}</td>

            {item.periodValues.filter(pv => pv.period).map((pv, i) => {

              return (

                <td key={i} style={{ padding: '6px 8px', textAlign: 'right', color: '#000000', fontSize: '10px' }}>

                  {formatValueForTable(pv.amount, item.parameter)}

                </td>

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
      Top Growth
    </div>

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

                <div style={{ fontWeight: 500, color: '#000000', fontSize: '10px' }}>{change.parameter}</div>

                <div style={{ fontSize: 10, color: '#666666' }}>

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
      Top Decline
    </div>

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

                <div style={{ fontWeight: 500, color: '#000000', fontSize: '10px' }}>{change.parameter}</div>

                <div style={{ fontSize: 10, color: '#666666' }}>

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
      Summary
    </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>

        <span style={{ color: '#000000', fontSize: '10px' }}>Parameters Increased:</span>

        <span style={{ fontWeight: 500, color: '#000000', fontSize: '10px' }}>

          {growthAnalysis

            .flatMap(item => item.changes)

            .filter(change => change.isPositive).length}

        </span>

      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>

        <span style={{ color: '#000000', fontSize: '10px' }}>Parameters Decreased:</span>

        <span style={{ fontWeight: 500, color: '#000000', fontSize: '10px' }}>

          {growthAnalysis

            .flatMap(item => item.changes)

            .filter(change => !change.isPositive).length}

        </span>

      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>

        <span style={{ color: '#000000', fontSize: '10px' }}>Highest Growth:</span>

        <span style={{ fontWeight: 500, color: '#000000', fontSize: '10px' }}>

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

        revenue: periodData.find(i => i.parameter === "Revenue")?.amount || 0,

        gpm: periodData.find(i => i.parameter === "GPM")?.amount || 0,

        netMargin: periodData.find(i => i.parameter === "Net Margin")?.amount || 0

      };

    });



    const baseline = metrics[0];

    
    
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

    const currentValue = metric.calculate(metrics[metrics.length - 1]);

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

                    {m.period}

                    {i === 0 && <div style={{ fontSize: 10, fontWeight: 400, color: '#000000' }}>(Baseline)</div>}

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

                      const current = metric.calculate(metrics[metrics.length - 1]);

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