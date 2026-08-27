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
  if (typeof value === 'number') return value;
  const strValue = String(value).trim();
  if (strValue === '-' || strValue === '') return 0;
  return parseFloat(strValue.replace(/,/g, '')) || 0;
};

const CLIENT_DIMENSION_COLS = ['client_name', 'project_name', 'business_unit', 'bu_head', 'month', 'year'];
const CLIENT_METRIC_COLS = [
  'hc', 'salary_cost', 'revenue', 'gpm', 'gpm_percentage', 'leave_encashment',
  'team_cost', 'opr_cost', 'funding_cost', 'np', 'np_percentage',
  'rebate', 'passthrough', 'vendor_cost', 'discount', 'f_and_f',
];

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

/** Build UPDATE for client bulk import using only columns present on the module table. */
function buildClientUpdateParts(targetCols) {
  const fields = ['bu_head', ...CLIENT_METRIC_COLS].filter((f) => targetCols.has(f));
  if (fields.length === 0) {
    throw new Error('No updatable columns found on client module table.');
  }
  const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  const valueKeys = fields;
  return { setClause, valueKeys, idParam: fields.length + 1 };
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
        const { business_unit: businessUnit } = req.query;
        let query = `SELECT * FROM ${summaryTable}`;
        const params = [];
        if (businessUnit) {
          query += " WHERE LOWER(REGEXP_REPLACE(TRIM(business_unit), '\\s*\\|\\s*', '|', 'g')) = LOWER(REGEXP_REPLACE(TRIM($1), '\\s*\\|\\s*', '|', 'g'))";
          params.push(businessUnit);
        }
        query += ' ORDER BY year DESC, month, business_unit';
        const result = await executeQuery(query, params);
        res.json(result.rows);
      } catch (err) {
        next(err);
      }
    });

    app.get(`${prefix}/team-report`, async (req, res, next) => {
      try {
        const { designation, business_unit: businessUnit } = req.query;
        let query = `SELECT * FROM ${clientTable}`;
        const params = [];
        if (designation === 'BU HEAD' && businessUnit) {
          query += " WHERE LOWER(REGEXP_REPLACE(TRIM(business_unit), '\\s*\\|\\s*', '|', 'g')) = LOWER(REGEXP_REPLACE(TRIM($1), '\\s*\\|\\s*', '|', 'g'))";
          params.push(businessUnit);
        }
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
          const { setClause, valueKeys, idParam } = buildClientUpdateParts(targetCols);
          let updated = 0;
          let skipped = 0;
          const skippedSamples = [];
          const maxSkippedSamples = 10;

          for (const raw of data) {
            const record = { ...raw };
            if (record.business_unit) record.business_unit = normalizeBusinessUnitName(record.business_unit);
            if (!record.month || !record.year) throw new Error('Month and Year are required.');
            record.month = normalizeMonthName(record.month);
            if (record.year < 100) record.year = 2000 + record.year;
            const numericFields = ['hc', 'salary_cost', 'revenue', 'gpm', 'gpm_percentage', 'leave_encashment',
              'team_cost', 'opr_cost', 'funding_cost', 'np', 'np_percentage', 'rebate', 'passthrough', 'vendor_cost', 'discount', 'f_and_f'];
            numericFields.forEach((f) => {
              if (targetCols.has(f)) record[f] = parseNumeric(record[f]);
            });
            if (computeGpmNpForTeamReport) {
              const gpmNp = computeGpmNpForTeamReport(record);
              record.gpm = gpmNp.gpm;
              record.gpm_percentage = gpmNp.gpm_percentage;
              record.np = gpmNp.np !== null ? gpmNp.np : 0;
              record.np_percentage = gpmNp.np_percentage;
            }
            const existing = await client.query(
              `SELECT id FROM ${clientTable} WHERE business_unit IS NOT DISTINCT FROM $1 AND client_name IS NOT DISTINCT FROM $2
               AND project_name IS NOT DISTINCT FROM $3 AND month = $4 AND year = $5 LIMIT 1`,
              [record.business_unit || null, record.client_name || null, record.project_name || null, record.month, record.year]
            );
            if (existing.rows.length > 0) {
              const values = valueKeys.map((key) => record[key] ?? (key === 'bu_head' ? null : 0));
              await client.query(
                `UPDATE ${clientTable} SET ${setClause} WHERE id = $${idParam}`,
                [...values, existing.rows[0].id]
              );
              updated += 1;
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
              error: 'No rows matched existing FT/F&F structure. Download the client template — do not change client, project, BU, month, or year.',
              updated: 0,
              skipped,
              skippedSamples,
              module: moduleKey,
              strictImport: true,
            });
          }
          await recomputeSummaryFromClient(
            (sql, params) => client.query(sql, params),
            clientTable,
            summaryTable
          );
          await client.query('COMMIT');
          res.json({
            success: true,
            updated,
            skipped,
            skippedSamples,
            module: moduleKey,
            summaryRecomputed: true,
            strictImport: true,
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

module.exports = { registerMfsModuleRoutes, syncMfsStructureToFtFnf, MODULE_CONFIG };
