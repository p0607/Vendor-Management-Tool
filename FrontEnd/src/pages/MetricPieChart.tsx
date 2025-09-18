import * as am5 from "@amcharts/amcharts5";
import * as am5percent from "@amcharts/amcharts5/percent";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import React, { useLayoutEffect, useRef } from "react";

const MetricPieChart: React.FC<{ data: { field: string; sum: number; percent: number }[] }> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);

  useLayoutEffect(() => {
    let root: am5.Root | null = null;
    let chart: am5percent.PieChart | null = null;
    let series: am5percent.PieSeries | null = null;

    if (chartRef.current) {
      // Create root element
      root = am5.Root.new(chartRef.current);
      rootRef.current = root;
      root.setThemes([am5themes_Animated.new(root)]);

      // Create chart
      chart = root.container.children.push(
        am5percent.PieChart.new(root, {
          layout: root.verticalLayout,
        })
      );

      // Create series
      series = chart.series.push(
        am5percent.PieSeries.new(root, {
          valueField: "sum",
          categoryField: "field",
          alignLabels: true,
        })
      );
    }

    return () => {
      // Clean up on unmount or data change
      if (root) {
        root.dispose();
      }
      rootRef.current = null;
    };
  }, []); // Empty dependency array - runs only once on mount

  useLayoutEffect(() => {
    if (!chartRef.current) return;

    // Get existing root element
    const root = rootRef.current;
    if (!root) return;

    // Get the first series (we know there's only one)
    const chart = root.container.children.getIndex(0) as am5percent.PieChart | undefined;
    const series = chart?.series.getIndex(0) as am5percent.PieSeries | undefined;
    if (!series) return;

    // Update data
    series.data.setAll(
      data.map(item => ({
        ...item,
        percent: item.percent,
      }))
    );

    // Configure labels and tooltips
    series.labels.template.setAll({
      text: "{category}: {percent.formatNumber('0.0')}%",
      fontSize: 14,
      fill: am5.color(0x000000), // Black color for labels
    });

    series.slices.template.setAll({
      tooltipText: "{category}: {value.formatNumber('#,##0')} ({percent.formatNumber('0.0')}%)",
      cursorOverStyle: "pointer",
    });

    // Animate the update
    series.appear(1000, 100);

  }, [data]); // Runs whenever data changes

  return <div ref={chartRef} style={{ width: "100%", height: "350px" }} />;
};

export default MetricPieChart;