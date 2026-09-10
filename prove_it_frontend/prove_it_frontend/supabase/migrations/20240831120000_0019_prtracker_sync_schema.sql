-- Migration 0019: PR Tracker sync schema
-- Adds fields to organizations and projects tables to track sync status with PR Tracker

-- Add columns to organizations table
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS pr_tracker_company_id text UNIQUE,
ADD COLUMN IF NOT EXISTS sync_status text CHECK (sync_status IN ('Not Synced', 'Synced', 'Incomplete', 'Blocked', 'Sync Failed')),
ADD COLUMN IF NOT EXISTS missing_fields text[],
ADD COLUMN IF NOT EXISTS last_synced_at timestamp with time zone;

-- Add columns to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS pr_tracker_project_id text UNIQUE,
ADD COLUMN IF NOT EXISTS sync_status text CHECK (sync_status IN ('Not Synced', 'Synced', 'Incomplete', 'Blocked', 'Sync Failed')),
ADD COLUMN IF NOT EXISTS missing_fields text[],
ADD COLUMN IF NOT EXISTS last_synced_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS tracker_manager_name text;

-- Add column to org_members table
ALTER TABLE org_members
ADD COLUMN IF NOT EXISTS pr_tracker_emp_id text;

-- Create index on pr_tracker_company_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_organizations_pr_tracker_company_id
ON organizations(pr_tracker_company_id);

CREATE INDEX IF NOT EXISTS idx_projects_pr_tracker_project_id
ON projects(pr_tracker_project_id);

CREATE INDEX IF NOT EXISTS idx_org_members_pr_tracker_emp_id
ON org_members(pr_tracker_emp_id);
