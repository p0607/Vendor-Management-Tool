import React, { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { Select } from 'antd';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import {
  CLIENT_GROWTH_PARAMETERS,
  getCurrentFinancialYearForGrowthChart,
  normalizeToFullMonthNameForGrowth,
  getMonthKeyForGrowth
} from './ClientWiseGrowthChart';
import './ClientWiseGrowthChart.css';

const MONTH_ABBR = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const SERIES_COLORS = [0x1890ff, 0x52c41a, 0xff4d4f, 0xfaad14, 0x722ed1, 0x13c2c2, 0xeb2f96, 0x597ef7];

type Props = {
  data: any[];
  businessUnit: string;
  chartId?: string;
};

export default function ClientWiseGrowthChartSection({ data, businessUnit, chartId = 'clientGrowthChartInline' }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);

  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedParameters, setSelectedParameters] = useState<string[]>(['revenue']);
  const [periodType, setPeriodType] = useState<'year' | 'quarter' | 'month'>('year');
  const [selectedYears, setSelectedYears] = useState<number[]>([getCurrentFinancialYearForGrowthChart()]);
  const [selectedQuarters, setSelectedQuarters] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
  const [isChartVisible, setIsChartVisible] = useState(true);

  const filteredByBU = data;

  const clientList = useMemo(() => {
    const set = new Set<string>();
    filteredByBU.forEach((item: any) => {
      const c = (item.client_name ?? '').toString().trim();
      if (c) set.add(c);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [filteredByBU]);

  const effectiveClients = useMemo(() => {
    if (selectedClients.length === 0) return clientList;
    return selectedClients.filter((c) => clientList.includes(c));
  }, [clientList, selectedClients]);

  const effectiveParameters = useMemo(() => {
    if (selectedParameters.length === 0) return ['revenue'];
    return selectedParameters.filter((p) => CLIENT_GROWTH_PARAMETERS.some((x) => x.key === p));
  }, [selectedParameters]);

  const yearOptions = useMemo(() => {
    const currentFY = getCurrentFinancialYearForGrowthChart();
    const arr: number[] = [];
    for (let i = 0; i < 5; i++) arr.push(currentFY - i);
    return arr;
  }, []);

  const quarterOptions = useMemo(() => {
    const currentFY = getCurrentFinancialYearForGrowthChart();
    const arr: string[] = [];
    for (let i = 0; i < 3; i++) {
      const y = currentFY - i;
      arr.push(`Q1(Apr-Jun) ${y}`, `Q2(Jul-Sep) ${y}`, `Q3(Oct-Dec) ${y}`, `Q4(Jan-Mar) ${y + 1}`);
    }
    return arr;
  }, []);

  const monthOptions = useMemo(() => {
    const currentFY = getCurrentFinancialYearForGrowthChart();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const arr: string[] = [];
    for (let i = 3; i < 12; i++) arr.push(`${monthNames[i]} ${currentFY}`);
    for (let i = 0; i < 3; i++) arr.push(`${monthNames[i]} ${currentFY + 1}`);
    for (let i = 3; i < 12; i++) arr.push(`${monthNames[i]} ${currentFY - 1}`);
    for (let i = 0; i < 3; i++) arr.push(`${monthNames[i]} ${currentFY}`);
    return arr;
  }, []);

  const periodLabelsAndKeys = useMemo(() => {
    const result: { key: string; label: string }[] = [];
    if (periodType === 'year' && selectedYears.length > 0) {
      const order = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
      const all: { key: string; label: string }[] = [];
      selectedYears.forEach((fyStart) => {
        order.forEach((monthNum) => {
          const y = monthNum >= 4 ? fyStart : fyStart + 1;
          all.push({
            key: `${y}-${String(monthNum).padStart(2, '0')}`,
            label: `${MONTH_ABBR[monthNum]} ${y}`
          });
        });
      });
      all.sort((a, b) => a.key.localeCompare(b.key));
      result.push(...all);
    } else if (periodType === 'quarter' && selectedQuarters.length > 0) {
      const monthAbbrToNum: { [key: string]: number } = {
        'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
        'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
      };
      const all: { key: string; label: string }[] = [];
      selectedQuarters.forEach((periodValue) => {
        const match = periodValue.match(/Q(\d)/);
        const yearMatch = periodValue.match(/(\d{4})/);
        if (match && yearMatch) {
          const q = parseInt(match[1], 10);
          const y = parseInt(yearMatch[1], 10);
          const quarterMonths: { [key: number]: number[] } = {
            1: [4, 5, 6], 2: [7, 8, 9], 3: [10, 11, 12], 4: [1, 2, 3]
          };
          (quarterMonths[q] || []).forEach((m) => {
            all.push({ key: `${y}-${String(m).padStart(2, '0')}`, label: `${MONTH_ABBR[m]} ${y}` });
          });
        }
      });
      all.sort((a, b) => a.key.localeCompare(b.key));
      result.push(...all);
    } else if (periodType === 'month' && selectedMonths.length > 0) {
      const monthAbbrToNum: { [key: string]: number } = {
        'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
        'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
      };
      selectedMonths.sort((a, b) => {
        const [aM, aY] = a.split(' ');
        const [bM, bY] = b.split(' ');
        const aNum = monthAbbrToNum[aM] ?? 0;
        const bNum = monthAbbrToNum[bM] ?? 0;
        const aYear = parseInt(aY, 10);
        const bYear = parseInt(bY, 10);
        const aFY = (aNum >= 4) ? aYear : aYear - 1;
        const bFY = (bNum >= 4) ? bYear : bYear - 1;
        if (aFY !== bFY) return aFY - bFY;
        return aNum - bNum;
      });
      selectedMonths.forEach((m) => {
        const [monthAbbr, yearStr] = m.split(' ');
        const monthNum = monthAbbrToNum[monthAbbr] ?? 0;
        const year = parseInt(yearStr, 10);
        result.push({ key: `${year}-${String(monthNum).padStart(2, '0')}`, label: m });
      });
    }
    return result;
  }, [periodType, selectedYears, selectedQuarters, selectedMonths]);

  const previousPeriodKeys = useMemo(() => {
    const keys: string[] = [];
    if (periodType === 'year' && selectedYears.length > 0) {
      const order = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
      selectedYears.forEach((fyStart) => {
        const prevFy = fyStart - 1;
        order.forEach((monthNum) => {
          const y = monthNum >= 4 ? prevFy : prevFy + 1;
          keys.push(`${y}-${String(monthNum).padStart(2, '0')}`);
        });
      });
    } else if (periodType === 'quarter' && selectedQuarters.length > 0) {
      selectedQuarters.forEach((periodValue) => {
        const match = periodValue.match(/Q(\d)/);
        const yearMatch = periodValue.match(/(\d{4})/);
        if (match && yearMatch) {
          const q = parseInt(match[1], 10);
          const y = parseInt(yearMatch[1], 10);
          const prevYear = y - 1;
          const quarterMonths: { [key: number]: number[] } = {
            1: [4, 5, 6], 2: [7, 8, 9], 3: [10, 11, 12], 4: [1, 2, 3]
          };
          (quarterMonths[q] || []).forEach((m) => keys.push(`${prevYear}-${String(m).padStart(2, '0')}`));
        }
      });
    } else if (periodType === 'month' && selectedMonths.length > 0) {
      const monthAbbrToNum: { [key: string]: number } = {
        'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
        'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
      };
      selectedMonths.forEach((m) => {
        const [monthAbbr, yearStr] = m.split(' ');
        const monthNum = monthAbbrToNum[monthAbbr] ?? 0;
        const year = parseInt(yearStr, 10) - 1;
        keys.push(`${year}-${String(monthNum).padStart(2, '0')}`);
      });
    }
    return keys;
  }, [periodType, selectedYears, selectedQuarters, selectedMonths]);

  const chartData = useMemo(() => {
    if (!periodLabelsAndKeys.length || effectiveParameters.length === 0) return [];

    const currentKeysSet = new Set(periodLabelsAndKeys.map((p) => p.key));
    const getVal = (item: any, paramKey: string): number => {
      const v = item[paramKey];
      if (v == null) return 0;
      const n = typeof v === 'number' ? v : parseFloat(String(v));
      return isNaN(n) ? 0 : n;
    };

    const multiClientMonthView = effectiveClients.length >= 2;
    if (multiClientMonthView) {
      const out: { period: string; [key: string]: any }[] = [];
      const paramKey = effectiveParameters[0];
      periodLabelsAndKeys.forEach(({ key, label }) => {
        const row: { period: string; [key: string]: any } = { period: label };
        effectiveClients.forEach((clientName) => {
          let sum = 0;
          filteredByBU.forEach((item: any) => {
            if ((item.client_name ?? '').toString().trim() !== clientName) return;
            if (item.month == null || item.year == null) return;
            const monthName = normalizeToFullMonthNameForGrowth(item.month);
            const year = Number(item.year);
            if (isNaN(year)) return;
            const k = getMonthKeyForGrowth(monthName, year);
            if (k === key) sum += getVal(item, paramKey);
          });
          row[clientName] = sum;
        });
        out.push(row);
      });
      return out;
    }

    const singleClientAggView = effectiveClients.length === 0;
    if (singleClientAggView) {
      const out: { period: string; [key: string]: any }[] = [];
      clientList.forEach((clientName) => {
        const row: { period: string; [key: string]: any } = { period: clientName };
        effectiveParameters.forEach((paramKey) => {
          let sum = 0;
          filteredByBU.forEach((item: any) => {
            if ((item.client_name ?? '').toString().trim() !== clientName) return;
            if (item.month == null || item.year == null) return;
            const monthName = normalizeToFullMonthNameForGrowth(item.month);
            const year = Number(item.year);
            if (isNaN(year)) return;
            const k = getMonthKeyForGrowth(monthName, year);
            if (currentKeysSet.has(k)) sum += getVal(item, paramKey);
          });
          row[paramKey] = sum;
        });
        out.push(row);
      });
      return out;
    }

    const singleClient = effectiveClients[0];
    const out: { period: string; [key: string]: any }[] = [];
    periodLabelsAndKeys.forEach(({ key, label }) => {
      const row: { period: string; [key: string]: any } = { period: label };
      effectiveParameters.forEach((paramKey) => {
        let sum = 0;
        filteredByBU.forEach((item: any) => {
          if ((item.client_name ?? '').toString().trim() !== singleClient) return;
          if (item.month == null || item.year == null) return;
          const monthName = normalizeToFullMonthNameForGrowth(item.month);
          const year = Number(item.year);
          if (isNaN(year)) return;
          const k = getMonthKeyForGrowth(monthName, year);
          if (k === key) sum += getVal(item, paramKey);
        });
        row[paramKey] = sum;
      });
      out.push(row);
    });
    return out;
  }, [filteredByBU, effectiveClients, effectiveParameters, periodLabelsAndKeys, clientList]);

  const isMultiClientMonthView = effectiveClients.length >= 2;
  const chartSeriesConfig = useMemo(() => {
    if (isMultiClientMonthView) {
      return effectiveClients.map((clientName, idx) => ({
        type: 'client' as const,
        name: clientName,
        valueField: clientName,
        labelField: `_lbl_${idx}`,
        color: SERIES_COLORS[idx % SERIES_COLORS.length]
      }));
    }
    return effectiveParameters.map((paramKey, idx) => ({
      type: 'parameter' as const,
      name: CLIENT_GROWTH_PARAMETERS.find((p) => p.key === paramKey)?.label ?? paramKey,
      valueField: paramKey,
      labelField: `_lbl_${idx}`,
      color: SERIES_COLORS[idx % SERIES_COLORS.length]
    }));
  }, [isMultiClientMonthView, effectiveClients, effectiveParameters]);

  useEffect(() => {
    if (periodType === 'year') setSelectedYears([getCurrentFinancialYearForGrowthChart()]);
    else if (periodType === 'quarter') setSelectedQuarters(quarterOptions.length ? [quarterOptions[0]] : []);
    else setSelectedMonths([]);
  }, [periodType]);

  useLayoutEffect(() => {
    const container = chartRef.current;
    if (!container || !chartData.length || chartSeriesConfig.length === 0) return;

    am5.array.each(am5.registry.rootElements, (root) => {
      if (root?.dom?.id === chartId) root.dispose();
    });

    const root = am5.Root.new(container);
    rootRef.current = root;
    root.setThemes([am5themes_Animated.new(root)]);

    const manyPeriods = chartData.length > 12;
    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        layout: root.verticalLayout,
        panX: manyPeriods,
        panY: false,
        wheelX: manyPeriods ? 'panX' : 'none',
        wheelY: 'none',
        cursor: am5xy.XYCursor.new(root, {}),
        background: am5.Rectangle.new(root, { fill: am5.color(0xffffff) })
      })
    );

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: 'period',
        renderer: am5xy.AxisRendererX.new(root, {}),
        tooltip: am5.Tooltip.new(root, {})
      })
    );
    const dataForChart = chartData.map((row) => {
      const out: Record<string, string | number> = { period: row.period };
      chartSeriesConfig.forEach((config) => {
        const v = row[config.valueField];
        const num = typeof v === 'number' && !isNaN(v) ? v : 0;
        out[config.valueField] = num;
        out[config.labelField] = num === 0 ? '' : `${(num / 1e7).toFixed(2)} Cr`;
      });
      return out;
    });
    xAxis.data.setAll(dataForChart);
    xAxis.get('renderer').labels.template.setAll({ fill: am5.color(0x000000), fontSize: 10 });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {}),
        tooltip: am5.Tooltip.new(root, {})
      })
    );
    yAxis.get('renderer').labels.template.setAll({ fill: am5.color(0x000000), fontSize: 10 });

    chartSeriesConfig.forEach((config) => {
      const bulletLabel = () => {
        const label = am5.Label.new(root, {
          text: `{${config.labelField}}`,
          centerY: am5.percent(50),
          centerX: am5.percent(50),
          fill: am5.color(0x000000),
          fontSize: 9,
          fontWeight: '500'
        });
        return am5.Bullet.new(root, { locationY: 0.5, sprite: label });
      };
      if (chartType === 'bar') {
        const series = chart.series.push(
          am5xy.ColumnSeries.new(root, {
            name: config.name,
            xAxis,
            yAxis,
            valueYField: config.valueField,
            categoryXField: 'period'
          })
        );
        series.columns.template.setAll({
          strokeWidth: 0,
          width: am5.percent(70)
        });
        series.set('fill', am5.color(config.color));
        series.data.setAll(dataForChart);
        series.set('tooltip', am5.Tooltip.new(root, { forceHidden: true }));
        series.bullets.push(bulletLabel);
      } else {
        const series = chart.series.push(
          am5xy.LineSeries.new(root, {
            name: config.name,
            xAxis,
            yAxis,
            valueYField: config.valueField,
            categoryXField: 'period'
          })
        );
        series.strokes.template.setAll({ strokeWidth: 2 });
        series.set('stroke', am5.color(config.color));
        series.set('fill', am5.color(config.color));
        series.data.setAll(dataForChart);
        series.set('tooltip', am5.Tooltip.new(root, { forceHidden: true }));
        series.bullets.push(bulletLabel);
      }
    });

    const legend = chart.children.push(am5.Legend.new(root, {}));
    legend.data.setAll(chart.series.values);

    const rafId = requestAnimationFrame(() => {
      try {
        root.resize();
      } catch (_) {}
    });

    return () => {
      cancelAnimationFrame(rafId);
      root.dispose();
      rootRef.current = null;
    };
  }, [chartData, chartSeriesConfig, chartId, chartType]);

  if (!isChartVisible) {
    return (
      <div className="client-growth-chart-section">
        <div className="client-growth-chart-section-header-row">
          <span className="client-growth-chart-section-title client-growth-chart-section-title-inline">
            Client Wise Growth Chart – {businessUnit}
          </span>
          <button
            type="button"
            className="client-growth-chart-show-btn"
            onClick={() => setIsChartVisible(true)}
          >
            Show chart
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="client-growth-chart-section">
      <div className="client-growth-chart-section-header-row">
        <span className="client-growth-chart-section-title client-growth-chart-section-title-inline">
          Client Wise Growth Chart – {businessUnit}
        </span>
        <button
          type="button"
          className="client-growth-chart-close-btn"
          onClick={() => setIsChartVisible(false)}
          title="Hide chart"
          aria-label="Hide chart"
        >
          ×
        </button>
      </div>
      <div className="client-growth-chart-filters">
        <div className="client-growth-chart-field client-growth-chart-field-wide">
          <label>Client</label>
          <Select
            mode="multiple"
            allowClear
            placeholder="All clients"
            value={selectedClients.length === 0 ? undefined : selectedClients}
            onChange={(vals) => setSelectedClients(vals || [])}
            style={{ width: '100%' }}
            options={clientList.map((c) => ({ label: c, value: c }))}
          />
        </div>
        <div className="client-growth-chart-field client-growth-chart-field-wide">
          <label>Parameter</label>
          <Select
            mode="multiple"
            placeholder="Select parameters"
            value={selectedParameters}
            onChange={(vals) => setSelectedParameters(vals?.length ? vals : ['revenue'])}
            style={{ width: '100%' }}
            options={CLIENT_GROWTH_PARAMETERS.map((p) => ({ label: p.label, value: p.key }))}
          />
        </div>
        <div className="client-growth-chart-field">
          <label>Chart Type</label>
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value as 'bar' | 'line')}
            style={{ minWidth: 100 }}
          >
            <option value="bar">Bar</option>
            <option value="line">Line</option>
          </select>
        </div>
        <div className="client-growth-chart-field">
          <label>Period Type</label>
          <select
            value={periodType}
            onChange={(e) => {
              const v = e.target.value as 'year' | 'quarter' | 'month';
              setPeriodType(v);
              if (v === 'year') setSelectedYears([getCurrentFinancialYearForGrowthChart()]);
              else if (v === 'quarter') setSelectedQuarters(quarterOptions.length ? [quarterOptions[0]] : []);
              else setSelectedMonths([]);
            }}
          >
            <option value="year">Year</option>
            <option value="quarter">Quarter</option>
            <option value="month">Month</option>
          </select>
        </div>
        {periodType === 'year' && (
          <div className="client-growth-chart-field client-growth-chart-field-wide">
            <label>Year</label>
            <Select
              mode="multiple"
              placeholder="Select years"
              value={selectedYears}
              onChange={(vals) => setSelectedYears(vals?.length ? vals : [getCurrentFinancialYearForGrowthChart()])}
              style={{ width: '100%' }}
              options={yearOptions.map((y) => ({ label: String(y), value: y }))}
            />
          </div>
        )}
        {periodType === 'quarter' && (
          <div className="client-growth-chart-field client-growth-chart-field-wide">
            <label>Quarter</label>
            <Select
              mode="multiple"
              placeholder="Select quarters"
              value={selectedQuarters}
              onChange={(vals) => setSelectedQuarters(vals || [])}
              style={{ width: '100%' }}
              options={quarterOptions.map((q) => ({ label: q, value: q }))}
            />
          </div>
        )}
        {periodType === 'month' && (
          <div className="client-growth-chart-field client-growth-chart-field-wide">
            <label>Months</label>
            <Select
              mode="multiple"
              placeholder="Select months"
              value={selectedMonths}
              onChange={(vals) => setSelectedMonths(vals || [])}
              style={{ width: '100%' }}
              options={monthOptions.map((m) => ({ label: m, value: m }))}
            />
          </div>
        )}
      </div>
      <div className="client-growth-chart-legend">
        <span className="client-growth-chart-legend-note">
          {isMultiClientMonthView
            ? 'Month-wise comparison; one series per client. Values in Cr (Crores).'
            : effectiveClients.length === 1
              ? 'Each category is a period (single client). Values in Cr.'
              : 'Each category is a client (aggregated for selected period). Values in Cr.'}
        </span>
        {(selectedYears.length > 1 || selectedQuarters.length > 1) && (
          <span className="client-growth-chart-legend-note" style={{ display: 'block', marginTop: 4 }}>
            Multiple {periodType === 'year' ? 'years' : 'quarters'} selected: chart shows all months in order ({periodLabelsAndKeys.length} months). Scroll horizontally if needed.
          </span>
        )}
      </div>
      <div className="client-growth-chart-data-status">
        Data: {filteredByBU.length} records
        {periodLabelsAndKeys.length > 0 && ` · ${periodLabelsAndKeys.length} periods`}
        {clientList.length > 0 && ` · ${clientList.length} clients`}
        {chartData.length > 0 && ` · Chart: ${chartData.length} points`}
      </div>
      <div
        ref={chartRef}
        id={chartId}
        className="client-growth-chart-container"
        style={{ width: '100%', minHeight: 420, height: 420 }}
      />
      {chartData.length === 0 && (
        <p className="client-growth-chart-message">
          {filteredByBU.length === 0
            ? 'No data received for this business unit. Ensure Client MFS data is loaded and the selected BU has records.'
            : 'No chart data for the selected filters. Select at least one parameter, and for Year/Quarter/Month choose at least one period.'}
        </p>
      )}
    </div>
  );
}
