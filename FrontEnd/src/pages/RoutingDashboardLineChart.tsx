import React, { useEffect, useRef } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import * as am5themes_Animated from '@amcharts/amcharts5/themes/Animated';


interface RoutingDashboardLineChartProps {
  data: any[];
}

const RoutingDashboardLineChart: React.FC<RoutingDashboardLineChartProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;

    // Process and sort data
    const chartData = data
      .map((item) => {
        const billingDate = new Date(item['Billing Date'] || '');
        const vendorPayout = Math.round(
          parseFloat(String(item['Vendor Payout'] || '0').replace(/[^\d.-]/g, ''))
        );
        const alchemyBilling = Math.round(
          parseFloat(String(item['Alchemy Billing Value'] || '0').replace(/[^\d.-]/g, ''))
        );

        return {
          date: billingDate.getTime(),
          vendorPayout: vendorPayout,
          alchemyBilling: alchemyBilling,
        };
      })
      .filter((item) => !isNaN(item.date))
      .sort((a, b) => a.date - b.date);

    // Create root and chart
    const root = am5.Root.new(chartRef.current);
    root._logo?.dispose();

    root.setThemes([am5themes_Animated.default.new(root)]);

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: true,
        wheelX: "panX",
        wheelY: "zoomX",
        pinchZoomX: true,
        layout: root.verticalLayout
      })
    );

    // Add cursor
    const cursor = chart.set("cursor", am5xy.XYCursor.new(root, {}));
    cursor.lineY.set("visible", false);

    // Create axes
    const xAxis = chart.xAxes.push(
      am5xy.DateAxis.new(root, {
        baseInterval: { timeUnit: "day", count: 1 },
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: 60
        }),
        tooltip: am5.Tooltip.new(root, {})
      })
    );

    // Configure X-axis labels
    xAxis.get("renderer").labels.template.setAll({
      fill: am5.color(0x000000) // Black color for X-axis labels
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {})
      })
    );

    // Configure Y-axis labels
    yAxis.get("renderer").labels.template.setAll({
      fill: am5.color(0x000000) // Black color for Y-axis labels
    });

    // Create series function
    const createSeries = (field: string, name: string, color: am5.Color) => {
      const series = chart.series.push(
        am5xy.SmoothedXLineSeries.new(root, {
          name: name,
          xAxis: xAxis,
          yAxis: yAxis,
          valueYField: field,
          valueXField: "date",
          stroke: color,
          tooltip: am5.Tooltip.new(root, {
            pointerOrientation: "horizontal",
            getFillFromSprite: false,
            labelText: "[bold]{name}[/]\n{valueX}: [bold]₹{valueY}[/]"
          })
        })
      );

      series.strokes.template.set("strokeWidth", 2);
      series.data.setAll(chartData);

      const tooltip = series.get("tooltip");
      const background = tooltip?.get("background");
      if (background) {
        background.setAll({
          fill: color,
          fillOpacity: 0.7
        });
      }

      return series;
    };

    // Create series with distinct colors
    createSeries("vendorPayout", "Vendor Payout", am5.color("#FF6B6B"));
    createSeries("alchemyBilling", "Alchemy Billing", am5.color("#4ECDC4"));

    // Add legend
    const legend = chart.children.push(
      am5.Legend.new(root, {
        centerX: am5.p50,
        x: am5.p50
      })
    );
    legend.data.setAll(chart.series.values);

    // Configure date formatting
    root.dateFormatter.setAll({
      dateFormat: "yyyy-MM-dd",
      dateFields: ["valueX"]
    });

    // Animate chart
    chart.appear(1000, 100);

    return () => {
      root.dispose();
    };
  }, [data]);

  return (
    <div className="chart-container">
      <h3>Billing Timeline Overview</h3>
      <div ref={chartRef} style={{ width: "100%", height: "500px" }}></div>
    </div>
  );
};

export default RoutingDashboardLineChart;