import React, { useState, useEffect, useRef } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import * as am5percent from '@amcharts/amcharts5/percent';
import * as am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { Spin, Alert, Tabs, Tag, Row, Col, Input } from 'antd';
import Card from 'antd/es/card';
import { TeamOutlined, FileTextOutlined, CalendarOutlined } from '@ant-design/icons';
import type { TabsProps } from 'antd';
import VendorPerformanceChart from './VendorPerformanceChart';
import { useNavigate } from "react-router-dom";
import styles from './CTSDashboard.module.css';
import VendorGanttChart from './VendorGanttChart';
import DatePickerComponent from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import * as XLSX from 'xlsx';
import apiClient from '../config/api';

import logo from '../assets/logo_1.png';



interface CTSDataItem {
  "Sl No": string;
  "vendor_name": string;
  'booking_month': string;
  "resource_name": string;
  "SERVICE MONTH": string;
  "VENDOR Invoice No": string;
  "VENDOR Invoice Date": string;
  "ATIPL Invoice Base Amount": string;
  "GST": string;
  "Total Invoice amount": string;
  "TDS": string;
  "Net Receivable": string;
  'payment_recieved': string;
  "Balance receivable from client": string;
  "Tally Book Entry Date": string;
  "Sub Vendor Invoice date": string;
  "Sub Vendor Invoice No": string;
  "Base amt as per Tally (Vendor)": string;
  "Margin": string;
  "Vendor Invoice Status": string;
  "Payment Date": string;
  "Instrument No": string;
  "Payment Mode": string;
  "Payment Status": string;
  "RECEIPTS STATUS": string;
  [key: string]: string;
}

interface VendorSummary {
  vendor: string;
  totalInvoiceAmount: number;
  baseAmount: number;
  netReceivable: number;
  paymentReceived: number;
  baseAmountTally: number;
  margin: number;
  resourceCount: number;
}

const METRIC_OPTIONS = [
  { value: 'total_invoice_amount', label: 'Total Invoice Amount' },
  { value: 'atipl_invoice_base_amount', label: 'Base Amount' },
  { value: 'net_receivable', label: 'Net Receivable' },
  { value: 'payment_received', label: 'Payment Received' },
  { value: 'base_amount', label: 'Base Amount (Tally)' },
  { value: 'margin', label: 'Margin' }
];

const CTSDashboard: React.FC = () => {
  const [data, setData] = useState<CTSDataItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // Helper function to get current financial year start and current month end dates (Financial Year: April to March)
  const getCurrentFinancialYearDates = () => {
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-11
    const currentYear = now.getFullYear();
    
    // Financial year starts from April (month 3)
    // Determine financial year start
    let financialYearStart = currentYear;
    if (currentMonth < 3) { // Jan, Feb, Mar - belongs to previous financial year
      financialYearStart = currentYear - 1;
    }
    
    // Financial year starts from April 1st
    const financialYearStartDate = new Date(financialYearStart, 3, 1); // April 1st
    
    // End date is current month (last day of current month)
    const currentMonthEndDate = new Date(currentYear, currentMonth + 1, 0); // Last day of current month
    
    return { financialYearStartDate, currentMonthEndDate };
  };

  const { financialYearStartDate, currentMonthEndDate } = getCurrentFinancialYearDates();
  const [bookingMonthStart, setBookingMonthStart] = useState<Date | null>(financialYearStartDate);
  const [bookingMonthEnd, setBookingMonthEnd] = useState<Date | null>(currentMonthEndDate);
  const [visibleRows, setVisibleRows] = useState(20);
  const [activeTab, setActiveTab] = useState<string>("1");
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMetric, setSelectedMetric] = useState<string>('Total Invoice amount');


  // Refs for AMCharts
  const vendorChartRef = useRef<HTMLDivElement>(null);
  const resourceCountChartRef = useRef<HTMLDivElement>(null);
  const resourceChartRef = useRef<HTMLDivElement>(null);
  const vendorPerformanceChartRef = useRef<HTMLDivElement>(null);
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
   const navigate = useNavigate();
   const [selectedVendorForDetail, setSelectedVendorForDetail] = useState<string | null>(null);

   // ...inside CTSDashboard component...
  const [ganttView, setGanttView] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
