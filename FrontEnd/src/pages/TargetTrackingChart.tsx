import React, { useState, useEffect } from 'react';
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { Card, Row, Col, Select, Typography } from 'antd';
import apiClient from '../config/api';

const { Title, Text } = Typography;
const { Option } = Select;

interface ForecastChartProps {
  selectedBusinessUnit: string | null;
  selectedPeriod: string | null;
  compareType: string;
  actualData: {
    revenue: number;
    netMargin: number;
    gpm?: number;
    hc?: number;
    period: string;
  }[];
  // Add data from TeamReportCompare
  data?: any[];
  availableParameters?: string[];
}

const ForecastChart: React.FC<ForecastChartProps> = ({
  selectedBusinessUnit,
  selectedPeriod,
  compareType,
  actualData,
  data = [],
  availableParameters: propAvailableParameters = []
}) => {
  const [selectedParameter, setSelectedParameter] = useState<string>('Revenue');
  const [selectedTimeline, setSelectedTimeline] = useState<string>('month');
  const [selectedBusinessUnitFilter, setSelectedBusinessUnitFilter] = useState<string>('all');
  const [databaseData, setDatabaseData] = useState<any[]>(data || []);
  const [isLoading, setIsLoading] = useState(false);

  // Use parameters from props or fallback to default
  const availableParameters = propAvailableParameters.length > 0 ? propAvailableParameters : [
    'Revenue', 
    'GPM', 
    'NP', 
    'Team Cost', 
    'Salary Cost', 
    'Opr Cost', 
    'Funding Cost', 
    'Leave Encashment', 
    'HC', 
    'GPM %', 
    'NP %'
  ];

  // Update databaseData when data prop changes
  useEffect(() => {
    if (data && data.length > 0) {
      setDatabaseData(data);
    }
  }, [data]);

  // Timeline options
  const timelineOptions = [
    { value: 'month', label: 'Month' },
    { value: 'quarter', label: 'Quarter' },
    { value: 'year', label: 'Year' }
  ];

  // Financial year months (April to March)
  const financialYearMonths = [
    'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
    'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'
  ];

  // Enhanced date parser to handle various date formats (same as TeamReportCompare)
  const parseDate = (dateStr: string, year?: number): Date => {
    if (!dateStr || dateStr.trim() === '') {
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
    
    // Fix misspellings silently

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const monthIndex = monthNames.findIndex(month => {
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
    
    if (monthIndex !== -1) {
      // If we find a month name, create a date for the 1st of that month
      // Use the provided year - DO NOT use current year as fallback to prevent automatic data generation
      if (!year) {
        return new Date(NaN);
      }
      return new Date(year, monthIndex, 1);
    }
    
    // Try abbreviated month names
    const abbreviatedMonthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    
    const abbreviatedIndex = abbreviatedMonthNames.findIndex(month => {
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
    
    if (abbreviatedIndex !== -1) {
      if (!year) {
        return new Date(NaN);
      }
      return new Date(year, abbreviatedIndex, 1);
    }
    
    // Handle ISO format (YYYY-MM-DD) or other standard formats
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }
    
    // Fallback - return invalid date
    return new Date(NaN);
  };

  // Get current financial year and month
  const getCurrentFinancialYear = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12
    return month >= 4 ? year : year - 1; // FY starts in April
  };

  const getCurrentMonthIndex = () => {
    const now = new Date();
    const month = now.getMonth() + 1; // 1-12
    return month >= 4 ? month - 4 : month + 8; // Convert to FY month index (0-11)
  };

  // Get unique business units from data
  const getBusinessUnits = () => {
    if (!databaseData || databaseData.length === 0) return [];
    const units = Array.from(new Set(databaseData.map(item => item.business_unit))).filter(Boolean);
    return [{ value: 'all', label: 'All Business Units' }, ...units.map(unit => ({ value: unit, label: unit }))];
  };

  // Fetch data from database
  const fetchDataFromDatabase = async () => {
    // If data is provided via props, don't fetch from API
    if (data && data.length > 0) {
      return;
    }
    
    setIsLoading(true);
    try {
      const params: any = {};
      
      // Use chart's own business unit filter if set, otherwise use prop
      const businessUnitToUse = selectedBusinessUnitFilter !== 'all' ? selectedBusinessUnitFilter : selectedBusinessUnit;
      if (businessUnitToUse && businessUnitToUse !== 'all') {
        params.business_unit = businessUnitToUse;
      }
      
      const res = await apiClient.get("/team-summary-report", { params });
      
      // Convert all numeric fields to numbers and handle formatting
      const convertedData = res.data.map((item: any) => {
        const convertedItem = { ...item };
        
        // List of actual fields available in team-summary-report (only 5 fields)
        const numericFields = [
          'hc', 'revenue', 'gpm', 'team_cost', 'net_margin'
        ];
        
        // Convert each numeric field
        numericFields.forEach(field => {
          if (item[field] !== undefined && item[field] !== null) {
            let numericValue: number;
            
            if (typeof item[field] === 'string') {
          // Remove commas and convert to float
              numericValue = parseFloat(item[field].replace(/,/g, ''));
            } else if (typeof item[field] === 'number') {
              numericValue = item[field];
        } else {
              numericValue = 0;
            }
            
            convertedItem[field] = isNaN(numericValue) ? 0 : numericValue;
          }
        });
        
        // Map field names for compatibility (team-summary-report has net_margin, not np)
        if (convertedItem.net_margin && !convertedItem.np) {
          convertedItem.np = convertedItem.net_margin;
        }
        if (convertedItem.np && !convertedItem.net_margin) {
          convertedItem.net_margin = convertedItem.np;
        }
        
        return convertedItem;
      });
      
      setDatabaseData(convertedData);
    } catch (error: any) {
      console.error("❌ Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data when component mounts or filters change
  // Set default values since dropdowns are removed
  useEffect(() => {
    // Set default timeline to Month
    setSelectedTimeline('Month');
    
    // Set default business unit filter to use parent's selection
    if (selectedBusinessUnit) {
      setSelectedBusinessUnitFilter(selectedBusinessUnit);
    } else {
      setSelectedBusinessUnitFilter('all');
    }
  }, [selectedBusinessUnit]);

  // Fetch data when dependencies change
  useEffect(() => {
    fetchDataFromDatabase();
  }, [selectedBusinessUnit, selectedBusinessUnitFilter, selectedParameter, data]);

  // Process data based on selected timeline
  const processDataForTimeline = (data: any[]) => {
    if (!data || data.length === 0) return [];

    // Filter by business unit if selected
    let filteredData = data;
    if (selectedBusinessUnitFilter !== 'all') {
      filteredData = data.filter(item => item.business_unit === selectedBusinessUnitFilter);
    }

    // Filter by parameter if it's a specific parameter (not calculated)
    if (selectedParameter !== 'Revenue' && selectedParameter !== 'Net Margin' && selectedParameter !== 'GPM' && selectedParameter !== 'HC') {
      filteredData = filteredData.filter(item => item.business_unit === selectedParameter);
    }


    const processedData = filteredData.map(item => {
      const date = new Date(item.month);
      const timestamp = date.getTime();
      
      // Validate that we have a valid timestamp
      if (isNaN(timestamp)) {
        return null;
      }

      // Create timeline label based on selected timeline
      let timelineLabel = '';
      const monthNum = date.getMonth();
      const year = date.getFullYear();
      
      switch (selectedTimeline) {
        case 'month':
          timelineLabel = `${date.toLocaleString('default', { month: 'long' })} ${year}`;
          break;
        case 'quarter':
          let quarter, quarterRange;
          if (monthNum >= 3 && monthNum <= 5) {
            quarter = 1;
            quarterRange = "Apr-Jun";
          } else if (monthNum >= 6 && monthNum <= 8) {
            quarter = 2;
            quarterRange = "Jul-Sep";
          } else if (monthNum >= 9 && monthNum <= 11) {
            quarter = 3;
            quarterRange = "Oct-Dec";
          } else {
            quarter = 4;
            quarterRange = "Jan-Mar";
          }
          timelineLabel = `Q${quarter}(${quarterRange}) ${year}`;
          break;
        case 'year':
          timelineLabel = year.toString();
          break;
        default:
          timelineLabel = `${date.toLocaleString('default', { month: 'long' })} ${year}`;
      }
      
      return {
        date: timestamp, // Use timestamp for DateAxis
        timelineLabel: timelineLabel, // For grouping
        revenue: item.revenue || 0,
        netMargin: item.net_margin || 0,
        gpm: item.gpm || 0,
        hc: item.hc || 0,
        teamCost: item.team_cost || 0,
        // Set other fields to 0 since they don't exist in team-summary-report
        lpm: 0,
        throughput: 0,
        latency: 0,
        cpu: 0,
        memory: 0,
        disk: 0,
        network: 0,
        tower: item.tower,
        business_unit: item.business_unit
      };
    }).filter(item => item !== null); // Remove any null items

        // Group by timeline if not month view
    if (selectedTimeline !== 'month') {
      const groupedData = processedData.reduce((acc, item) => {
        if (!item) return acc; // Skip null items
        
        if (!acc[item.timelineLabel]) {
          acc[item.timelineLabel] = {
            date: item.date,
            timelineLabel: item.timelineLabel,
            revenue: 0,
            netMargin: 0,
            gpm: 0,
            hc: 0,
            teamCost: 0,
            lpm: 0,
            throughput: 0,
            latency: 0,
            cpu: 0,
            memory: 0,
            disk: 0,
            network: 0,
            count: 0
          };
        }
        
        acc[item.timelineLabel].revenue += item.revenue;
        acc[item.timelineLabel].netMargin += item.netMargin;
        acc[item.timelineLabel].gpm += item.gpm;
        acc[item.timelineLabel].hc += item.hc;
        acc[item.timelineLabel].teamCost += item.teamCost;
        acc[item.timelineLabel].lpm += item.lpm;
        acc[item.timelineLabel].throughput += item.throughput;
        acc[item.timelineLabel].latency += item.latency;
        acc[item.timelineLabel].cpu += item.cpu;
        acc[item.timelineLabel].memory += item.memory;
        acc[item.timelineLabel].disk += item.disk;
        acc[item.timelineLabel].network += item.network;       
        acc[item.timelineLabel].count += 1;
        
        return acc;
      }, {} as any);

      // Convert to array and calculate averages
      const aggregatedData = Object.values(groupedData).map((group: any) => ({
        date: group.date,
        timelineLabel: group.timelineLabel,
        revenue: group.revenue,
        netMargin: group.netMargin,
        gpm: group.gpm,
        hc: Math.round(group.hc / group.count),
        teamCost: group.teamCost,
        lpm: group.lpm,
        throughput: group.throughput,
        latency: Math.round(group.latency / group.count),
        cpu: Math.round(group.cpu / group.count),
        memory: Math.round(group.memory / group.count),
        disk: Math.round(group.disk / group.count),
        network: Math.round(group.network / group.count)
      }));

      // Sort by date
      return aggregatedData.sort((a, b) => a.date - b.date);
    }

    // For month view, just sort by date
    const sortedData = processedData.sort((a, b) => (a?.date || 0) - (b?.date || 0));
    return sortedData;
  };

  // Generate chart data with forecasting
    const generateChartData = () => {
      
    // Use only database data for forecasting
    if (databaseData.length === 0) {
        return [];
    }
    
    // Debug: Log the selected parameter and available data
    console.log('🔍 generateChartData - selectedParameter:', selectedParameter);
    console.log('🔍 generateChartData - databaseData length:', databaseData.length);
    console.log('🔍 generateChartData - sample data:', databaseData.slice(0, 2));

    const currentFY = getCurrentFinancialYear();
    const currentMonthIndex = getCurrentMonthIndex();

    // Filter data for current financial year (same logic as KPI Dashboard)
    const currentFYData = databaseData.filter(item => {
      const itemDate = parseDate(item.month, item.year);
      if (isNaN(itemDate.getTime())) return false;
      
      const itemYear = itemDate.getFullYear();
      const itemMonth = itemDate.getMonth() + 1;
      
      // Check if it's in current FY (April to March)
      if (itemMonth >= 4) {
        return itemYear === currentFY;
      } else {
        return itemYear === currentFY + 1;
      }
    });


    // Get actual data for current FY months (April to current month)
    const actualData: { [key: string]: number } = {};
    
    // Process data to get monthly totals for the selected parameter (same logic as KPI Dashboard)
    currentFYData.forEach(item => {
      // Map parameter names to database field names (same as KPI Dashboard)
      const parameterMapping: { [key: string]: string[] } = {
        'Revenue': ['sales', 'amount', 'revenue'],
        'GPM': ['gpm', 'gross_profit_margin'],
        'Net Margin': ['net_margin', 'np', 'net_profit'],
        'NP': ['np', 'net_profit', 'net_margin'],
        'Team Cost': ['team_cost', 'teamcost', 'teamCost'],
        'Salary Cost': ['salary_cost', 'salarycost', 'salaryCost'],
        'Opr Cost': ['opr_cost', 'oprcost', 'oprCost'],
        'Funding Cost': ['funding_cost', 'fundingcost', 'fundingCost'],
        'Leave Encashment': ['leave_encashment', 'leaveencashment', 'leaveEncashment'],
        'HC': ['hc', 'headcount', 'head_count'],
        'GPM %': ['gpm_percent', 'gpm%', 'gpmPercent'],
        'NP %': ['np_percent', 'np%', 'npPercent']
      };
      
      // Find the actual field name in the database
      const possibleFields = parameterMapping[selectedParameter] || [selectedParameter.toLowerCase()];
      let parameterValue: number | null = null;
      
      for (const field of possibleFields) {
        if (item[field] !== undefined && item[field] !== null) {
          parameterValue = parseFloat(item[field]) || 0;
          break;
        }
      }
      
      if (parameterValue === null) {
        console.log('🔍 No parameter value found for:', selectedParameter, 'in item:', item);
        return;
      }
      
      console.log('🔍 Found parameter value:', parameterValue, 'for field:', selectedParameter);
      
      // Parse month using same logic as KPI Dashboard
      const itemDate = parseDate(item.month, item.year);
      if (isNaN(itemDate.getTime())) return;
      
      const monthValue = itemDate.getMonth() + 1; // 1-12
      
      // Convert month to FY month index (1-12 to 0-11, April=0)
      let fyMonthIndex: number;
      if (monthValue >= 4) {
        fyMonthIndex = monthValue - 4; // Apr=0, May=1, etc.
      } else {
        fyMonthIndex = monthValue + 8; // Jan=9, Feb=10, Mar=11
      }
      
      const monthKey = financialYearMonths[fyMonthIndex];
      
      if (!actualData[monthKey]) {
        actualData[monthKey] = 0;
      }
      actualData[monthKey] += parameterValue;
    });


    // Calculate forecasting
    const forecastData: { [key: string]: number } = {};
    
    // Get actual values for available months
    const actualValues = Object.values(actualData).filter(v => v > 0);
    
    if (actualValues.length === 0) {
      
      // Create sample data for demonstration
      const sampleData = financialYearMonths.map((month, index) => {
        // Find the last month with actual data in the database
        const lastActualMonthIndex = Math.max(...Object.keys(actualData)
          .map(monthKey => financialYearMonths.indexOf(monthKey))
          .filter(idx => idx >= 0 && actualData[financialYearMonths[idx]] > 0));
        
        const isForecast = index > lastActualMonthIndex;
        const baseValue = 1000000; // 1M base value
        const value = isForecast 
          ? baseValue + (index - lastActualMonthIndex) * 100000 // Growing forecast
          : baseValue + index * 50000; // Actual data with some growth
        
        return {
          period: month,
          value: value,
          isForecast: isForecast
        };
      });
      
      return sampleData;
    }

    // Advanced forecasting: use weighted average and trend analysis
    const monthsToAverage = Math.min(6, actualValues.length); // Use up to 6 months for better accuracy
    const recentValues = actualValues.slice(-monthsToAverage);
    
    // Calculate weighted average (more recent months have higher weight)
    let weightedSum = 0;
    let totalWeight = 0;
    recentValues.forEach((value, index) => {
      const weight = index + 1; // More recent = higher weight
      weightedSum += value * weight;
      totalWeight += weight;
    });
    const weightedAverage = weightedSum / totalWeight;
    
    // Calculate growth trend using linear regression
    let growthRate = 0;
    if (actualValues.length >= 3) {
      // Use linear regression to find trend
      const n = actualValues.length;
      const xSum = (n * (n - 1)) / 2; // Sum of indices
      const ySum = actualValues.reduce((sum, val) => sum + val, 0);
      const xySum = actualValues.reduce((sum, val, index) => sum + (val * index), 0);
      const xSquaredSum = (n * (n - 1) * (2 * n - 1)) / 6; // Sum of squared indices
      
      growthRate = (n * xySum - xSum * ySum) / (n * xSquaredSum - xSum * xSum);
    } else if (actualValues.length >= 2) {
      // Simple growth rate for 2 data points
      const firstValue = actualValues[0];
      const lastValue = actualValues[actualValues.length - 1];
      growthRate = (lastValue - firstValue) / (actualValues.length - 1);
    }


    // Generate chart data for all 12 months (April to March)
    const chartData = financialYearMonths.map((month, index) => {
      let value: number;
      let isForecast = false;
      
      // Check if this month has actual data in the database
      const hasActualData = actualData[month] && actualData[month] > 0;
      
      if (hasActualData) {
        // Use actual data from database for months that have data
        value = actualData[month];
        isForecast = false;
      } else {
        // Months without actual data - apply forecasting
        // Find the last month with actual data to base forecast on
        const lastActualMonthIndex = Math.max(...Object.keys(actualData)
          .map(monthKey => financialYearMonths.indexOf(monthKey))
          .filter(idx => idx >= 0 && actualData[financialYearMonths[idx]] > 0));
        
        const monthsAhead = index - lastActualMonthIndex;
        
        // Use weighted average as base and apply growth trend
        const baseForecast = weightedAverage;
        const trendAdjustment = growthRate * monthsAhead;
        
        // Apply seasonal adjustment (optional - can be enhanced)
        const seasonalFactor = 1.0; // For now, no seasonal adjustment
        
        value = (baseForecast + trendAdjustment) * seasonalFactor;
        isForecast = true;
        
      }

        return {
        period: month,
        value: Math.max(0, value), // Ensure non-negative values
        isForecast: isForecast
        };
    });

      return chartData;
    };

    // Render chart
  useEffect(() => {
    
    // Check if chart container exists
    const chartContainer = document.getElementById("forecastChart");
    if (!chartContainer) {
      return;
    }
    
    // Cleanup existing chart
    am5.array.each(am5.registry.rootElements, (root) => {
      if (root && root.dom && root.dom.id === "forecastChart") root.dispose();
    });

    const root = am5.Root.new("forecastChart");
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

    // Create axes - EXACTLY like TeamReportCompare
    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "period",
        renderer: am5xy.AxisRendererX.new(root, {}),
        tooltip: am5.Tooltip.new(root, {})
      })
    );
    xAxis.get("renderer").labels.template.setAll({
      fill: am5.color(0x000000),
      fontSize: "8px"
    });
    
    // Ensure all category labels are shown
    xAxis.get("renderer").grid.template.setAll({
      stroke: am5.color(0xe0e0e0),
      strokeWidth: 1
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {}),
        tooltip: am5.Tooltip.new(root, {})
      })
    );
    yAxis.get("renderer").labels.template.setAll({
      fill: am5.color(0x000000),
      fontSize: "8px"
    });

    // Generate chart data
    const chartData = generateChartData();
    if (chartData.length === 0) {
      return;
    }

    // Helper function to get format for parameter - EXACTLY like TeamReportCompare
    const getParameterFormat = (param: string) => {
      if (param === 'Net Margin %' || param === 'Growth Margin %') {
        return {
          prefix: '',
          suffix: '%',
          format: '#,##0.00'
        };
      }
      if (param === 'HC') {
        return {
          prefix: '',
          suffix: '',
          format: '#,##0'
        };
      }
      return {
        prefix: '',
        suffix: '',
        format: '#,##0.00'
      };
    };

    // Create series for actual data
    const format = getParameterFormat(selectedParameter);
    const actualSeries = chart.series.push(
      am5xy.LineSeries.new(root, {
        name: `${selectedParameter} (Actual)`,
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
              padding: 4px 6px; 
              background: #ffffff; 
              color: #000000; 
              font-size: 8px;
              border: 1px solid #ccc;
            ">
              {categoryX}: ${format.prefix}{valueY.formatNumber('${format.format}')}${format.suffix}
            </div>
          `
        })
      })
    );

    // Create series for forecast data
    const forecastSeries = chart.series.push(
      am5xy.LineSeries.new(root, {
        name: `${selectedParameter} (Forecast)`,
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
              padding: 4px 6px; 
              background: #ffffff; 
              color: #000000; 
              font-size: 8px;
              border: 1px solid #ccc;
            ">
              {categoryX}: ${format.prefix}{valueY.formatNumber('${format.format}')}${format.suffix}
            </div>
          `
        })
      })
    );

    // Set series styling
    actualSeries.strokes.template.setAll({
      stroke: am5.color(0x1890ff), // Blue for actual data
      strokeWidth: 3
    });

    actualSeries.bullets.push(() => {
      return am5.Bullet.new(root, {
        sprite: am5.Circle.new(root, {
          radius: 4,
          fill: am5.color(0x1890ff)
        })
      });
    });

    forecastSeries.strokes.template.setAll({
      stroke: am5.color(0xff6b35), // Orange for forecast data
      strokeWidth: 3,
      strokeDasharray: [5, 5] // Dashed line for forecast
    });

    forecastSeries.bullets.push(() => {
      return am5.Bullet.new(root, {
        sprite: am5.Circle.new(root, {
          radius: 4,
          fill: am5.color(0xff6b35)
        })
      });
    });

    // Prepare data for each series separately - ensure all 12 months are included
    const actualData = financialYearMonths.map(month => {
      const chartItem = chartData.find(item => item.period === month);
      return {
        period: month,
        value: chartItem && !chartItem.isForecast ? chartItem.value : null
      };
    });

    const forecastData = financialYearMonths.map(month => {
      const chartItem = chartData.find(item => item.period === month);
      return {
        period: month,
        value: chartItem && chartItem.isForecast ? chartItem.value : null
      };
    });

    actualSeries.data.setAll(actualData);
    forecastSeries.data.setAll(forecastData);
    
    // Set x-axis data - ensure all 12 months are always displayed
    const allMonthsData = financialYearMonths.map(month => ({ period: month }));
    xAxis.data.setAll(allMonthsData);

    // Add legend
    const legend = chart.children.push(
      am5.Legend.new(root, {
        centerX: am5.p50,
        x: am5.p50,
        layout: root.horizontalLayout,
        marginTop: 20
      })
    );
    legend.labels.template.setAll({
      fill: am5.color(0x000000),
      fontSize: 12
    });
    legend.data.setAll(chart.series.values);

    // Make chart appear
    chart.appear(1000, 100);

    return () => {
      root.dispose();
    };
  }, [selectedParameter, selectedTimeline, selectedBusinessUnitFilter, databaseData]);

  return (
    <Card 
      title={
        <Title level={4} style={{ color: '#000000', margin: 0, fontSize: '12px' }}>
          Parameter Tracking Chart
        </Title>
      }
      style={{ 
        backgroundColor: '#ffffff', 
        border: '1px solid #d9d9d9',
        marginTop: '1rem'
      }}
    >
      <style>
        {`
          .ant-select-selector {
            background-color: #ffffff !important;
            border-color: #d9d9d9 !important;
          }
          .ant-select-selection-item {
            color: #000000 !important;
          }
          .ant-select-arrow {
            color: #808080 !important;
          }
          .ant-card-body .ant-row {
            background-color: #ffffff !important;
          }
        `}
      </style>
      
      <Row gutter={16} style={{ marginBottom: '0.5rem', backgroundColor: '#ffffff', padding: '8px', borderRadius: '8px', border: '1px solid #d9d9d9' }}>
        <Col span={24}>
          <div style={{ marginBottom: '0.5rem' }}>
            <label style={{ color: '#000000', display: 'block', marginBottom: '0.25rem', fontSize: '10px' }}>
              Select Parameter:
            </label>
            <Select
              value={selectedParameter}
              onChange={setSelectedParameter}
              style={{ width: '100%' }}
            >
              {availableParameters.map(param => (
                <Option key={param} value={param}>{param}</Option>
              ))}
            </Select>
          </div>
        </Col>
      </Row>


      <div id="forecastChart" style={{ width: "100%", height: "300px" }}></div>
    </Card>
  );
};

export default ForecastChart;