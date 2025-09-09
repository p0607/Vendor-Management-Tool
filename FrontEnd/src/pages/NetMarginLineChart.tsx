import React, { useEffect, useState } from "react";
import axios from "axios";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { formatValueByFieldType } from "../utils/formatUtils";

interface ReportData {
  particulars: string;
  amount: number;
  month: string; // e.g., "2024-04-01"
}

interface NetMarginLineChartProps {
  data: ReportData[];
  selectedParticular?: string | null;
}

const NetMarginLineChart: React.FC<NetMarginLineChartProps> = ({ data, selectedParticular }) => {
  
  useEffect(() => {
    const targetParticular = selectedParticular || "NET MARGIN";
    const filtered = data
      .filter((d) => d.particulars && d.particulars.toUpperCase() === targetParticular.toUpperCase())
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

    const chartData = filtered.map((item) => ({
      date: new Date(item.month).getTime(),
      value: Number(item.amount) || 0,
      formattedValue: formatValueByFieldType(Number(item.amount) || 0, targetParticular)
    }));

    am5.array.each(am5.registry.rootElements, function(root) {
      if (root && root.dom && root.dom.id === "netMarginLine") root.dispose();
    });

    const root = am5.Root.new("netMarginLine");
    root.setThemes([am5themes_Animated.new(root)]);

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        layout: root.verticalLayout
      })
    );

    const xAxis = chart.xAxes.push(
      am5xy.DateAxis.new(root, {
        maxDeviation: 0.2,
        baseInterval: { timeUnit: "month", count: 1 },
        renderer: am5xy.AxisRendererX.new(root, {}),
        tooltip: am5.Tooltip.new(root, {})
      })
    );
    xAxis.get("renderer").labels.template.setAll({
      fill: am5.color(0x000000)
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {})
      })
    );
    yAxis.get("renderer").labels.template.setAll({
      fill: am5.color(0x000000)
    });

    const series = chart.series.push(
      am5xy.LineSeries.new(root, {
        name: "Net Margin",
        xAxis,
        yAxis,
        valueYField: "value",
        valueXField: "date",
        tooltip: am5.Tooltip.new(root, {
          labelText: "{formattedValue} on {valueX.formatDate('MMM yyyy')}"
        })
      })
    );

    series.data.setAll(chartData);

    chart.set("cursor", am5xy.XYCursor.new(root, {}));

    return () => {
      root.dispose();
    };
  }, [data]);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4" style={{ color: '#ffffff' }}>
        {selectedParticular ? `${selectedParticular} Trend Over Time` : 'Net Margin Trend Over Time'}
      </h2>
      <div id="netMarginLine" style={{ width: "100%", height: "500px" }}></div>
    </div>
  );
};

export default NetMarginLineChart;
