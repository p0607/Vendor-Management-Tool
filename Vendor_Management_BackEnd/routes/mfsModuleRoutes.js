/**
 * FT and F&F (fnf) MFS module routes — same fields as MFS, separate tables.
 */

const MODULE_CONFIG = {
  ft: {
    prefix: '/api/ft',
    summaryTable: 'team_summary_report_ft',
    clientTable: 'team_report_ft',
  },
  fnf: {
    prefix: '/api/fnf',
    summaryTable: 'team_summary_report_fnf',
    clientTable: 'team_report_fnf',
  },
};

const normalizeBusinessUnitName = (name) => {
  if (!name || name === '') return null;
  const trimmed = String(name).trim();
  if (trimmed === '') return null;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
};

const normalizeMonthName = (month) => {
  const monthNames = {
    January: 'January', February: 'February', March: 'March', April: 'April',
    May: 'May', June: 'June', July: 'July', August: 'August',
    September: 'September', October: 'October', November: 'November', December: 'December',
    Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April',
    Jun: 'June', Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December',
  };
  const fullMonthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  if (!month) return null;
  let normalized = monthNames[month];
  if (!normalized) {
    const monthStr = String(month).trim();
    const capitalized = monthStr.charAt(0).toUpperCase() + monthStr.slice(1).toLowerCase();
    normalized = monthNames[capitalized];
    if (!normalized) {
      const monthNum = parseInt(monthStr, 10);
      if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
        normalized = fullMonthNames[monthNum - 1];
      }
    }
  }
  return normalized || month;
};

const parseNumeric = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isNaN(value) ? 0 : value;
  let strValue = String(value).trim();
  if (strValue === '' || strValue === '-' || strValue === '########' ||
      strValue.toUpperCase().includes('DIV') || strValue === '#DIV/0!' ||
      strValue === 'NaN' || strValue.toUpperCase() === 'INFINITY' || strValue === '#VALUE!') {
    return 0;
  }
  if (strValue.startsWith('(') && strValue.endsWith(')')) {
    strValue = `-${strValue.slice(1, -1).trim()}`;
  }
  if (strValue.endsWith('%')) {
    strValue = strValue.slice(0, -1).trim();
  }
  strValue = strValue.replace(/,/g, '').replace(/\u2212/g, '-').replace(/\s+/g, '');
  const parsed = parseFloat(strValue);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const { buildTeamReportListQuery } = require('../utils/teamReportQueryFilters');
const CLIENT_DIMENSION_COLS = ['client_name', 'project_name', 'business_unit', 'bu_head', 'month', 'year'];
const CLIENT_OPTIONAL_TEXT_COLS = ['alchemy_name'];
const CLIENT_METRIC_COLS = [
  'hc', 'salary_cost', 'revenue', 'gpm', 'gpm_percentage', 'leave_encashment',
  'team_cost', 'opr_cost', 'funding_cost', 'np', 'np_percentage',
  'rebate', 'passthrough', 'vendor_cost', 'discount', 'f_and_f',
];

function getClientUpdateValue(record, key) {
  if (key === 'bu_head' || CLIENT_OPTIONAL_TEXT_COLS.includes(key)) {
    const value = record[key];
    if (value === undefined || value === null || String(value).trim() === '') return null;
    return String(value).trim();
  }
  if (key === 'f_and_f' && (record[key] === null || record[key] === undefined)) {
    return null;
  }
  return record[key] ?? 0;
}

async function getTableColumns(client, tableName) {
  const safeName = String(tableName).replace(/[^a-z0-9_]/gi, '');
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    [safeName]
  );
  return new Set(rows.map((r) => r.column_name));
}

