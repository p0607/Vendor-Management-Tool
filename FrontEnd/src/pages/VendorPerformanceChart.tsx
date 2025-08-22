import React, { useEffect, useRef, useState } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import * as am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import * as am5percent from "@amcharts/amcharts5/percent";

const METRIC_OPTIONS = [
  { value: "payment_receive_from_client", label: "payment_receive_from_client" },
  { value: "base_amt_as_per_tally_vendor", label: "base_amt_as_per_tally_vendor" },
  { value: "margin", label: "Margin" },
  { value: "atipl_invoice_base_amount", label: "ATIPL Invoice Base Amount" },
  { value: "total_invoice_amount", label: "Total Invoice Amount" },
  { value: "resource_count", label: "Resource Count" },
];

interface VendorPerformanceChartProps {
  data: any[];
  selectedMetric?: string;
}

const VendorPerformanceChart: React.FC<VendorPerformanceChartProps> = ({ data, selectedMetric }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const detailChartRef = useRef<HTMLDivElement>(null);
  const [metric, setMetric] = useState(selectedMetric || METRIC_OPTIONS[0].value);
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [showDetailChart, setShowDetailChart] = useState(false);

  const parseValue = (val: any) => {
    if (!val) return 0;
    if (typeof val === "number") return val;
    return parseFloat(val.toString().replace(/,/g, "")) || 0;
  };

  // Main chart effect
  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;

    // Clean up previous chart
    am5.array.each(am5.registry.rootElements, function(root) {
      if (root.dom === chartRef.current) root.dispose();
    });

    const root = am5.Root.new(chartRef.current);
    root.setThemes([am5themes_Animated.default.new(root)]);

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: true,
        wheelX: "panX",
        wheelY: "zoomX",
        layout: root.verticalLayout,
        background: am5.Rectangle.new(root, {
          fill: am5.color(0xFFFFFF)
        })
      })
    );

    // Prepare data
    const vendorMap: Record<string, number> = {};
    
    if (metric === "resource_count") {
      // For resource count, count total records per vendor (matching pivot table logic)
      data.forEach(item => {
        const vendor = item["vendor_name"]?.trim() || "Unknown Vendor";
        vendorMap[vendor] = (vendorMap[vendor] || 0) + 1;
      });
    } else {
      // For other metrics, sum the values
      data.forEach(item => {
        const vendor = item["vendor_name"]?.trim() || "Unknown Vendor";
        const value = parseValue(
          item[metric] ||
          item[metric.toLowerCase()] ||
          item[metric.replace(/ /g, "_")] ||
          0
        );
        vendorMap[vendor] = (vendorMap[vendor] || 0) + value;
      });
    }

    const chartData = Object.entries(vendorMap)
      .map(([vendor, value]) => ({ vendor, value }))
      .sort((a, b) => b.value - a.value);

    // Y axis
    const yAxis = chart.yAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "vendor",
        renderer: am5xy.AxisRendererY.new(root, {
          inversed: true
        })
      })
    );
    
    // Set black labels for Y axis
    yAxis.get("renderer").labels.template.setAll({
      fill: am5.color(0x000000)
    });
    yAxis.data.setAll(chartData);

    // X axis
    const xAxis = chart.xAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererX.new(root, {}),
        numberFormat: metric === "resource_count" ? "#,##0" : "₹#,##0.00"
      })
    );
    
    // Set black labels for X axis
    xAxis.get("renderer").labels.template.setAll({
      fill: am5.color(0x000000)
    });

    // Series
    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: metric,
        xAxis,
        yAxis,
        valueXField: "value",
        categoryYField: "vendor",
        tooltip: am5.Tooltip.new(root, {
          labelText: metric === "resource_count" 
            ? "{categoryY}: {valueX.formatNumber('#,##0')} resources"
            : "{categoryY}: ₹{valueX.formatNumber('#,##0.00')}"
        })
      })
    );

    series.columns.template.setAll({
      width: am5.percent(70),
      cornerRadiusTL: 5,
      cornerRadiusTR: 5,
      tooltipText: metric === "resource_count" 
        ? "{categoryY}: {valueX.formatNumber('#,##0')} resources"
        : "{categoryY}: ₹{valueX.formatNumber('#,##0.00')}",
      interactive: true,
      cursorOverStyle: "pointer"
    });

    // Add click event to bars
     series.columns.template.events.on("click", (ev) => {
      const dataItem = ev.target.dataItem;
      if (dataItem) {
        const vendor = (dataItem.dataContext as { vendor?: string })?.vendor ?? "Unknown Vendor";
        setSelectedVendor(vendor);
        setShowDetailChart(true);
      }
    });

    series.data.setAll(chartData);
    chart.set("cursor", am5xy.XYCursor.new(root, {}));

    return () => root.dispose();
  }, [data, metric]);

  // Detail chart effect
  useEffect(() => {
    if (!detailChartRef.current || !selectedVendor || !showDetailChart) return;

    am5.array.each(am5.registry.rootElements, function(root) {
  if (root.dom === detailChartRef.current) root.dispose();
});

const root = am5.Root.new(detailChartRef.current);
root.setThemes([am5themes_Animated.default.new(root)]);

const chart = root.container.children.push(
  am5percent.PieChart.new(root, {
    layout: root.verticalLayout,
    innerRadius: am5.percent(60) // This makes it a donut chart
  })
);

// Filter data for selected vendor
const vendorData = data.filter(item => 
  (item["vendor_name"]?.trim() || "Unknown Vendor") === selectedVendor
);

// Prepare metrics data for the selected vendor
const metricsData = METRIC_OPTIONS.map(option => {
  let total = 0;
  
  if (option.value === "resource_count") {
    // For resource count, count total records (matching pivot table logic)
    total = vendorData.length;
  } else {
    // For other metrics, sum the values
    total = vendorData.reduce((sum, item) => {
      const value = parseValue(
        item[option.value] ||
        item[option.value.toLowerCase()] ||
        item[option.value.replace(/ /g, "_")] ||
        0
      );
      return sum + value;
    }, 0);
  }
  
  return {
    metric: option.label,
    value: total
  };
});

const pieSeries = chart.series.push(
  am5percent.PieSeries.new(root, {
    valueField: "value",
    categoryField: "metric",
    legendLabelText: "{category}: [bold]{value}[/]",
    tooltipText: "{category}: {value}"
  })
);

pieSeries.slices.template.set("tooltipText", "{category}: {value}");

// Set black labels for pie chart
pieSeries.labels.template.setAll({
  fill: am5.color(0x000000),
  fontWeight: "bold"
});

pieSeries.data.setAll(metricsData);

const legend = chart.children.push(
  am5.Legend.new(root, {
    centerX: am5.percent(50),
    x: am5.percent(50)
  })
);

// Set black labels for legend
legend.labels.template.setAll({
  fill: am5.color(0x000000)
});

    // Pie chart already created above, and pieSeries is set up with metricsData.
    // No XY axes or column series needed for PieChart.

    return () => root.dispose();
  }, [selectedVendor, showDetailChart, data]);

  return (
    <div>
      <select
        className="mb-4 p-2 border rounded"
        value={metric}
        onChange={e => setMetric(e.target.value)}
        style={{ marginBottom: 16 }}
      >
        {METRIC_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      
      <div ref={chartRef} style={{ width: "100%", height: "500px" }} />
      
      {showDetailChart && selectedVendor && (
        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">
              Detailed Metrics for: {selectedVendor}
            </h3>
            <button 
              onClick={() => setShowDetailChart(false)}
              className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
            >
              Close
            </button>
          </div>
          <div ref={detailChartRef} style={{ width: "100%", height: "500px" }} />
        </div>
      )}
    </div>
  );
};

export default VendorPerformanceChart;