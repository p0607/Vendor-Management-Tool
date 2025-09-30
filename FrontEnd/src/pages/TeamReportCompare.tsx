import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Select, Button, Dropdown, Tabs, message, AutoComplete } from "antd";
import { PlusOutlined, CloseOutlined, DownOutlined } from "@ant-design/icons";
import * as XLSX from 'xlsx';

import styles from './TeamReportDashboard.module.css';
import ForecastChart from './TargetTrackingChart';
import apiClient from '../config/api';
import logo from '../assets/logo_1.png';

const { TabPane } = Tabs;
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

  total: number;

}



interface GrowthAnalysis {

  parameter: string;

  periodValues: {

    period: string;

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

    

    const quarters = [

      `Q1 FY ${financialYear}`,

      `Q2 FY ${financialYear}`,

      `Q3 FY ${financialYear}`,

      `Q4 FY ${financialYear}`

    ];

    

    return quarters;

  };



  // Helper function to get current financial year

  const getCurrentFinancialYear = () => {

    const currentDate = new Date();

    const currentMonth = currentDate.getMonth() + 1; // 1-12

    const currentYear = currentDate.getFullYear();

    

    // Financial year starts from April (month 4)

    if (currentMonth >= 4) {

      return currentYear;

    } else {

      return currentYear - 1;

    }

  };



  // Helper function to get fiscal quarter

  const getFiscalQuarter = (date: Date) => {

    const month = date.getMonth() + 1; // 1-12

    const year = date.getFullYear();

    

    // Financial year starts from April (month 4)

    let financialYear;

    if (month >= 4) {

      financialYear = year;

    } else {

      financialYear = year - 1;

    }

    

    let quarter;

    if (month >= 4 && month <= 6) {

      quarter = 1;

    } else if (month >= 7 && month <= 9) {

      quarter = 2;

    } else if (month >= 10 && month <= 12) {

      quarter = 3;

    } else {

      quarter = 4;

    }

    

    return {

      quarter,

      year: financialYear,

      label: `Q${quarter} FY ${financialYear}`

    };

  };



  // Helper function to parse date from month and year

  const parseDate = (month: string, year: number): Date => {

    // Handle different month formats

    let monthIndex;

    if (typeof month === 'string') {

      const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

      const monthLower = month.toLowerCase();

      monthIndex = monthNames.findIndex(name => name.includes(monthLower));

      if (monthIndex === -1) {

        // Try to parse as number

        const monthNum = parseInt(month);

        if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {

          monthIndex = monthNum - 1;

        } else {

          // Default to current month if parsing fails

          monthIndex = new Date().getMonth();

        }

      }

    } else {

      monthIndex = new Date().getMonth();

    }

    

    return new Date(year, monthIndex, 1);

  };



  // Helper function to parse numeric value

  const parseNumericValue = (value: any): number => {

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



  // Helper function to convert string to null if empty

  const stringOrNull = (value: any): string | null => {

    if (value === null || value === undefined || value === '') return null;

    return String(value);

  };



  // Helper function to calculate growth percentage

  const calculateGrowthPercentage = (current: number, previous: number): number => {

    if (previous === 0) return 0;

    return ((current - previous) / previous) * 100;

  };



  // Helper function to format value

  const formatValue = (value: number, isCroreMode: boolean = true): string => {

    if (isCroreMode) {

      return (value / 10000000).toFixed(2);

    }

    return value.toLocaleString();

  };



  // Helper function to get financial year months

  const getFinancialYearMonths = (): string[] => {

    return ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];

  };



  // Helper function to check if date is in financial year

  const isInFinancialYear = (date: Date, year: number): boolean => {

    const month = date.getMonth() + 1; // 1-12

    const dateYear = date.getFullYear();

    

    // Financial year starts from April (month 4)

    if (month >= 4) {

      return dateYear === year;

    } else {

      return dateYear === year + 1;

    }

  };



