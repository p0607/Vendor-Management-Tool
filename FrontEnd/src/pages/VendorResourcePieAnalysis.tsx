import React, { useEffect, useRef, useState } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5percent from "@amcharts/amcharts5/percent";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";

interface Metric {
  key: string;
  label: string;
}

interface Props {
  data: any[];
  metrics?: Metric[];
}

const DEFAULT_METRICS = [
  { key: "base_amt_as_per_tally_vendor", label: "Base Amount" },
  { key: "total_invoice_amount", label: "Total Amount" },
  { key: "margin", label: "Margin" },
  { key: "payment_receive_from_client", label: "Payment Received" },
  { key: "atipl_invoice_base_amount", label: "atipl_invoice_base_amount" },
  { key: "net_receivable", label: "Net Receivable" }
];

const VendorResourcePieAnalysis: React.FC<Props> = ({ data, metrics = DEFAULT_METRICS }) => {
  const chartDiv = useRef<HTMLDivElement>(null);
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  
  // Consistent vendor name normalization
  const normalizeVendorName = (name: any): string => {
    if (!name) return "Unknown Vendor";
    const strName = typeof name === "string" ? name.trim() : String(name).trim();
    return strName || "Unknown Vendor";
  };

  // Prepare main pie data (vendor resource count)
  const vendorResourceData = React.useMemo(() => {
    const counts: Record<string, number> = {};
    data.forEach(item => {
      const vendor = normalizeVendorName(item.vendor_name);
      counts[vendor] = (counts[vendor] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([vendor, value]) => ({
        category: vendor,
        value,
        subData: vendor
      }));
  }, [data]);

  // Prepare sub pie data for a vendor with case-insensitive matching
  const getVendorMetrics = (vendor: string) => {
    const normalizedVendor = normalizeVendorName(vendor);
    const vendorItems = data.filter(item => 
      normalizeVendorName(item.vendor_name) === normalizedVendor
    );
    
    return metrics.map(m => {
      // Try to find the value using different case variations
      const value = vendorItems.reduce((sum, item) => {
        // Try exact key, then lowercase, then with underscores
        const val = item[m.key] || 
                   item[m.key.toLowerCase()] || 
                   item[m.key.replace(/ /g, "_")] ||
                   item[m.key.replace(/_/g, " ")] ||
                   0;
        
        // Parse the value consistently
        if (typeof val === "string") {
          return sum + parseFloat(val.replace(/,/g, "")) || 0;
        }
        return sum + (Number(val) || 0);
      }, 0);
      
      return {
        category: m.label,
        value
      };
    }).filter(item => item.value > 0); // Filter out metrics with zero values
  };

  useEffect(() => {
    if (!chartDiv.current || vendorResourceData.length === 0) return;
    
    let root = am5.Root.new(chartDiv.current);
    root.setThemes([am5themes_Animated.new(root)]);
    
    // Set background color
    root.setThemes([
      am5themes_Animated.new(root)
    ]);
    
    // Add background rectangle
    root.container.children.push(
      am5.Rectangle.new(root, {
        fill: am5.color(0x002542),
        width: am5.p100,
        height: am5.p100
      })
    );

    let container = root.container.children.push(
      am5.Container.new(root, {
        width: am5.p100,
        height: am5.p100,
        layout: root.horizontalLayout
      })
    );

        // Main Pie Chart
    let chart = container.children.push(
      am5percent.PieChart.new(root, {
        background: am5.Rectangle.new(root, {
          fill: am5.color(0x002542)
        }),
        tooltip: am5.Tooltip.new(root, {})
      })
    );

    let series = chart.series.push(
      am5percent.PieSeries.new(root, {
        valueField: "value",
        categoryField: "category",
        alignLabels: false
      })
    );

    // Configure labels
    series.labels.template.setAll({
      textType: "regular",
      radius: 15,
      fontSize: 13,
      maxWidth: 120,
      oversizedBehavior: "truncate",
      textAlign: "center",
      text: "{category}\n{value}",
      fill: am5.color(0xFFFFFF) // White color for labels
    });

    series.ticks.template.set("visible", false);
    series.slices.template.set("toggleKey", "none");

    // Sub Pie Chart
    let subChart = container.children.push(
      am5percent.PieChart.new(root, {
        radius: am5.percent(50),
        tooltip: am5.Tooltip.new(root, {})
      })
    );

    let subSeries = subChart.series.push(
      am5percent.PieSeries.new(root, {
        valueField: "value",
        categoryField: "category",
        alignLabels: true
      })
    );

    // Configure sub pie labels
    subSeries.labels.template.setAll({
      text: "{category}: {valuePercentTotal.formatNumber('0.0')}%",
      radius: 10,
      fontSize: 12,
      textAlign: "center",
      fill: am5.color(0xFFFFFF) // White color for labels
    });
    subSeries.slices.template.set("tooltipText", "{category}: ₹{value.formatNumber('#,##0.00')}");

    // Lines connecting the charts
    let line0 = container.children.push(
      am5.Line.new(root, {
        position: "absolute",
        stroke: root.interfaceColors.get("text"),
        strokeDasharray: [2, 2]
      })
    );
    
    let line1 = container.children.push(
      am5.Line.new(root, {
        position: "absolute",
        stroke: root.interfaceColors.get("text"),
        strokeDasharray: [2, 2]
      })
    );

    let selectedSlice: any | null = null;

    // Function to update connecting lines
    function updateLines() {
      if (selectedSlice) {
        const startAngle = selectedSlice.get("startAngle");
        const arc = selectedSlice.get("arc");
        const radius = selectedSlice.get("radius");

        const x00 = radius * am5.math.cos(startAngle);
        const y00 = radius * am5.math.sin(startAngle);

        const x10 = radius * am5.math.cos(startAngle + arc);
        const y10 = radius * am5.math.sin(startAngle + arc);

        const subRadius = subSeries.slices.getIndex(0)?.get("radius") || 0;
        const x01 = 0;
        const y01 = -subRadius;

        const x11 = 0;
        const y11 = subRadius;

        const point00 = series.toGlobal({ x: x00, y: y00 });
        const point10 = series.toGlobal({ x: x10, y: y10 });

        const point01 = subSeries.toGlobal({ x: x01, y: y01 });
        const point11 = subSeries.toGlobal({ x: x11, y: y11 });

        line0.set("points", [point00, point01]);
        line1.set("points", [point10, point11]);
      }
    }

    // Set up events for updating lines
    series.on("startAngle", function() {
      updateLines();
    });

    container.events.on("boundschanged", function() {
      root.events.once("frameended", function() {
        updateLines();
      });
    });

    // Function to handle slice selection
    function selectSlice(slice: any) {
      selectedSlice = slice;
      const dataItem = slice.dataItem;
      const vendor = (dataItem?.dataContext as { category?: string })?.category;
      
      if (vendor) {
        setSelectedVendor(vendor);
        const metricsData = getVendorMetrics(vendor);
        subSeries.data.setAll(metricsData);
        
        // Animation for rotation
        const middleAngle = slice.get("startAngle") + slice.get("arc") / 2;
        const firstAngle = series.dataItems[0]?.get("slice")?.get("startAngle") || 0;

        series.animate({
          key: "startAngle",
          to: firstAngle - middleAngle,
          duration: 1000,
          easing: am5.ease.out(am5.ease.cubic)
        });
        
        series.animate({
          key: "endAngle",
          to: firstAngle - middleAngle + 360,
          duration: 1000,
          easing: am5.ease.out(am5.ease.cubic)
        });
      }
    }

    // Set initial data
    const initialVendor = vendorResourceData[0]?.category;
    if (initialVendor) {
      setSelectedVendor(initialVendor);
      const metricsData = getVendorMetrics(initialVendor);
      subSeries.data.setAll(metricsData);
      
      // Select the first slice after data is validated
      series.events.once("datavalidated", function() {
        const firstSlice = series.slices.getIndex(0);
        if (firstSlice) {
          selectSlice(firstSlice);
        }
      });
    }

    // Click event for main pie
    series.slices.template.events.on("click", (ev) => {
      if (ev.target) {
        selectSlice(ev.target);
      }
    });

    // Set main pie data
    series.data.setAll(vendorResourceData);

    return () => {
      root.dispose();
    };
  }, [data, metrics, vendorResourceData]);

  return (
    <div>
      {selectedVendor && (
        <div className="text-center mb-2">
          <span className="font-semibold">Showing metrics for: </span>
          <span className="text-blue-600">{selectedVendor}</span>
        </div>
      )}
      <div ref={chartDiv} style={{ width: "100%", height: "500px" }} />
    </div>
  );
};

export default VendorResourcePieAnalysis;