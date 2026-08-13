/**
 * Business Unit Utility Functions
 * 
 * This module provides centralized functions for normalizing, mapping, and comparing
 * business unit names across the application. It ensures case-insensitive matching
 * so that "CAPTIVE", "Captive", and "captive" are all treated as the same business unit.
 */

/**
 * Canonical business unit names - these are the standard forms used throughout the system
 */
export const CANONICAL_BUSINESS_UNITS = {
  CAPTIVE: 'Captive',
  'BPO|HTD': 'BPO|HTD',
  CANADA: 'Canada',
  JAPAN: 'Japan',
  SINGAPORE: 'Singapore',
  SI: 'SI',
  USA: 'USA',
  MS: 'MS',
  EGG: 'Egg',
  FINANCE: 'Finance',
  ALL: 'Finance' // ALL maps to Finance
} as const;

/**
 * Maps signup business unit names to their canonical forms
 * This ensures consistency between signup and data filtering
 */
const SIGNUP_TO_CANONICAL_MAP: { [key: string]: string } = {
  // Direct mappings
  'CAPTIVE': 'Captive',
  'captive': 'Captive',
  'Captive': 'Captive',
  'BPO|HTD': 'BPO|HTD',
  'BPO | HTD': 'BPO|HTD',
  'BPO| HTD': 'BPO|HTD',
  'BPO |HTD': 'BPO|HTD',
  'bpo|htd': 'BPO|HTD',
  'bpo | htd': 'BPO|HTD',
  'bpo| htd': 'BPO|HTD',
  'bpo |htd': 'BPO|HTD',
  'Bpo|Htd': 'BPO|HTD',
  'Bpo | Htd': 'BPO|HTD',
  'Canada': 'Canada',
  'canada': 'Canada',
  'CANADA': 'Canada',
  'Japan': 'Japan',
  'japan': 'Japan',
  'JAPAN': 'Japan',
  'Singapore': 'Singapore',
  'singapore': 'Singapore',
  'SINGAPORE': 'Singapore',
  'SI': 'SI',
  'si': 'SI',
  'Si': 'SI',
  'USA': 'USA',
  'usa': 'USA',
  'Usa': 'USA',
  'MS': 'MS',
  'ms': 'MS',
  'Ms': 'MS',
  'Egg': 'Egg',
  'egg': 'Egg',
  'EGG': 'Egg',
  'ENGG': 'Egg',
  'engg': 'Egg',
  'Engg': 'Egg',
  'ALL': 'Finance',
  'all': 'Finance',
  'All': 'Finance',
  'FINANCE': 'Finance',
  'finance': 'Finance',
  'Finance': 'Finance',
  
  // Variations that might appear in data
  'IT - SI': 'SI',
  'IT-SI': 'SI',
  'it - si': 'SI',
  'it-si': 'SI',
  'It - Si': 'SI',
  'It-Si': 'SI',
  'IT Captive': 'Captive',
  'IT-Captive': 'Captive',
  'it captive': 'Captive',
  'it-captive': 'Captive',
  'It Captive': 'Captive',
  'It-Captive': 'Captive',
  'Managed Services': 'MS',
  'managed services': 'MS',
  'MANAGED SERVICES': 'MS',
  'Managed services': 'MS',
  'MANAGED  SERVICES': 'MS', // Note: double space
  'SI Tech': 'SI',
  'SI BPO': 'SI',
  'si tech': 'SI',
  'si bpo': 'SI',
  'ENGINEERING': 'Egg',
  'Engineering': 'Egg',
  'engineering': 'Egg'
};

/**
 * Normalizes a business unit name to its canonical form
 * Handles case-insensitive matching and maps variations to standard forms
 * 
 * @param name - The business unit name to normalize
 * @returns The canonical business unit name, or null if invalid/empty
 */
export const normalizeBusinessUnitName = (name: string | null | undefined): string | null => {
  if (!name) return null;
  
  const trimmed = String(name).trim();
  if (trimmed === '') return null;
  
  // Handle BPO|HTD variations first (case-insensitive: BPO|HTD, bpo|htd, with or without spaces)
  const lowerTrimmed = trimmed.toLowerCase();
  // Remove spaces around pipe/slash/dash; collapse space between words for "BPO HTD" / "bpo htd"
  const normalizedForComparison = lowerTrimmed
    .replace(/\s*\|\s*/g, '|')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s*-\s*/g, '-')
    .replace(/\b(bpo)\s+(htd)\b/gi, '$1|$2');
  if (normalizedForComparison === 'bpo|htd' || normalizedForComparison === 'bpo/htd' || normalizedForComparison === 'bpo-htd') {
    return 'BPO|HTD';
  }
  
  // First check if there's a direct mapping
  const directMapping = SIGNUP_TO_CANONICAL_MAP[trimmed];
  if (directMapping) {
    return directMapping;
  }
  
  // Check case-insensitive mapping
  const lowerKey = trimmed.toLowerCase();
  for (const [key, value] of Object.entries(SIGNUP_TO_CANONICAL_MAP)) {
    if (key.toLowerCase() === lowerKey) {
      return value;
    }
  }
  
  // Handle special patterns
  const normalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  
  // Check for IT-SI patterns
  if (normalized.includes('IT') && normalized.includes('SI')) {
    return 'SI';
  }
  
  // Check for IT-Captive patterns
  if (normalized.includes('IT') && normalized.includes('Captive')) {
    return 'Captive';
  }
  
  // Check for Managed Services patterns
  if (normalized.includes('Managed') && normalized.includes('Service')) {
    return 'MS';
  }
  
  // Check for Engineering/Engg patterns
  if (normalized.toLowerCase() === 'engg' || normalized.toLowerCase() === 'engineering') {
    return 'Egg';
  }
  
  // For known business units, return title case version
  // Otherwise return the normalized version
  return normalized;
};

