-- FT and F&F (FNF) data modules — same schema as MFS tables, separate values.
-- Run: psql -U vendor_user -d vendor_management -f scripts/create_ft_fnf_module_tables.sql

CREATE TABLE IF NOT EXISTS team_summary_report_ft (LIKE team_summary_report INCLUDING ALL);
CREATE TABLE IF NOT EXISTS team_summary_report_fnf (LIKE team_summary_report INCLUDING ALL);
CREATE TABLE IF NOT EXISTS team_report_ft (LIKE team_report INCLUDING ALL);
CREATE TABLE IF NOT EXISTS team_report_fnf (LIKE team_report INCLUDING ALL);

-- Ensure quarterly F&F columns exist on module summary tables (if parent was migrated later)
ALTER TABLE team_summary_report_ft
  ADD COLUMN IF NOT EXISTS f_and_f_q1 NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS f_and_f_q2 NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS f_and_f_q3 NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS f_and_f_q4 NUMERIC DEFAULT 0;

ALTER TABLE team_summary_report_fnf
  ADD COLUMN IF NOT EXISTS f_and_f_q1 NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS f_and_f_q2 NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS f_and_f_q3 NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS f_and_f_q4 NUMERIC DEFAULT 0;

COMMENT ON TABLE team_summary_report_ft IS 'MFS summary metrics for FT module';
COMMENT ON TABLE team_summary_report_fnf IS 'MFS summary metrics for F&F module';
COMMENT ON TABLE team_report_ft IS 'Client-wise metrics for FT module';
COMMENT ON TABLE team_report_fnf IS 'Client-wise metrics for F&F module';

-- Ensure client module tables have columns added to team_report after initial clone
ALTER TABLE team_report_ft
  ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS f_and_f NUMERIC DEFAULT 0;

ALTER TABLE team_report_fnf
  ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS f_and_f NUMERIC DEFAULT 0;