/** Copy client dimension rows from MFS with zero metrics — only uses columns that exist on the target table. */
async function insertClientStructureFromMfs(client, targetTable) {
  const targetCols = await getTableColumns(client, targetTable);
  if (targetCols.size === 0) {
    throw new Error(`Table "${targetTable}" does not exist. Run create_ft_fnf_module_tables.sql.`);
  }
  const insertCols = [
    ...CLIENT_DIMENSION_COLS.filter((c) => targetCols.has(c)),
    ...CLIENT_METRIC_COLS.filter((c) => targetCols.has(c)),
  ];
  if (!insertCols.includes('month') || !insertCols.includes('year')) {
    throw new Error(`Table "${targetTable}" is missing month/year columns.`);
  }
  const colList = insertCols.join(', ');
  const selectList = insertCols
    .map((col) => (CLIENT_DIMENSION_COLS.includes(col) ? `s.${col}` : '0'))
    .join(', ');
  const result = await client.query(`
    INSERT INTO ${targetTable} (${colList})
    SELECT ${selectList}
    FROM team_report s
    WHERE NOT EXISTS (
      SELECT 1 FROM ${targetTable} t
      WHERE t.business_unit IS NOT DISTINCT FROM s.business_unit
        AND t.client_name IS NOT DISTINCT FROM s.client_name
        AND t.project_name IS NOT DISTINCT FROM s.project_name
        AND t.month = s.month AND t.year = s.year
    )
  `);
  return result.rowCount || 0;
}

async function findModuleClientRowId(client, clientTable, record) {
  const { rows } = await client.query(
    `SELECT id FROM ${clientTable}
     WHERE business_unit IS NOT DISTINCT FROM $1 AND client_name IS NOT DISTINCT FROM $2
       AND project_name IS NOT DISTINCT FROM $3 AND month = $4 AND year = $5
     LIMIT 1`,
    [
      record.business_unit || null,
      record.client_name || null,
      record.project_name || null,
      record.month,
      record.year,
    ]
  );
  return rows[0]?.id ?? null;
}

async function insertModuleClientShellRow(client, clientTable, targetCols, dims) {
  const insertCols = [
    ...CLIENT_DIMENSION_COLS.filter((c) => targetCols.has(c)),
    ...CLIENT_METRIC_COLS.filter((c) => targetCols.has(c)),
    ...CLIENT_OPTIONAL_TEXT_COLS.filter((c) => targetCols.has(c)),
  ];
  if (!insertCols.includes('month') || !insertCols.includes('year')) {
    throw new Error(`Table "${clientTable}" is missing month/year columns.`);
  }
  const values = insertCols.map((col) => {
    if (CLIENT_METRIC_COLS.includes(col)) return 0;
    if (col === 'f_and_f') return null;
    if (col in dims) {
      const v = dims[col];
      return v === undefined || v === '' ? null : v;
    }
    return null;
  });
  const placeholders = insertCols.map((_, i) => `$${i + 1}`).join(', ');
  const { rows } = await client.query(
    `INSERT INTO ${clientTable} (${insertCols.join(', ')}) VALUES (${placeholders}) RETURNING id`,
    values
  );
  return rows[0]?.id ?? null;
}

async function resolveProjectNameFromMfs(client, record) {
  if (record.project_name && String(record.project_name).trim() !== '') return;
  const { rows } = await client.query(
    `SELECT DISTINCT project_name FROM team_report
     WHERE business_unit IS NOT DISTINCT FROM $1 AND client_name IS NOT DISTINCT FROM $2`,
    [record.business_unit || null, record.client_name || null]
  );
  const nonEmpty = rows
    .map((r) => r.project_name)
    .filter((p) => p !== null && p !== undefined && String(p).trim() !== '');
  if (nonEmpty.length === 1) {
    record.project_name = nonEmpty[0];
    return;
  }
  if (rows.length === 1 && (rows[0].project_name === null || String(rows[0].project_name).trim() === '')) {
    record.project_name = null;
  }
}

async function mfsClientIdentityExists(client, record) {
  await resolveProjectNameFromMfs(client, record);
  const exact = await client.query(
    `SELECT 1 FROM team_report
     WHERE business_unit IS NOT DISTINCT FROM $1 AND client_name IS NOT DISTINCT FROM $2
       AND project_name IS NOT DISTINCT FROM $3
     LIMIT 1`,
    [record.business_unit || null, record.client_name || null, record.project_name ?? null]
  );
  if (exact.rows.length > 0) return true;
  return client.query(
    `SELECT 1 FROM team_report
     WHERE business_unit IS NOT DISTINCT FROM $1 AND client_name IS NOT DISTINCT FROM $2
     LIMIT 1`,
    [record.business_unit || null, record.client_name || null]
  ).then((r) => r.rows.length > 0);
}

