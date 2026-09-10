export function getCurrentFyStartYear(): number {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  return month >= 4 ? year : year - 1;
}

export type TeamReportQueryOptions = {
  fyStartYear?: number;
  fyStartYears?: number[];
  allYears?: boolean;
  businessUnit?: string;
  dimensionsOnly?: boolean;
  distinctField?: 'business_unit';
  designation?: string;
  userBusinessUnit?: string;
};

export function buildTeamReportQueryParams(
  options: TeamReportQueryOptions = {}
): Record<string, string | number> {
  const params: Record<string, string | number> = {};

  if (options.distinctField) {
    params.distinct_field = options.distinctField;
  }
  if (options.dimensionsOnly) {
    params.dimensions_only = 'true';
  }
  if (options.allYears) {
    params.all_years = 'true';
  } else if (options.fyStartYears?.length) {
    params.fy_start_years = options.fyStartYears.join(',');
  } else {
    params.fy_start_year = options.fyStartYear ?? getCurrentFyStartYear();
  }

  const businessUnit = options.businessUnit?.trim();
  if (businessUnit) {
    params.business_unit = businessUnit;
  }

  const designation = options.designation?.trim();
  if (designation) {
    params.designation = designation;
  }
  if (designation?.toUpperCase() === 'BU HEAD' && options.userBusinessUnit && !businessUnit) {
    params.business_unit = options.userBusinessUnit;
  }

  return params;
}
