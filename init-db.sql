-- Database initialization script for Vendor Management Tool
-- This script runs when the PostgreSQL container starts for the first time

-- Create database if it doesn't exist
SELECT 'CREATE DATABASE vendor_management'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'vendor_management');

-- Connect to the database
\c vendor_management;

-- Create extensions if they don't exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS public;

-- Set default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO vmt_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO vmt_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO vmt_user;

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO vmt_user;

-- Grant all privileges on all tables in schema public
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO vmt_user;

-- Grant all privileges on all sequences in schema public
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO vmt_user;

-- Grant all privileges on all functions in schema public
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO vmt_user;

-- Set search path
SET search_path TO public;

-- Create basic tables if they don't exist (these will be overridden by your backup)
CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial migration record
INSERT INTO migrations (name) VALUES ('initial_setup') ON CONFLICT DO NOTHING;

-- Set timezone
SET timezone = 'UTC';

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Database initialization completed successfully';
END $$;