/** BU + client (+ project when known) from module or MFS — used to open a new month/year row. */
async function fetchSiblingClientDimensions(client, clientTable, record) {
  const bu = record.business_unit || null;
  const clientName = record.client_name || null;
  const project = record.project_name ?? null;
  const projectBlank = project === null || String(project).trim() === '';

  const pickExact = async (table) => {
    const { rows } = await client.query(
      `SELECT client_name, project_name, business_unit, bu_head
       FROM ${table}
       WHERE business_unit IS NOT DISTINCT FROM $1 AND client_name IS NOT DISTINCT FROM $2
         AND project_name IS NOT DISTINCT FROM $3
       ORDER BY year DESC, month DESC
       LIMIT 1`,
      [bu, clientName, project]
    );
    return rows[0] || null;
  };

  let row = await pickExact(clientTable);
  if (row) return row;
  row = await pickExact('team_report');
  if (row) return row;
  if (!projectBlank) return null;

  const pickLoose = async (table) => {
    const { rows } = await client.query(
      `SELECT client_name, project_name, business_unit, bu_head
       FROM ${table}
       WHERE business_unit IS NOT DISTINCT FROM $1 AND client_name IS NOT DISTINCT FROM $2
       ORDER BY year DESC, month DESC
       LIMIT 1`,
      [bu, clientName]
    );
    return rows[0] || null;
  };

  row = await pickLoose(clientTable);
  if (row) return row;
  return pickLoose('team_report');
}

/**
 * FT/F&F import: client must exist in MFS (BU + client + project rules).
 * Month/year come from the import payload only — new periods insert a shell row then update metrics.
 */
async function ensureModuleClientRowForImport(client, clientTable, targetCols, record) {
  await resolveProjectNameFromMfs(client, record);
  if (!(await mfsClientIdentityExists(client, record))) {
    return null;
  }

  let id = await findModuleClientRowId(client, clientTable, record);
  if (id) return id;

  await insertClientStructureFromMfs(client, clientTable);
  id = await findModuleClientRowId(client, clientTable, record);
  if (id) return id;

  const mfsExact = await client.query(
    `SELECT client_name, project_name, business_unit, bu_head, month, year
     FROM team_report
     WHERE business_unit IS NOT DISTINCT FROM $1 AND client_name IS NOT DISTINCT FROM $2
       AND project_name IS NOT DISTINCT FROM $3 AND month = $4 AND year = $5
     LIMIT 1`,
    [
      record.business_unit || null,
      record.client_name || null,
      record.project_name || null,
      record.month,
      record.year,
    ]
  );
  if (mfsExact.rows.length > 0) {
    id = await insertModuleClientShellRow(client, clientTable, targetCols, {
      ...mfsExact.rows[0],
      month: record.month,
      year: record.year,
    });
    if (id) return id;
  }

  const projectBlank = !record.project_name || String(record.project_name).trim() === '';
  if (projectBlank) {
    const mfsLoose = await client.query(
      `SELECT client_name, project_name, business_unit, bu_head, month, year
       FROM team_report
       WHERE business_unit IS NOT DISTINCT FROM $1 AND client_name IS NOT DISTINCT FROM $2
         AND month = $3 AND year = $4`,
      [record.business_unit || null, record.client_name || null, record.month, record.year]
    );
    if (mfsLoose.rows.length === 1) {
      record.project_name = mfsLoose.rows[0].project_name;
      id = await findModuleClientRowId(client, clientTable, record);
      if (id) return id;
      id = await insertModuleClientShellRow(client, clientTable, targetCols, {
        ...mfsLoose.rows[0],
        month: record.month,
        year: record.year,
      });
      if (id) return id;
    }
  }

  const sibling = await fetchSiblingClientDimensions(client, clientTable, record);
  if (!sibling) {
    return null;
  }
  if (projectBlank && sibling.project_name) {
    record.project_name = sibling.project_name;
    id = await findModuleClientRowId(client, clientTable, record);
    if (id) return id;
  }
  const alchemyCol = targetCols.has('alchemy_name')
    ? await client.query(
      `SELECT alchemy_name FROM ${clientTable}
       WHERE business_unit IS NOT DISTINCT FROM $1 AND client_name IS NOT DISTINCT FROM $2
         AND project_name IS NOT DISTINCT FROM $3 AND alchemy_name IS NOT NULL AND TRIM(alchemy_name) <> ''
       LIMIT 1`,
      [sibling.business_unit || null, sibling.client_name || null, sibling.project_name || null]
    )
    : { rows: [] };
  return insertModuleClientShellRow(client, clientTable, targetCols, {
    ...sibling,
    month: record.month,
    year: record.year,
    alchemy_name: alchemyCol.rows[0]?.alchemy_name ?? null,
  });
}

