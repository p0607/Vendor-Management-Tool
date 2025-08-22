
import React, { useEffect, useState } from "react";
import axios from "axios";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { Button, DatePicker, Select, Space, message, Dropdown } from "antd";
import { useNavigate } from "react-router-dom";
import { DownOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import styles from './TeamReportDashboard.module.css';
import KPIStats from "./KPIStats";
import QuarterlyPieChart from "./QuarterlyPieChart";
import NetMarginLineChart from "./NetMarginLineChart";
import * as XLSX from "xlsx";
import MonthlyPivotTable from "./MonthlyPivotTable";
import logo from '../assets/logo_1.png';
import { formatDateToDDMMYYYY } from '../utils/dateUtils';
import { formatValueByFieldType } from '../utils/formatUtils';
import apiClient from '../config/api';


const { RangePicker } = DatePicker;
const { Option } = Select;

interface ReportData {
  business_unit: string;  // Changed from lob to business_unit
  particulars: string;
  amount: number;
  month: string;
}


type FilterType = "date" | "month" | "quarter" | "year";

const TeamReportDashboard: React.FC = () => {
  const [data, setData] = useState<ReportData[]>([]);
  const [filterType, setFilterType] = useState<FilterType>("month");
  const [range, setRange] = useState<any>(null);
  const [selectedLob, setSelectedLob] = useState<string | null>(null);
  const [selectedParticular, setSelectedParticular] = useState<string | null>(null);
  const [user, setUser] = useState<any>({});
  const [isActionDropdownOpen, setIsActionDropdownOpen] = useState(false);
  const navigate = useNavigate();

  // Function to get current financial year range
  const getCurrentFinancialYear = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11 (Jan-Dec)
    
    // Financial year starts from April (month 3) to March (month 2)
    let financialYearStart, financialYearEnd;
    
    if (currentMonth >= 3) { // April or later
      financialYearStart = new Date(currentYear, 3, 1); // April 1st of current year
      financialYearEnd = new Date(currentYear + 1, 2, 31); // March 31st of next year
    } else { // January to March
      financialYearStart = new Date(currentYear - 1, 3, 1); // April 1st of previous year
      financialYearEnd = new Date(currentYear, 2, 31); // March 31st of current year
    }
    
    return [financialYearStart, financialYearEnd];
  };

  const lobOptions = [
    "BPO | HTD",
    "Canada",
    "Captive",
    "Egg",
    "Japan",
    "MS",
    "SI",
    "Singapore",
    "USA"
  ];

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");
      if (storedUser && storedUser !== "undefined") {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        
        // Set the selected business unit for BU HEAD users
        if (userData.designation === 'BU HEAD' && userData.business_unit) {
          setSelectedLob(userData.business_unit);
        }
      }
    } catch (error) {
      console.error("Failed to parse user data:", error);
    }

    // Set default date range to current financial year
    const financialYearRange = getCurrentFinancialYear();
    setRange([
      dayjs(financialYearRange[0]),
      dayjs(financialYearRange[1])
    ]);
  }, []);

  const isBUHead = user?.designation === 'BU HEAD';
  const allowedLobs = isBUHead && user.business_unit 
    ? [user.business_unit] 
    : lobOptions;

  useEffect(() => {
    apiClient.get("/team-report", {
      params: {
        designation: user?.designation || '',
        business_unit: isBUHead ? user?.business_unit : selectedLob
      }
    }).then((res) => {
      setData(res.data);
    }).catch((err) => {
      console.error('Error fetching team report data:', err);
      message.error('Failed to fetch team report data');
    });
  }, [user?.designation, isBUHead, user?.business_unit, selectedLob]);

  // Get unique particulars for dropdown
  const uniqueParticulars = Array.from(new Set(data.map(item => item.particulars))).sort();

  // Filter logic remains the same
  const filteredData = data.filter(item => {
    if (selectedLob && item.business_unit !== selectedLob) return false;  // Changed from lob
    if (selectedParticular && item.particulars !== selectedParticular) return false;  // Filter by selected particular
    if (!range || range.length !== 2) return true;
    const itemDate = new Date(item.month);
    if (filterType === "date") {
      return itemDate >= range[0].startOf("day").toDate() && itemDate <= range[1].endOf("day").toDate();
    }
    if (filterType === "month") {
      return (
        itemDate >= range[0].startOf("month").toDate() &&
        itemDate <= range[1].endOf("month").toDate()
      );
    }
    if (filterType === "quarter") {
      const getQuarter = (d: Date) => Math.floor(d.getMonth() / 3) + 1;
      const q1 = getQuarter(range[0].toDate());
      const q2 = getQuarter(range[1].toDate());
      const y1 = range[0].year();
      const y2 = range[1].year();
      const itemQ = getQuarter(itemDate);
      const itemY = itemDate.getFullYear();
      if (itemY < y1 || itemY > y2) return false;
      if (itemY === y1 && itemQ < q1) return false;
      if (itemY === y2 && itemQ > q2) return false;
      return true;
    }
    if (filterType === "year") {
      return (
        itemDate >= range[0].startOf("year").toDate() &&
        itemDate <= range[1].endOf("year").toDate()
      );
    }
    return true;
  });

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      if (!bstr) return;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const jsonData: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

      const mappedData = jsonData.map(row => {
        // Handle amount formatting - remove commas and handle negative values in parentheses
        let amountValue = row.amount || row.Amount || 0;
        
        // Handle blank/empty values
        if (amountValue === null || amountValue === undefined || amountValue === '') {
          amountValue = 0;
        } else if (typeof amountValue === 'string') {
          // Remove commas from numbers
          amountValue = amountValue.replace(/,/g, '');
          
          // Handle negative values in parentheses like "(80,003)"
          if (amountValue.startsWith('(') && amountValue.endsWith(')')) {
            amountValue = '-' + amountValue.slice(1, -1);
          }
          
          // Convert to number
          amountValue = parseFloat(amountValue) || 0;
        }
        
        return {
          business_unit: row.business_unit || row['Business Unit'] || row['BUSINESS UNIT'] || "",
          particulars: row.particulars || row.Particulars || "",
          amount: amountValue,
          month: excelDateToISO(row.month || row.Month || ""),
        };
      });

      try {
        await apiClient.post("/team-report/bulk", { data: mappedData });
        message.success('Data imported successfully');
        
        // Refresh data
        const res = await apiClient.get<ReportData[]>("/team-report");
        setData(res.data);
      } catch (err: any) {
        console.error('Error importing data:', err);
        message.error(err.response?.data?.error || 'Failed to import data');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExportExcel = () => {
    const exportData = filteredData.map((row: ReportData) => ({
      'Business Unit': row.business_unit,  // Changed from LOB
      Particulars: row.particulars,
      Amount: row.amount,
      Month: row.month,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "TeamReport");
    XLSX.writeFile(workbook, "TeamReport.xlsx");
  };

  // Action dropdown items
  const actionDropdownItems = [
    {
      key: 'add',
      label: 'Add Team Report Data',
      onClick: () => navigate('/AddTeamReportData')
    },
    {
      key: 'import',
      label: 'Import Excel',
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
    {
      key: 'compare',
      label: 'Compare',
      onClick: () => navigate(`/team-report/compare?business_unit=${selectedLob || ''}`)
    }
  ];

  // Chart rendering code remains the same
  useEffect(() => {
    if (filteredData.length === 0) return;

    const grouped = filteredData.reduce<Record<string, number>>((acc, item) => {
      let key: string;
      
      if (selectedParticular) {
        // If a particular is selected, group by business unit and month
        const month = new Date(item.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        key = `${item.business_unit} - ${month}`;
      } else {
        // If no particular is selected, group by business unit and particulars
        key = `${item.business_unit} - ${item.particulars}`.toUpperCase();
      }
      
      acc[key] = (acc[key] || 0) + Number(item.amount);
      return acc;
    }, {});

    const chartData = Object.entries(grouped).map(([key, value]) => {
      // Extract the particulars from the key (format: "Business Unit - Particulars")
      const particulars = key.includes(' - ') ? key.split(' - ')[1] : key;
      return {
        particulars: key,
        amount: value,
        formattedAmount: formatValueByFieldType(value, particulars)
      };
    });

    am5.array.each(am5.registry.rootElements, function(root) {
      if (root.dom.id === "barChart") root.dispose();
    });

    const root = am5.Root.new("barChart");

    root.setThemes([am5themes_Animated.new(root)]);

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        layout: root.verticalLayout
      })
    );

    const yAxis = chart.yAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "particulars",
        renderer: am5xy.AxisRendererY.new(root, {
          inversed: true,
          minGridDistance: 20
        })
      })
    );
    yAxis.get("renderer").labels.template.setAll({
      fill: am5.color(0x000000)
    });

    const xAxis = chart.xAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererX.new(root, {})
      })
    );
    xAxis.get("renderer").labels.template.setAll({
      fill: am5.color(0x000000)
    });

    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: "Amount",
        xAxis,
        yAxis,
        valueXField: "amount",
        categoryYField: "particulars",
        tooltip: am5.Tooltip.new(root, {
          labelText: "{categoryY}: {formattedAmount}"
        })
      })
    );

    series.columns.template.setAll({
      tooltipText: "{categoryY}: {formattedAmount}",
      interactive: true,
      cursorOverStyle: "pointer"
    });

    yAxis.data.setAll(chartData);
    series.data.setAll(chartData);

    chart.set("scrollbarX", am5.Scrollbar.new(root, {
      orientation: "horizontal"
    }));

    chart.set("cursor", am5xy.XYCursor.new(root, {
      behavior: "zoomX",
      xAxis: xAxis,
      yAxis: yAxis
    }));

    const legend = chart.children.push(
      am5.Legend.new(root, {
        centerX: am5.percent(50),
        x: am5.percent(50),
        layout: root.horizontalLayout
      })
    );
    legend.labels.template.setAll({
      fill: am5.color(0x000000)
    });
    legend.data.setAll(chart.series.values);
    series.set("legendLabelText", "{categoryY}: {formattedAmount}");

    series.appear(1000);
    chart.appear(1000, 100);

    return () => {
      root.dispose();
    };
  }, [filteredData]);

  function excelDateToISO(serial: number | string): string {
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
  }

  return (
    <div className="homepage">
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
          .ant-picker-input > input {
            color: #000000 !important;
          }
          .ant-picker-input > input::placeholder {
            color: #000000 !important;
          }
          .ant-picker-suffix {
            color: #000000 !important;
          }
          .ant-picker {
            background-color: #ffffff !important;
            border-color: #004a7a !important;
          }
          .ant-picker-panel {
            background-color: #ffffff !important;
          }
          .ant-picker-panel-container {
            background-color: #ffffff !important;
          }
          .ant-picker-cell {
            color: #000000 !important;
          }
          .ant-picker-header {
            color: #000000 !important;
          }
          .ant-picker-header button {
            color: #000000 !important;
          }
          .ant-picker-content th {
            color: #000000 !important;
          }
          .ant-picker-content td {
            color: #000000 !important;
          }
          .ant-picker-year-panel .ant-picker-cell,
          .ant-picker-month-panel .ant-picker-cell,
          .ant-picker-quarter-panel .ant-picker-cell {
            color: #000000 !important;
          }
          .ant-picker-panel * {
            color: #000000 !important;
          }
          .ant-picker-panel .ant-picker-cell-inner {
            color: #000000 !important;
          }
          .ant-picker-panel .ant-picker-header-view {
            color: #000000 !important;
          }
          .ant-picker-panel .ant-picker-header-view button {
            color: #000000 !important;
          }
          .ant-picker-panel .ant-picker-content {
            color: #000000 !important;
          }
          .ant-picker-panel .ant-picker-content * {
            color: #000000 !important;
          }
          .ant-picker-dropdown {
            background-color: #ffffff !important;
          }
          .ant-picker-dropdown * {
            color: #000000 !important;
          }
          .ant-btn {
            color: #ffffff !important;
          }
          .ant-btn-primary {
            background-color: #004a7a !important;
            border-color: #004a7a !important;
          }
          .ant-btn-primary:hover {
            background-color: #00345a !important;
            border-color: #00345a !important;
          }
          .ant-dropdown-menu {
            background-color: #ffffff !important;
            border: 1px solid #d9d9d9 !important;
            box-shadow: 0 6px 16px 0 rgba(0, 0, 0, 0.08) !important;
          }
          .ant-dropdown-menu-item {
            color: #000000 !important;
            background-color: #ffffff !important;
          }
          .ant-dropdown-menu-item:hover {
            background-color: #f5f5f5 !important;
            color: #000000 !important;
          }
          .ant-dropdown-menu-item:active {
            background-color: #e6f7ff !important;
            color: #000000 !important;
          }
        `}
      </style>
      <div className="routing-header-bar" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '2rem 2rem 0 2rem' }}>
        <div className="homepage-logo-top-left">
          <img src={logo} alt="Alchemy Logo" />
        </div>
        <h2 style={{ 
          position: 'absolute', 
          left: '50%', 
          transform: 'translateX(-50%)', 
          color: 'white', 
          fontWeight: 700, 
          fontSize: '2rem', 
          fontFamily: 'Montserrat, sans-serif', 
          margin: 0, 
          zIndex: 1 
        }}>Team Report Dashboard</h2>
        <div className="auth-buttons-container">
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

      <div className="p-6 space-y-8" style={{ marginTop: '6rem' }}>


         {/* Filter Controls */}
                 <Space className="mb-6" wrap style={{ marginTop: '2rem' }}>
           <Select
             value={selectedLob || undefined}
             onChange={(value) => setSelectedLob(value || null)}
             style={{ width: 200 }}
             disabled={isBUHead}
             placeholder="Select Business Unit"
           >
             <Option value="">All Business Units</Option>
             {allowedLobs.map(bu => (
               <Option key={bu} value={bu}>{bu}</Option>
             ))}
           </Select>
           <Select
             value={selectedParticular || undefined}
             onChange={(value) => setSelectedParticular(value || null)}
             style={{ width: 200 }}
             placeholder="Select Particular"
             allowClear
           >
             <Option value="">All Particulars</Option>
             {uniqueParticulars.map(particular => (
               <Option key={particular} value={particular}>{particular}</Option>
             ))}
           </Select>
           <Select value={filterType} onChange={setFilterType} style={{ width: 120 }}>
             <Option value="date">Date</Option>
             <Option value="month">Month</Option>
             <Option value="quarter">Quarter</Option>
             <Option value="year">Year</Option>
           </Select>
           <RangePicker
             picker={filterType}
             onChange={setRange}
             allowClear
           />
         </Space>
        {/* KPI Cards */}
        <div style={{ marginTop: '2rem' }}>
          <KPIStats data={filteredData} />
        </div>

        {/* Bar Chart & Pie Chart Side by Side */}
        <div className={styles.dashboardGrid} style={{ marginTop: '2rem' }}>
                     <div>
             <h2 className="text-xl font-bold mb-1" style={{ color: '#ffffff' }}>
               {selectedParticular ? `${selectedParticular} by Business Unit & Month` : 'Particulars vs Amount'}
             </h2>
             <div id="barChart" style={{ width: "100%", height: "500px" }}></div>
           </div>
                     <QuarterlyPieChart data={filteredData} selectedParticular={selectedParticular} />
        </div>

                 {/* Line Chart (Net Margin Trend) */}
         <NetMarginLineChart data={filteredData} selectedParticular={selectedParticular} />
        <MonthlyPivotTable data={filteredData} />
      </div>
    </div>
  );
};

export default TeamReportDashboard;