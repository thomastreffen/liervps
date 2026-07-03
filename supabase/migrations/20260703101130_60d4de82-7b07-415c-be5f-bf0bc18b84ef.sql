-- super_admin bypass: check_permission_v2 always returns true for super_admin users
CREATE OR REPLACE FUNCTION public.check_permission_v2(_auth_user_id uuid, _perm text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    -- 0. Super admin bypass — any of the legacy/v2/assignment tables
    (SELECT true WHERE EXISTS (
       SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = _auth_user_id AND ur.role::text = 'super_admin'
    ) OR EXISTS (
       SELECT 1 FROM public.user_roles_v2 urv
       JOIN public.user_accounts ua ON ua.id = urv.user_account_id
       JOIN public.roles r ON r.id = urv.role_id
       WHERE ua.auth_user_id = _auth_user_id AND ua.is_active = true AND r.name = 'super_admin'
    ) OR EXISTS (
       SELECT 1 FROM public.user_role_assignments ura
       JOIN public.roles r ON r.id = ura.role_id
       WHERE ura.user_id = _auth_user_id AND r.name = 'super_admin'
    )),
    -- 1. Override (v2)
    (SELECT CASE WHEN upo.mode = 'allow' THEN true ELSE false END
     FROM public.user_permission_overrides_v2 upo
     JOIN public.user_accounts ua ON ua.id = upo.user_account_id
     WHERE ua.auth_user_id = _auth_user_id AND ua.is_active = true
       AND upo.permission_key = _perm
     LIMIT 1),
    -- 2. Role permissions via user_roles_v2
    (SELECT bool_or(rp.allowed)
     FROM public.user_roles_v2 urv
     JOIN public.user_accounts ua ON ua.id = urv.user_account_id
     JOIN public.role_permissions rp ON rp.role_id = urv.role_id
     WHERE ua.auth_user_id = _auth_user_id AND ua.is_active = true
       AND rp.permission_key = _perm),
    false
  )
$function$;