-- Migration 0020: PR Tracker sync RPCs and triggers
-- Creates stored procedures for syncing companies, projects, and employees
-- Also creates triggers to skip outbound syncs when writes come FROM PR Tracker

-- RPC: apply_tracker_company_sync
-- Called by Edge Function when PR Tracker sends a company sync
CREATE OR REPLACE FUNCTION apply_tracker_company_sync(
  p_tracker_id text,
  p_name text
)
RETURNS TABLE(org_id uuid, missing_fields text[]) AS $$
DECLARE
  v_org_id uuid;
  v_missing text[] := ARRAY[]::text[];
BEGIN
  -- Check for missing fields
  IF p_name IS NULL OR p_name = '' THEN
    v_missing := array_append(v_missing, 'name');
  END IF;

  -- Try to find existing organization by pr_tracker_company_id
  SELECT id INTO v_org_id FROM organizations
  WHERE pr_tracker_company_id = p_tracker_id LIMIT 1;

  IF v_org_id IS NOT NULL THEN
    -- Update existing
    UPDATE organizations
    SET
      name = COALESCE(p_name, name),
      sync_status = CASE WHEN array_length(v_missing, 1) > 0 THEN 'Incomplete' ELSE 'Synced' END,
      missing_fields = v_missing,
      last_synced_at = NOW(),
      updated_at = NOW()
    WHERE id = v_org_id
    AND current_setting('app.from_pr_tracker', true) IS NOT DISTINCT FROM 'true';
  ELSE
    -- Insert new
    INSERT INTO organizations (name, pr_tracker_company_id, sync_status, missing_fields, last_synced_at, created_at, updated_at)
    VALUES (
      COALESCE(p_name, 'Untitled'),
      p_tracker_id,
      CASE WHEN array_length(v_missing, 1) > 0 THEN 'Incomplete' ELSE 'Synced' END,
      v_missing,
      NOW(),
      NOW(),
      NOW()
    )
    RETURNING id INTO v_org_id;
  END IF;

  RETURN QUERY SELECT v_org_id, v_missing;
END;
$$ LANGUAGE plpgsql;

-- RPC: apply_tracker_project_sync
CREATE OR REPLACE FUNCTION apply_tracker_project_sync(
  p_tracker_id text,
  p_name text,
  p_org_id uuid,
  p_manager_name text DEFAULT NULL,
  p_manager_email text DEFAULT NULL
)
RETURNS TABLE(project_id uuid, missing_fields text[]) AS $$
DECLARE
  v_project_id uuid;
  v_missing text[] := ARRAY[]::text[];
BEGIN
  -- Check for missing fields
  IF p_name IS NULL OR p_name = '' THEN
    v_missing := array_append(v_missing, 'name');
  END IF;
  IF p_org_id IS NULL THEN
    v_missing := array_append(v_missing, 'organization');
  END IF;

  -- Try to find existing project
  SELECT id INTO v_project_id FROM projects
  WHERE pr_tracker_project_id = p_tracker_id LIMIT 1;

  IF v_project_id IS NOT NULL THEN
    -- Update existing
    UPDATE projects
    SET
      name = COALESCE(p_name, name),
      sync_status = CASE WHEN array_length(v_missing, 1) > 0 THEN 'Incomplete' ELSE 'Synced' END,
      missing_fields = v_missing,
      tracker_manager_name = p_manager_name,
      last_synced_at = NOW(),
      updated_at = NOW()
    WHERE id = v_project_id
    AND current_setting('app.from_pr_tracker', true) IS NOT DISTINCT FROM 'true';
  ELSE
    -- Insert new
    INSERT INTO projects (org_id, name, pr_tracker_project_id, sync_status, missing_fields, tracker_manager_name, created_at, updated_at)
    VALUES (
      p_org_id,
      COALESCE(p_name, 'Untitled'),
      p_tracker_id,
      CASE WHEN array_length(v_missing, 1) > 0 THEN 'Incomplete' ELSE 'Synced' END,
      v_missing,
      p_manager_name,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_project_id;
  END IF;

  RETURN QUERY SELECT v_project_id, v_missing;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Skip outbound webhook when write comes FROM PR Tracker
-- The Edge Function sets this GUC before writing, so the trigger knows to skip
CREATE OR REPLACE FUNCTION skip_webhook_if_from_tracker()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.from_pr_tracker', true) IS DISTINCT FROM 'true' THEN
    -- This write is NOT from PR Tracker, so normal webhook trigger should fire
    RETURN NEW;
  END IF;
  -- This write IS from PR Tracker, skip the webhook (prevent loops)
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Grant execute on functions to authenticated users
GRANT EXECUTE ON FUNCTION apply_tracker_company_sync TO authenticated, anon;
GRANT EXECUTE ON FUNCTION apply_tracker_project_sync TO authenticated, anon;
