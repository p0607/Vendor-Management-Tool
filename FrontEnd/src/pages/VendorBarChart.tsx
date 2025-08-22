import React, { useEffect, useRef, useState } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import * as am5themes_Animated from '@amcharts/amcharts5/themes/Animated';

interface VendorData {
  vendorName: string;
  value: number;
}

interface VendorBarChartProps {
  data: VendorData[];
  onVendorClick?: (vendorName: string) => void;
}

const VendorBarChart: React.FC<VendorBarChartProps> = ({ data, onVendorClick }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  useEffect(() => {
    // 1. Check if container exists and we have data
    if (!chartRef.current || data.length === 0) return;

    //Aggregate data by vendorName
  const aggregatedData = data.reduce((acc: VendorData[], item) => {
    const existing = acc.find(d => d.vendorName === item.vendorName);
    if (existing) {
      existing.value += item.value; // Sum the values for the same vendor
    } else {
      acc.push({ vendorName: item.vendorName, value: item.value });
    }
    return acc;
  }, []);

     // 2. Sort the aggregated data
     const sortedData = [...aggregatedData].sort((a, b) =>
      sortDirection === 'desc' ? a.value - b.value : b.value - a.value
    );
    // 3. Create root element
    const root = am5.Root.new(chartRef.current);
    root._logo?.dispose();
    
    // 4. Set theme
    root.setThemes([am5themes_Animated.default.new(root)]);

    // 5. Create chart
    const chart = root.container.children.push(am5xy.XYChart.new(root, {
      layout: root.verticalLayout,
      panX: true,
      panY: true,
      wheelX: "panX",
      wheelY: "zoomX",
      pinchZoomX: true,
      paddingLeft: 0,
      background: am5.Rectangle.new(root, {
        fill: am5.color(0xFFFFFF) // White background
      })
    }));

    // 6. Add cursor
    const cursor = chart.set("cursor", am5xy.XYCursor.new(root, {}));
    cursor.lineX.set("visible", false);

    // 7. Create Y-axis (categories)
    const yAxis = chart.yAxes.push(am5xy.CategoryAxis.new(root, {
      categoryField: "vendorName",
      renderer: am5xy.AxisRendererY.new(root, {
        minGridDistance: 10, // Reduce distance for denser labels
        strokeOpacity: 0     // Hide axis line
      })
    }));

    yAxis.get("renderer").labels.template.setAll({
      oversizedBehavior: "wrap",
      textAlign: "center",
      fontSize: 14,
      cursorOverStyle: "pointer",
      fill: am5.color(0x000000) // Black color for labels
    });

     yAxis.get("renderer").grid.template.setAll({
      visible: false
    });

    // 8. Create X-axis (values)
    const xAxis = chart.xAxes.push(am5xy.ValueAxis.new(root, {
      renderer: am5xy.AxisRendererX.new(root, {
        strokeOpacity: 0, // Hide axis line
           // Remove grid lines
      })
    }));

    // Remove X-axis grid lines
    xAxis.get("renderer").grid.template.setAll({
      visible: false
    });

    // 9. Create series
    const series = chart.series.push(am5xy.ColumnSeries.new(root, {
      xAxis: xAxis,
      yAxis: yAxis,
      valueXField: "value",
      categoryYField: "vendorName",
      tooltip: am5.Tooltip.new(root, {
        labelText: "{vendorName}: ₹{valueX}"
      })
    }));

    series.columns.template.setAll({
      cursorOverStyle: "pointer",
      width: am5.percent(95), // Broader bars
      fillOpacity: 0.9,
      strokeOpacity: 0.2,
      cornerRadiusTL: 8,
      cornerRadiusTR: 8
    });
    // 10. Add click events
    series.columns.template.events.on("click", (ev) => {
      const dataItem = ev.target.dataItem as am5.DataItem<am5xy.IXYSeriesDataItem>;
      if (dataItem && onVendorClick) {
        onVendorClick(dataItem.get("categoryY") as string);
      }
    });

    // 11. Set data
    yAxis.data.setAll(sortedData); // Ensure Y-axis has all vendor names
  series.data.setAll(sortedData);

    // 12. Animate
    series.appear(1000);
    chart.appear(1000, 100);

    // 13. Cleanup
    return () => {
      root.dispose();
    };
  }, [data, sortDirection, onVendorClick]);

  return (
    <div className="vendor-chart-container">
      <div className="chart-header">
        <h3>Vendor Performance Overview (Alchemy Billing Value)</h3>
        <button 
          onClick={() => setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc')}
          className="sort-button"
        >
          {sortDirection === 'desc' ? '▼' : '▲'}
          Sort {sortDirection === 'desc' ? 'Ascending' : 'Descending'}
        </button>
      </div>
      <div 
        ref={chartRef} 
        style={{ 
          width: "100%", 
          height: "1000px",
          minHeight: "600px",
          backgroundColor: "white" // White background
        }}
      />
    </div>
  );
};

export default VendorBarChart;