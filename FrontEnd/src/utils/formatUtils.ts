export type KpiCompareType = 'year' | 'quarter' | 'month';

/** Chronological sort key for KPI comparison periods (year / quarter / month). */
export const getPeriodSortKey = (period: string, compareType: KpiCompareType): number => {
  if (compareType === 'year') {
    const fy = period.match(/FY\s*(\d{4})/i)?.[1] ?? period.match(/(\d{4})/)?.[1];
    return fy ? parseInt(fy, 10) : 0;
  }
  if (compareType === 'month') {
    const m = period.match(/^([A-Za-z]+)[\s-]+(\d{4})$/);
    if (!m) return 0;
    const d = new Date(`${m[1]} 1, ${m[2]}`);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }
  const qMatch = period.match(/Q(\d)\([^)]+\)\s+(\d{4})/);
  if (!qMatch) return 0;
  const q = parseInt(qMatch[1], 10);
  const y = parseInt(qMatch[2], 10);
  const yearOffset = q === 4 ? 1 : 0;
  const month = q === 1 ? 4 : q === 2 ? 7 : q === 3 ? 10 : 1;
  return new Date(y + yearOffset, month - 1, 1).getTime();
};

/** Oldest = compare baseline, newest = current period for growth %. */
export const getRecentAndComparePeriods = (
  periods: (string | null | undefined)[],
  compareType: KpiCompareType
): { recent: string; compare: string } | null => {
  const valid = periods.filter((p): p is string => Boolean(p));
  if (valid.length < 2) return null;
  const sorted = [...valid].sort(
    (a, b) => getPeriodSortKey(a, compareType) - getPeriodSortKey(b, compareType)
  );
  return { compare: sorted[0], recent: sorted[sorted.length - 1] };
};

/** Q4 options that store Jan-Mar calendar year (e.g. Q4(Jan-Mar) 2026) → FY-anchor label for display */
export const normalizeCalendarQ4LabelForDisplay = (period: string): string => {
  const m = period.match(/^(Q4\([^)]+\))\s+(\d{4})$/);
  if (!m) return period;
  const calYear = parseInt(m[2], 10);
  return `${m[1]} ${calYear - 1}`;
};

/** FY start year (e.g. 2025) → "FY 25-26" */
export const formatFYFromStartYear = (fyStartYear: number): string => {
  const yy = fyStartYear % 100;
  const yyEnd = (fyStartYear + 1) % 100;
  return `FY ${String(yy).padStart(2, '0')}-${String(yyEnd).padStart(2, '0')}`;
};

/** Display-only label for KPI period strings; internal values stay unchanged. */
export const formatKpiPeriodDisplay = (period: string | null | undefined): string => {
  if (!period) return '';

  const parenIdx = period.indexOf(' (');
  if (parenIdx > 0) {
    return formatKpiPeriodDisplay(period.slice(0, parenIdx)) + period.slice(parenIdx);
  }

  if (period.includes(' + ')) {
    return period.split(' + ').map((part) => formatKpiPeriodDisplay(part.trim())).join(' + ');
  }

  if (period.includes(' vs ')) {
    return period.split(' vs ').map((part) => formatKpiPeriodDisplay(part.trim())).join(' vs ');
  }

  const quarterMatch = period.match(/^(Q\d\([^)]+\))\s+(\d{4})$/);
  if (quarterMatch) {
    return `${quarterMatch[1]} ${formatFYFromStartYear(parseInt(quarterMatch[2], 10))}`;
  }

  const fyMatch = period.match(/^FY\s*(\d{4})$/i);
  if (fyMatch) return formatFYFromStartYear(parseInt(fyMatch[1], 10));

  if (/^\d{4}$/.test(period)) return formatFYFromStartYear(parseInt(period, 10));

  const monthMatch = period.match(/^([A-Za-z]+)[\s-]+(\d{4})$/);
  if (monthMatch) {
    const calYear = parseInt(monthMatch[2], 10);
    const monthDate = new Date(`${monthMatch[1]} 1, ${calYear}`);
    if (!isNaN(monthDate.getTime())) {
      const monthNum = monthDate.getMonth() + 1;
      const fyStart = monthNum >= 4 ? calYear : calYear - 1;
      return `${monthMatch[1]} ${formatFYFromStartYear(fyStart)}`;
    }
  }

  return period;
};

// Utility function to format amounts with 2 decimal places
export const formatAmountInCrores = (amount: number | string | null | undefined): string => {
  if (amount === null || amount === undefined || amount === '' || amount === 0) return '0.00';
  
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return '0.00';
  
  return numAmount.toFixed(2);
};

// Format amount with 2 decimal places
export const formatAmountInCroresDetailed = (amount: number | string | null | undefined): string => {
  if (amount === null || amount === undefined || amount === '' || amount === 0) return '0.00';
  
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return '0.00';
  
  return numAmount.toFixed(2);
};

// Format amount for tooltips and detailed views
export const formatAmountWithDetails = (amount: number | string | null | undefined): string => {
  if (amount === null || amount === undefined || amount === '' || amount === 0) return '0.00';
  
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return '0.00';
  
  return numAmount.toFixed(2);
};

// Format value based on field type (HC should be number, others should be amount with 2 decimals)
export const formatValueByFieldType = (value: number | string | null | undefined, fieldName: string): string => {
  const field = fieldName.toUpperCase();
  
  // Handle null/undefined/empty values
  if (value === null || value === undefined || value === '') {
    return field === 'HC' ? '0' : '0.00';
  }
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) {
    return field === 'HC' ? '0' : '0.00';
  }
  
  // HC (Head Count) should be displayed as a regular number
  if (field === 'HC') {
    return numValue.toLocaleString('en-IN');
  }
  
  // Percentage fields
  if (field.includes('%') || field === 'NET MARGIN %' || field === 'GROWTH MARGIN %') {
    return `${numValue.toFixed(2)}%`;
  }
  
  // All other fields should be formatted as amount with 2 decimal places
  return formatAmountInCrores(numValue);
};

// Format value for tables (without rupee sign for HC)
export const formatValueForTable = (value: number | string | null | undefined, fieldName: string): string => {
  const field = fieldName.toUpperCase();
  
  // Handle null/undefined/empty values
  if (value === null || value === undefined || value === '') {
    return field === 'HC' ? '0' : '0';
  }
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) {
    return field === 'HC' ? '0' : '0';
  }
  
  // HC (Head Count) should be displayed as a regular number
  if (field === 'HC') {
    return Math.round(numValue).toLocaleString('en-IN');
  }
  
  // Percentage fields
  if (field.includes('%') || field === 'NET MARGIN %' || field === 'GROWTH MARGIN %') {
    return `${numValue.toFixed(2)}%`;
  }
  
  // All other fields should be formatted as amount without decimal places, with comma separators
  return Math.round(numValue).toLocaleString('en-IN');
};
