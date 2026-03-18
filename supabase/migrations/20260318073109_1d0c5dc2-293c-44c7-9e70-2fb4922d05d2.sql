-- Add module.* permission keys to all roles
-- These control per-user/role module access (separate from module_settings global toggle)

-- Superadmin: all modules
INSERT INTO public.role_permissions (role_id, permission_key, allowed)
SELECT 'b0000000-0000-0000-0000-000000000004', unnest(ARRAY[
  'module.overview', 'module.projects', 'module.resource_plan', 'module.absence',
  'module.invoice_basis', 'module.fag', 'module.inbox', 'module.sales',
  'module.customers', 'module.management', 'module.admin',
  'module.calendar', 'module.documents', 'module.communication', 'module.contracts',
  'module.sharepoint', 'module.leads'
]), true
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Planlegger/Admin: most modules
INSERT INTO public.role_permissions (role_id, permission_key, allowed)
SELECT 'b0000000-0000-0000-0000-000000000003', unnest(ARRAY[
  'module.overview', 'module.projects', 'module.resource_plan', 'module.absence',
  'module.invoice_basis', 'module.inbox', 'module.sales',
  'module.customers', 'module.management', 'module.admin',
  'module.calendar', 'module.documents', 'module.communication', 'module.contracts',
  'module.sharepoint', 'module.leads'
]), true
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Prosjektleder: operational modules
INSERT INTO public.role_permissions (role_id, permission_key, allowed)
SELECT 'b0000000-0000-0000-0000-000000000002', unnest(ARRAY[
  'module.overview', 'module.projects', 'module.resource_plan', 'module.absence',
  'module.invoice_basis', 'module.sales', 'module.customers',
  'module.calendar', 'module.documents', 'module.communication', 'module.contracts',
  'module.leads'
]), true
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Montør: limited modules
INSERT INTO public.role_permissions (role_id, permission_key, allowed)
SELECT 'b0000000-0000-0000-0000-000000000001', unnest(ARRAY[
  'module.overview', 'module.projects', 'module.absence',
  'module.documents', 'module.communication'
]), true
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Ressursplan roles: resource plan focused
INSERT INTO public.role_permissions (role_id, permission_key, allowed)
SELECT '2c9226da-b200-4f8e-a160-675d97706a54', unnest(ARRAY[
  'module.overview', 'module.resource_plan'
]), true
ON CONFLICT (role_id, permission_key) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_key, allowed)
SELECT '987d4803-3d44-4950-9cd8-2ff27325cae7', unnest(ARRAY[
  'module.overview', 'module.resource_plan'
]), true
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Fill in missing action permissions for Superadmin role
INSERT INTO public.role_permissions (role_id, permission_key, allowed)
VALUES
  ('b0000000-0000-0000-0000-000000000004', 'resourceplan.view', true),
  ('b0000000-0000-0000-0000-000000000004', 'resourceplan.view_busy', true),
  ('b0000000-0000-0000-0000-000000000004', 'resourceplan.view_external_blocks', true),
  ('b0000000-0000-0000-0000-000000000004', 'resourceplan.view_external_titles', true),
  ('b0000000-0000-0000-0000-000000000004', 'resourceplan.view_external_details', true),
  ('b0000000-0000-0000-0000-000000000004', 'resourceplan.schedule', true),
  ('b0000000-0000-0000-0000-000000000004', 'resourceplan.edit_others', true),
  ('b0000000-0000-0000-0000-000000000004', 'resourceplan.cross_company', true),
  ('b0000000-0000-0000-0000-000000000004', 'calendar.read_busy', true),
  ('b0000000-0000-0000-0000-000000000004', 'calendar.view_external', true),
  ('b0000000-0000-0000-0000-000000000004', 'calendar.write_events', true),
  ('b0000000-0000-0000-0000-000000000004', 'calendar.delete_events', true),
  ('b0000000-0000-0000-0000-000000000004', 'admin.manage_companies', true),
  ('b0000000-0000-0000-0000-000000000004', 'admin.manage_departments', true),
  ('b0000000-0000-0000-0000-000000000004', 'admin.manage_users', true),
  ('b0000000-0000-0000-0000-000000000004', 'admin.manage_roles', true),
  ('b0000000-0000-0000-0000-000000000004', 'admin.manage_settings', true),
  ('b0000000-0000-0000-0000-000000000004', 'admin.data_integrity', true),
  ('b0000000-0000-0000-0000-000000000004', 'scope.view.all', true),
  ('b0000000-0000-0000-0000-000000000004', 'postkontor.view', true),
  ('b0000000-0000-0000-0000-000000000004', 'postkontor.admin', true),
  ('b0000000-0000-0000-0000-000000000004', 'data.delete', true),
  ('b0000000-0000-0000-0000-000000000004', 'contracts.read', true),
  ('b0000000-0000-0000-0000-000000000004', 'contracts.edit', true),
  ('b0000000-0000-0000-0000-000000000004', 'contracts.admin', true),
  ('b0000000-0000-0000-0000-000000000004', 'sharepoint.view', true),
  ('b0000000-0000-0000-0000-000000000004', 'sharepoint.upload', true),
  ('b0000000-0000-0000-0000-000000000004', 'sharepoint.delete', true),
  ('b0000000-0000-0000-0000-000000000004', 'sharepoint.link_job', true),
  ('b0000000-0000-0000-0000-000000000004', 'sharepoint.admin', true),
  ('b0000000-0000-0000-0000-000000000004', 'regulation.review', true),
  ('b0000000-0000-0000-0000-000000000004', 'jobs.view', true),
  ('b0000000-0000-0000-0000-000000000004', 'jobs.create', true),
  ('b0000000-0000-0000-0000-000000000004', 'jobs.edit', true),
  ('b0000000-0000-0000-0000-000000000004', 'jobs.delete', true),
  ('b0000000-0000-0000-0000-000000000004', 'jobs.archive', true),
  ('b0000000-0000-0000-0000-000000000004', 'jobs.assign_users', true),
  ('b0000000-0000-0000-0000-000000000004', 'jobs.view_pricing', true),
  ('b0000000-0000-0000-0000-000000000004', 'offers.view', true),
  ('b0000000-0000-0000-0000-000000000004', 'offers.create', true),
  ('b0000000-0000-0000-0000-000000000004', 'offers.edit', true),
  ('b0000000-0000-0000-0000-000000000004', 'offers.delete', true),
  ('b0000000-0000-0000-0000-000000000004', 'offers.archive', true),
  ('b0000000-0000-0000-0000-000000000004', 'calc.view', true),
  ('b0000000-0000-0000-0000-000000000004', 'calc.edit', true),
  ('b0000000-0000-0000-0000-000000000004', 'docs.view', true),
  ('b0000000-0000-0000-0000-000000000004', 'docs.upload', true),
  ('b0000000-0000-0000-0000-000000000004', 'docs.delete', true),
  ('b0000000-0000-0000-0000-000000000004', 'comm.view', true),
  ('b0000000-0000-0000-0000-000000000004', 'comm.create_note', true),
  ('b0000000-0000-0000-0000-000000000004', 'comm.delete_note', true),
  ('b0000000-0000-0000-0000-000000000004', 'leads.view', true),
  ('b0000000-0000-0000-0000-000000000004', 'leads.create', true),
  ('b0000000-0000-0000-0000-000000000004', 'leads.edit', true),
  ('b0000000-0000-0000-0000-000000000004', 'leads.transfer_owner', true),
  ('b0000000-0000-0000-0000-000000000004', 'leads.manage_participants', true),
  ('b0000000-0000-0000-0000-000000000004', 'leads.convert', true),
  ('b0000000-0000-0000-0000-000000000004', 'leads.email_draft', true),
  ('b0000000-0000-0000-0000-000000000004', 'leads.create_meeting', true),
  -- Missing action permissions for Planlegger/Admin
  ('b0000000-0000-0000-0000-000000000003', 'resourceplan.view', true),
  ('b0000000-0000-0000-0000-000000000003', 'resourceplan.view_busy', true),
  ('b0000000-0000-0000-0000-000000000003', 'resourceplan.view_external_blocks', true),
  ('b0000000-0000-0000-0000-000000000003', 'resourceplan.view_external_titles', true),
  ('b0000000-0000-0000-0000-000000000003', 'resourceplan.view_external_details', true),
  ('b0000000-0000-0000-0000-000000000003', 'resourceplan.schedule', true),
  ('b0000000-0000-0000-0000-000000000003', 'resourceplan.edit_others', true),
  ('b0000000-0000-0000-0000-000000000003', 'calendar.read_busy', true),
  ('b0000000-0000-0000-0000-000000000003', 'calendar.view_external', true),
  ('b0000000-0000-0000-0000-000000000003', 'postkontor.view', true),
  ('b0000000-0000-0000-0000-000000000003', 'postkontor.admin', true),
  ('b0000000-0000-0000-0000-000000000003', 'data.delete', true),
  ('b0000000-0000-0000-0000-000000000003', 'contracts.read', true),
  ('b0000000-0000-0000-0000-000000000003', 'contracts.edit', true),
  ('b0000000-0000-0000-0000-000000000003', 'contracts.admin', true),
  ('b0000000-0000-0000-0000-000000000003', 'sharepoint.view', true),
  ('b0000000-0000-0000-0000-000000000003', 'sharepoint.upload', true),
  ('b0000000-0000-0000-0000-000000000003', 'sharepoint.delete', true),
  ('b0000000-0000-0000-0000-000000000003', 'sharepoint.link_job', true),
  ('b0000000-0000-0000-0000-000000000003', 'admin.manage_companies', true),
  ('b0000000-0000-0000-0000-000000000003', 'admin.manage_departments', true),
  ('b0000000-0000-0000-0000-000000000003', 'admin.manage_users', true),
  ('b0000000-0000-0000-0000-000000000003', 'admin.manage_roles', true),
  ('b0000000-0000-0000-0000-000000000003', 'admin.manage_settings', true),
  -- Missing for Prosjektleder
  ('b0000000-0000-0000-0000-000000000002', 'resourceplan.view', true),
  ('b0000000-0000-0000-0000-000000000002', 'resourceplan.view_busy', true),
  ('b0000000-0000-0000-0000-000000000002', 'resourceplan.view_external_blocks', true),
  ('b0000000-0000-0000-0000-000000000002', 'resourceplan.view_external_titles', true),
  ('b0000000-0000-0000-0000-000000000002', 'calendar.read_busy', true),
  ('b0000000-0000-0000-0000-000000000002', 'contracts.read', true),
  ('b0000000-0000-0000-0000-000000000002', 'sharepoint.view', true),
  ('b0000000-0000-0000-0000-000000000002', 'sharepoint.upload', true),
  -- Missing for Ressursplan roles
  ('2c9226da-b200-4f8e-a160-675d97706a54', 'resourceplan.view', true),
  ('2c9226da-b200-4f8e-a160-675d97706a54', 'resourceplan.view_busy', true),
  ('987d4803-3d44-4950-9cd8-2ff27325cae7', 'resourceplan.view', true),
  ('987d4803-3d44-4950-9cd8-2ff27325cae7', 'resourceplan.view_busy', true),
  -- Absence permissions
  ('b0000000-0000-0000-0000-000000000001', 'absence.create_self', true),
  ('b0000000-0000-0000-0000-000000000002', 'absence.create_self', true),
  ('b0000000-0000-0000-0000-000000000002', 'absence.view_team', true),
  ('b0000000-0000-0000-0000-000000000003', 'absence.create_self', true),
  ('b0000000-0000-0000-0000-000000000003', 'absence.create_for_others', true),
  ('b0000000-0000-0000-0000-000000000003', 'absence.approve', true),
  ('b0000000-0000-0000-0000-000000000003', 'absence.view_team', true),
  ('b0000000-0000-0000-0000-000000000003', 'absence.view_company', true),
  ('b0000000-0000-0000-0000-000000000004', 'absence.create_self', true),
  ('b0000000-0000-0000-0000-000000000004', 'absence.create_for_others', true),
  ('b0000000-0000-0000-0000-000000000004', 'absence.approve', true),
  ('b0000000-0000-0000-0000-000000000004', 'absence.view_team', true),
  ('b0000000-0000-0000-0000-000000000004', 'absence.view_company', true)
ON CONFLICT (role_id, permission_key) DO NOTHING;