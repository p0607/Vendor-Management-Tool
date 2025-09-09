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
  return numValue.toFixed(2);
};