/** Build UPDATE for client bulk import using only columns present on the module table. */
function buildClientUpdateParts(targetCols, record = null) {
  const optionalTextFields = CLIENT_OPTIONAL_TEXT_COLS.filter((f) => {
    if (!targetCols.has(f)) return false;
    if (record && !Object.prototype.hasOwnProperty.call(record, f)) return false;
    return true;
  });
  const metricFields = CLIENT_METRIC_COLS.filter((f) => {
    if (!targetCols.has(f)) return false;
    if (record && !Object.prototype.hasOwnProperty.call(record, f)) return false;
    return true;
  });
  const fields = [
    ...(record && Object.prototype.hasOwnProperty.call(record, 'bu_head') ? ['bu_head'] : []),
    ...optionalTextFields,
    ...metricFields,
  ];
  if (fields.length === 0) {
    throw new Error('No updatable columns found on client module table.');
  }
  const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  const valueKeys = fields;
  return { setClause, valueKeys, idParam: fields.length + 1 };
}

const FY_START_MONTHS_SQL = [
  'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December',
];
const FY_END_MONTHS_SQL = ['January', 'February', 'March'];

/**
 * Sum monthly F&F client f_and_f only (no other metrics) by BU and FY quarter into MFS summary
 * f_and_f_q1..q4 on the April anchor row. Partial quarters OK (e.g. Q1 = April only until May/June arrive).
 */
async function syncFnfQuarterlyTotalsToMfsSummary(client, logger) {
  const fnfCols = await getTableColumns(client, 'team_report_fnf');
  const mfsSummaryCols = await getTableColumns(client, 'team_summary_report');
  const quarterCols = ['f_and_f_q1', 'f_and_f_q2', 'f_and_f_q3', 'f_and_f_q4'];
  if (!quarterCols.every((col) => mfsSummaryCols.has(col))) {
    logger.warn('syncFnfQuarterlyTotalsToMfsSummary skipped: team_summary_report missing F&F Q columns');
    return { businessUnitsUpdated: 0 };
  }
  if (!fnfCols.has('f_and_f')) {
    logger.warn('syncFnfQuarterlyTotalsToMfsSummary skipped: team_report_fnf has no f_and_f column');
    return { businessUnitsUpdated: 0 };
  }

  const startMonthsIn = FY_START_MONTHS_SQL.map((m) => `'${m}'`).join(', ');
  const endMonthsIn = FY_END_MONTHS_SQL.map((m) => `'${m}'`).join(', ');

  const quarterlyCte = `
    WITH scoped AS (
      SELECT
        business_unit,
        TRIM(month::text) AS month_name,
        year::int AS cal_year,
        f_and_f::numeric AS ff_val
      FROM team_report_fnf
      WHERE business_unit IS NOT NULL AND TRIM(business_unit) <> ''
        AND month IS NOT NULL AND TRIM(month::text) <> ''
        AND year IS NOT NULL
        AND f_and_f IS NOT NULL
    ),
    tagged AS (
      SELECT
        business_unit,
        CASE
          WHEN month_name IN (${startMonthsIn}) THEN cal_year
          ELSE cal_year - 1
        END AS fy_start_year,
        CASE
          WHEN month_name IN ('April', 'May', 'June') THEN 1
          WHEN month_name IN ('July', 'August', 'September') THEN 2
          WHEN month_name IN ('October', 'November', 'December') THEN 3
          WHEN month_name IN (${endMonthsIn}) THEN 4
          ELSE NULL
        END AS qtr,
        ff_val
      FROM scoped
    ),
    quarterly AS (
      SELECT
        business_unit,
        fy_start_year,
        SUM(ff_val) FILTER (WHERE qtr = 1) AS q1,
        SUM(ff_val) FILTER (WHERE qtr = 2) AS q2,
        SUM(ff_val) FILTER (WHERE qtr = 3) AS q3,
        SUM(ff_val) FILTER (WHERE qtr = 4) AS q4
      FROM tagged
      WHERE qtr IS NOT NULL
      GROUP BY business_unit, fy_start_year
    )
  `;

  const updateSet = quarterCols.map((col, idx) => `${col} = q.q${idx + 1}`).join(', ');
  const updateSql = mfsSummaryCols.has('updated_at')
    ? `${quarterlyCte}
       UPDATE team_summary_report s
       SET ${updateSet}, updated_at = CURRENT_TIMESTAMP
       FROM quarterly q
       WHERE s.business_unit = q.business_unit
         AND s.month = 'April'
         AND s.year::int = q.fy_start_year`
    : `${quarterlyCte}
       UPDATE team_summary_report s
       SET ${updateSet}
       FROM quarterly q
       WHERE s.business_unit = q.business_unit
         AND s.month = 'April'
         AND s.year::int = q.fy_start_year`;

  const updateResult = await client.query(updateSql);
  const insertCols = ['business_unit', 'month', 'year', 'hc', 'revenue', 'gpm', 'team_cost', 'net_margin', ...quarterCols];
  const insertSelect = [
    'q.business_unit',
    "'April'",
    'q.fy_start_year',
    '0', '0', '0', '0', '0',
    'q.q1', 'q.q2', 'q.q3', 'q.q4',
  ];
  const insertSql = `${quarterlyCte}
    INSERT INTO team_summary_report (${insertCols.join(', ')})
    SELECT ${insertSelect.join(', ')}
    FROM quarterly q
    WHERE NOT EXISTS (
      SELECT 1 FROM team_summary_report s
      WHERE s.business_unit = q.business_unit
        AND s.month = 'April'
        AND s.year::int = q.fy_start_year
    )`;

  const insertResult = await client.query(insertSql);
  const businessUnitsUpdated = (updateResult.rowCount || 0) + (insertResult.rowCount || 0);
  logger.info('F&F monthly totals synced to MFS summary quarters', { businessUnitsUpdated });
  return { businessUnitsUpdated };
}

