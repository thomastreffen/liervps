
-- Seed default roles
INSERT INTO public.roles (name, description, is_system_role)
SELECT v.name, v.descr, true FROM (VALUES
  ('super_admin','Superadministrator med full tilgang'),
  ('admin','Administrator'),
  ('tekniker','Tekniker / montør'),
  ('bruker','Standard bruker')
) AS v(name, descr)
WHERE NOT EXISTS (SELECT 1 FROM public.roles r WHERE r.name = v.name);

CREATE OR REPLACE FUNCTION public.ensure_user_provisioning(
  p_full_name text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_avatar text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_name text;
  v_company_id uuid;
  v_person_id uuid;
  v_account_id uuid;
  v_membership_created boolean := false;
  v_person_created boolean := false;
  v_account_created boolean := false;
  v_role_assigned text := null;
  v_has_any_superadmin boolean;
  v_ep_id uuid;
  v_tech_id uuid;
  v_role_name text;
  v_role_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  v_email := lower(coalesce(p_email, (auth.jwt() ->> 'email')));
  v_name := coalesce(nullif(trim(p_full_name), ''), v_email);

  SELECT id INTO v_company_id
  FROM public.internal_companies
  WHERE is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  SELECT id, person_id INTO v_account_id, v_person_id
  FROM public.user_accounts WHERE auth_user_id = v_uid LIMIT 1;

  IF v_person_id IS NULL AND v_email IS NOT NULL THEN
    SELECT id INTO v_person_id FROM public.people WHERE lower(email) = v_email LIMIT 1;
  END IF;

  IF v_person_id IS NULL THEN
    INSERT INTO public.people (full_name, email, is_active)
    VALUES (v_name, v_email, true) RETURNING id INTO v_person_id;
    v_person_created := true;
  ELSE
    UPDATE public.people
    SET full_name = COALESCE(NULLIF(trim(v_name), ''), full_name),
        email = COALESCE(v_email, email),
        is_active = true
    WHERE id = v_person_id;
  END IF;

  IF v_account_id IS NULL THEN
    INSERT INTO public.user_accounts (person_id, auth_user_id, company_id, is_active)
    VALUES (v_person_id, v_uid, v_company_id, true) RETURNING id INTO v_account_id;
    v_account_created := true;
  ELSE
    UPDATE public.user_accounts
    SET person_id = v_person_id,
        company_id = COALESCE(company_id, v_company_id),
        is_active = true
    WHERE id = v_account_id;
  END IF;

  -- Ensure membership
  IF v_company_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.user_memberships WHERE user_id = v_uid AND company_id = v_company_id
  ) THEN
    INSERT INTO public.user_memberships (user_id, company_id, is_active)
    VALUES (v_uid, v_company_id, true);
    v_membership_created := true;
  ELSE
    UPDATE public.user_memberships SET is_active = true
    WHERE user_id = v_uid AND company_id = v_company_id;
  END IF;

  -- First user becomes super_admin (legacy user_roles)
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin') INTO v_has_any_superadmin;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_uid) THEN
    IF NOT v_has_any_superadmin THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'super_admin');
      v_role_assigned := 'super_admin';
    ELSE
      INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'montør');
      v_role_assigned := 'montør';
    END IF;
  END IF;

  -- Ensure employment_profile so person is plannable in the tenant
  IF v_company_id IS NOT NULL THEN
    SELECT id INTO v_ep_id FROM public.employment_profiles
    WHERE person_id = v_person_id AND company_id = v_company_id LIMIT 1;
    IF v_ep_id IS NULL THEN
      INSERT INTO public.employment_profiles (person_id, company_id, is_plannable_resource, relationship_type, include_in_hms_people)
      VALUES (v_person_id, v_company_id, true, 'employee', true);
    END IF;
  END IF;

  -- Ensure technicians row so Ressursplan can render user
  SELECT id INTO v_tech_id FROM public.technicians WHERE user_id = v_uid LIMIT 1;
  IF v_tech_id IS NULL THEN
    INSERT INTO public.technicians (user_id, name, email, is_plannable_resource)
    VALUES (v_uid, v_name, v_email, true);
  ELSE
    UPDATE public.technicians
    SET name = COALESCE(NULLIF(trim(v_name),''), name),
        email = COALESCE(v_email, email),
        archived_at = NULL,
        deleted_at = NULL
    WHERE id = v_tech_id;
  END IF;

  -- Sync legacy user_roles -> user_roles_v2 (map montør -> tekniker)
  SELECT role INTO v_role_name FROM public.user_roles WHERE user_id = v_uid LIMIT 1;
  IF v_role_name IS NOT NULL THEN
    SELECT id INTO v_role_id FROM public.roles
    WHERE name = CASE
      WHEN v_role_name IN ('montør','montor','technician') THEN 'tekniker'
      ELSE v_role_name
    END
    LIMIT 1;
    IF v_role_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.user_roles_v2 WHERE user_account_id = v_account_id AND role_id = v_role_id
    ) THEN
      INSERT INTO public.user_roles_v2 (user_account_id, role_id) VALUES (v_account_id, v_role_id);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'auth_user_id', v_uid,
    'email', v_email,
    'company_id', v_company_id,
    'person_id', v_person_id,
    'person_created', v_person_created,
    'user_account_id', v_account_id,
    'account_created', v_account_created,
    'membership_created', v_membership_created,
    'role_assigned', v_role_assigned,
    'role_v2', v_role_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_user_provisioning(text, text, text) TO authenticated;
