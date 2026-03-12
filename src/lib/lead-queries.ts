import { supabase } from "@/integrations/supabase/client";

/**
 * Centralized active-leads query.
 * Active = deleted_at IS NULL AND archived_at IS NULL.
 * Optionally filter by company_id.
 */
export async function fetchActiveLeads(selectCols = "*", companyId?: string | null) {
  let query = supabase
    .from("leads")
    .select(selectCols)
    .is("deleted_at", null)
    .filter("archived_at", "is", "null");
  if (companyId) query = query.eq("company_id", companyId);
  const { data, error } = await query;
  return { data: (data || []) as any[], error };
}

/** Deleted leads (trash) */
export async function fetchDeletedLeads(selectCols = "*", companyId?: string | null) {
  let query = supabase
    .from("leads")
    .select(selectCols)
    .not("deleted_at", "is", null);
  if (companyId) query = query.eq("company_id", companyId);
  const { data, error } = await query;
  return { data: (data || []) as any[], error };
}

/** Archived leads */
export async function fetchArchivedLeads(selectCols = "*", companyId?: string | null) {
  let query = supabase
    .from("leads")
    .select(selectCols)
    .is("deleted_at", null)
    .not("archived_at" as any, "is", null);
  if (companyId) query = query.eq("company_id", companyId);
  const { data, error } = await query;
  return { data: (data || []) as any[], error };
}