/** Roll up client rows into summary (HC, Revenue, GPM, Team Cost; NP → net_margin) per BU/month/year. */
async function recomputeSummaryFromClient(runQuery, clientTable, summaryTable) {
  const aggSubquery = `
    SELECT business_unit, month, year,
      COALESCE(SUM(hc), 0) AS hc,
      COALESCE(SUM(revenue), 0) AS revenue,
      COALESCE(SUM(gpm), 0) AS gpm,
      COALESCE(SUM(team_cost), 0) AS team_cost,
      COALESCE(SUM(np), 0) AS net_margin
    FROM ${clientTable}
    WHERE business_unit IS NOT NULL AND TRIM(business_unit) <> ''
      AND month IS NOT NULL AND year IS NOT NULL
    GROUP BY business_unit, month, year
  `;

  await runQuery(`
    UPDATE ${summaryTable} s
    SET
      hc = a.hc,
      revenue = a.revenue,
      gpm = a.gpm,
      team_cost = a.team_cost,
      net_margin = a.net_margin
    FROM (${aggSubquery}) a
    WHERE s.business_unit = a.business_unit AND s.month = a.month AND s.year = a.year
  `);

  await runQuery(`
    INSERT INTO ${summaryTable} (business_unit, month, year, hc, revenue, gpm, team_cost, net_margin)
    SELECT a.business_unit, a.month, a.year, a.hc, a.revenue, a.gpm, a.team_cost, a.net_margin
    FROM (${aggSubquery}) a
    WHERE NOT EXISTS (
      SELECT 1 FROM ${summaryTable} s
      WHERE s.business_unit = a.business_unit AND s.month = a.month AND s.year = a.year
    )
  `);

  await runQuery(`
    UPDATE ${summaryTable} s
    SET hc = 0, revenue = 0, gpm = 0, team_cost = 0, net_margin = 0
    WHERE NOT EXISTS (
      SELECT 1 FROM ${clientTable} c
      WHERE c.business_unit = s.business_unit AND c.month = s.month AND c.year = s.year
    )
  `);
}

