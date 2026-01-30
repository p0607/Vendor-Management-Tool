// Date utility functions for consistent DD-MM-YYYY formatting

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

/**
 * Converts Excel serial number or date string to DD-MM-YYYY format
 * @param value - Excel serial number, date string (e.g. DD-MM-YYYY), or Date object
 * @returns Formatted date string in DD-MM-YYYY format
 */
export const formatExcelDate = (value: number | string | Date): string => {
  if (!value) return '';
  
  try {
    // Handle string dates (like "13-Aug-24" or "25-11-2025")
    if (typeof value === 'string') {
      const trimmed = value.trim();
      // Handle dd-mm-yyyy format (e.g., "25-11-2025") - pass through so backend can parse
      if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(trimmed)) {
        return trimmed;
      }
      // Handle dd-mmm-yy format (e.g., "13-Aug-24")
      if (/^\d{1,2}-[A-Za-z]{3}-\d{2}$/.test(trimmed)) {
        const [day, month, year] = value.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthIndex = monthNames.findIndex(m => m.toLowerCase() === month.toLowerCase());
        
        if (monthIndex !== -1) {
          // Convert 2-digit year to 4-digit year
          const fullYear = parseInt(year) < 50 ? 2000 + parseInt(year) : 1900 + parseInt(year);
          const date = new Date(fullYear, monthIndex, parseInt(day));
          return formatDateToDDMMYYYY(date.toISOString());
        }
      }
      
      // Handle other string formats (e.g. ISO or locale-dependent)
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return formatDateToDDMMYYYY(date.toISOString());
      }
    }

    // Handle Date objects (Excel sometimes returns these for date cells)
    if (value instanceof Date && !isNaN(value.getTime())) {
      return formatDateToDDMMYYYY(value.toISOString());
    }
    
    // Handle Excel serial numbers
    if (typeof value === 'number' && value > 1) {
      // Excel dates are number of days since 1900-01-01
      const excelDate = new Date((value - 25569) * 86400 * 1000);
      if (!isNaN(excelDate.getTime())) {
        return formatDateToDDMMYYYY(excelDate.toISOString());
      }
    }
    
    return '';
  } catch (error) {
    console.error('Error formatting Excel date:', error);
    return '';
  }
};

/**
 * Converts any date value to YYYY-MM-DD for API payloads. All parsing happens here; backend receives only ISO dates.
 */
export const dateToISOForAPI = (value: number | string | Date | null | undefined): string => {
  if (value == null || value === '') return '';
  const ddMmYyyy = formatExcelDate(value as number | string | Date);
  if (!ddMmYyyy) return '';
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(ddMmYyyy)) {
    const [d, m, y] = ddMmYyyy.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  }
  const date = new Date(ddMmYyyy);
  if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  return '';
};

/**
 * Billing month (first day of month) in YYYY-MM-DD for API.
 */
export const billingMonthToISOForAPI = (value: number | string | Date | null | undefined): string => {
  const iso = dateToISOForAPI(value);
  if (!iso) return '';
  const [y, m] = iso.split('-').map(Number);
  return `${y}-${String(m).padStart(2, '0')}-01`;
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
