
DO $$
DECLARE
  _admin_id uuid := 'b0000000-0000-0000-0000-000000000003'; -- Planlegger/Admin
  _super_id uuid := 'b0000000-0000-0000-0000-000000000004'; -- Superadmin
  _pl_id uuid := 'b0000000-0000-0000-0000-000000000002'; -- Prosjektleder
  _mont_id uuid := 'b0000000-0000-0000-0000-000000000001'; -- Montør
BEGIN
  -- Admin (Planlegger/Admin) - full module access
  INSERT INTO public.role_permissions (role_id, permission_key, allowed) VALUES
    (_admin_id, 'documents.upload', true),
    (_admin_id, 'documents.delete', true),
    (_admin_id, 'documents.analyze', true),
    (_admin_id, 'change_orders.create', true),
    (_admin_id, 'change_orders.send', true),
    (_admin_id, 'change_orders.cancel', true),
    (_admin_id, 'change_orders.mark_invoiced', true),
    (_admin_id, 'contracts.create', true),
    (_admin_id, 'contracts.analyze', true),
    (_admin_id, 'contracts.upload_document', true),
    (_admin_id, 'calculations.create', true),
    (_admin_id, 'calculations.edit', true),
    (_admin_id, 'calculations.ai_generate', true),
    (_admin_id, 'calculations.create_offer', true),
    (_admin_id, 'projects.edit_plan', true),
    (_admin_id, 'projects.delete_attachment', true),
    (_admin_id, 'admin.data_integrity', true)
  ON CONFLICT DO NOTHING;

  -- Superadmin
  INSERT INTO public.role_permissions (role_id, permission_key, allowed) VALUES
    (_super_id, 'documents.upload', true),
    (_super_id, 'documents.delete', true),
    (_super_id, 'documents.analyze', true),
    (_super_id, 'change_orders.create', true),
    (_super_id, 'change_orders.send', true),
    (_super_id, 'change_orders.cancel', true),
    (_super_id, 'change_orders.mark_invoiced', true),
    (_super_id, 'contracts.create', true),
    (_super_id, 'contracts.analyze', true),
    (_super_id, 'contracts.upload_document', true),
    (_super_id, 'calculations.create', true),
    (_super_id, 'calculations.edit', true),
    (_super_id, 'calculations.ai_generate', true),
    (_super_id, 'calculations.create_offer', true),
    (_super_id, 'projects.edit_plan', true),
    (_super_id, 'projects.delete_attachment', true),
    (_super_id, 'admin.data_integrity', true)
  ON CONFLICT DO NOTHING;

  -- Prosjektleder
  INSERT INTO public.role_permissions (role_id, permission_key, allowed) VALUES
    (_pl_id, 'documents.upload', true),
    (_pl_id, 'documents.delete', true),
    (_pl_id, 'documents.analyze', true),
    (_pl_id, 'change_orders.create', true),
    (_pl_id, 'change_orders.send', true),
    (_pl_id, 'change_orders.cancel', true),
    (_pl_id, 'change_orders.mark_invoiced', true),
    (_pl_id, 'contracts.create', true),
    (_pl_id, 'contracts.analyze', true),
    (_pl_id, 'contracts.upload_document', true),
    (_pl_id, 'calculations.create', true),
    (_pl_id, 'calculations.edit', true),
    (_pl_id, 'calculations.ai_generate', true),
    (_pl_id, 'calculations.create_offer', true),
    (_pl_id, 'projects.edit_plan', true),
    (_pl_id, 'projects.delete_attachment', true)
  ON CONFLICT DO NOTHING;

  -- Montør - limited
  INSERT INTO public.role_permissions (role_id, permission_key, allowed) VALUES
    (_mont_id, 'documents.upload', true)
  ON CONFLICT DO NOTHING;
END $$;
