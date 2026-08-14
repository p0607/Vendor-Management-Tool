-- Quarterly F&F columns on MFS summary (team_summary_report)
-- Values are entered manually per FY (import on April row or any row with F&F Q1–Q4 columns)
-- Example: psql -U your_user -d vendor_management -f scripts/add_f_and_f_columns.sql

ALTER TABLE team_summary_report
ADD COLUMN IF NOT EXISTS f_and_f_q1 NUMERIC DEFAULT 0;

ALTER TABLE team_summary_report
ADD COLUMN IF NOT EXISTS f_and_f_q2 NUMERIC DEFAULT 0;

ALTER TABLE team_summary_report
ADD COLUMN IF NOT EXISTS f_and_f_q3 NUMERIC DEFAULT 0;

ALTER TABLE team_summary_report
ADD COLUMN IF NOT EXISTS f_and_f_q4 NUMERIC DEFAULT 0;

COMMENT ON COLUMN team_summary_report.f_and_f_q1 IS 'Manual F&F Q1 (Apr–Jun) for the financial year';
COMMENT ON COLUMN team_summary_report.f_and_f_q2 IS 'Manual F&F Q2 (Jul–Sep) for the financial year';
COMMENT ON COLUMN team_summary_report.f_and_f_q3 IS 'Manual F&F Q3 (Oct–Dec) for the financial year';
COMMENT ON COLUMN team_summary_report.f_and_f_q4 IS 'Manual F&F Q4 (Jan–Mar) for the financial year';
