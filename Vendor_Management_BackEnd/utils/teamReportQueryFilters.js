const FY_START_MONTHS = [
  'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December',
];
const FY_END_MONTHS = ['January', 'February', 'March'];

function getCurrentFyStartYear() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  return month >= 4 ? year : year - 1;
}

function isTruthyFlag(value) {
  return value === 'true' || value === '1' || value === true;
}

function parseFyStartYears(query) {
  if (isTruthyFlag(query.all_years)) {
    return null;
  }
  if (query.fy_start_years) {
    const years = String(query.fy_start_years)
      .split(',')
      .map((part) => parseInt(part.trim(), 10))
      .filter((year) => !Number.isNaN(year));
    if (years.length > 0) return years;
  }
  if (query.fy_start_year !== undefined && query.fy_start_year !== '') {
    const year = parseInt(String(query.fy_start_year), 10);
    if (!Number.isNaN(year)) return [year];
  }
  return [getCurrentFyStartYear()];
}

function isBuHeadDesignation(designation) {
  return String(designation || '').trim().toUpperCase() === 'BU HEAD';
}

function resolveBusinessUnitFilter(req, query) {
  const user = req.financialsUser;
  const designation = query.designation || user?.designation;
  const queryBu = query.business_unit ? String(query.business_unit).trim() : '';

  if (isBuHeadDesignation(designation)) {
    if (queryBu) return queryBu;
    if (user?.business_unit) return String(user.business_unit).trim();
  }

  return queryBu || null;
}

function appendBuFilter(conditions, params, businessUnit) {
  if (!businessUnit) return;
  const paramIndex = params.length + 1;
  conditions.push(
    `LOWER(REGEXP_REPLACE(TRIM(business_unit), '\\s*\\|\\s*', '|', 'g')) = LOWER(REGEXP_REPLACE(TRIM($${paramIndex}), '\\s*\\|\\s*', '|', 'g'))`
  );
  params.push(businessUnit);
}

function appendFyFilter(conditions, params, fyStartYears) {
  if (!fyStartYears || fyStartYears.length === 0) return;

  const fyClauses = fyStartYears.map((fyStartYear) => {
    const startYearParam = params.length + 1;
    params.push(fyStartYear);
    const startMonthsParam = params.length + 1;
    params.push(FY_START_MONTHS);
    const endYearParam = params.length + 1;
    params.push(fyStartYear + 1);
    const endMonthsParam = params.length + 1;
    params.push(FY_END_MONTHS);

    return `((year = $${startYearParam} AND month = ANY($${startMonthsParam})) OR (year = $${endYearParam} AND month = ANY($${endMonthsParam})))`;
  });

  conditions.push(`(${fyClauses.join(' OR ')})`);
}

/**
 * Build a scoped list query for team_report / team_summary_report style tables.
 * Defaults to current financial year when fy/all_years not provided.
 */
function buildTeamReportListQuery(tableName, req) {
  const safeTable = String(tableName).replace(/[^a-z0-9_]/gi, '');
  const query = req.query || {};
  const conditions = [];
  const params = [];

  appendBuFilter(conditions, params, resolveBusinessUnitFilter(req, query));

  const fyStartYears = parseFyStartYears(query);
  appendFyFilter(conditions, params, fyStartYears);

  const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';

  if (query.distinct_field === 'business_unit') {
    return {
      query: `SELECT DISTINCT business_unit FROM ${safeTable}${whereClause} ORDER BY business_unit`,
      params,
    };
  }

  if (isTruthyFlag(query.dimensions_only)) {
    return {
      query: `SELECT DISTINCT business_unit, client_name, project_name, bu_head, month, year
              FROM ${safeTable}${whereClause}
              ORDER BY business_unit, client_name, project_name, year, month`,
      params,
    };
  }

  return {
    query: `SELECT * FROM ${safeTable}${whereClause} ORDER BY year DESC, month, business_unit, client_name`,
    params,
  };
}

module.exports = {
  buildTeamReportListQuery,
  getCurrentFyStartYear,
  FY_START_MONTHS,
  FY_END_MONTHS,
};