const [ganttMetric, setGanttMetric] = useState<'head_count' | 'payment_receive_from_client' | 'base_amt_as_per_tally_vendor' | 'margin' | 'total_invoice_amount'>('head_count');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/CTS');
      console.log("Fetched data:", response.data); // Debug log
      setData(response.data);
    } catch (err: any) {
      console.error("Error fetching data:", err); // Detailed error logging
      setError(err.response?.data?.error || err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  

  // Filter data based on date range
  const filteredData = data.filter(item => {
    // If no date filters are applied, include all data
    if (!bookingMonthStart && !bookingMonthEnd) {
      return true;
    }

    try {
      const dateStr = item["service_month"];
      if (!dateStr) return false;

      let serviceDate: Date | null = null;

      if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
        // ISO format from DB
        serviceDate = new Date(dateStr);
      } else if (/^[A-Za-z]{3}-\d{2}$/.test(dateStr)) {
        // "Apr-24" format
        const [month, year] = dateStr.split('-');
        const monthIndex = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(month);
        serviceDate = new Date(2000 + parseInt(year, 10), monthIndex, 1);
      } else {
        // Unknown format, skip
        return false;
      }

      // Check start date filter
      if (bookingMonthStart) {
        const startOfMonth = new Date(bookingMonthStart.getFullYear(), bookingMonthStart.getMonth(), 1);
        if (serviceDate < startOfMonth) {
          return false;
        }
      }

      // Check end date filter
      if (bookingMonthEnd) {
        const endOfMonth = new Date(bookingMonthEnd.getFullYear(), bookingMonthEnd.getMonth() + 1, 0);
        if (serviceDate > endOfMonth) {
          return false;
        }
      }

      return true;
    } catch (e) {
      console.warn('Invalid date format for item:', item, e);
      return false;
    }
  });

  // Calculate vendor summaries for pivot table
  const calculateVendorSummaries = (): VendorSummary[] => {
    const vendorMap = new Map<string, VendorSummary>();

    filteredData.forEach(item => {
      const vendor = item['vendor_name'] || 'Unknown Vendor';
      const toNumber = (value: any): number => {
        if (typeof value === 'number') return value;
        const strValue = String(value || '0')
          .replace(/[^\d.-]/g, '')
          .replace(/,/g, '');
        return parseFloat(strValue) || 0;
      };

      const totalInvoiceAmount = toNumber(item['total_invoice_amount']);
      const baseAmount = toNumber(item['atipl_invoice_base_amount']);
      const netReceivable = toNumber(item['net_receivable']);
      const paymentReceived = toNumber(item['payment_receive_from_client']);
      const baseAmountTally = toNumber(item['base_amt_as_per_tally_vendor']);
      const margin = toNumber(item['margin']);

      if (!vendorMap.has(vendor)) {
        vendorMap.set(vendor, {
          vendor,
          totalInvoiceAmount: 0,
          baseAmount: 0,
          netReceivable: 0,
          paymentReceived: 0,
          baseAmountTally: 0,
          margin: 0,
          resourceCount: 0
        });
      }

      const vendorData = vendorMap.get(vendor)!;
      vendorData.totalInvoiceAmount += totalInvoiceAmount;
      vendorData.baseAmount += baseAmount;
      vendorData.netReceivable += netReceivable;
      vendorData.paymentReceived += paymentReceived;
      vendorData.baseAmountTally += baseAmountTally;
      vendorData.margin += margin;
      vendorData.resourceCount += 1;
    });

    return Array.from(vendorMap.values()).sort((a, b) => b.totalInvoiceAmount - a.totalInvoiceAmount);
  };

  const vendorSummaries = calculateVendorSummaries();

  const grandTotals = vendorSummaries.reduce(
    (acc, summary) => ({
      totalInvoiceAmount: acc.totalInvoiceAmount + (summary.totalInvoiceAmount || 0),
      baseAmount: acc.baseAmount + (summary.baseAmount || 0),
      netReceivable: acc.netReceivable + (summary.netReceivable || 0),
      paymentReceived: acc.paymentReceived + (summary.paymentReceived || 0),
      baseAmountTally: acc.baseAmountTally + (summary.baseAmountTally || 0),
      margin: acc.margin + (summary.margin || 0),
      resourceCount: acc.resourceCount + (summary.resourceCount || 0),
    }),
    {
      totalInvoiceAmount: 0,
      baseAmount: 0,
      netReceivable: 0,
      paymentReceived: 0,
      baseAmountTally: 0,
      margin: 0,
      resourceCount: 0,
    }
  );

  // Excel export functionality for pivot table
  const exportPivotToExcel = () => {
    const workbook = XLSX.utils.book_new();
    
    // Prepare data for export - include vendor summaries and grand totals
    const exportData = [
      // Add vendor summary rows
      ...vendorSummaries.map(summary => ({
        'Vendor Name': summary.vendor,
        'Total Invoice Amount': summary.totalInvoiceAmount,
        'Base Amount': summary.baseAmount,
        'Net Receivable': summary.netReceivable,
        'Payment Received': summary.paymentReceived,
        'Base Amount (Tally)': summary.baseAmountTally,
        'Margin': summary.margin,
        'Resource Count': summary.resourceCount
      })),
      // Add grand totals row
      {
        'Vendor Name': 'GRAND TOTAL',
        'Total Invoice Amount': grandTotals.totalInvoiceAmount,
        'Base Amount': grandTotals.baseAmount,
        'Net Receivable': grandTotals.netReceivable,
        'Payment Received': grandTotals.paymentReceived,
        'Base Amount (Tally)': grandTotals.baseAmountTally,
        'Margin': grandTotals.margin,
        'Resource Count': grandTotals.resourceCount
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    
    // Set column widths
    const columnWidths = [
      { wch: 30 }, // Vendor Name
      { wch: 20 }, // Total Invoice Amount
      { wch: 15 }, // Base Amount
      { wch: 15 }, // Net Receivable
      { wch: 15 }, // Payment Received
      { wch: 15 }, // Base Amount (Tally)
      { wch: 15 }, // Margin
      { wch: 15 }  // Resource Count
    ];
    worksheet['!cols'] = columnWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, 'CTS Pivot Data');
    
    // Generate filename with current date
    const currentDate = new Date().toISOString().split('T')[0];
    const filename = `CTS_Pivot_Data_${currentDate}.xlsx`;
    
    XLSX.writeFile(workbook, filename);
  };

  // Simplified vendor name cleaning
  const cleanVendorName = (name: string): string => {
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return 'Unknown Vendor';
    }
    return name.trim();
  };

  // Improved currency parsing
  const parseCurrency = (value: string): number => {
    if (!value) return 0;
    // Remove commas and any non-numeric characters except decimal point
    const numericValue = value.replace(/[^0-9.]/g, '');
    return parseFloat(numericValue) || 0;
  };

  // Filtered data for Resource Payment Status table (search + date filter)
  const searchedData = filteredData.filter(item => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (item["vendor_name"] && item["vendor_name"].toLowerCase().includes(term)) ||
      (item["base_amt_as_per_tally_vendor"] && item["base_amt_as_per_tally_vendor"].toLowerCase().includes(term)) ||
      (item["payment_receive_from_client"] && item["payment_receive_from_client"].toLowerCase().includes(term)) ||
      (item["vendor_invoice_status"] && item["vendor_invoice_status"].toLowerCase().includes(term)) ||
      (item["payment_status"] && item["payment_status"].toLowerCase().includes(term))
    );
  });

  // Create tabs items for Ant Design v5
  const tabItems = [
    {
      key: '1',
      label: (
        <span>
          <TeamOutlined /> Vendor Analysis
        </span>
      ),
      children: (
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card title="Vendor Analysis Pivot Table">
              <div className={styles['pivot-table-container']}>
                <table className={styles['pivot-table']}>
                  <thead>
                    <tr>
                      <th>Vendor Name</th>
                      <th>Total Invoice Amount</th>
                      <th>Base Amount</th>
                      <th>Net Receivable</th>
                      <th>Payment Received</th>
                      <th>Base Amount (Tally)</th>
                      <th>Margin</th>
                      <th>Resource Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendorSummaries.map((summary, index) => (
                      <tr key={index}>
                        <td>{summary.vendor}</td>
                        <td>{Math.round(summary.totalInvoiceAmount).toLocaleString()}</td>
                        <td>{Math.round(summary.baseAmount).toLocaleString()}</td>
                        <td>{Math.round(summary.netReceivable).toLocaleString()}</td>
                        <td>{Math.round(summary.paymentReceived).toLocaleString()}</td>
                        <td>{Math.round(summary.baseAmountTally).toLocaleString()}</td>
                        <td>{Math.round(summary.margin).toLocaleString()}</td>
                        <td>{summary.resourceCount}</td>
                      </tr>
                    ))}
                    <tr className="grand-total">
                      <td><strong>Grand Total</strong></td>
                      <td><strong>{Math.round(grandTotals.totalInvoiceAmount).toLocaleString()}</strong></td>
                      <td><strong>{Math.round(grandTotals.baseAmount).toLocaleString()}</strong></td>
                      <td><strong>{Math.round(grandTotals.netReceivable).toLocaleString()}</strong></td>
                      <td><strong>{Math.round(grandTotals.paymentReceived).toLocaleString()}</strong></td>
                      <td><strong>{Math.round(grandTotals.baseAmountTally).toLocaleString()}</strong></td>
                      <td><strong>{Math.round(grandTotals.margin).toLocaleString()}</strong></td>
                      <td><strong>{grandTotals.resourceCount}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          </Col>
          <Col span={24}>
            
          </Col>
          <Col span={24}>
            <Card 
              title="Vendor Performance by Month"
            >
              <VendorPerformanceChart 
                data={filteredData} 
                selectedMetric={selectedMetric} 
              />
            </Card>
          </Col>
        </Row>
      )
    },
    {
      key: '2',
      label: (
        <span>
          <FileTextOutlined /> Resource Details
        </span>
      ),
      children: (
        <Card title="Resource Payment Status">
          <div className="mb-4 flex justify-end">
            <Input.Search
              placeholder="Search Resource or Vendor..."
              allowClear
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
              }}
              style={{ 
                width: 320,
                color: '#000000'
              }}
            />
          </div>
          
          <div className="overflow-x-auto" style={{ maxHeight: '500px', overflowY: 'auto', margin: '1rem 0' }}>
            <table className="min-w-full resource-table" style={{ 
              tableLayout: 'fixed', 
              borderCollapse: 'collapse',
              border: '2px solid #004a7a'
            }}>
              <colgroup>
                <col style={{ width: '18%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '16%' }} />
              </colgroup>
              <thead style={{ 
                position: 'sticky', 
                top: 0, 
                zIndex: 1,
                backgroundColor: '#002542',
                border: '2px solid #004a7a'
              }}>
                <tr>
                  <th style={{ 
                    padding: '12px 8px', 
                    textAlign: 'center', 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    textTransform: 'uppercase',
                    color: '#ffffff',
                    borderRight: '1px solid #004a7a',
                    borderBottom: '2px solid #004a7a'
                  }}>Resource</th>
                  <th style={{ 
                    padding: '12px 8px', 
                    textAlign: 'center', 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    textTransform: 'uppercase',
                    color: '#ffffff',
                    borderRight: '1px solid #004a7a',
                    borderBottom: '2px solid #004a7a'
                  }}>Vendor</th>
                  <th style={{ 
                    padding: '12px 8px', 
                    textAlign: 'center', 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    textTransform: 'uppercase',
                    color: '#ffffff',
                    borderRight: '1px solid #004a7a',
                    borderBottom: '2px solid #004a7a'
                  }}>Base Amount</th>
                  <th style={{ 
                    padding: '12px 8px', 
                    textAlign: 'center', 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    textTransform: 'uppercase',
                    color: '#ffffff',
                    borderRight: '1px solid #004a7a',
                    borderBottom: '2px solid #004a7a'
                  }}>Payment</th>
                  <th style={{ 
                    padding: '12px 8px', 
                    textAlign: 'center', 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    textTransform: 'uppercase',
                    color: '#ffffff',
                    borderRight: '1px solid #004a7a',
                    borderBottom: '2px solid #004a7a'
                  }}>Invoice Status</th>
                  <th style={{ 
                    padding: '12px 8px', 
                    textAlign: 'center', 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    textTransform: 'uppercase',
                    color: '#ffffff',
                    borderRight: '2px solid #004a7a',
                    borderBottom: '2px solid #004a7a'
                  }}>Payment Status</th>
                </tr>
              </thead>
              <tbody style={{ backgroundColor: '#002542' }}>
                {searchedData.map((item, index) => (
                  <tr key={index} style={{ 
                    borderBottom: '1px solid #004a7a',
                    backgroundColor: index % 2 === 0 ? '#002542' : '#00345a'
                  }}>
                    <td style={{ 
                      padding: '12px 8px', 
                      textAlign: 'center', 
                      borderRight: '1px solid #004a7a',
                      whiteSpace: 'nowrap',
                      color: '#ffffff'
                    }}>{item["resource_name"] || 'N/A'}</td>
                    <td style={{ 
                      padding: '12px 8px', 
                      textAlign: 'center', 
                      borderRight: '1px solid #004a7a',
                      whiteSpace: 'nowrap',
                      color: '#ffffff'
                    }}>{cleanVendorName(item["vendor_name"])}</td>
                    <td style={{ 
                      padding: '12px 8px', 
                      textAlign: 'center', 
                      borderRight: '1px solid #004a7a',
                      whiteSpace: 'nowrap',
                      color: '#ffffff'
                    }}>{Math.round(parseCurrency(item["base_amt_as_per_tally_vendor"])).toLocaleString('en-IN')}</td>
                    <td style={{ 
                      padding: '12px 8px', 
                      textAlign: 'center', 
                      borderRight: '1px solid #004a7a',
                      whiteSpace: 'nowrap',
                      color: '#ffffff'
                    }}>{Math.round(parseCurrency(item['payment_receive_from_client'])).toLocaleString('en-IN')}</td>
                    <td style={{ 
                      padding: '12px 8px', 
                      textAlign: 'center', 
                      borderRight: '1px solid #004a7a',
                      whiteSpace: 'nowrap',
                      color: '#ffffff'
                    }}>
                      <Tag color={item["vendor_invoice_status"] === 'RECEIVED' ? 'green' : 'orange'}>
                        {item["vendor_invoice_status"] || 'Unknown'}
                      </Tag>
                    </td>
                    <td style={{ 
                      padding: '12px 8px', 
                      textAlign: 'center', 
                      borderRight: '2px solid #004a7a',
                      whiteSpace: 'nowrap',
                      color: '#ffffff'
                    }}>
                      <Tag color={item["payment_status"] === 'PROCESSED' ? 'green' : 'orange'}>
                        {item["payment_status"] || 'Unknown'}
                      </Tag>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )
    }
  ];

  // Handler for vendor click in chart
  const handleVendorClick = (vendorName: string) => {
    setActiveTab("3"); // Switch to Resource Details tab
    setSearchTerm(vendorName); // Set search bar to vendor name
    setVisibleRows(20); // Reset pagination
  };

  // Initialize Vendor Chart
  useEffect(() => {
    if (!vendorChartRef.current || filteredData.length === 0) return;

    const root = am5.Root.new(vendorChartRef.current);
    root.setThemes([am5themes_Animated.default.new(root)]);

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: true,
        wheelX: "panX",
        wheelY: "zoomX",
        layout: root.verticalLayout
      })
    );

    // Process vendor data with proper error handling
     const vendorData = filteredData.reduce((acc, item) => {
    try {
      const vendor = cleanVendorName(item["vendor_name"]);
      const payment = parseCurrency(item['payment_recieved']);
      
      if (!vendor) {
        console.warn('Empty vendor name for item:', item);
        return acc;
      }
      
      if (!acc[vendor]) {
        acc[vendor] = { vendor, payment: 0, resources: new Set() };
      }
      
      acc[vendor].payment += payment;
      const resourceName = item["resource_name"] || 'Unknown Resource';
      acc[vendor].resources.add(resourceName);
    } catch (e) {
      console.error('Error processing item:', item, e);
    }
    return acc;
  }, {} as Record<string, any>);

  console.log("Vendor data for chart:", vendorData); // Debug log

  const sortedVendors = Object.values(vendorData)
    .sort((a: any, b: any) => b.payment - a.payment)
    .slice(0, 10);

      const yAxis = chart.yAxes.push(
    am5xy.CategoryAxis.new(root, {
      categoryField: "vendor",
      renderer: am5xy.AxisRendererY.new(root, {})
    })
  );
  yAxis.data.setAll(sortedVendors);

   const xAxis = chart.xAxes.push(
    am5xy.ValueAxis.new(root, {
      renderer: am5xy.AxisRendererX.new(root, {}),
      numberFormat: "#,##0"
    })
  );

  // Add series
  const series = chart.series.push(
    am5xy.ColumnSeries.new(root, {
      name: METRIC_OPTIONS.find(m => m.value === selectedMetric)?.label || "Value",
      xAxis: xAxis,
      yAxis: yAxis,
      valueXField: "value",
      categoryYField: "vendor",
      tooltip: am5.Tooltip.new(root, {
        pointerOrientation: "horizontal",
        labelText: "[bold]{categoryY}[/]\n{name}: [bold]{valueX.formatNumber('#,##0')}[/]"
      }),
      fill: am5.color("#8884d8")
    })
  );

  series.columns.template.setAll({
    width: am5.percent(60),
    cornerRadiusTL: 5,
    cornerRadiusTR: 5
  });

  series.data.setAll(sortedVendors);
  chart.set("cursor", am5xy.XYCursor.new(root, {}));


   return () => root.dispose();
}, [filteredData, selectedMetric]); // Add selectedMetric as dependency


  // Initialize Total Amount by Vendor Chart