  // State variables

  const [data, setData] = useState<ReportData[]>([]);

  const [isLoading, setIsLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string | null>(null);

  const [selectedClientName, setSelectedClientName] = useState<string | null>(null);

  const [selectedBUHead, setSelectedBUHead] = useState<string | null>(null);

  const [compareType, setCompareType] = useState<CompareType>('year');

  const [comparisonValues, setComparisonValues] = useState<(string | null)[]>([]);

  const [selectedParameters, setSelectedParameters] = useState<string[]>(['Revenue', 'GPM', 'NP', 'Team Cost']);

  const [showAllKPIs, setShowAllKPIs] = useState(false);

  const [showAllParameters, setShowAllParameters] = useState(false);

  const [isCroreMode, setIsCroreMode] = useState(true);

  const [activeTab, setActiveTab] = useState('kpi');

  const [activeChartTab, setActiveChartTab] = useState('revenue');

  const [combinedPeriods, setCombinedPeriods] = useState<CombinedPeriod[]>([]);



  // Available parameters

  const availableParameters = [

    'Revenue', 'GPM', 'NP', 'Team Cost', 'HC', 'Salary Cost', 'Opr Cost', 'Funding Cost', 'Leave Encashment'

  ];



  // Available business units

  const [businessUnits, setBusinessUnits] = useState<string[]>([]);

  const [clientNames, setClientNames] = useState<string[]>([]);

  const [buHeads, setBUHeads] = useState<string[]>([]);



  // Fetch data from API

  const fetchData = useCallback(async () => {

    setIsLoading(true);

    setError(null);

    

    try {

      const res = await apiClient.get("/team-report");

      

      if (res.data && Array.isArray(res.data)) {

        setData(res.data);

      } else {

        console.warn("🔍 No data received from API or data is not an array");

        console.warn("🔍 Data type:", typeof res.data);

        console.warn("🔍 Data value:", res.data);

        setData([]);

      }

    } catch (err: any) {

      setError(err.response?.data?.error || err.message || 'Failed to fetch data');

    } finally {

      setIsLoading(false);

    }

  }, []);



  // Initial data fetch

  useEffect(() => {

    fetchData();

  }, [fetchData]);



  // Update business units when data changes

  useEffect(() => {

    if (data.length > 0) {

      const uniqueBusinessUnits = Array.from(new Set(data.map(item => item.business_unit))).filter(Boolean);

      setBusinessUnits(uniqueBusinessUnits);

    }

  }, [data]);



  // Update client names when business unit changes

  useEffect(() => {

    if (data.length > 0 && selectedBusinessUnit) {

      let filteredData = data.filter(item => item.business_unit === selectedBusinessUnit);

      

      if (selectedBusinessUnit === "Managed Services" || selectedBusinessUnit === "MS") {

        const uniqueClientNames = Array.from(new Set(filteredData.map(item => item.project_name))).filter(Boolean);

        setClientNames(uniqueClientNames);

      } else {

        const uniqueClientNames = Array.from(new Set(filteredData.map(item => item.client_name))).filter(Boolean);

        setClientNames(uniqueClientNames);

      }

    } else {

      setClientNames([]);

    }

  }, [data, selectedBusinessUnit]);



  // Update BU heads when business unit changes

  useEffect(() => {

    if (data.length > 0 && selectedBusinessUnit) {

      const filteredData = data.filter(item => item.business_unit === selectedBusinessUnit);

      const uniqueBUHeads = Array.from(new Set(filteredData.map(item => item.bu_head))).filter(Boolean);

      setBUHeads(uniqueBUHeads);

    } else {

      setBUHeads([]);

    }

  }, [data, selectedBusinessUnit]);



  // Set default comparison values

  useEffect(() => {

    if (compareType === 'year') {

      const currentFY = getCurrentFinancialYear();

      setComparisonValues([`FY ${currentFY}`, `FY ${currentFY - 1}`]);

    } else if (compareType === 'quarter') {

      const quarters = getCurrentFinancialYearQuarters();

      setComparisonValues([quarters[0], quarters[1]]);

    }

  }, [compareType]);



  // Filter data based on selected filters

  const filteredData = useMemo(() => {

    return data.filter(item => {

      if (selectedBusinessUnit && item.business_unit !== selectedBusinessUnit) return false;

      if (selectedClientName) {

        if (selectedBusinessUnit === "Managed Services" || selectedBusinessUnit === "MS") {

          if (item.project_name !== selectedClientName) return false;

        } else {

          if (item.client_name !== selectedClientName) return false;

        }

      }

      if (selectedBUHead && item.bu_head !== selectedBUHead) return false;

      return true;

    });

  }, [data, selectedBusinessUnit, selectedClientName, selectedBUHead]);



  // Calculate KPI data

  const kpiData = useMemo(() => {

    if (comparisonValues.filter(Boolean).length < 2) return {};

    

    const currentPeriod = comparisonValues[0];

    const previousPeriod = comparisonValues[1];

    

    if (!currentPeriod || !previousPeriod) return {};

    

    // Filter data for current and previous periods

    const currentPeriodData = filteredData.filter(item => {

      const date = parseDate(item.month, item.year);

      if (isNaN(date.getTime())) return false;

      

      if (compareType === 'year') {

        const year = date.getFullYear();

        return year.toString() === currentPeriod.replace('FY ', '');

      } else if (compareType === 'quarter') {

        const quarter = getFiscalQuarter(date);

        return quarter.label === currentPeriod;

      }

      return false;

    });

    

    const previousPeriodData = filteredData.filter(item => {

      const date = parseDate(item.month, item.year);

      if (isNaN(date.getTime())) return false;

      

      if (compareType === 'year') {

        const year = date.getFullYear();

        return year.toString() === previousPeriod.replace('FY ', '');

      } else if (compareType === 'quarter') {

        const quarter = getFiscalQuarter(date);

        return quarter.label === previousPeriod;

      }

      return false;

    });

    

    // Calculate KPIs for each parameter

    const calculateKPI = (parameter: string) => {

      const currentValue = currentPeriodData.reduce((sum, item) => sum + (item[parameter.toLowerCase().replace(' ', '_')] || 0), 0);

      const previousValue = previousPeriodData.reduce((sum, item) => sum + (item[parameter.toLowerCase().replace(' ', '_')] || 0), 0);

      const growthPercentage = calculateGrowthPercentage(currentValue, previousValue);

      

      return {

        currentFY: currentValue,

        previousFY: previousValue,

        growthPercentage,

        isPositive: growthPercentage >= 0,

        monthsCompleted: currentPeriodData.length,

        monthsRemaining: 12 - currentPeriodData.length,

        period: `${currentPeriod} vs ${previousPeriod}`,

        currentFYActual: currentValue,

        projectedAmount: 0

      };

    };

    

    return {

      Revenue: calculateKPI('sales'),

      GPM: calculateKPI('gpm'),

      'Team Cost': calculateKPI('team_cost'),

      NP: calculateKPI('np'),

      HC: calculateKPI('hc'),

      'Salary Cost': calculateKPI('salary_cost'),

      'Opr Cost': calculateKPI('opr_cost'),

      'Funding Cost': calculateKPI('funding_cost'),

      'Leave Encashment': calculateKPI('leave_encashment')

    };

  }, [filteredData, comparisonValues, compareType]);



  // Calculate growth analysis

  const growthAnalysis = useMemo(() => {

    if (comparisonValues.filter(Boolean).length < 2) return [];

    

    const calculateGrowth = (): GrowthAnalysis[] => {

      return availableParameters.map(param => {

        const periodAmounts = comparisonValues.map((periodValue, index) => {

          if (!periodValue) return null;

          

          // Filter data for this period

          const periodData = filteredData.filter(item => {

            const date = parseDate(item.month, item.year);

            if (isNaN(date.getTime())) return false;

            

            if (compareType === 'year') {

              const year = date.getFullYear();

              return year.toString() === periodValue.replace('FY ', '');

            } else if (compareType === 'quarter') {

              const quarter = getFiscalQuarter(date);

              return quarter.label === periodValue;

            }

            return false;

          });

          

          const amount = periodData.reduce((sum, item) => sum + (item[param.toLowerCase().replace(' ', '_')] || 0), 0);

          

          return {

            period: periodValue,

            amount

          };

        }).filter((item): item is { period: string; amount: number } => item !== null);

        

        // Calculate changes between periods

        const changes: PeriodChange[] = [];

        for (let i = 1; i < periodAmounts.length; i++) {

          const current = periodAmounts[i];

          const previous = periodAmounts[i - 1];

          

          if (current && previous) {

            const absoluteChange = current.amount - previous.amount;

            const percentageChange = calculateGrowthPercentage(current.amount, previous.amount);

            

            changes.push({

              fromPeriod: previous.period,

              toPeriod: current.period,

              absoluteChange,

              percentageChange,

              isPositive: absoluteChange >= 0

            });

          }

        }

        

        return {

          parameter: param,

          periodValues: periodAmounts.filter(Boolean),

          changes

        };

      });

    };

    

    return calculateGrowth();

  }, [filteredData, comparisonValues, compareType]);



  // Handle parameter selection

  const handleParameterToggle = (parameter: string) => {

    setSelectedParameters(prev =>

      prev.includes(parameter)

        ? prev.filter(p => p !== parameter)

        : [...prev, parameter]

    );

  };



  // Handle Excel import

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {

    const file = e.target.files?.[0];

    if (!file) return;

    

    try {

      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            resolve(e.target.result as string);
          } else {
            reject(new Error('Failed to read file'));
          }
        };
        reader.onerror = () => reject(new Error('File reading failed'));
        reader.readAsArrayBuffer(file);
      });

      const workbook = XLSX.read(data, { type: 'array' });

      const sheetName = workbook.SheetNames[0];

      const worksheet = workbook.Sheets[sheetName];

      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      

      if (jsonData.length === 0) {

        message.error('No data found in the Excel file');

        return;

      }

      

      // Process and validate data

      const processedData = jsonData.map((row: any, index: number) => {

        const yearValue = row['Year'] || row.year;

        if (!yearValue) {

          throw new Error(`Row ${index + 1}: Year is required but missing`);

        }

        

        const monthValue = row['Month'] || row.month;

        if (!monthValue) {

          throw new Error(`Row ${index + 1}: Month is required but missing`);

        }

        

        return {

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

      });

      

      // Import data in batches

      const batchSize = 100;

      let successCount = 0;

      let errorCount = 0;

      

      for (let i = 0; i < processedData.length; i += batchSize) {

        const batch = processedData.slice(i, i + batchSize);

        const batchNumber = Math.floor(i / batchSize) + 1;

        

        try {

          await apiClient.post("/team-report/bulk", { data: batch });

          successCount += batch.length;

          message.loading(`Importing ${processedData.length} records... (${batchNumber}/${Math.ceil(processedData.length / batchSize)} batches completed)`, 0);

        } catch (error: any) {

          errorCount += batch.length;

          console.error(`Batch ${batchNumber} failed:`, error);

        }

      }

      

      message.destroy();

      

      if (successCount === processedData.length) {

        message.success(`Successfully imported ${successCount} records`);

        fetchData(); // Refresh data

      } else {

        message.warning(`Imported ${successCount} records successfully, ${errorCount} records failed.`);

      }

    } catch (error: any) {

      message.error(`Import failed: ${error.message}`);

    }

  };



  // Handle Excel export

  const handleExportExcel = () => {

    const exportData = data.map((row: ReportData) => ({

      Tower: row.tower,

      'Client Name': row.client_name,

      'Project Name': row.project_name,

      'Business Unit': row.business_unit,

      'BU Head': row.bu_head,

      HC: row.hc,

      'Salary Cost': row.salary_cost,

      SALES: row.sales,

      GPM: row.gpm,

      'GPM %': row.gpm_percentage,

      'Leave Encashment': row.leave_encashment,

      'Team Cost': row.team_cost,

      'Opr Cost': row.opr_cost,

      'Funding Cost': row.funding_cost,

      NP: row.np,

      'NP %': row.np_percentage,

      Month: row.month,

      Year: row.year

    }));

    

    const worksheet = XLSX.utils.json_to_sheet(exportData);

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Team Report Data');

    

    const fileName = `team_report_${new Date().toISOString().split('T')[0]}.xlsx`;

    XLSX.writeFile(workbook, fileName);

    message.success('Data exported successfully');

  };



  // Render KPI Dashboard

  const renderKPIDashboard = () => {

    const kpiCards = Object.entries(kpiData).map(([key, value]) => {

      if (!showAllKPIs && !selectedParameters.includes(key)) return null;

      

      return (

        <div key={key} style={{

          backgroundColor: 'white',

          padding: '16px',

          borderRadius: '8px',

          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',

          minWidth: '200px'

        }}>

          <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>{key}</h3>

          <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>

            {formatValue(value.currentFY, isCroreMode)} {isCroreMode ? 'Cr' : ''}

          </div>

          <div style={{ fontSize: '12px', color: value.isPositive ? '#52c41a' : '#ff4d4f' }}>

            {value.isPositive ? '+' : ''}{value.growthPercentage.toFixed(1)}% Growth

          </div>

          <div style={{ fontSize: '12px', color: value.isPositive ? '#52c41a' : '#ff4d4f' }}>

            {value.isPositive ? '+' : ''}{formatValue(value.currentFY - value.previousFY, isCroreMode)} {isCroreMode ? 'Cr' : ''}

          </div>

          <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>

            {value.period}

          </div>

        </div>

      );

    }).filter(Boolean);

    

    return (

      <div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>

          <h2>KPI Dashboard</h2>

          <Button

            type="primary"

            icon={<PlusOutlined />}

            onClick={() => setShowAllKPIs(!showAllKPIs)}

          >

            {showAllKPIs ? 'Hide All KPIs' : 'Show All KPIs'}

          </Button>

        </div>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>

          {kpiCards}

        </div>

      </div>

    );

  };



  // Render Growth Analysis

  const renderGrowthAnalysis = () => {

    if (growthAnalysis.length === 0) {

      return <div style={{ color: '#000000', padding: 16, textAlign: 'center' }}>Select at least 2 periods to compare</div>;

    }

    

    return (

      <div>

        <h2>Growth Analysis</h2>

        <div style={{ overflowX: 'auto' }}>

          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #d9d9d9' }}>

            <thead>

              <tr style={{ backgroundColor: '#f5f5f5' }}>

                <th style={{ padding: '8px', border: '1px solid #d9d9d9', textAlign: 'left' }}>Parameter</th>

                {comparisonValues.filter(Boolean).map(period => (

                  <th key={period} style={{ padding: '8px', border: '1px solid #d9d9d9', textAlign: 'center' }}>

                    {period}

                  </th>

                ))}

                <th style={{ padding: '8px', border: '1px solid #d9d9d9', textAlign: 'center' }}>Growth %</th>

                <th style={{ padding: '8px', border: '1px solid #d9d9d9', textAlign: 'center' }}>Absolute Change</th>

              </tr>

            </thead>

            <tbody>

              {growthAnalysis.map(item => {

                const firstValue = item.periodValues[0]?.amount || 0;

                const lastValue = item.periodValues[item.periodValues.length - 1]?.amount || 0;

                const growthPercentage = calculateGrowthPercentage(lastValue, firstValue);

                const absoluteChange = lastValue - firstValue;

                

                return (

                  <tr key={item.parameter}>

                    <td style={{ padding: '8px', border: '1px solid #d9d9d9', fontWeight: 600 }}>

                      {item.parameter}

                    </td>

                    {comparisonValues.filter(Boolean).map(period => {

                      const periodValue = item.periodValues.find(pv => pv.period === period);

                      return (

                        <td key={period} style={{ padding: '8px', border: '1px solid #d9d9d9', textAlign: 'center' }}>

                          {formatValue(periodValue?.amount || 0, isCroreMode)} {isCroreMode ? 'Cr' : ''}

                        </td>

                      );

                    })}

                    <td style={{ 

                      padding: '8px', 

                      border: '1px solid #d9d9d9', 

                      textAlign: 'center',

                      color: growthPercentage >= 0 ? '#52c41a' : '#ff4d4f'

                    }}>

                      {growthPercentage >= 0 ? '+' : ''}{growthPercentage.toFixed(1)}%

                    </td>

                    <td style={{ 

                      padding: '8px', 

                      border: '1px solid #d9d9d9', 

                      textAlign: 'center',

                      color: absoluteChange >= 0 ? '#52c41a' : '#ff4d4f'

                    }}>

                      {absoluteChange >= 0 ? '+' : ''}{formatValue(absoluteChange, isCroreMode)} {isCroreMode ? 'Cr' : ''}

                    </td>

                  </tr>

                );

              })}

            </tbody>

          </table>

        </div>

      </div>

    );

  };



  // Main render

  return (

    <div style={{ padding: '24px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>

      {/* Header */}

      <div style={{ 

        display: 'flex', 

        justifyContent: 'space-between', 

        alignItems: 'center', 

        marginBottom: '24px',

        backgroundColor: 'white',

        padding: '16px',

        borderRadius: '8px',

        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'

      }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

          <img src={logo} alt="Logo" style={{ height: 32 }} />

          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Team Report Dashboard</h1>

        </div>

        <Dropdown

          menu={{

            items: [

              {

                key: 'import',

                label: 'Import Excel',

                onClick: () => {

                  const input = document.createElement('input');

                  input.type = 'file';

                  input.accept = '.xlsx,.xls';

                  input.onchange = (e) => handleImportExcel(e as any);

                  input.click();

                }

              },

              {

                key: 'export',

                label: 'Export Excel',

                onClick: handleExportExcel

              }

            ]

          }}

          trigger={['click']}

        >

          <Button type="primary" icon={<DownOutlined />}>

            Data Actions

          </Button>

        </Dropdown>

      </div>



      {/* Filters */}

      <div style={{

        backgroundColor: 'white',

        padding: '16px',

        borderRadius: '8px',

        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',

        marginBottom: '24px'

      }}>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

            <span>Compare By:</span>

            <Select

              value={compareType}

              onChange={setCompareType}

              style={{ width: 120 }}

            >

              <Option value="year">Year</Option>

              <Option value="quarter">Quarter</Option>

            </Select>

          </div>

          

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

            <span>Current:</span>

            <Select

              value={comparisonValues[0]}

              onChange={(value: string) => setComparisonValues(prev => [value, prev[1]])}

              style={{ width: 120 }}

            >

              {compareType === 'year' ? (

                Array.from({ length: 5 }, (_, i) => {

                  const year = getCurrentFinancialYear() - i;

                  return <Option key={year} value={`FY ${year}`}>FY {year}</Option>;

                })

              ) : (

                getCurrentFinancialYearQuarters().map(quarter => (

                  <Option key={quarter} value={quarter}>{quarter}</Option>

                ))

              )}

            </Select>

          </div>

          

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

            <span>Previous:</span>

            <Select

              value={comparisonValues[1]}

              onChange={(value: string) => setComparisonValues(prev => [prev[0], value])}

              style={{ width: 120 }}

            >

              {compareType === 'year' ? (

                Array.from({ length: 5 }, (_, i) => {

                  const year = getCurrentFinancialYear() - i;

                  return <Option key={year} value={`FY ${year}`}>FY {year}</Option>;

                })

              ) : (

                getCurrentFinancialYearQuarters().map(quarter => (

                  <Option key={quarter} value={quarter}>{quarter}</Option>

                ))

              )}

            </Select>

          </div>

          

          <Button

            type={isCroreMode ? 'primary' : 'default'}

            onClick={() => setIsCroreMode(!isCroreMode)}

          >

            {isCroreMode ? 'Crore Mode' : 'Lakh Mode'}

          </Button>

          

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

            <span>Business Unit:</span>

            <Select

              value={selectedBusinessUnit}

              onChange={setSelectedBusinessUnit}

              style={{ width: 150 }}

              placeholder="All Business Units"

            >

              <Option value={null}>All Business Units</Option>

              {businessUnits.map(unit => (

                <Option key={unit} value={unit}>{unit}</Option>

              ))}

            </Select>

          </div>

          

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

            <span>Client Name:</span>

            <AutoComplete

              value={selectedClientName}

              onChange={setSelectedClientName}

              options={clientNames.map(name => ({ value: name }))}

              style={{ width: 150 }}

              placeholder="All Clients"

            />

          </div>

          

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

            <span>BU Head:</span>

            <Select

              value={selectedBUHead}

              onChange={setSelectedBUHead}

              style={{ width: 150 }}

              placeholder="All BU Heads"

            >

              <Option value={null}>All BU Heads</Option>

              {buHeads.map(head => (

                <Option key={head} value={head}>{head}</Option>

              ))}

            </Select>

          </div>

        </div>

      </div>



      {/* Parameter Selection */}

      <div style={{

        backgroundColor: 'white',

        padding: '16px',

        borderRadius: '8px',

        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',

        marginBottom: '24px'

      }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>

          <span>Select Parameters:</span>

          <Button

            type="primary"

            icon={<PlusOutlined />}

            onClick={() => setShowAllParameters(!showAllParameters)}

          >

            {showAllParameters ? 'Hide All' : 'Show All'}

          </Button>

        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>

          {availableParameters.map(param => {

            if (!showAllParameters && !selectedParameters.includes(param)) return null;

            

            return (

              <div

                key={param}

                style={{

                  display: 'flex',

                  alignItems: 'center',

                  gap: '4px',

                  padding: '4px 8px',

                  backgroundColor: selectedParameters.includes(param) ? '#1890ff' : '#f5f5f5',

                  color: selectedParameters.includes(param) ? 'white' : 'black',

                  borderRadius: '4px',

                  cursor: 'pointer'

                }}

                onClick={() => handleParameterToggle(param)}

              >

                <span>{param}</span>

                {selectedParameters.includes(param) && (

                  <CloseOutlined style={{ fontSize: '12px' }} />

                )}

              </div>

            );

          })}

        </div>

      </div>



      {/* Main Content Tabs */}

      <Tabs 

        activeKey={activeTab} 

        onChange={setActiveTab}

        style={{ marginBottom: '16px' }}

      >

        <TabPane tab="KPI Dashboard" key="kpi">

          {renderKPIDashboard()}

        </TabPane>

        <TabPane tab="Growth Analysis" key="growth">

          {renderGrowthAnalysis()}

        </TabPane>

        <TabPane tab="Parameter Tracking" key="tracking">

          <ForecastChart

            selectedBusinessUnit={selectedBusinessUnit}

            selectedPeriod={comparisonValues[0]}

            compareType={compareType}

            actualData={[{

              revenue: 0,

              netMargin: 0,

              period: comparisonValues[0] || ''

            }]}

          />

        </TabPane>

      </Tabs>

    </div>

  );

};



export default TeamReportCompare;
