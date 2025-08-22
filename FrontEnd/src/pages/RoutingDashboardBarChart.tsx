import React, { useEffect, useRef } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import * as am5themes_Animated from '@amcharts/amcharts5/themes/Animated';

interface MonthlyBillingData {
  billingMonth: string;
  alchemyBilling: number;
  integratorCharges: number;
  fundingCost: number;
  netMargin: number;
}

interface RoutingDashboardBarChartProps {
  data: MonthlyBillingData[];
}

const RoutingDashboardBarChart: React.FC<RoutingDashboardBarChartProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;

    // Create root element
    const root = am5.Root.new(chartRef.current);
    root._logo?.dispose(); // Prevent potential logo-related issues
    
    // Set themes
    root.setThemes([
      am5themes_Animated.default.new(root)
    ]);

    // Create chart
    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: false,
        panY: false,
        wheelX: "panX",
        wheelY: "zoomX",
        paddingLeft: 0,
        layout: root.verticalLayout
      })
    );

    // Add scrollbar
    chart.set(
      "scrollbarX",
      am5.Scrollbar.new(root, {
        orientation: "horizontal"
      })
    );

    // Create X-axis
    const xRenderer = am5xy.AxisRendererX.new(root, {
      minGridDistance: 30,
      cellStartLocation: 0.1,
      cellEndLocation: 0.9
    });
    
    xRenderer.labels.template.setAll({
      fontSize: "1rem",
      paddingTop: 5,
      fill: am5.color(0xFFFFFF) // White color for X-axis labels
    });

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "billingMonth",
        renderer: xRenderer,
        tooltip: am5.Tooltip.new(root, {})
      })
    );

    xAxis.data.setAll(data);

    // Create Y-axis with explicit renderer
    const yRenderer = am5xy.AxisRendererY.new(root, {
      strokeOpacity: 0.1
    });
    
    yRenderer.labels.template.setAll({
      fontSize: "1rem",
      fill: am5.color(0xFFFFFF) // White color for Y-axis labels
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        min: 0,
        extraMax: 0.1,
        renderer: yRenderer
      })
    );

    // Add series function
    const createSeries = (name: string, field: string, color: am5.Color) => {
      const series = chart.series.push(
        am5xy.ColumnSeries.new(root, {
          name: name,
          xAxis: xAxis,
          yAxis: yAxis,
          valueYField: field,
          categoryXField: "billingMonth",
          clustered: true,
          tooltip: am5.Tooltip.new(root, {
            pointerOrientation: "horizontal",
            labelText: "{name}: ₹{valueY}"
          })
        })
      );

      series.columns.template.setAll({
        fill: color,
        stroke: color,
        width: am5.percent(80),
        cornerRadiusTL: 4,
        cornerRadiusTR: 4
      });
      
      // Change tooltip text size
      const tooltip = series.get("tooltip");
      if (tooltip) {
        tooltip.label.setAll({
          fontSize: "0.8rem", // Set the desired font size for the tooltip text
          fill: am5.color(0xffffff) // Optional: Set text color to white
        });
      }
      
      series.data.setAll(data);
      return series;
    };

    // Create series for each metric with distinct colors
    const colors = am5.ColorSet.new(root, {
      colors: [
        am5.color("#4ECDC4"), // Alchemy Billing Value
        am5.color("#FF6B6B"), // Integrator Charges
        am5.color("#45B7D1"), // Funding Cost
        am5.color("#96CEB4")  // Net Margin
      ]
    });
    
    createSeries("Alchemy Billing Value", "alchemyBilling", colors.next());
    createSeries("Integrator Charges", "integratorCharges", colors.next());
    createSeries("Funding Cost", "fundingCost", colors.next());
    createSeries("Net Margin", "netMargin", colors.next());

    // Add legend
    const legend = chart.children.push(
      am5.Legend.new(root, {
        centerX: am5.p50,
        x: am5.p50,
        marginTop: 20,
        marginBottom: 20
      })
    );
    
    // Change the size of legend text
    legend.labels.template.setAll({
      fontSize: "0.8rem", // Set the desired font size for legend text
      fill: am5.color(0xFFFFFF) // White color for legend labels
    });
    
    legend.data.setAll(chart.series.values);

    // Add cursor
    chart.set("cursor", am5xy.XYCursor.new(root, {}));

    // Make chart animate on load
    chart.appear(1000, 100);

    return () => {
      root.dispose();
    };
  }, [data]);

  return (
    <div className="chart-container">
      <h3>Monthly Billing Overview</h3>
      <div ref={chartRef} style={{ width: "100%", height: "400px" }}></div>
    </div>
  );
};

export default RoutingDashboardBarChart;