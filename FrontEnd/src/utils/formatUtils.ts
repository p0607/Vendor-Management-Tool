// Utility function to format amounts in crores for better readability
export const formatAmountInCrores = (amount: number): string => {
  if (amount === 0) return '₹0';
  
  const crore = 10000000; // 1 crore = 10,000,000
  const lakh = 100000; // 1 lakh = 100,000
  
  if (Math.abs(amount) >= crore) {
    const croreValue = amount / crore;
    return `₹${croreValue.toFixed(2)} Cr`;
  } else if (Math.abs(amount) >= lakh) {
    const lakhValue = amount / lakh;
    return `₹${lakhValue.toFixed(2)} L`;
  } else {
    return `₹${amount.toLocaleString('en-IN')}`;
  }
};

// Format amount in crores with more precision for larger amounts
export const formatAmountInCroresDetailed = (amount: number): string => {
  if (amount === 0) return '₹0';
  
  const crore = 10000000; // 1 crore = 10,000,000
  const lakh = 100000; // 1 lakh = 100,000
  
  if (Math.abs(amount) >= crore) {
    const croreValue = amount / crore;
    // Show more precision for larger amounts
    const precision = croreValue >= 100 ? 1 : 2;
    return `₹${croreValue.toFixed(precision)} Cr`;
  } else if (Math.abs(amount) >= lakh) {
    const lakhValue = amount / lakh;
    return `₹${lakhValue.toFixed(2)} L`;
  } else {
    return `₹${amount.toLocaleString('en-IN')}`;
  }
};

// Format amount for tooltips and detailed views (showing both crores and actual value)
export const formatAmountWithDetails = (amount: number): string => {
  if (amount === 0) return '₹0';
  
  const crore = 10000000;
  const croreValue = amount / crore;
  
  if (Math.abs(amount) >= crore) {
    return `₹${croreValue.toFixed(2)} Cr (₹${amount.toLocaleString('en-IN')})`;
  } else {
    return `₹${amount.toLocaleString('en-IN')}`;
  }
};

// Format value based on field type (HC should be number, others should be currency)
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
  
  // All other fields should be formatted as currency in crores
  return formatAmountInCrores(value);
};

// Format value for tables (without crore formatting for HC)
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
  
  // All other fields should be formatted as currency
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
