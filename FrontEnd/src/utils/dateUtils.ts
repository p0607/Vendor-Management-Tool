// Date utility functions for consistent DD-MM-YYYY formatting

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Formats a date string to DD-MM-YYYY format for display.
 * Accepts ISO (YYYY-MM-DD), DD-MM-YYYY, or date with time.
 */
export const formatDateToDDMMYYYY = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  const s = String(dateStr).trim();
  if (!s) return '';
  try {
    // Already DD-MM-YYYY
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(s)) {
      const [d, m, y] = s.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      if (!isNaN(date.getTime())) return s;
    }
    // ISO or date with time
    const dateOnly = s.split('T')[0];
    const date = new Date(dateOnly);
    if (isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};

/**
 * Formats a date string to DD-MM-YYYY format for display in tables
 * @param dateStr - Date string in any format
 * @returns Formatted date string in DD-MM-YYYY format
 */
export const formatDateForDisplay = (dateStr: string | null | undefined): string => {
  return formatDateToDDMMYYYY(dateStr);
};

/**
 * Formats a date string to DD-MM-YYYY format for table display
 * @param dateStr - Date string in any format
 * @returns Formatted date string in DD-MM-YYYY format
 */
export const formatDateOnly = (dateStr: string | null | undefined): string => {
  if (!dateStr || dateStr === 'null' || dateStr === 'undefined') {
    return 'No Date';
  }
  return formatDateToDDMMYYYY(dateStr);
};

/** Excel/string date → DD-MM-YYYY for other date columns (Costing Date, PO Date, etc.). */
export const formatExcelDate = (value: number | string | Date): string => {
  if (!value) return '';
  try {
    if (typeof value === 'string') {
      const s = value.trim();
      if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(s)) return s;
      if (/^\d{1,2}-[A-Za-z]{3}-\d{2}$/.test(s)) {
        const [day, month, year] = value.split('-');
        const mi = MONTH_NAMES.findIndex(m => m.toLowerCase() === month.toLowerCase());
        if (mi !== -1) {
          const y = parseInt(year) < 50 ? 2000 + parseInt(year) : 1900 + parseInt(year);
          const d = new Date(y, mi, parseInt(day));
          return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
        }
      }
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        const [y, m, d] = s.slice(0, 10).split('-').map(Number);
        const date = new Date(y, m - 1, d);
        if (!isNaN(date.getTime())) return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
      }
      const date = new Date(value);
      if (!isNaN(date.getTime())) return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
    }
    if (value instanceof Date && !isNaN(value.getTime())) {
      return `${String(value.getDate()).padStart(2, '0')}-${String(value.getMonth() + 1).padStart(2, '0')}-${value.getFullYear()}`;
    }
    if (typeof value === 'number' && value > 1) {
      const utc = new Date((value - 25569) * 86400 * 1000);
      if (!isNaN(utc.getTime())) {
        const y = utc.getUTCFullYear(), m = utc.getUTCMonth(), d = utc.getUTCDate();
        return `${String(d).padStart(2, '0')}-${String(m + 1).padStart(2, '0')}-${y}`;
      }
    }
    return '';
  } catch { return ''; }
};

/** Any date value → YYYY-MM-DD for API (other date columns). */
export const dateToISOForAPI = (value: number | string | Date | null | undefined): string => {
  if (value == null || value === '') return '';
  const ddMmYyyy = formatExcelDate(value as number | string | Date);
  if (!ddMmYyyy) return '';
  const [d, m, y] = ddMmYyyy.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (!isNaN(date.getTime())) return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return '';
};

/** Billing month: Jan-26 → 1 Jan 2026 (2026-01-01), Dec-25 → 1 Dec 2025. Whatever MMM-YY is in Excel = first of that month. */
export const billingMonthToISOForAPI = (value: number | string | Date | null | undefined): string => {
  if (value == null || value === '') return '';
  const s = String(value).trim();
  const match = s.match(/^([A-Za-z]{3})[- ](\d{2,4})$/i);
  if (match) {
    const mi = MONTH_NAMES.findIndex(m => m.toLowerCase() === match[1].toLowerCase());
    if (mi !== -1) {
      const yy = match[2].length === 2 ? (parseInt(match[2], 10) < 50 ? 2000 + parseInt(match[2], 10) : 1900 + parseInt(match[2], 10)) : parseInt(match[2], 10);
      return `${yy}-${String(mi + 1).padStart(2, '0')}-01`;
    }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (typeof value === 'number' && value > 1) {
    const d = new Date((value - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) {
      const y = d.getUTCFullYear(), m = d.getUTCMonth();
      return `${y}-${String(m + 1).padStart(2, '0')}-01`;
    }
  }
  if (value instanceof Date && !isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-01`;
  }
  return '';
};

/**
 * Gets current date in DD-MM-YYYY format
 * @returns Current date in DD-MM-YYYY format
 */
export const getCurrentDateFormatted = (): string => {
  const now = new Date();
  return formatDateToDDMMYYYY(now.toISOString());
};

/**
 * Validates if a string is a valid date
 * @param dateStr - Date string to validate
 * @returns True if valid date, false otherwise
 */
export const isValidDate = (dateStr: string): boolean => {
  if (!dateStr) return false;
  
  try {
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  } catch (error) {
    return false;
  }
};
