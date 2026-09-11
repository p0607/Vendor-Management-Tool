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

function isSummaryTable(tableName) {
  return String(tableName).includes('summary');
}

function quoteSqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function appendFyFilter(conditions, params, fyStartYears) {
  if (!fyStartYears || fyStartYears.length === 0) return;

  const startMonthsIn = FY_START_MONTHS.map(quoteSqlLiteral).join(', ');
  const endMonthsIn = FY_END_MONTHS.map(quoteSqlLiteral).join(', ');

  const fyClauses = fyStartYears.map((fyStartYear) => {
    const startYearParam = params.length + 1;
    params.push(fyStartYear);
    const endYearParam = params.length + 1;
    params.push(fyStartYear + 1);

    return `((year::int = $${startYearParam} AND TRIM(month::text) IN (${startMonthsIn})) OR (year::int = $${endYearParam} AND TRIM(month::text) IN (${endMonthsIn})))`;
  });

  conditions.push(`(${fyClauses.join(' OR ')})`);
}

function buildOrderClause(tableName) {
  if (isSummaryTable(tableName)) {
    return ' ORDER BY year DESC, month, business_unit';
  }
  return ' ORDER BY year DESC, month, business_unit, client_name, project_name';
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
    if (isSummaryTable(safeTable)) {
      return {
        query: `SELECT DISTINCT business_unit, month, year
                FROM ${safeTable}${whereClause}
                ORDER BY business_unit, year, month`,
        params,
      };
    }
    return {
      query: `SELECT DISTINCT business_unit, client_name, project_name, bu_head, month, year
              FROM ${safeTable}${whereClause}
              ORDER BY business_unit, client_name, project_name, year, month`,
      params,
    };
  }

  return {
    query: `SELECT * FROM ${safeTable}${whereClause}${buildOrderClause(safeTable)}`,
    params,
  };
}

const TEAM_REPORT_DIMENSION_COLS = ['client_name', 'project_name', 'business_unit', 'bu_head'];
/** MFS team_report client metrics — no f_and_f (that belongs on FT/F&F module tables only). */
const MFS_TEAM_REPORT_METRIC_COLS = [
  'hc', 'salary_cost', 'revenue', 'gpm', 'gpm_percentage', 'leave_encashment',
  'team_cost', 'opr_cost', 'funding_cost', 'np', 'np_percentage',
  'rebate', 'passthrough', 'vendor_cost', 'discount',
];
const TEAM_REPORT_PERIOD_COLS = ['month', 'year'];
const TEAM_REPORT_TEXT_COLS = new Set(TEAM_REPORT_DIMENSION_COLS);

async function getTableColumns(client, tableName) {
  const safeName = String(tableName).replace(/[^a-z0-9_]/gi, '');
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [safeName]
  );
  return new Set(rows.map((row) => row.column_name));
}

function filterExistingCols(cols, targetCols) {
  return cols.filter((col) => targetCols.has(col));
}

function pickTeamReportRecordValues(record, cols) {
  return cols.map((col) => {
    if (TEAM_REPORT_TEXT_COLS.has(col)) {
      const value = record[col];
      return value === '' || value === undefined ? null : value;
    }
    if (col === 'month' || col === 'year') {
      return record[col];
    }
    return record[col] ?? 0;
  });
}

function buildTeamReportInsertPlan(targetCols) {
  const insertCols = [
    ...filterExistingCols(TEAM_REPORT_DIMENSION_COLS, targetCols),
    ...filterExistingCols(MFS_TEAM_REPORT_METRIC_COLS, targetCols),
    ...filterExistingCols(TEAM_REPORT_PERIOD_COLS, targetCols),
  ];
  if (insertCols.length === 0) {
    throw new Error('team_report table has no insertable columns.');
  }
  const insertPlaceholders = insertCols.map((_, index) => `$${index + 1}`).join(', ');
  return {
    insertCols,
    insertQuery: `INSERT INTO team_report (${insertCols.join(', ')}) VALUES (${insertPlaceholders}) RETURNING *`,
  };
}

function buildTeamReportBulkUpsertPlan(targetCols) {
  const insertCols = [
    ...filterExistingCols(TEAM_REPORT_DIMENSION_COLS, targetCols),
    ...filterExistingCols(MFS_TEAM_REPORT_METRIC_COLS, targetCols),
    ...filterExistingCols(TEAM_REPORT_PERIOD_COLS, targetCols),
  ];
  const updateCols = [
    ...filterExistingCols(['bu_head'], targetCols),
    ...filterExistingCols(MFS_TEAM_REPORT_METRIC_COLS, targetCols),
  ];
  if (insertCols.length === 0) {
    throw new Error('team_report table has no insertable columns.');
  }

  const insertPlaceholders = insertCols.map((_, index) => `$${index + 1}`).join(', ');
  const insertQuery = `INSERT INTO team_report (${insertCols.join(', ')}) VALUES (${insertPlaceholders})`;
  const setClause = updateCols.map((col, index) => `${col} = $${index + 1}`).join(', ');
  const updateQuery = updateCols.length > 0
    ? `UPDATE team_report SET ${setClause} WHERE id = $${updateCols.length + 1}`
    : null;

  return { insertCols, updateCols, insertQuery, updateQuery };
}

module.exports = {
  buildTeamReportListQuery,
  buildTeamReportBulkUpsertPlan,
  buildTeamReportInsertPlan,
  getCurrentFyStartYear,
  getTableColumns,
  pickTeamReportRecordValues,
  FY_START_MONTHS,
  FY_END_MONTHS,
};
