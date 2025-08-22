import React, { useEffect, useRef } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import * as am5themes_Animated from '@amcharts/amcharts5/themes/Animated';

interface CTSDashboardLineChartProps {
  data: any[];
}

const CTSDashboardLineChart: React.FC<CTSDashboardLineChartProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;

    // Process and sort CTS data
    const chartData = data
      .map((item) => {
        const serviceDate = new Date(item['service_month'] || item['vendor_invoice_date'] || '');
        const invoiceAmount = Math.round(
          parseFloat(String(item['total_amount'] || '0').replace(/[^\d.-]/g, ''))
        );
        const receivedAmount = Math.round(
          parseFloat(String(item['payment_recieved'] || '0').replace(/[^\d.-]/g, ''))
        );

        return {
          date: serviceDate.getTime(),
          invoiceAmount: invoiceAmount,
          receivedAmount: receivedAmount,
          margin: invoiceAmount - receivedAmount
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
        baseInterval: { timeUnit: "month", count: 1 },
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: 60
        }),
        tooltip: am5.Tooltip.new(root, {}),
        groupData: true,
        groupCount: 30,
        dateFormats: {
          day: "MMM dd",
          month: "MMM yyyy",
          year: "yyyy"
        },
        periodChangeDateFormats: {
          day: "MMM dd",
          month: "MMM yyyy",
          year: "yyyy"
        }
      })
    );

    // Configure X-axis labels
    xAxis.get("renderer").labels.template.setAll({
      fill: am5.color(0x000000) // Black color for X-axis labels
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {}),
        extraTooltipPrecision: 1
      })
    );

    // Configure Y-axis labels
    yAxis.get("renderer").labels.template.setAll({
      fill: am5.color(0x000000) // Black color for Y-axis labels
    });

    // Create series function
    const createSeries = (field: string, name: string, color: am5.Color, dashArray?: number[]) => {
      const series = chart.series.push(
        am5xy.SmoothedXLineSeries.new(root, {
          name: name,
          xAxis: xAxis,
          yAxis: yAxis,
          valueYField: field,
          valueXField: "date",
          stroke: color,
          fill: field !== 'margin' ? color : undefined,
          
          tooltip: am5.Tooltip.new(root, {
            pointerOrientation: "horizontal",
            getFillFromSprite: false,
            labelText: "[bold]{name}[/]\n{valueX.formatDate('MMM yyyy')}: [bold]₹{valueY.formatNumber('#,##0')}[/]"
          })
        })
      );

      if (dashArray) {
        series.strokes.template.setAll({
          strokeDasharray: dashArray,
          strokeWidth: 2
        });
      } else {
        series.strokes.template.set("strokeWidth", 2);
      }

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
    createSeries("invoiceAmount", "Total Invoice Amount", am5.color("#4E79A7"));
    createSeries("receivedAmount", "Amount Received", am5.color("#59A14F"));
    createSeries("margin", "Margin", am5.color("#E15759"), [3, 3]);

    // Add legend
    const legend = chart.children.push(
      am5.Legend.new(root, {
        centerX: am5.p50,
        x: am5.p50,
        marginTop: 20,
        marginBottom: 20
      })
    );
    legend.data.setAll(chart.series.values);

    // Add scrollbar
    chart.set("scrollbarX", am5.Scrollbar.new(root, {
      orientation: "horizontal"
    }));

    // Configure date formatting
    root.dateFormatter.setAll({
      dateFormat: "MMM yyyy",
      dateFields: ["valueX"]
    });

    // Add title
    const title = chart.children.push(
      am5.Label.new(root, {
        text: "CTS Performance Over Time",
        fontSize: 18,
        fontWeight: "bold",
        textAlign: "center",
        x: am5.percent(50),
        centerX: am5.percent(50),
        paddingTop: 0,
        paddingBottom: 10
      })
    );

    // Animate chart
    chart.appear(1000, 100);

    return () => {
      root.dispose();
    };
  }, [data]);

  return (
    <div className="cts-chart-container bg-white p-4 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold text-gray-800 mb-2">Cost to Serve Analysis</h3>
      <p className="text-sm text-gray-600 mb-4">Tracking invoice amounts, payments received, and margins over time</p>
      <div ref={chartRef} style={{ width: "100%", height: "500px" }}></div>
    </div>
  );
};

export default CTSDashboardLineChart;