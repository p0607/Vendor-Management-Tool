import React, { useState, useEffect } from 'react';
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { Card, Row, Col, Select, Typography, Alert } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
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
  const [selectedParameter, setSelectedParameter] = useState<string>('Sales');
  const [selectedTimeline, setSelectedTimeline] = useState<string>('month');
  const [selectedBusinessUnitFilter, setSelectedBusinessUnitFilter] = useState<string>('all');
  const [databaseData, setDatabaseData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Use parameters from props or fallback to default
  const availableParameters = propAvailableParameters.length > 0 ? propAvailableParameters : [
    'Sales', 
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
    setIsLoading(true);
    try {
      const params: any = {};
      if (selectedBusinessUnit) {
        params.business_unit = selectedBusinessUnit;
      }
      
      console.log('🔍 Fetching data from API endpoint: /team-report');
      console.log('🔍 Fetching data from database with params:', params);
      const res = await apiClient.get("/team-report", { params });
      
      // Convert sales to numbers and handle formatting
      const convertedData = res.data.map((item: any) => {
        let salesValue: number;
        
        if (typeof item.sales === 'string') {
          // Remove commas and convert to float
          salesValue = parseFloat(item.sales.replace(/,/g, ''));
        } else if (typeof item.sales === 'number') {
          salesValue = item.sales;
        } else {
          salesValue = 0;
        }
        
        return {
          ...item,
          amount: isNaN(salesValue) ? 0 : salesValue // Keep amount field for compatibility with existing chart logic
        };
      });
      
      console.log('🔍 Fetched database data:', convertedData);
      console.log('🔍 Sample amounts:', convertedData.slice(0, 10).map((item: any) => item.amount));
      console.log('🔍 Sample dates:', convertedData.slice(0, 10).map((item: any) => item.month));
      setDatabaseData(convertedData);
    } catch (error: any) {
      console.error("❌ Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data when component mounts or business unit changes
  useEffect(() => {
    fetchDataFromDatabase();
  }, [selectedBusinessUnit]);

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

    console.log('🔍 Filtered data count:', filteredData.length);
    console.log('🔍 Selected business unit:', selectedBusinessUnitFilter);
    console.log('🔍 Selected parameter:', selectedParameter);
    console.log('🔍 Sample filtered data:', filteredData.slice(0, 3));

    const processedData = filteredData.map(item => {
      const date = new Date(item.month);
      const timestamp = date.getTime();
      
      // Validate that we have a valid timestamp
      if (isNaN(timestamp)) {
        console.warn('🔍 Invalid date found:', item.month);
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
        revenue: item.amount,
        netMargin: item.amount * 0.15,
        gpm: item.amount * 0.3,
        hc: Math.floor(item.amount / 10000),
        lpm: item.amount * 0.05,
        throughput: item.amount * 0.1,
        latency: 50,
        cpu: 75,
        memory: 80,
        disk: 500,
        network: 800,
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
    console.log('🔍 Before sorting - sample dates:', processedData.slice(0, 3).map(item => item ? { date: item.date, type: typeof item.date } : null));
    const sortedData = processedData.sort((a, b) => (a?.date || 0) - (b?.date || 0));
    console.log('🔍 After sorting - sample dates:', sortedData.slice(0, 3).map(item => item ? { date: item.date, type: typeof item.date } : null));
    console.log('🔍 Final processed data sample:', sortedData.slice(0, 3));
    return sortedData;
  };

  // Generate chart data with forecasting
  const generateChartData = () => {
    console.log('🔍 Generating forecast chart data for parameter:', selectedParameter);
    console.log('🔍 Available data length:', data.length);
    
    if (data.length === 0) {
      console.log('🔍 No data available for forecasting');
      return [];
    }

    const currentFY = getCurrentFinancialYear();
    const currentMonthIndex = getCurrentMonthIndex();
    
    console.log('🔍 Current FY:', currentFY);
    console.log('🔍 Current month index:', currentMonthIndex);

    // Get actual data for current FY months (April to current month)
    const actualData: { [key: string]: number } = {};
    
    // Process data to get monthly totals for the selected parameter
    data.forEach(item => {
      if (!item.month || !item[selectedParameter]) return;
      
      const monthValue = parseFloat(item.month);
      if (isNaN(monthValue)) return;
      
      // Convert month to FY month index (1-12 to 0-11, April=0)
      let fyMonthIndex: number;
      if (monthValue >= 4) {
        fyMonthIndex = monthValue - 4; // Apr=0, May=1, etc.
      } else {
        fyMonthIndex = monthValue + 8; // Jan=9, Feb=10, Mar=11
      }
      
      const monthKey = financialYearMonths[fyMonthIndex];
      const value = parseFloat(item[selectedParameter]) || 0;
      
      if (!actualData[monthKey]) {
        actualData[monthKey] = 0;
      }
      actualData[monthKey] += value;
    });

    console.log('🔍 Actual data by month:', actualData);

    // Calculate forecasting
    const forecastData: { [key: string]: number } = {};
    
    // Get actual values for available months
    const actualValues = Object.values(actualData).filter(v => v > 0);
    
    if (actualValues.length === 0) {
      console.log('🔍 No actual data available for forecasting');
      return [];
    }

    // Simple forecasting: use average of last 3 months or all available months
    const monthsToAverage = Math.min(3, actualValues.length);
    const recentValues = actualValues.slice(-monthsToAverage);
    const averageValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Calculate growth trend (simple linear trend)
    let growthRate = 0;
    if (actualValues.length >= 2) {
      const firstValue = actualValues[0];
      const lastValue = actualValues[actualValues.length - 1];
      growthRate = (lastValue - firstValue) / (actualValues.length - 1);
    }

    console.log('🔍 Average value for forecasting:', averageValue);
    console.log('🔍 Growth rate:', growthRate);

    // Generate chart data for all 12 months
    const chartData = financialYearMonths.map((month, index) => {
      let value: number;
      let isForecast = false;
      
      if (actualData[month] && actualData[month] > 0) {
        // Use actual data
        value = actualData[month];
        isForecast = false;
      } else if (index <= currentMonthIndex) {
        // Past months with no data - use 0 or average
        value = 0;
        isForecast = false;
      } else {
        // Future months - apply forecasting
        const monthsAhead = index - currentMonthIndex;
        value = averageValue + (growthRate * monthsAhead);
        isForecast = true;
      }

      return {
        period: month,
        value: Math.max(0, value), // Ensure non-negative values
        isForecast: isForecast
      };
    });

    console.log('🔍 Final forecast chart data:', chartData);
    return chartData;
  };

    // Render chart
  useEffect(() => {
    console.log('🔍 Chart useEffect triggered');
    console.log('🔍 Selected parameter:', selectedParameter);
    console.log('🔍 Selected timeline:', selectedTimeline);
    console.log('🔍 Selected business unit filter:', selectedBusinessUnitFilter);
    console.log('🔍 Database data length:', databaseData.length);
    
    // Check if chart container exists
    const chartContainer = document.getElementById("forecastChart");
    if (!chartContainer) {
      console.error('🔍 Chart container not found!');
      return;
    }
    console.log('🔍 Chart container found');
    
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

    // Generate chart data
    const chartData = generateChartData();
    console.log('🔍 About to render chart with data:', chartData);
    if (chartData.length === 0) {
      console.log('🔍 No chart data available, returning early');
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
        valueYField: "actualValue",
        categoryXField: "period",
        tooltip: am5.Tooltip.new(root, {
          pointerOrientation: "horizontal",
          labelText: `{categoryX} - ${selectedParameter} (Actual): ${format.prefix}{valueY.formatNumber('${format.format}')}${format.suffix}`,
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
              <div style="font-weight: 500; margin-bottom: 2px; color: #666666; font-size: 11px;">${selectedParameter} (Actual)</div>
              <div style="font-weight: 700; color: #000000; font-size: 13px;">${format.prefix}{valueY.formatNumber('${format.format}')}${format.suffix}</div>
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
        valueYField: "forecastValue",
        categoryXField: "period",
        tooltip: am5.Tooltip.new(root, {
          pointerOrientation: "horizontal",
          labelText: `{categoryX} - ${selectedParameter} (Forecast): ${format.prefix}{valueY.formatNumber('${format.format}')}${format.suffix}`,
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
              <div style="font-weight: 600; margin-bottom: 4px; color: #ff6b35; font-size: 11px;">{categoryX}</div>
              <div style="font-weight: 500; margin-bottom: 2px; color: #666666; font-size: 11px;">${selectedParameter} (Forecast)</div>
              <div style="font-weight: 700; color: #000000; font-size: 13px;">${format.prefix}{valueY.formatNumber('${format.format}')}${format.suffix}</div>
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

    // Prepare data for both series
    const actualData = chartData.map(item => ({
      period: item.period,
      actualValue: item.isForecast ? null : item.value,
      forecastValue: null
    }));

    const forecastData = chartData.map(item => ({
      period: item.period,
      actualValue: null,
      forecastValue: item.isForecast ? item.value : null
    }));

    console.log('🔍 Setting actual series data:', actualData);
    actualSeries.data.setAll(actualData);
    console.log('🔍 Setting forecast series data:', forecastData);
    forecastSeries.data.setAll(forecastData);
    console.log('🔍 Series data set successfully');
    
    // Set x-axis data - this is crucial for CategoryAxis
    const periods = chartData.map(item => item?.period).filter(Boolean);
    console.log('🔍 Setting x-axis periods:', periods);
    xAxis.data.setAll(periods);

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
  }, [selectedParameter, selectedTimeline, selectedBusinessUnitFilter, databaseData, data]);

  return (
    <Card 
      title={
        <Title level={3} style={{ color: '#000000', margin: 0 }}>
          Parameter Tracking Chart
        </Title>
      }
      style={{ 
        backgroundColor: '#ffffff', 
        border: '1px solid #d9d9d9',
        marginTop: '2rem'
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
      
      <Row gutter={16} style={{ marginBottom: '1rem', backgroundColor: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #d9d9d9' }}>
        <Col span={8}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ color: '#000000', display: 'block', marginBottom: '0.5rem' }}>
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
        <Col span={8}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ color: '#000000', display: 'block', marginBottom: '0.5rem' }}>
              Select Timeline:
            </label>
            <Select
              value={selectedTimeline}
              onChange={setSelectedTimeline}
              style={{ width: '100%' }}
            >
              {timelineOptions.map(option => (
                <Option key={option.value} value={option.value}>{option.label}</Option>
              ))}
            </Select>
          </div>
        </Col>
        <Col span={8}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ color: '#000000', display: 'block', marginBottom: '0.5rem' }}>
              Select Business Unit:
            </label>
            <Select
              value={selectedBusinessUnitFilter}
              onChange={setSelectedBusinessUnitFilter}
              style={{ width: '100%' }}
            >
              {getBusinessUnits().map(unit => (
                <Option key={unit.value} value={unit.value}>{unit.label}</Option>
              ))}
            </Select>
          </div>
        </Col>
      </Row>

      <Alert
        message="Parameter Tracking"
        description={
          <div>
            <p><strong>Blue Line with Points:</strong> {selectedParameter} data over time</p>
            <p><strong>X-axis:</strong> Shows {selectedTimeline} periods</p>
            <p><strong>Y-axis:</strong> Shows {selectedParameter} values</p>
            <p><strong>Data Source:</strong> Real data from your database</p>
            <p><strong>API Endpoint:</strong> /api/team-report</p>
            <p><strong>Data Points:</strong> {databaseData.length} records processed</p>
          </div>
        }
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        style={{ 
          marginBottom: '1rem',
          backgroundColor: '#f8f9fa',
          borderColor: '#d9d9d9',
          color: '#000000'
        }}
      />

      <div id="forecastChart" style={{ width: "100%", height: "500px" }}></div>
    </Card>
  );
};

export default ForecastChart;