async function syncMfsStructureToFtFnf(pool, logger, type = 'all') {
  const client = await pool.connect();
  let summarySynced = 0;
  let clientSynced = 0;
  try {
    const ftSummaryCols = await getTableColumns(client, 'team_summary_report_ft');
    if (ftSummaryCols.size === 0) {
      throw new Error('Table "team_summary_report_ft" does not exist. Run create_ft_fnf_module_tables.sql on the database.');
    }
    await client.query('BEGIN');
    if (type === 'summary' || type === 'all') {
      for (const table of ['team_summary_report_ft', 'team_summary_report_fnf']) {
        const result = await client.query(`
          INSERT INTO ${table} (business_unit, month, year, hc, revenue, gpm, team_cost, net_margin)
          SELECT s.business_unit, s.month, s.year, 0, 0, 0, 0, 0
          FROM team_summary_report s
          WHERE s.business_unit IS NOT NULL AND TRIM(s.business_unit) <> ''
            AND s.month IS NOT NULL AND TRIM(s.month) <> ''
            AND s.year IS NOT NULL
            AND NOT EXISTS (
            SELECT 1 FROM ${table} t
            WHERE t.business_unit = s.business_unit AND t.month = s.month AND t.year = s.year
          )
        `);
        summarySynced += result.rowCount || 0;
      }
    }
    if (type === 'client' || type === 'all') {
      for (const table of ['team_report_ft', 'team_report_fnf']) {
        clientSynced += await insertClientStructureFromMfs(client, table);
      }
    }
    if (type === 'client' || type === 'all') {
      for (const [clientTable, summaryTable] of [
        ['team_report_ft', 'team_summary_report_ft'],
        ['team_report_fnf', 'team_summary_report_fnf'],
      ]) {
        await recomputeSummaryFromClient((sql, params) => client.query(sql, params), clientTable, summaryTable);
      }
    }
    await client.query('COMMIT');
    logger.info('MFS module structure synced', { summarySynced, clientSynced, type });
    return { summarySynced, clientSynced };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* connection may already be closed */
    }
    throw err;
  } finally {
    client.release();
  }
}

