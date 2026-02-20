import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { compareBusinessUnits } from '../utils/businessUnitUtils';
import apiClient from '../config/api';
import './ClientWiseGrowthChart.css';

export const CLIENT_GROWTH_PARAMETERS = [
  { key: 'hc', label: 'HC' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'salary_cost', label: 'Salary Cost' },
  { key: 'gpm', label: 'GPM' },
  { key: 'gpm_percentage', label: 'GPM %' },
  { key: 'np', label: 'NP' },
  { key: 'np_percentage', label: 'NP %' },
  { key: 'leave_encashment', label: 'Leave Encashment' },
  { key: 'team_cost', label: 'Team Cost' },
  { key: 'opr_cost', label: 'Opr Cost' },
  { key: 'funding_cost', label: 'Funding Cost' },
  { key: 'rebate', label: 'Rebate' },
  { key: 'passthrough', label: 'Passthrough' },
  { key: 'vendor_cost', label: 'Vendor Cost' },
  { key: 'discount', label: 'Discount' }
];

const PARAMETERS = CLIENT_GROWTH_PARAMETERS;

export function getCurrentFinancialYearForGrowthChart(): number {
  const d = new Date();
  const m = d.getMonth() + 1;
  const y = d.getFullYear();
  return m >= 4 ? y : y - 1;
}

export function normalizeToFullMonthNameForGrowth(monthName: any): string {
  if (monthName == null || monthName === '') return '';
  const fullMonthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  if (typeof monthName === 'number' && monthName >= 1 && monthName <= 12) return fullMonthNames[monthName - 1];
  const str = String(monthName).trim();
  if (/^\d{1,2}$/.test(str)) {
    const n = parseInt(str, 10);
    if (n >= 1 && n <= 12) return fullMonthNames[n - 1];
  }
  const dateMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (dateMatch) {
    const monthNum = parseInt(dateMatch[2], 10);
    if (monthNum >= 1 && monthNum <= 12) return fullMonthNames[monthNum - 1];
  }
  const abbreviationMap: { [key: string]: string } = {
    'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April',
    'May': 'May', 'Jun': 'June', 'Jul': 'July', 'Aug': 'August',
    'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December'
  };
  const normalized = str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  return abbreviationMap[normalized] || normalized;
}

function getMonthNumber(monthName: string): number {
  const months: { [key: string]: number } = {
    'January': 1, 'February': 2, 'March': 3, 'April': 4, 'May': 5, 'June': 6,
    'July': 7, 'August': 8, 'September': 9, 'October': 10, 'November': 11, 'December': 12
  };
  return months[normalizeToFullMonthNameForGrowth(monthName)] || 0;
}

export function getMonthKeyForGrowth(month: string, year: number): string {
  const fullMonthName = normalizeToFullMonthNameForGrowth(month);
  const monthNum = getMonthNumber(fullMonthName);
  return `${year}-${String(monthNum).padStart(2, '0')}`;
}