useEffect(() => {
  if (!resourceCountChartRef.current || filteredData.length === 0) return;

  const root = am5.Root.new(resourceCountChartRef.current);
  root.setThemes([am5themes_Animated.default.new(root)]);

  const chart = root.container.children.push(
    am5xy.XYChart.new(root, {
      panX: true,
      panY: true,
      wheelX: "panX",
      wheelY: "zoomX",
      layout: root.verticalLayout
    })
  );
 
  // Sum total amount per vendor
  const vendorAmountMap = filteredData.reduce((acc, item) => {
    const vendor = cleanVendorName(item["vendor_name"]);
    const amount = parseCurrency(item["Total Invoice amount"] || item["total_amount"] || "0");
    if (!vendor) return acc;
    if (!acc[vendor]) acc[vendor] = 0;
    acc[vendor] += amount;
    return acc;
  }, {} as Record<string, number>);

  // Convert to array and sort by amount (descending)
  const vendorAmountData = Object.entries(vendorAmountMap)
    .map(([vendor, totalAmount]) => ({
      vendor,
      totalAmount
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 10);

  console.log("Vendor Amount Data:", vendorAmountData); // Debug log

  // Create axes
  const yAxis = chart.yAxes.push(
    am5xy.CategoryAxis.new(root, {
      categoryField: "vendor",
      renderer: am5xy.AxisRendererY.new(root, {})
    })
  );
  yAxis.data.setAll(vendorAmountData);

  const xAxis = chart.xAxes.push(
    am5xy.ValueAxis.new(root, {
      renderer: am5xy.AxisRendererX.new(root, {}),
      numberFormat: "#,##0"
    })
  );
  // Create series
  const series = chart.series.push(
    am5xy.ColumnSeries.new(root, {
      name: "Total Amount",
      xAxis: xAxis,
      yAxis: yAxis,
      valueXField: "totalAmount",
      categoryYField: "vendor",
      fill: am5.color("#FF6B6B")
    })
  );

  // Configure tooltip
  series.set("tooltip", am5.Tooltip.new(root, {
    pointerOrientation: "horizontal",
    labelText: "[bold]{categoryY}[/]\nTotal Amount: [bold]{valueX.formatNumber('#,##0')}[/]"
  }));

  series.columns.template.setAll({
    width: am5.percent(60),
    strokeOpacity: 0,
    cornerRadiusBR: 5,
    cornerRadiusTR: 5,
    fillOpacity: 0.8
  });

  // Add click handler
  series.columns.template.events.on("click", (ev) => {
    const dataItem = ev.target.dataItem;
    const vendor = (dataItem?.dataContext as { vendor?: string })?.vendor;
    if (vendor) {
      setSelectedVendor(vendor);
      // Switch to the Resource Details tab (Tab 3)
      // You might need to add tab state management if not already present
    }
  });

  series.data.setAll(vendorAmountData);

  // Add cursor
  chart.set("cursor", am5xy.XYCursor.new(root, {}));

  return () => root.dispose();
}, [filteredData]);

  // Initialize Resource Distribution Chart
  useEffect(() => {
    if (!resourceChartRef.current || filteredData.length === 0) return;

    const root = am5.Root.new(resourceChartRef.current);
    root.setThemes([am5themes_Animated.default.new(root)]);

    const chart = root.container.children.push(
      am5percent.PieChart.new(root, {
        layout: root.verticalLayout
      })
    );

    // Process resource data
    const resourceCounts = filteredData.reduce((acc, item) => {
      try {
        const vendor = cleanVendorName(item["vendor_name"]);
        if (!vendor) {
          console.warn('Empty vendor name for item:', item);
          return acc;
        }
        acc[vendor] = (acc[vendor] || 0) + 1;
      } catch (e) {
        console.error('Error processing item:', item, e);
      }
      return acc;
    }, {} as Record<string, number>);

    const pieData = Object.entries(resourceCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .map(([vendor, count]) => ({ vendor, count }));

const series = chart.series.push(
  am5percent.PieSeries.new(root, {
    name: "Resources",
    categoryField: "vendor",
    valueField: "count",
    legendLabelText: "{category}: {value}",
    tooltip: am5.Tooltip.new(root, {
      pointerOrientation: "horizontal",
      labelText: "{valuePercentTotal.formatNumber('0.00')}%"
    })
  })
);

// Show vendor name and count outside
series.labels.template.setAll({
  text: "{category}: {value}",
  radius: 20,
  fontWeight: "bold",
  fill: am5.color(0xFFFFFF)
});

// Optional: show lines from slice to label
series.ticks.template.setAll({
  forceHidden: false
});

series.data.setAll(pieData);


  // Add legend if needed
  chart.children.push(am5.Legend.new(root, {
    centerX: am5.percent(50),
    x: am5.percent(50)
  }));

    return () => root.dispose();
  }, [filteredData]);




  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex flex-col items-center">
          <Spin size="large" />
          <span className="mt-2">Loading CTS Data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="Error Loading Data"
        description={error}
        type="error"
        showIcon
      />
    );
  }

  return (
     <div className="homepage" style={{ backgroundColor: '#e8f4f8', minHeight: '100vh' }}>
      <style>
        {`
          .ant-tabs-content {
            background-color: white !important;
          }
          .ant-tabs-tabpane {
            background-color: white !important;
          }
          .ant-card {
            background-color: white !important;
            border-color: #e0e0e0 !important;
          }
          .ant-card-head {
            background-color: #f5f5f5 !important;
            border-bottom-color: #e0e0e0 !important;
          }
          .ant-card-head-title {
            color: #000000 !important;
          }
          .ant-tabs-tab {
            color: #000000 !important;
          }
          .ant-tabs-tab-active {
            color: #000000 !important;
          }
          .ant-tabs-tab:hover {
            color: #000000 !important;
          }
          .ant-tabs-ink-bar {
            background-color: #1890ff !important;
          }
        `}
      </style>
      <div className="routing-header-bar" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '1rem 2rem 0 2rem' }}>
        <div className="homepage-logo-top-left">
          <img src={logo} alt="Alchemy Logo" />
        </div>
        <h2 style={{ 
          position: 'absolute', 
          left: '50%', 
          transform: 'translateX(-50%)', 
          color: 'black', 
          fontWeight: 700, 
          fontSize: '2rem', 
          fontFamily: 'Montserrat, sans-serif', 
          margin: 0, 
          zIndex: 1 
        }}>Cost to Serve Dashboard</h2>
        <div className="auth-buttons-container">
          
          <button
            className="auth-button"
            onClick={() => navigate(-1)}
          >
            Back
          </button>
          <button
            className="auth-button"
            onClick={exportPivotToExcel}
            style={{ backgroundColor: '#28a745', borderColor: '#28a745' }}
          >
            Export Excel
          </button>
        </div>
      </div>
    <div className="p-6" style={{ marginTop: '4rem' }}>
      <div className="flex justify-between items-center mb-6">
        <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ color: 'black', marginRight: '10px' }}>Service Month Range:</label>
          <div style={{ 
            padding: '8px 12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            backgroundColor: 'white',
            color: 'black'
          }}>
            <DatePickerComponent
              selected={bookingMonthStart}
              onChange={date => setBookingMonthStart(date)}
              dateFormat="MMM-yyyy"
              showMonthYearPicker
              placeholderText="Start month"
              className="date-input"
              isClearable
            />
          </div>
          <span style={{ color: 'black' }}>to</span>
          <div style={{ 
            padding: '8px 12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            backgroundColor: 'white',
            color: 'black'
          }}>
            <DatePickerComponent
              selected={bookingMonthEnd}
              onChange={date => setBookingMonthEnd(date)}
              dateFormat="MMM-yyyy"
              showMonthYearPicker
              placeholderText="End month"
              className="date-input"
              isClearable
            />
          </div>
          {(bookingMonthStart || bookingMonthEnd) && (
            <button
              onClick={() => {
                setBookingMonthStart(null);
                setBookingMonthEnd(null);
              }}
              style={{
                padding: '8px 12px',
                backgroundColor: '#ff4d4f',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginLeft: '10px'
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <Tabs 
        defaultActiveKey="1" 
        items={tabItems}
        style={{ 
          backgroundColor: 'white',
          color: '#000000'
        }}
      />
    </div>
    </div>
  );
};


export default CTSDashboard;