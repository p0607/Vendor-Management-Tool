import React, { useEffect, useRef } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import * as am5themes_Animated from '@amcharts/amcharts5/themes/Animated';

interface VendorTimelineChartProps {
  data: any[];
  view: 'monthly' | 'quarterly' | 'yearly';
  metric: 'head_count' | 'payment_receive_from_client' | 'base_amt_as_per_tally_vendor' | 'margin' | 'total_invoice_amount';
}

// Enhanced data processing with NaN handling
const processData = (rawData: any[], viewType: string, metricKey: string) => {
  const groupedData: Record<string, any> = {};

  rawData.forEach(item => {
    const vendor = item.vendor_name || 'Unknown Vendor';
    let periodKey = '';
    
    try {
      const date = new Date(item.service_month || item.booking_month || Date.now());
      
      if (viewType === 'monthly') {
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else if (viewType === 'quarterly') {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        periodKey = `${date.getFullYear()}-Q${quarter}`;
      } else {
        periodKey = `${date.getFullYear()}`;
      }
    } catch (e) {
      periodKey = 'Invalid Date';
    }

    const compositeKey = `${vendor}|${periodKey}`;
    
    if (!groupedData[compositeKey]) {
      groupedData[compositeKey] = {
        vendor,
        period: periodKey,
        head_count: 0,
        payment_receive_from_client: 0,
        base_amt_as_per_tally_vendor: 0,
        margin: 0,
        total_invoice_amount: 0
      };
    }

    // Safe number parsing with NaN handling
    const safeParse = (val: any) => {
      if (val === null || val === undefined) return 0;
      const num = typeof val === 'string' 
        ? parseFloat(val.replace(/[^\d.-]/g, '')) 
        : Number(val);
      return isNaN(num) ? 0 : num;
    };

    groupedData[compositeKey].head_count += 1;
    groupedData[compositeKey].payment_receive_from_client += safeParse(item.payment_receive_from_client || item.payment_receive_from_client);
    groupedData[compositeKey].base_amt_as_per_tally_vendor += safeParse(item.base_amt_as_per_tally_vendor);
    groupedData[compositeKey].margin += safeParse(item.margin);
    groupedData[compositeKey].total_invoice_amount += safeParse(item.total_invoice_amount || item['total_invoice_amount']);
  });

  return Object.values(groupedData).map(item => ({
    ...item,
    value: item[metricKey]
  }));
};

const VendorTimelineChart: React.FC<VendorTimelineChartProps> = ({ data, view, metric }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  // Compute processedData and vendors outside useEffect for use in render
  const processedData = processData(data, view, metric);
  const validData = processedData.filter(item => !isNaN(item.value) && item.value !== null);
  const vendors = Array.from(new Set(validData.map(item => item.vendor)));

  useEffect(() => {
    if (!chartRef.current) return;

    const root = am5.Root.new(chartRef.current);
    root.setThemes([am5themes_Animated.default.new(root)]);

    // Process data with NaN handling
    // const processedData = processData(data, view, metric);
    
    // Filter out entries with NaN or invalid values
    // const validData = processedData.filter(item => !isNaN(item.value) && item.value !== null);
    
    if (validData.length === 0) {
      root.dispose();
      return;
    }
// Calculate total value per vendor
const vendorTotals: Record<string, number> = {};
validData.forEach(item => {
  vendorTotals[item.vendor] = (vendorTotals[item.vendor] || 0) + (item.value || 0);
});
const topVendors = Object.entries(vendorTotals)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([vendor]) => vendor);

    // const vendors = Array.from(new Set(validData.map(item => item.vendor)));
    const periods = Array.from(new Set(validData.map(item => item.period))).sort();

    // Create chart
    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: true,
        wheelX: "panX",
        wheelY: "zoomX",
        layout: root.verticalLayout,
        background: am5.Rectangle.new(root, { fill: am5.color(0x002542) })
      })
    );

    // Add scrollbar
    chart.set("scrollbarX", am5.Scrollbar.new(root, {
      orientation: "horizontal"
    }));

    // Create axes
    const yAxis = chart.yAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "vendor",
        renderer: am5xy.AxisRendererY.new(root, {
          inversed: true,
          cellStartLocation: 0.1,
          cellEndLocation: 0.9
        })
      })
    );
    yAxis.get("renderer").labels.template.setAll({
      fill: am5.color(0xFFFFFF)
    });
    yAxis.data.setAll(topVendors.map(vendor => ({ vendor })));

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "period",
        renderer: am5xy.AxisRendererX.new(root, {}),
        tooltip: am5.Tooltip.new(root, {})
      })
    );
    xAxis.get("renderer").labels.template.setAll({
      fill: am5.color(0xFFFFFF)
    });
    xAxis.data.setAll(periods.map(period => ({ period })));

    // Add series
    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: "Metric",
        xAxis: xAxis,
        yAxis: yAxis,
        valueXField: "value",
        categoryYField: "vendor",
        categoryXField: "period",
        tooltip: am5.Tooltip.new(root, {
          pointerOrientation: "horizontal",
          labelText: "[bold]{categoryY}[/]\n{categoryX}: [bold]{valueX}[/]"
        })
      })
    );

    series.columns.template.setAll({
      strokeOpacity: 0,
      cornerRadiusTL: 3,
      cornerRadiusTR: 3,
      cornerRadiusBL: 3,
      cornerRadiusBR: 3,
    });

    // Set default value for NaN cases (though we've filtered them out)
    series.set("calculateAggregates", true);
    series.set("ignoreMinMax", true);

    // Add color based on value
    series.columns.template.adapters.add("fill", (fill, target) => {
      const value = (target.dataItem?.dataContext as { value?: number })?.value ?? 0;
      if (value <= 0) return am5.color(0xcccccc); // Gray for zero/negative values
      
      // Customize your color ranges here
      if (value < 1000) return am5.color(0x8dd3c7);
      if (value < 5000) return am5.color(0xffffb3);
      if (value < 10000) return am5.color(0xbebada);
      return am5.color(0xfb8072);
    });

    series.data.setAll(validData);

    // Add legend
    const legend = chart.children.push(am5.Legend.new(root, {
      centerX: am5.p50,
      x: am5.p50
    }));
    legend.labels.template.setAll({
      fill: am5.color(0xFFFFFF)
    });
    legend.data.setAll(chart.series.values);

    // Add cursor
    chart.set("cursor", am5xy.XYCursor.new(root, {
      behavior: "zoomXY",
      xAxis: xAxis,
      yAxis: yAxis
    }));

    return () => root.dispose();
  }, [data, view, metric]);

  return <div ref={chartRef} style={{ width: '100%', height: Math.max(600, vendors.length * 40) }} />;
};

export default VendorTimelineChart;