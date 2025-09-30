// Custom hook for Growth Analysis calculations
// Handles growth analysis data processing and calculations

import { useMemo } from 'react';
import { ReportData, GrowthAnalysis, PeriodChange, CompareType } from '../types';
import { parseDate, getFiscalQuarter } from '../utils/calculations';
import { 
  filterByBusinessUnit, 
  filterByClientName, 
  filterByBUHead 
} from '../utils/dataProcessing';

interface UseGrowthAnalysisProps {
  data: ReportData[];
  selectedBusinessUnit: string | null;
  selectedClientName: string | null;
  selectedBUHead: string | null;
  compareType: CompareType;
  comparisonValues: (string | null)[];
  availableParameters: string[];
  combinedPeriods: any[];
}

export const useGrowthAnalysis = ({
  data,
  selectedBusinessUnit,
  selectedClientName,
  selectedBUHead,
  compareType,
  comparisonValues,
  availableParameters,
  combinedPeriods
}: UseGrowthAnalysisProps) => {

  const growthAnalysis = useMemo(() => {
    if (comparisonValues.filter(Boolean).length < 2) {
      return [];
    }

    const calculateGrowth = (): GrowthAnalysis[] => {
      return availableParameters.map(param => {
        const periodAmounts = comparisonValues.map((periodValue, index) => {
          if (!periodValue) return null;

          // Check if this is a combined period
          const combinedPeriod = combinedPeriods[index];

          if (combinedPeriod && combinedPeriod.label === periodValue) {
            // Special handling for HC - use sum of last available month's HC data
            if (param === 'HC') {
              const allPeriodData = combinedPeriod.periods.flatMap(period => 
                data.filter(item => {
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
                return lastMonthData.hc || 0;
              }
              return 0;
            }

            // For all other parameters: sum all months
            return combinedPeriod.periods.reduce((total, period) => {
              return total + data
                .filter(item => {
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
                .reduce((sum, item) => {
                  let value = 0;
                  switch (param) {
                    case 'Revenue': value = item.sales || 0; break;
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
          const filteredData = data.filter(item => {
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
            if (isNaN(date.getTime())) return false;
            
            let itemValue = "";
            switch (compareType) {
              case "year": 
                const yearStr = date.getFullYear().toString();
                const fyYearStr = `FY ${yearStr}`;
                itemValue = yearStr; 
                return periodValue === yearStr || periodValue === fyYearStr;
              case "month": itemValue = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`; break;
              case "quarter": itemValue = getFiscalQuarter(date).label; break;
              default: return false;
            }
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
              return lastMonthData.hc || 0;
            }
            return 0;
          }

          // For all other parameters: sum all months
          return filteredData.reduce((sum, item) => {
            let value = 0;
            switch (param) {
              case 'Revenue': value = item.sales || 0; break;
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
            ? (absoluteChange / firstAmount) * 100 
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
      });
    };

    return calculateGrowth();
  }, [
    data,
    selectedBusinessUnit,
    selectedClientName,
    selectedBUHead,
    compareType,
    comparisonValues,
    availableParameters,
    combinedPeriods
  ]);

  return {
    growthAnalysis
  };
};
