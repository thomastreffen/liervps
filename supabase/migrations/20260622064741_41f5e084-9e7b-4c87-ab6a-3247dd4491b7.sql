
-- ============================================================
-- 1. company_settings: only members of the company may read
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view company settings" ON public.company_settings;
CREATE POLICY "Members read own company settings"
  ON public.company_settings FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.is_company_member(auth.uid(), id)
    OR public.user_has_company_access(auth.uid(), id)
  );

-- ============================================================
-- 2. customer_contact_tag_relations: scope by contact's company
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage contact tag relations"
  ON public.customer_contact_tag_relations;

CREATE POLICY "Members read contact tag relations"
  ON public.customer_contact_tag_relations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.customer_contacts cc
      JOIN public.customers cu ON cu.id = cc.customer_id
      WHERE cc.id = customer_contact_tag_relations.contact_id
        AND cu.company_id IS NOT NULL
        AND (
          public.is_company_member(auth.uid(), cu.company_id)
          OR public.user_has_company_access(auth.uid(), cu.company_id)
        )
    )
  );

CREATE POLICY "Members write contact tag relations"
  ON public.customer_contact_tag_relations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.customer_contacts cc
      JOIN public.customers cu ON cu.id = cc.customer_id
      WHERE cc.id = customer_contact_tag_relations.contact_id
        AND cu.company_id IS NOT NULL
        AND (
          public.is_company_member(auth.uid(), cu.company_id)
          OR public.user_has_company_access(auth.uid(), cu.company_id)
        )
    )
  );

CREATE POLICY "Members delete contact tag relations"
  ON public.customer_contact_tag_relations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.customer_contacts cc
      JOIN public.customers cu ON cu.id = cc.customer_id
      WHERE cc.id = customer_contact_tag_relations.contact_id
        AND cu.company_id IS NOT NULL
        AND (
          public.is_company_member(auth.uid(), cu.company_id)
          OR public.user_has_company_access(auth.uid(), cu.company_id)
        )
    )
  );

-- ============================================================
-- 3. customer_tag_relations: scope by customer's company
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view tag relations" ON public.customer_tag_relations;
DROP POLICY IF EXISTS "Authenticated users can manage tag relations" ON public.customer_tag_relations;
DROP POLICY IF EXISTS "Authenticated users can delete tag relations" ON public.customer_tag_relations;

CREATE POLICY "Members read customer tag relations"
  ON public.customer_tag_relations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_tag_relations.customer_id
        AND c.company_id IS NOT NULL
        AND (
          public.is_company_member(auth.uid(), c.company_id)
          OR public.user_has_company_access(auth.uid(), c.company_id)
        )
    )
  );

CREATE POLICY "Members insert customer tag relations"
  ON public.customer_tag_relations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_tag_relations.customer_id
        AND c.company_id IS NOT NULL
        AND (
          public.is_company_member(auth.uid(), c.company_id)
          OR public.user_has_company_access(auth.uid(), c.company_id)
        )
    )
  );

CREATE POLICY "Members delete customer tag relations"
  ON public.customer_tag_relations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_tag_relations.customer_id
        AND c.company_id IS NOT NULL
        AND (
          public.is_company_member(auth.uid(), c.company_id)
          OR public.user_has_company_access(auth.uid(), c.company_id)
        )
    )
  );

-- ============================================================
-- 4. form_signatures: only related users / company members / admin can read
-- ============================================================
DROP POLICY IF EXISTS "Users view form_signatures" ON public.form_signatures;

CREATE POLICY "Members read form_signatures"
  ON public.form_signatures FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.form_instances fi
      WHERE fi.id = form_signatures.instance_id
        AND (
          fi.assigned_to = auth.uid()
          OR fi.created_by = auth.uid()
          OR (fi.company_id IS NOT NULL AND (
            public.is_company_member(auth.uid(), fi.company_id)
            OR public.user_has_company_access(auth.uid(), fi.company_id)
          ))
        )
    )
  );

-- ============================================================
-- 5. invoice_basis: company members + admin only
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users read invoice_basis" ON public.invoice_basis;

CREATE POLICY "Members read invoice_basis"
  ON public.invoice_basis FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR (company_id IS NOT NULL AND (
      public.is_company_member(auth.uid(), company_id)
      OR public.user_has_company_access(auth.uid(), company_id)
    ))
  );

-- ============================================================
-- 6. products: company members only
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read products" ON public.products;

CREATE POLICY "Members read products"
  ON public.products FOR SELECT
  TO authenticated
  USING (
    company_id IS NOT NULL AND (
      public.user_has_company_access(auth.uid(), company_id)
      OR public.is_company_member(auth.uid(), company_id)
    )
  );

-- ============================================================
-- 7. STORAGE: calculation-attachments (path: {calc_id}/...)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view calculation attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload calculation attachments" ON storage.objects;

CREATE POLICY "Members read calculation attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'calculation-attachments'
    AND EXISTS (
      SELECT 1 FROM public.calculations c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND c.company_id IS NOT NULL
        AND (
          public.user_has_company_access(auth.uid(), c.company_id)
          OR public.is_company_member(auth.uid(), c.company_id)
        )
    )
  );

CREATE POLICY "Members upload calculation attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'calculation-attachments'
    AND EXISTS (
      SELECT 1 FROM public.calculations c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND c.company_id IS NOT NULL
        AND (
          public.user_has_company_access(auth.uid(), c.company_id)
          OR public.is_company_member(auth.uid(), c.company_id)
        )
    )
  );

-- ============================================================
-- 8. STORAGE: conversation-files (path: {company_id}/{thread_id}/{post_id}/...)
-- ============================================================
DROP POLICY IF EXISTS "Users can read conversation files" ON storage.objects;
DROP POLICY IF EXISTS "conv_files_authenticated_select" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload conversation files" ON storage.objects;
DROP POLICY IF EXISTS "conv_files_authenticated_insert" ON storage.objects;

CREATE POLICY "Members read conversation files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'conversation-files'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Members upload conversation files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'conversation-files'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

-- ============================================================
-- 9. STORAGE: order-form-attachments (path: {company_id}/{submission_id}/...)
--    Drop anon SELECT entirely; force signed URLs or edge function.
--    Keep anon INSERT only for open submissions with valid public access.
-- ============================================================
DROP POLICY IF EXISTS "Anon can read order form attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anon can upload order form attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read order form attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload order form attachments" ON storage.objects;

CREATE POLICY "Members read order form attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'order-form-attachments'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Members upload order form attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'order-form-attachments'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Anon upload to open order submission"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'order-form-attachments'
    AND (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
    AND public.order_submission_allows_public_child_insert(((storage.foldername(name))[2])::uuid)
  );
