// Custom hook for KPI calculations
// Handles all KPI-related calculations and projections

import { useMemo } from 'react';
import { ReportData, KPIData, CompareType } from '../types';
import { 
  parseDate, 
  getCurrentFinancialYear, 
  getFiscalQuarter, 
  calculateGrowthPercentage 
} from '../utils/calculations';
import { 
  filterByBusinessUnit, 
  filterByClientName, 
  filterByBUHead, 
  filterByPeriod 
} from '../utils/dataProcessing';

interface UseKPICalculationsProps {
  data: ReportData[];
  selectedBusinessUnit: string | null;
  selectedClientName: string | null;
  selectedBUHead: string | null;
  compareType: CompareType;
  comparisonValues: (string | null)[];
}

export const useKPICalculations = ({
  data,
  selectedBusinessUnit,
  selectedClientName,
  selectedBUHead,
  compareType,
  comparisonValues
}: UseKPICalculationsProps) => {

  // Calculate KPIs for quarter comparison
  const calculateQuarterKPIs = useMemo((): Record<string, KPIData> => {
    if (compareType !== 'quarter' || comparisonValues.length < 2) return {} as Record<string, KPIData>;

    const currentQuarter = comparisonValues[0];
    const previousQuarter = comparisonValues[1];

    if (!currentQuarter || !previousQuarter) return {} as Record<string, KPIData>;

    // Filter data for current and previous quarters
    const currentQuarterData = data.filter(item => {
      if (selectedBusinessUnit && item.business_unit !== selectedBusinessUnit) return false;
      if (selectedClientName) {
        if (selectedBusinessUnit === "Managed Services" || selectedBusinessUnit === "MS") {
          if (item.project_name !== selectedClientName) return false;
        } else {
          if (item.client_name !== selectedClientName) return false;
        }
      }
      if (selectedBUHead && item.bu_head !== selectedBUHead) return false;

      const date = parseDate(item.month, item.year);
      const quarter = getFiscalQuarter(date);
      return quarter.label === currentQuarter;
    });

    const previousQuarterData = data.filter(item => {
      if (selectedBusinessUnit && item.business_unit !== selectedBusinessUnit) return false;
      if (selectedClientName) {
        if (selectedBusinessUnit === "Managed Services" || selectedBusinessUnit === "MS") {
          if (item.project_name !== selectedClientName) return false;
        } else {
          if (item.client_name !== selectedClientName) return false;
        }
      }
      if (selectedBUHead && item.bu_head !== selectedBUHead) return false;

      const date = parseDate(item.month, item.year);
      const quarter = getFiscalQuarter(date);
      return quarter.label === previousQuarter;
    });

    const calculateParameterKPI = (parameter: string): KPIData => {
      const currentValue = currentQuarterData.reduce((sum, item) => sum + (item[parameter] || 0), 0);
      const previousValue = previousQuarterData.reduce((sum, item) => sum + (item[parameter] || 0), 0);
      const growthPercentage = calculateGrowthPercentage(currentValue, previousValue);

      return {
        currentFY: currentValue,
        previousFY: previousValue,
        growthPercentage,
        isPositive: growthPercentage >= 0,
        monthsCompleted: 3,
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
  }, [data, selectedBusinessUnit, selectedClientName, selectedBUHead, compareType, comparisonValues]);

  // Calculate KPIs for year comparison
  const calculateYearKPIs = useMemo((): Record<string, KPIData> => {
    if (compareType !== 'year' || comparisonValues.length < 2) return {} as Record<string, KPIData>;

    const currentFY = parseInt(comparisonValues[0]?.replace('FY ', '') || '0');
    const previousFY = parseInt(comparisonValues[1]?.replace('FY ', '') || '0');

    if (!currentFY || !previousFY) return {} as Record<string, KPIData>;

    // Filter data for current and previous financial years
    const currentFYData = data.filter(item => {
      if (selectedBusinessUnit && item.business_unit !== selectedBusinessUnit) return false;
      if (selectedClientName) {
        if (selectedBusinessUnit === "Managed Services" || selectedBusinessUnit === "MS") {
          if (item.project_name !== selectedClientName) return false;
        } else {
          if (item.client_name !== selectedClientName) return false;
        }
      }
      if (selectedBUHead && item.bu_head !== selectedBUHead) return false;

      const date = parseDate(item.month, item.year);
      const itemYear = date.getFullYear();
      const itemMonth = date.getMonth() + 1;

      // Financial year runs from April to March
      if (itemMonth >= 4) {
        return itemYear === currentFY;
      } else {
        return itemYear === currentFY + 1;
      }
    });

    const previousFYData = data.filter(item => {
      if (selectedBusinessUnit && item.business_unit !== selectedBusinessUnit) return false;
      if (selectedClientName) {
        if (selectedBusinessUnit === "Managed Services" || selectedBusinessUnit === "MS") {
          if (item.project_name !== selectedClientName) return false;
        } else {
          if (item.client_name !== selectedClientName) return false;
        }
      }
      if (selectedBUHead && item.bu_head !== selectedBUHead) return false;

      const date = parseDate(item.month, item.year);
      const itemYear = date.getFullYear();
      const itemMonth = date.getMonth() + 1;

      // Financial year runs from April to March
      if (itemMonth >= 4) {
        return itemYear === previousFY;
      } else {
        return itemYear === previousFY + 1;
      }
    });

    const calculateParameterKPI = (parameter: string): KPIData => {
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
          currentFYActual = lastMonthCurrent.hc || 0;
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
          previousFYTotal = lastMonthPrevious.hc || 0;
        } else {
          previousFYTotal = 0;
        }
      } else {
        // For all other parameters: sum all months and apply projection
        currentFYActual = currentFYData.reduce((sum, item) => sum + (item[parameter] || 0), 0);
        
        // Calculate months completed and remaining
        const monthsCompleted = currentFYData.length;
        const monthsRemaining = 12 - monthsCompleted;
        
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
      const growthPercentage = calculateGrowthPercentage(currentFYProjected, previousFYTotal);
      const projectedAmount = currentFYProjected - currentFYActual;

      return {
        currentFY: currentFYProjected,
        previousFY: previousFYTotal,
        growthPercentage,
        isPositive: growthPercentage >= 0,
        monthsCompleted: currentFYData.length,
        monthsRemaining: 12 - currentFYData.length,
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
  }, [data, selectedBusinessUnit, selectedClientName, selectedBUHead, compareType, comparisonValues]);

  // Return appropriate KPI calculations based on comparison type
  const kpiData = useMemo((): Record<string, KPIData> => {
    if (compareType === 'quarter') {
      return calculateQuarterKPIs;
    } else if (compareType === 'year') {
      return calculateYearKPIs;
    }
    return {} as Record<string, KPIData>;
  }, [compareType, calculateQuarterKPIs, calculateYearKPIs]);

  return {
    kpiData,
    isLoading: false // This hook doesn't handle loading state
  };
};
