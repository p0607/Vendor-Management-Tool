-- Add Discount column to team_report (Client MFS data) after Vendor Cost
-- Run this script on your database before deploying the backend/frontend changes.
-- Example: psql -U your_user -d vendor_management -f scripts/add_discount_to_team_report.sql

-- Add column (after vendor_cost in logical order; column order in table may vary)
ALTER TABLE team_report
  ADD COLUMN IF NOT EXISTS discount NUMERIC(18, 2) DEFAULT 0;

-- Optional: add comment
COMMENT ON COLUMN team_report.discount IS 'Discount amount for Client MFS data';
