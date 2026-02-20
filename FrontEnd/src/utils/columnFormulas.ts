/**
 * Column formulas for Client MFS / Team Report data by Business Unit.
 * Used for import mapping (GPM, NP), display in UI, and as single source of truth.
 *
 * GPM % = (GPM / Revenue) × 100  (when Revenue ≠ 0)
 * NP %  = (NP / Revenue) × 100   (when Revenue ≠ 0 and NP is calculated)
 */

export interface ColumnFormulaEntry {
  /** Display label for the business unit(s) */
  businessUnits: string[];
  /** Formula expression for GPM */
  gpmFormula: string;
  /** Formula expression for NP (null if NP is not calculated for this BU) */
  npFormula: string | null;
  /** Short description */
  description?: string;
}

/** GPM % and NP % are derived the same way for all BUs when Revenue ≠ 0 */
export const PERCENTAGE_FORMULAS = {
  gpm_percentage: 'GPM % = (GPM / Revenue) × 100',
  np_percentage: 'NP % = (NP / Revenue) × 100'
} as const;

/**
 * All column formulas by business unit (order matches app logic: MS → USA → Japan/Canada/Singapore → Other).
 */
export const BUSINESS_UNIT_COLUMN_FORMULAS: ColumnFormulaEntry[] = [
  {
    businessUnits: ['MS', 'Managed Services'],
    gpmFormula: 'GPM = Revenue − Salary Cost',
    npFormula: null,
    description: 'NP is not calculated for MS / Managed Services.'
  },
  {
    businessUnits: ['USA'],
    gpmFormula: 'GPM = Revenue − Salary Cost − Rebate − Passthrough',
    npFormula: null,
    description: 'NP is not calculated for USA.'
  },
  {
    businessUnits: ['Japan'],
    gpmFormula: 'GPM = Revenue − Salary Cost − Discount',
    npFormula: null,
    description: 'NP is not calculated for Japan.'
  },
  {
    businessUnits: ['Canada', 'Singapore'],
    gpmFormula: 'GPM = Revenue − Salary Cost',
    npFormula: null,
    description: 'NP is not calculated for Canada, Singapore.'
  },
  {
    businessUnits: ['BPO|HTD', 'Captive', 'SI', 'Egg', 'Other'],
    gpmFormula: 'GPM = Revenue − Salary Cost − Leave Encashment − Vendor Cost',
    npFormula: 'NP = GPM − Team Cost − Opr Cost − Funding Cost',
    description: 'All other business units use this GPM and NP calculation.'
  }
];

/**
 * Returns formula entries for a specific business unit or for all.
 * @param businessUnit - Optional. If provided, returns only the entry that applies to this BU (case-insensitive match).
 * @returns One or more formula entries. For "Other" BUs, returns the last entry (BPO|HTD, Captive, etc.).
 */
export function getColumnFormulasByBusinessUnit(businessUnit?: string): ColumnFormulaEntry[] {
  if (!businessUnit || businessUnit.trim() === '') {
    return BUSINESS_UNIT_COLUMN_FORMULAS;
  }
  const bu = businessUnit.trim();
  const buLower = bu.toLowerCase();
  const normalizedMS = ['ms', 'managed services'];
  const normalizedUSA = ['usa'];
  if (normalizedMS.some((u) => u === buLower) || buLower === 'ms') {
    return BUSINESS_UNIT_COLUMN_FORMULAS.filter((e) => e.businessUnits.some((u) => u.toLowerCase() === 'ms'));
  }
  if (normalizedUSA.includes(buLower)) {
    return BUSINESS_UNIT_COLUMN_FORMULAS.filter((e) => e.businessUnits.some((u) => u.toLowerCase() === 'usa'));
  }
  if (buLower === 'japan') {
    return BUSINESS_UNIT_COLUMN_FORMULAS.filter((e) => e.businessUnits.some((u) => u.toLowerCase() === 'japan'));
  }
  if (['canada', 'singapore'].includes(buLower)) {
    return BUSINESS_UNIT_COLUMN_FORMULAS.filter((e) =>
      e.businessUnits.some((u) => ['canada', 'singapore'].includes(u.toLowerCase()))
    );
  }
  // All other BUs (BPO|HTD, Captive, SI, Egg, etc.) use the "Other" formula
  const otherEntry = BUSINESS_UNIT_COLUMN_FORMULAS[BUSINESS_UNIT_COLUMN_FORMULAS.length - 1];
  return [{ ...otherEntry, businessUnits: [bu, ...otherEntry.businessUnits] }];
}

/**
 * Returns a flat list of formula strings for GPM and NP (and optionally %) for display.
 * If businessUnit is passed, returns formulas for that BU only; otherwise for all BU groups.
 */
export function getFormulaSummary(businessUnit?: string): { column: string; formula: string }[] {
  const entries = getColumnFormulasByBusinessUnit(businessUnit);
  const lines: { column: string; formula: string }[] = [];
  entries.forEach((e) => {
    lines.push({ column: 'GPM', formula: e.gpmFormula });
    if (e.npFormula) lines.push({ column: 'NP', formula: e.npFormula });
  });
  lines.push({ column: 'GPM %', formula: PERCENTAGE_FORMULAS.gpm_percentage });
  lines.push({ column: 'NP %', formula: PERCENTAGE_FORMULAS.np_percentage });
  return lines;
}

/**
 * Returns formulas for all business units in a table-friendly shape.
 * Use this to "fetch all formulas for GPM and NP for all business unit".
 */
export function getAllFormulasByBusinessUnit(): {
  businessUnit: string;
  gpmFormula: string;
  npFormula: string;
  gpmPctFormula: string;
  npPctFormula: string;
}[] {
  return BUSINESS_UNIT_COLUMN_FORMULAS.map((e) => ({
    businessUnit: e.businessUnits.join(', '),
    gpmFormula: e.gpmFormula,
    npFormula: e.npFormula ?? '—',
    gpmPctFormula: PERCENTAGE_FORMULAS.gpm_percentage,
    npPctFormula: PERCENTAGE_FORMULAS.np_percentage
  }));
}