const MONTH_ABBR = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function ClientWiseGrowthChart() {
  const location = useLocation();
  const navigate = useNavigate();
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);

  const businessUnit = (location.state as { businessUnit?: string })?.businessUnit;

  const [rawData, setRawData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<string>('__all__');
  const [selectedParameter, setSelectedParameter] = useState<string>('revenue');
  const [periodType, setPeriodType] = useState<'year' | 'quarter' | 'month'>('year');
  const [periodValue, setPeriodValue] = useState<string>(String(getCurrentFinancialYearForGrowthChart()));
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get('/team-report');
        setRawData(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.error('Failed to fetch team-report', e);
        setRawData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredByBU = useMemo(() => {
    if (!businessUnit || !rawData.length) return [];
    return rawData.filter((item: any) => compareBusinessUnits(item.business_unit, businessUnit));
  }, [rawData, businessUnit]);

  const clientList = useMemo(() => {
    const set = new Set<string>();
    filteredByBU.forEach((item: any) => {
      const c = (item.client_name ?? '').toString().trim();
      if (c) set.add(c);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [filteredByBU]);

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
    if (periodType === 'year' && periodValue) {
      const fyStart = parseInt(periodValue, 10);
      const order = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
      const displayYear = (monthNum: number) => monthNum >= 4 ? fyStart : fyStart + 1;
      order.forEach((monthNum) => {
        const y = displayYear(monthNum);
        result.push({
          key: `${y}-${String(monthNum).padStart(2, '0')}`,
          label: `${MONTH_ABBR[monthNum]} ${y}`
        });
      });
    } else if (periodType === 'quarter' && periodValue) {
      const match = periodValue.match(/Q(\d)/);
      const yearMatch = periodValue.match(/(\d{4})/);
      if (match && yearMatch) {
        const q = parseInt(match[1], 10);
        const y = parseInt(yearMatch[1], 10);
        const quarterMonths: { [key: number]: number[] } = {
          1: [4, 5, 6], 2: [7, 8, 9], 3: [10, 11, 12], 4: [1, 2, 3]
        };
        const months = quarterMonths[q] || [];
        months.forEach((m) => {
          result.push({ key: `${y}-${String(m).padStart(2, '0')}`, label: `${MONTH_ABBR[m]} ${y}` });
        });
      }
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
  }, [periodType, periodValue, selectedMonths]);

  // Previous period keys (same length/structure as current) for growth comparison when "All clients" is selected
  const previousPeriodKeys = useMemo(() => {
    const keys: string[] = [];
    if (periodType === 'year' && periodValue) {
      const fyStart = parseInt(periodValue, 10) - 1;
      const order = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
      order.forEach((monthNum) => {
        const y = monthNum >= 4 ? fyStart : fyStart + 1;
        keys.push(`${y}-${String(monthNum).padStart(2, '0')}`);
      });
    } else if (periodType === 'quarter' && periodValue) {
      const match = periodValue.match(/Q(\d)/);
      const yearMatch = periodValue.match(/(\d{4})/);
      if (match && yearMatch) {
        const q = parseInt(match[1], 10);
        const y = parseInt(yearMatch[1], 10);
        const prevYear = y - 1; // same quarter, previous year
        const quarterMonths: { [key: number]: number[] } = {
          1: [4, 5, 6], 2: [7, 8, 9], 3: [10, 11, 12], 4: [1, 2, 3]
        };
        const months = quarterMonths[q] || [];
        months.forEach((m) => {
          keys.push(`${prevYear}-${String(m).padStart(2, '0')}`);
        });
      }
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
  }, [periodType, periodValue, selectedMonths]);

  const chartData = useMemo(() => {
    if (!periodLabelsAndKeys.length || !selectedParameter) return [];

    const paramKey = selectedParameter;
    const currentKeysSet = new Set(periodLabelsAndKeys.map((p) => p.key));
    const previousKeysSet = new Set(previousPeriodKeys);

    const getVal = (item: any): number => {
      const v = item[paramKey];
      if (v == null) return 0;
      const n = typeof v === 'number' ? v : parseFloat(String(v));
      return isNaN(n) ? 0 : n;
    };

    if (selectedClient === '__all__') {
      // One bar per client: value = current period sum, color = growth vs previous period
      const clientNames = Array.from(new Set(filteredByBU.map((item: any) => (item.client_name ?? '').toString().trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      const out: { period: string; value: number; growthPct: number | null; fill: string }[] = [];

      clientNames.forEach((clientName) => {
        let currentSum = 0;
        let previousSum = 0;
        filteredByBU.forEach((item: any) => {
          if ((item.client_name ?? '').toString().trim() !== clientName) return;
          if (item.month == null || item.year == null) return;
          const monthName = normalizeToFullMonthNameForGrowth(item.month);
          const year = Number(item.year);
          if (isNaN(year)) return;
          const key = getMonthKeyForGrowth(monthName, year);
          const val = getVal(item);
          if (currentKeysSet.has(key)) currentSum += val;
          if (previousKeysSet.has(key)) previousSum += val;
        });

        let growthPct: number | null = null;
        let fill = '#1890ff';
        if (previousSum !== 0) {
          growthPct = ((currentSum - previousSum) / previousSum) * 100;
          fill = growthPct >= 0 ? '#52c41a' : '#ff4d4f';
        } else if (currentSum !== 0) {
          growthPct = 100;
          fill = '#52c41a';
        }
        out.push({
          period: clientName,
          value: currentSum,
          growthPct,
          fill
        });
      });
      return out;
    }

    // Single client: one bar per period, growth vs previous period
    const valuesByKey: { [key: string]: number } = {};
    periodLabelsAndKeys.forEach(({ key }) => { valuesByKey[key] = 0; });
    filteredByBU
      .filter((item: any) => (item.client_name ?? '').toString().trim() === selectedClient)
      .forEach((item: any) => {
        if (item.month == null || item.year == null) return;
        const monthName = normalizeToFullMonthNameForGrowth(item.month);
        const year = Number(item.year);
        if (isNaN(year)) return;
        const key = getMonthKeyForGrowth(monthName, year);
        if (key in valuesByKey) valuesByKey[key] += getVal(item);
      });

    const sortedPeriods = periodLabelsAndKeys.map(({ key, label }) => ({ key, label, value: valuesByKey[key] ?? 0 }));
    const out: { period: string; value: number; growthPct: number | null; fill: string }[] = [];
    sortedPeriods.forEach((p, i) => {
      const prev = i === 0 ? null : sortedPeriods[i - 1].value;
      let growthPct: number | null = null;
      let fill = '#1890ff';
      if (prev != null && prev !== 0) {
        growthPct = ((p.value - prev) / prev) * 100;
        fill = growthPct >= 0 ? '#52c41a' : '#ff4d4f';
      } else if (prev === 0 && p.value !== 0) {
        growthPct = 100;
        fill = '#52c41a';
      }
      out.push({
        period: p.label,
        value: p.value,
        growthPct,
        fill
      });
    });
    return out;
  }, [filteredByBU, selectedClient, selectedParameter, periodLabelsAndKeys, previousPeriodKeys]);

  useEffect(() => {
    if (periodType === 'year') setPeriodValue(String(getCurrentFinancialYearForGrowthChart()));
    else if (periodType === 'quarter') setPeriodValue(quarterOptions[0] ?? '');
    else setPeriodValue('');
  }, [periodType]);

  useEffect(() => {
    const container = chartRef.current;
    if (!container || !chartData.length) return;

    am5.array.each(am5.registry.rootElements, (root) => {
      if (root?.dom?.id === 'clientGrowthChart') root.dispose();
    });

    const root = am5.Root.new(container);
    rootRef.current = root;
    root.setThemes([am5themes_Animated.new(root)]);

    const chartDataWithGrowth = chartData.map(d => ({
      ...d,
      growthPct: d.growthPct != null ? d.growthPct.toFixed(1) + '%' : '-'
    }));

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: false,
        panY: false,
        wheelX: 'none',
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
    xAxis.data.setAll(chartDataWithGrowth);
    xAxis.get('renderer').labels.template.setAll({ fill: am5.color(0x000000), fontSize: 10 });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {}),
        tooltip: am5.Tooltip.new(root, {})
      })
    );
    yAxis.get('renderer').labels.template.setAll({ fill: am5.color(0x000000), fontSize: 10 });

    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        xAxis,
        yAxis,
        valueYField: 'value',
        categoryXField: 'period'
      })
    );
    series.columns.template.setAll({
      strokeWidth: 0,
      width: am5.percent(70)
    });
    series.columns.template.adapters.add('fill', (fill, target) => {
      const hex = (target.dataItem?.dataContext as any)?.fill;
      if (hex && typeof hex === 'string') {
        const num = parseInt(hex.replace(/^#/, ''), 16);
        return am5.color(num);
      }
      return fill;
    });
    series.data.setAll(chartDataWithGrowth);
    const isAllClients = selectedClient === '__all__';
    series.set('tooltipText', isAllClients
      ? '{period}: {value}\nGrowth vs previous period: {growthPct}'
      : '{period}: {value}\nGrowth: {growthPct}');

    return () => {
      root.dispose();
      rootRef.current = null;
    };
  }, [chartData, selectedParameter, selectedClient]);

  if (!businessUnit) {
    return (
      <div className="client-growth-chart-page">
        <div className="client-growth-chart-header">
          <button type="button" className="client-growth-chart-back" onClick={() => navigate('/team-report/compare')}>
            Back
          </button>
          <h1 className="client-growth-chart-title">Client Wise Growth Chart</h1>
        </div>
        <p className="client-growth-chart-message">No business unit selected. Open this page from the Client Data section on the MFS comparison page.</p>
      </div>
    );
  }

  return (
    <div className="client-growth-chart-page">
      <div className="client-growth-chart-header">
        <button type="button" className="client-growth-chart-back" onClick={() => navigate('/team-report/compare')}>
          Back
        </button>
        <h1 className="client-growth-chart-title">Client Wise Growth Chart – {businessUnit}</h1>
      </div>

      <div className="client-growth-chart-filters">
        <div className="client-growth-chart-field">
          <label>Client</label>
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
          >
            <option value="__all__">All clients</option>
            {clientList.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="client-growth-chart-field">
          <label>Parameter</label>
          <select
            value={selectedParameter}
            onChange={(e) => setSelectedParameter(e.target.value)}
          >
            {PARAMETERS.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        </div>
        <div className="client-growth-chart-field">
          <label>Period Type</label>
          <select
            value={periodType}
            onChange={(e) => {
              const v = e.target.value as 'year' | 'quarter' | 'month';
              setPeriodType(v);
              if (v === 'year') setPeriodValue(String(getCurrentFinancialYearForGrowthChart()));
              else if (v === 'quarter') setPeriodValue(quarterOptions[0] ?? '');
              else setSelectedMonths([]);
            }}
          >
            <option value="year">Year</option>
            <option value="quarter">Quarter</option>
            <option value="month">Month</option>
          </select>
        </div>
        {periodType === 'year' && (
          <div className="client-growth-chart-field">
            <label>Year</label>
            <select value={periodValue} onChange={(e) => setPeriodValue(e.target.value)}>
              {yearOptions.map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
          </div>
        )}
        {periodType === 'quarter' && (
          <div className="client-growth-chart-field">
            <label>Quarter</label>
            <select value={periodValue} onChange={(e) => setPeriodValue(e.target.value)}>
              <option value="">Select Quarter</option>
              {quarterOptions.map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>
        )}
        {periodType === 'month' && (
          <div className="client-growth-chart-field client-growth-chart-field-wide">
            <label>Months</label>
            <select
              multiple
              value={selectedMonths}
              onChange={(e) => {
                const opts = Array.from((e.target as HTMLSelectElement).selectedOptions, (o) => o.value);
                setSelectedMonths(opts);
              }}
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="client-growth-chart-loading">Loading data...</div>
      ) : (
        <>
          <div className="client-growth-chart-legend">
            <span className="client-growth-legend-item"><i style={{ background: '#52c41a' }} /> Growth</span>
            <span className="client-growth-legend-item"><i style={{ background: '#ff4d4f' }} /> Decline</span>
            <span className="client-growth-legend-item"><i style={{ background: '#1890ff' }} /> No prior period</span>
            {selectedClient === '__all__' && (
              <span className="client-growth-chart-legend-note">Each bar is one client; growth/decline vs same period previous year/quarter.</span>
            )}
          </div>
          <div ref={chartRef} id="clientGrowthChart" className="client-growth-chart-container" />
          {chartData.length === 0 && !loading && (
            <p className="client-growth-chart-message">No data for the selected filters.</p>
          )}
        </>
      )}
    </div>
  );
}
