import React, { useEffect, useState } from "react";
import axios from "axios";
import * as am5 from "@amcharts/amcharts5";
import * as am5percent from "@amcharts/amcharts5/percent";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { formatValueByFieldType } from "../utils/formatUtils";

interface ReportData {
  particulars: string;
  amount: number;
  month: string; // "2024-04-01"
}


interface QuarterlyPieChartProps {
  data: ReportData[];
  selectedParticular?: string | null;
}

const getQuarter = (month: string): string => {
  const m = new Date(month).getMonth() + 1;
  if (m >= 1 && m <= 3) return "Q4";       // Jan-Mar
  if (m >= 4 && m <= 6) return "Q1";       // Apr-Jun
  if (m >= 7 && m <= 9) return "Q2";       // Jul-Sep
  return "Q3";                             // Oct-Dec
};

const targetParticulars = ["NET MARGIN", "REVENUE", "GPM", "TEAM COST"];

const QuarterlyPieChart: React.FC<QuarterlyPieChartProps> = ({ data, selectedParticular }) => {
  //const [data, setData] = useState<ReportData[]>([]);
  const [selected, setSelected] = useState<string>(selectedParticular || "REVENUE");

  // Update selected when selectedParticular changes
  useEffect(() => {
    if (selectedParticular) {
      setSelected(selectedParticular);
    }
  }, [selectedParticular]);

   useEffect(() => {
    if (data.length === 0) return;

    const filtered = data.filter(item =>
      item.particulars.toUpperCase() === selected.toUpperCase()
    );

    const quarterlySums: Record<string, number> = {};

    filtered.forEach(item => {
      const quarter = getQuarter(item.month);
      quarterlySums[quarter] = (quarterlySums[quarter] || 0) + Number(item.amount);
    });

    const chartData = Object.entries(quarterlySums).map(([quarter, amount]) => ({
      category: quarter,
      value: amount,
      formattedValue: formatValueByFieldType(amount, selected)
    }));

    am5.array.each(am5.registry.rootElements, function(root) {
      if (root.dom.id === "quarterlyPie") root.dispose();
    });

    const root = am5.Root.new("quarterlyPie");

    root.setThemes([am5themes_Animated.new(root)]);

    const chart = root.container.children.push(
      am5percent.PieChart.new(root, {
        layout: root.verticalLayout
      })
    );

    const series = chart.series.push(
      am5percent.PieSeries.new(root, {
        valueField: "value",
        categoryField: "category",
        tooltip: am5.Tooltip.new(root, {
          labelText: "{category}: {formattedValue}"
        })
      })
    );

    series.labels.template.setAll({
      fill: am5.color(0x000000)
    });

    series.data.setAll(chartData);
    series.appear(1000, 100);

    return () => {
      root.dispose();
    };
  }, [data, selected]);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4" style={{ color: '#ffffff' }}>Quarterly Pie Chart ({selected})</h2>
      <select
        className="mb-4 p-2 border rounded"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
      >
        {targetParticulars.map((part) => (
          <option key={part} value={part}>{part}</option>
        ))}
      </select>
      <div id="quarterlyPie" style={{ width: "100%", height: "500px" }}></div>
    </div>
  );
};

export default QuarterlyPieChart;