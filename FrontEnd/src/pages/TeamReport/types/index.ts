// Team Report Types and Interfaces
// Centralized type definitions for Team Report components

export interface ReportData {
  id?: number;
  tower: string;
  client_name: string;
  project_name: string;
  business_unit: string;
  bu_head: string;
  hc: number;
  salary_cost: number;
  sales: number;
  gpm: number;
  gpm_percentage: number;
  leave_encashment: number;
  team_cost: number;
  opr_cost: number;
  funding_cost: number;
  np: number;
  np_percentage: number;
  month: string;
  year: number;
  created_at?: string;
  [key: string]: any; // Add index signature for dynamic property access
}

export interface PeriodChange {
  fromPeriod: string;
  toPeriod: string;
  absoluteChange: number;
  percentageChange: number;
  isPositive: boolean;
}

export interface CombinedPeriod {
  periods: string[];
  label: string;
  total: number;
}

export interface GrowthAnalysis {
  parameter: string;
  periodValues: {
    period: string;
    amount: number;
  }[];
  changes: PeriodChange[];
}

export type CompareType = "year" | "quarter" | "month";

export interface KPIData {
  currentFY: number;
  previousFY: number;
  growthPercentage: number;
  isPositive: boolean;
  monthsCompleted?: number;
  monthsRemaining?: number;
  period: string;
  currentFYActual?: number;
  projectedAmount?: number;
}

export interface FilterState {
  selectedBusinessUnit: string | null;
  selectedClientName: string | null;
  selectedBUHead: string | null;
  compareType: CompareType;
  comparisonValues: (string | null)[];
  selectedParameters: string[];
  showAllKPIs: boolean;
  showAllParameters: boolean;
  isCroreMode: boolean;
}

export interface ChartData {
  period: string;
  value: number;
  isForecast?: boolean;
}

export interface MetricCalculation {
  name: string;
  calculate: (metrics: any) => number;
  ideal: 'increase' | 'decrease';
  format: (value: number) => string;
}
