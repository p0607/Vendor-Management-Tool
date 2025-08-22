// Date utility functions for consistent DD-MM-YYYY formatting

/**
 * Formats a date string to DD-MM-YYYY format
 * @param dateStr - Date string in any format
 * @returns Formatted date string in DD-MM-YYYY format
 */
export const formatDateToDDMMYYYY = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  
  try {
    const date = new Date(dateStr);
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
  return formatDateToDDMMYYYY(dateStr);
};

/**
 * Converts Excel serial number to DD-MM-YYYY format
 * @param serial - Excel serial number
 * @returns Formatted date string in DD-MM-YYYY format
 */
export const formatExcelDate = (serial: number): string => {
  if (!serial || serial < 1) return '';
  
  try {
    // Excel dates are number of days since 1900-01-01
    const excelDate = new Date((serial - 25569) * 86400 * 1000);
    if (isNaN(excelDate.getTime())) return '';
    
    return formatDateToDDMMYYYY(excelDate.toISOString());
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
