import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user is super_admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Check super_admin permission
    const { data: permCheck } = await admin.rpc("check_permission_v2", {
      _auth_user_id: user.id,
      _perm: "admin.manage_users",
    });
    if (!permCheck) {
      return new Response(JSON.stringify({ error: "Forbidden – super_admin required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    // ========== ACTION: analyze ===========
    if (action === "analyze") {
      const { from_company_id, to_company_id } = body;
      if (!from_company_id || !to_company_id) {
        return new Response(JSON.stringify({ error: "from_company_id and to_company_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get customers in from_company
      const { data: customers } = await admin
        .from("customers")
        .select("id, name, org_number, billing_city")
        .eq("company_id", from_company_id)
        .order("name");

      const customerIds = (customers || []).map((c: any) => c.id);

      // Count related entities
      let projectCount = 0;
      let offerCount = 0;
      let leadCount = 0;
      let caseCount = 0;

      if (customerIds.length > 0) {
        const [projRes, offerRes, leadRes, caseRes] = await Promise.all([
          admin.from("events").select("id").in("customer_id" as any, customerIds).is("deleted_at", null),
          admin.from("offers").select("id").in("customer_id" as any, customerIds).is("deleted_at", null),
          admin.from("leads").select("id").in("customer_id" as any, customerIds).is("deleted_at", null),
          admin.from("cases").select("id").in("customer_id", customerIds),
        ]);
        projectCount = (projRes.data || []).length;
        offerCount = (offerRes.data || []).length;
        leadCount = (leadRes.data || []).length;
        caseCount = (caseRes.data || []).length;
      }

      // Check for potential duplicates in target company
      const { data: targetCustomers } = await admin
        .from("customers")
        .select("id, name, org_number")
        .eq("company_id", to_company_id);

      const targetNames = new Set((targetCustomers || []).map((c: any) => c.name.toLowerCase()));
      const targetOrgs = new Set((targetCustomers || []).map((c: any) => c.org_number).filter(Boolean));

      const duplicates = (customers || []).filter((c: any) =>
        targetNames.has(c.name.toLowerCase()) || (c.org_number && targetOrgs.has(c.org_number))
      );

      return new Response(JSON.stringify({
        customers: customers || [],
        related: { projects: projectCount, offers: offerCount, leads: leadCount, cases: caseCount },
        duplicates: duplicates.map((d: any) => ({ id: d.id, name: d.name, org_number: d.org_number })),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== ACTION: migrate ===========
    if (action === "migrate") {
      const { customer_ids, to_company_id, strategy, note } = body;
      if (!customer_ids?.length || !to_company_id || !strategy) {
        return new Response(JSON.stringify({ error: "customer_ids, to_company_id, strategy required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const results = { customers: 0, projects: 0, offers: 0, leads: 0, cases: 0 };

      // Move customers
      const { error: custErr, count } = await admin
        .from("customers")
        .update({ company_id: to_company_id })
        .in("id", customer_ids);
      if (custErr) throw new Error("Failed to move customers: " + custErr.message);
      results.customers = count || customer_ids.length;

      if (strategy === "customer_projects" || strategy === "customer_all") {
        // Move related projects
        const { data: projects } = await admin
          .from("events")
          .select("id")
          .in("customer_id" as any, customer_ids)
          .is("deleted_at", null);
        const projectIds = (projects || []).map((p: any) => p.id);
        if (projectIds.length > 0) {
          await admin.from("events").update({ company_id: to_company_id } as any).in("id", projectIds);
          results.projects = projectIds.length;
        }
      }

      if (strategy === "customer_all") {
        // Move related offers
        const { data: offers } = await admin
          .from("offers")
          .select("id")
          .in("customer_id" as any, customer_ids)
          .is("deleted_at", null);
        const offerIds = (offers || []).map((o: any) => o.id);
        if (offerIds.length > 0) {
          await admin.from("offers").update({ company_id: to_company_id } as any).in("id", offerIds);
          results.offers = offerIds.length;
        }

        // Move related leads
        const { data: leads } = await admin
          .from("leads")
          .select("id")
          .in("customer_id" as any, customer_ids)
          .is("deleted_at", null);
        const leadIds = (leads || []).map((l: any) => l.id);
        if (leadIds.length > 0) {
          await admin.from("leads").update({ company_id: to_company_id } as any).in("id", leadIds);
          results.leads = leadIds.length;
        }

        // Move related cases
        const { data: cases } = await admin
          .from("cases")
          .select("id")
          .in("customer_id", customer_ids);
        const caseIds = (cases || []).map((c: any) => c.id);
        if (caseIds.length > 0) {
          await admin.from("cases").update({ company_id: to_company_id }).in("id", caseIds);
          results.cases = caseIds.length;
        }
      }

      // Audit log
      await admin.from("audit_log").insert({
        action: "company_migration",
        target_type: "customer",
        target_id: customer_ids[0],
        actor_user_account_id: null,
        metadata: {
          actor_auth_id: user.id,
          to_company_id,
          strategy,
          note: note || null,
          customer_count: results.customers,
          project_count: results.projects,
          offer_count: results.offers,
          lead_count: results.leads,
          case_count: results.cases,
          customer_ids,
          timestamp: new Date().toISOString(),
        },
      });

      return new Response(JSON.stringify({ ok: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== ACTION: integrity_scan ===========
    if (action === "integrity_scan") {
      // Find customers with unexpected company assignments
      // Find projects where customer.company_id != project.company_id
      const { data: mismatchedProjects } = await admin
        .from("events")
        .select("id, title, company_id, customer_id, customer")
        .not("customer_id" as any, "is", null)
        .is("deleted_at", null)
        .limit(500);

      const customerIds = [...new Set((mismatchedProjects || []).map((p: any) => p.customer_id).filter(Boolean))];
      let customerCompanyMap: Record<string, string> = {};
      if (customerIds.length > 0) {
        const { data: custs } = await admin
          .from("customers")
          .select("id, company_id, name")
          .in("id", customerIds);
        for (const c of (custs || []) as any[]) {
          customerCompanyMap[c.id] = c.company_id;
        }
      }

      const projectMismatches = (mismatchedProjects || []).filter((p: any) => {
        const custCompany = customerCompanyMap[p.customer_id];
        return custCompany && custCompany !== p.company_id;
      }).map((p: any) => ({
        type: "project_customer_mismatch",
        entity_type: "project",
        entity_id: p.id,
        entity_name: p.title || p.customer,
        entity_company_id: p.company_id,
        related_company_id: customerCompanyMap[p.customer_id],
      }));

      // Find offers with mismatched customer company
      const { data: offers } = await admin
        .from("offers")
        .select("id, project_title, company_id, customer_id")
        .not("customer_id" as any, "is", null)
        .is("deleted_at", null)
        .limit(500);

      const offerCustIds = [...new Set((offers || []).map((o: any) => o.customer_id).filter(Boolean))];
      if (offerCustIds.length > 0) {
        const { data: custs2 } = await admin
          .from("customers")
          .select("id, company_id")
          .in("id", offerCustIds);
        for (const c of (custs2 || []) as any[]) {
          customerCompanyMap[c.id] = c.company_id;
        }
      }

      const offerMismatches = (offers || []).filter((o: any) => {
        const custCompany = customerCompanyMap[o.customer_id];
        return custCompany && custCompany !== o.company_id;
      }).map((o: any) => ({
        type: "offer_customer_mismatch",
        entity_type: "offer",
        entity_id: o.id,
        entity_name: o.project_title,
        entity_company_id: o.company_id,
        related_company_id: customerCompanyMap[o.customer_id],
      }));

      // Find leads with mismatched customer
      const { data: leads } = await admin
        .from("leads")
        .select("id, title, company_id, customer_id")
        .not("customer_id" as any, "is", null)
        .is("deleted_at", null)
        .limit(500);

      const leadMismatches = (leads || []).filter((l: any) => {
        const custCompany = customerCompanyMap[l.customer_id];
        return custCompany && custCompany !== l.company_id;
      }).map((l: any) => ({
        type: "lead_customer_mismatch",
        entity_type: "lead",
        entity_id: l.id,
        entity_name: l.title,
        entity_company_id: l.company_id,
        related_company_id: customerCompanyMap[l.customer_id],
      }));

      // Get company names for display
      const { data: companies } = await admin
        .from("internal_companies")
        .select("id, name")
        .eq("is_active", true);
      const companyNames: Record<string, string> = {};
      for (const c of (companies || []) as any[]) {
        companyNames[c.id] = c.name;
      }

      const allMismatches = [...projectMismatches, ...offerMismatches, ...leadMismatches]
        .map((m: any) => ({
          ...m,
          entity_company_name: companyNames[m.entity_company_id] || "Ukjent",
          related_company_name: companyNames[m.related_company_id] || "Ukjent",
        }));

      return new Response(JSON.stringify({
        mismatches: allMismatches,
        summary: {
          projects: projectMismatches.length,
          offers: offerMismatches.length,
          leads: leadMismatches.length,
          total: allMismatches.length,
        },
        companies: companyNames,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