function registerMfsModuleRoutes(app, deps) {
  const { pool, executeQuery, logger, computeGpmNpForTeamReport } = deps;

  Object.entries(MODULE_CONFIG).forEach(([moduleKey, config]) => {
    const { prefix, summaryTable, clientTable } = config;

    app.get(`${prefix}/team-summary-report`, async (req, res, next) => {
      try {
        const { query, params } = buildTeamReportListQuery(summaryTable, req);
        const result = await executeQuery(query, params);
        res.json(result.rows);
      } catch (err) {
        next(err);
      }
    });

    app.get(`${prefix}/team-report`, async (req, res, next) => {
      try {
        const { query, params } = buildTeamReportListQuery(clientTable, req);
        const result = await executeQuery(query, params);
        res.json(result.rows);
      } catch (err) {
        next(err);
      }
    });

    app.post(`${prefix}/team-summary-report/bulk`, async (req, res, next) => {
      try {
        const { data } = req.body;
        if (!Array.isArray(data) || data.length === 0) {
          return res.status(400).json({ success: false, error: 'Expected non-empty array.' });
        }
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          let count = 0;
          for (const raw of data) {
            const record = { ...raw };
            if (record.business_unit) record.business_unit = normalizeBusinessUnitName(record.business_unit);
            if (!record.business_unit || !record.month || !record.year) {
              throw new Error('Business Unit, Month, and Year are required.');
            }
            record.month = normalizeMonthName(record.month);
            if (record.year < 100) record.year = 2000 + record.year;
            ['hc', 'revenue', 'gpm', 'team_cost', 'net_margin'].forEach((f) => {
              record[f] = parseNumeric(record[f]);
            });
            const existing = await client.query(
              `SELECT id FROM ${summaryTable} WHERE business_unit = $1 AND month = $2 AND year = $3`,
              [record.business_unit, record.month, record.year]
            );
            if (existing.rows.length > 0) {
              await client.query(
                `UPDATE ${summaryTable} SET hc = $1, revenue = $2, gpm = $3, team_cost = $4, net_margin = $5 WHERE id = $6`,
                [record.hc, record.revenue, record.gpm, record.team_cost, record.net_margin, existing.rows[0].id]
              );
            } else {
              await client.query(
                `INSERT INTO ${summaryTable} (business_unit, month, year, hc, revenue, gpm, team_cost, net_margin)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [record.business_unit, record.month, record.year, record.hc, record.revenue, record.gpm, record.team_cost, record.net_margin]
              );
            }
            count += 1;
          }
          await client.query('COMMIT');
          res.json({ success: true, inserted: count, module: moduleKey });
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      } catch (err) {
        next(err);
      }
    });

    // FT/F&F client bulk: MFS client identity required; month/year are not validated against MFS.
    app.post(`${prefix}/team-report/bulk`, async (req, res, next) => {
      try {
        const { data } = req.body;
        if (!Array.isArray(data) || data.length === 0) {
          return res.status(400).json({ success: false, error: 'Expected non-empty array.' });
        }
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const targetCols = await getTableColumns(client, clientTable);
          let updated = 0;
          let created = 0;
          let skipped = 0;
          const skippedSamples = [];
          const maxSkippedSamples = 10;

          for (const raw of data) {
            const record = { ...raw };
            if (record.business_unit) record.business_unit = normalizeBusinessUnitName(record.business_unit);
            if (!record.client_name || String(record.client_name).trim() === '') {
              skipped += 1;
              continue;
            }
            if (!record.month || !record.year) throw new Error('Month and Year are required.');
            record.month = normalizeMonthName(record.month);
            if (record.year < 100) record.year = 2000 + record.year;
            await resolveProjectNameFromMfs(client, record);
            const hadRowBefore = await findModuleClientRowId(client, clientTable, record);
            const numericFields = ['hc', 'salary_cost', 'revenue', 'gpm', 'gpm_percentage', 'leave_encashment',
              'team_cost', 'opr_cost', 'funding_cost', 'np', 'np_percentage', 'rebate', 'passthrough', 'vendor_cost', 'discount', 'f_and_f'];
            numericFields.forEach((f) => {
              if (!targetCols.has(f)) return;
              if (f === 'f_and_f' && moduleKey === 'fnf') {
                if (!Object.prototype.hasOwnProperty.call(raw, 'f_and_f')) {
                  delete record.f_and_f;
                  return;
                }
                const rawFf = raw.f_and_f;
                if (rawFf === null || rawFf === undefined || String(rawFf).trim() === '') {
                  record.f_and_f = null;
                } else {
                  record.f_and_f = parseNumeric(rawFf);
                }
                return;
              }
              if (Object.prototype.hasOwnProperty.call(raw, f)) {
                record[f] = parseNumeric(record[f]);
              } else {
                delete record[f];
              }
            });
            if (targetCols.has('alchemy_name') && Object.prototype.hasOwnProperty.call(raw, 'alchemy_name')) {
              const rawAlchemy = record.alchemy_name;
              record.alchemy_name = rawAlchemy === undefined || rawAlchemy === null || String(rawAlchemy).trim() === ''
                ? null
                : String(rawAlchemy).trim();
            } else {
              delete record.alchemy_name;
            }
            // FT/F&F: keep Excel/client-supplied metrics; MFS-style formula overwrite is for main team_report only.
            if (computeGpmNpForTeamReport && moduleKey !== 'ft' && moduleKey !== 'fnf') {
              const gpmNp = computeGpmNpForTeamReport(record);
              record.gpm = gpmNp.gpm;
              record.gpm_percentage = gpmNp.gpm_percentage;
              record.np = gpmNp.np !== null ? gpmNp.np : 0;
              record.np_percentage = gpmNp.np_percentage;
            }
            const metricKeysOnRecord = CLIENT_METRIC_COLS.filter((f) =>
              Object.prototype.hasOwnProperty.call(record, f)
            );
            const hasAlchemyOnRecord = Object.prototype.hasOwnProperty.call(record, 'alchemy_name');
            if (metricKeysOnRecord.length === 0 && !hasAlchemyOnRecord) {
              continue;
            }
            let rowId = await ensureModuleClientRowForImport(client, clientTable, targetCols, record);
            if (rowId) {
              const { setClause, valueKeys, idParam } = buildClientUpdateParts(targetCols, record);
              const values = valueKeys.map((key) => getClientUpdateValue(record, key));
              await client.query(
                `UPDATE ${clientTable} SET ${setClause} WHERE id = $${idParam}`,
                [...values, rowId]
              );
              if (hadRowBefore) updated += 1;
              else created += 1;
            } else {
              skipped += 1;
              if (skippedSamples.length < maxSkippedSamples) {
                skippedSamples.push({
                  business_unit: record.business_unit || '',
                  client_name: record.client_name || '',
                  project_name: record.project_name || '',
                  month: record.month,
                  year: record.year,
                });
              }
            }
          }
          if (updated === 0 && skipped > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
              success: false,
              error: 'No rows imported. Business Unit and Client Name must exist in MFS (Project for MS). Month and Year can be any value you enter.',
              updated: 0,
              skipped,
              skippedSamples,
              module: moduleKey,
              clientIdentityFromMfs: true,
            });
          }
          await recomputeSummaryFromClient(
            (sql, params) => client.query(sql, params),
            clientTable,
            summaryTable
          );
          let mfsFnfQuarterlySync = null;
          if (moduleKey === 'fnf' && updated > 0) {
            mfsFnfQuarterlySync = await syncFnfQuarterlyTotalsToMfsSummary(client, logger);
          }
          await client.query('COMMIT');
          res.json({
            success: true,
            updated,
            created,
            skipped,
            skippedSamples,
            module: moduleKey,
            summaryRecomputed: true,
            /** No new clients — only MFS-known BU/client; month/year may be new. */
            clientIdentityFromMfs: true,
            mfsFnfQuarterlySync,
          });
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      } catch (err) {
        next(err);
      }
    });

    app.patch(`${prefix}/team-summary-report/:id`, async (req, res, next) => {
      try {
        const { id } = req.params;
        const updates = req.body;
        const fields = Object.keys(updates);
        if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
        const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
        const result = await executeQuery(
          `UPDATE ${summaryTable} SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`,
          [...Object.values(updates), id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
        res.json(result.rows[0]);
      } catch (err) {
        next(err);
      }
    });

    app.patch(`${prefix}/team-report/:id`, async (req, res, next) => {
      try {
        const { id } = req.params;
        const updates = req.body;
        const fields = Object.keys(updates);
        if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
        const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
        const result = await executeQuery(
          `UPDATE ${clientTable} SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`,
          [...Object.values(updates), id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
        await recomputeSummaryFromClient(
          (sql, params) => executeQuery(sql, params),
          clientTable,
          summaryTable
        );
        if (clientTable === 'team_report_fnf') {
          const syncClient = await pool.connect();
          try {
            await syncFnfQuarterlyTotalsToMfsSummary(syncClient, logger);
          } finally {
            syncClient.release();
          }
        }
        res.json(result.rows[0]);
      } catch (err) {
        next(err);
      }
    });

    app.delete(`${prefix}/team-summary-report/:id`, async (req, res, next) => {
      try {
        const result = await executeQuery(`DELETE FROM ${summaryTable} WHERE id = $1 RETURNING id`, [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
        res.status(200).json({ message: 'Record deleted successfully', id: Number(req.params.id) });
      } catch (err) {
        next(err);
      }
    });

    app.delete(`${prefix}/team-report/:id`, async (req, res, next) => {
      try {
        const result = await executeQuery(`DELETE FROM ${clientTable} WHERE id = $1 RETURNING id`, [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
        await recomputeSummaryFromClient(
          (sql, params) => executeQuery(sql, params),
          clientTable,
          summaryTable
        );
        if (clientTable === 'team_report_fnf') {
          const syncClient = await pool.connect();
          try {
            await syncFnfQuarterlyTotalsToMfsSummary(syncClient, logger);
          } finally {
            syncClient.release();
          }
        }
        res.status(200).json({ message: 'Record deleted successfully', id: Number(req.params.id), summaryRecomputed: true });
      } catch (err) {
        next(err);
      }
    });
  });

  // Sync dimension rows from main MFS tables into FT and FNF (zero metric values)
  app.post('/api/mfs-modules/sync-structure', async (req, res, next) => {
    try {
      const { type } = req.body;
      const result = await syncMfsStructureToFtFnf(pool, logger, type || 'all');
      res.json({ success: true, ...result });
    } catch (err) {
      logger.error('MFS module sync-structure failed', {
        error: err.message,
        code: err.code,
        detail: err.detail,
        table: err.table,
      });
      res.status(500).json({
        success: false,
        error: err.message || 'Failed to sync FT/F&F structure from MFS',
        hint: 'Ensure create_ft_fnf_module_tables.sql was run on the database.',
        code: err.code,
      });
    }
  });
}

module.exports = {
  registerMfsModuleRoutes,
  syncMfsStructureToFtFnf,
  syncFnfQuarterlyTotalsToMfsSummary,
  MODULE_CONFIG,
};
