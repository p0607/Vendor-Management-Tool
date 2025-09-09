// Utility function to format amounts with 2 decimal places
export const formatAmountInCrores = (amount: number): string => {
  if (amount === 0) return '0.00';
  return amount.toFixed(2);
};

// Format amount with 2 decimal places
export const formatAmountInCroresDetailed = (amount: number): string => {
  if (amount === 0) return '0.00';
  return amount.toFixed(2);
};

// Format amount for tooltips and detailed views
export const formatAmountWithDetails = (amount: number): string => {
  if (amount === 0) return '0.00';
  return amount.toFixed(2);
};

// Format value based on field type (HC should be number, others should be amount with 2 decimals)
export const formatValueByFieldType = (value: number, fieldName: string): string => {
  const field = fieldName.toUpperCase();
  
  // HC (Head Count) should be displayed as a regular number
  if (field === 'HC') {
    return value.toLocaleString('en-IN');
  }
  
  // Percentage fields
  if (field.includes('%') || field === 'NET MARGIN %' || field === 'GROWTH MARGIN %') {
    return `${value.toFixed(2)}%`;
  }
  
  // All other fields should be formatted as amount with 2 decimal places
  return formatAmountInCrores(value);
};

// Format value for tables (without rupee sign for HC)
export const formatValueForTable = (value: number, fieldName: string): string => {
  const field = fieldName.toUpperCase();
  
  // HC (Head Count) should be displayed as a regular number
  if (field === 'HC') {
    return value.toLocaleString('en-IN');
  }
  
  // Percentage fields
  if (field.includes('%') || field === 'NET MARGIN %' || field === 'GROWTH MARGIN %') {
    return `${value.toFixed(2)}%`;
  }
  
  // All other fields should be formatted as amount with 2 decimal places
  return value.toFixed(2);
};
