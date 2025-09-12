// Date utility functions for consistent DD-MM-YYYY formatting

/**
 * Formats a date string to DD-MM-YYYY format
 * @param dateStr - Date string in any format
 * @returns Formatted date string in DD-MM-YYYY format
 */
export const formatDateToDDMMYYYY = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  
  try {
    // Handle ISO date strings with time by extracting only the date part
    const dateOnly = dateStr.split('T')[0];
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
 * @param value - Excel serial number or date string
 * @returns Formatted date string in DD-MM-YYYY format
 */
export const formatExcelDate = (value: number | string): string => {
  if (!value) return '';
  
  try {
    // Handle string dates (like "13-Aug-24")
    if (typeof value === 'string') {
      // Handle dd-mmm-yy format (e.g., "13-Aug-24")
      if (/^\d{1,2}-[A-Za-z]{3}-\d{2}$/.test(value)) {
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
      
      // Handle other string formats
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return formatDateToDDMMYYYY(date.toISOString());
      }
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
