-- Add Discount column to team_report (Client MFS data) after Vendor Cost
-- Run this script on your database before deploying if you use Discount on MFS client rows.
-- Import works without this column (backend skips missing columns automatically).
-- Example: psql -U your_user -d vendor_management -f scripts/add_discount_to_team_report.sql

ALTER TABLE team_report
  ADD COLUMN IF NOT EXISTS discount NUMERIC(18, 2) DEFAULT 0;

COMMENT ON COLUMN team_report.discount IS 'Discount amount for Client MFS data';