/**
 * Maps Client MFS business unit names to MFS business unit names
 * This is a legacy function maintained for backward compatibility
 * 
 * @param name - The business unit name to map
 * @returns The mapped business unit name, or null if invalid/empty
 */
export const mapClientMFSToMFSBusinessUnit = (name: string | null | undefined): string | null => {
  // Use the normalize function which handles all mappings
  return normalizeBusinessUnitName(name);
};

/**
 * Compares two business unit names in a case-insensitive manner
 * Returns true if they represent the same business unit
 * 
 * @param bu1 - First business unit name
 * @param bu2 - Second business unit name
 * @returns True if both represent the same business unit
 */
export const compareBusinessUnits = (bu1: string | null | undefined, bu2: string | null | undefined): boolean => {
  if (!bu1 || !bu2) return false;
  
  const normalized1 = normalizeBusinessUnitName(bu1);
  const normalized2 = normalizeBusinessUnitName(bu2);
  
  if (!normalized1 || !normalized2) return false;
  
  return normalized1 === normalized2;
};

/**
 * Gets the canonical form of a business unit name
 * Useful for displaying consistent names in the UI
 * 
 * @param name - The business unit name
 * @returns The canonical form, or the original name if no mapping exists
 */
export const getCanonicalBusinessUnit = (name: string | null | undefined): string | null => {
  return normalizeBusinessUnitName(name);
};

/** Comma-separated list in users.business_unit (BU HEAD may have multiple). */
export const USER_BU_DELIMITER = ',';

/** Parse stored user.business_unit → canonical BU list (supports single or comma-separated). */
export const parseUserBusinessUnits = (stored: string | null | undefined): string[] => {
  if (!stored) return [];
  const trimmed = String(stored).trim();
  if (!trimmed) return [];
  const parts = trimmed.includes(USER_BU_DELIMITER)
    ? trimmed.split(USER_BU_DELIMITER)
    : [trimmed];
  const seen = new Set<string>();
  const result: string[] = [];
  parts.forEach((part) => {
    const normalized = normalizeBusinessUnitName(part.trim());
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  });
  return result;
};

/** Serialize selected BUs for storage in users.business_unit. */
export const serializeUserBusinessUnits = (units: string[]): string =>
  parseUserBusinessUnits(units.join(USER_BU_DELIMITER)).join(USER_BU_DELIMITER);

/** BU HEAD with more than one assigned business unit. */
export const isMultiBuHead = (
  designation: string | null | undefined,
  businessUnitStored: string | null | undefined
): boolean =>
  designation === 'BU HEAD' && parseUserBusinessUnits(businessUnitStored).length > 1;

/** Dropdown options for a BU HEAD's assigned business units. */
export const getBuHeadDropdownUnits = (businessUnitStored: string | null | undefined): string[] =>
  [...parseUserBusinessUnits(businessUnitStored)].sort();

/** True if data row BU is within the user's assigned BU list. */
export const itemMatchesUserBusinessUnits = (
  itemBu: string | null | undefined,
  userBusinessUnitStored: string | null | undefined
): boolean => {
  const userUnits = parseUserBusinessUnits(userBusinessUnitStored);
  if (userUnits.length === 0) return true;
  return userUnits.some((bu) => compareBusinessUnits(itemBu, bu));
};

/** Initial selected BU: single-BU head → that BU; multi-BU head → '' (all assigned BUs combined). */
export const initializeBuHeadSelection = (
  user: { designation?: string; business_unit?: string },
  buFromURL?: string | null
): string => {
  if (buFromURL) {
    return normalizeBusinessUnitName(buFromURL) || buFromURL;
  }
  if (user.designation !== 'BU HEAD' || !user.business_unit) {
    return '';
  }
  const units = parseUserBusinessUnits(user.business_unit);
  return units.length === 1 ? units[0] : '';
};

/** Multi-BU BU HEAD can change the business unit filter; single-BU stays locked. */
export const isBuHeadDropdownEnabled = (
  designation: string | null | undefined,
  businessUnitStored: string | null | undefined
): boolean => isMultiBuHead(designation, businessUnitStored);

