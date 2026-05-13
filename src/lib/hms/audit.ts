import { supabase } from "@/integrations/supabase/client";

export interface HmsAuditEntry {
  company_id: string | null | undefined;
  entity_type: string;
  entity_id?: string | null;
  action: string;
  payload?: Record<string, any>;
}

/**
 * Insert a row in hms_audit_log. Fails silently — audit logging must never
 * break the user flow. Resolves performed_by from the current auth session.
 */
export async function logHmsAudit(entry: HmsAuditEntry) {
  try {
    if (!entry.company_id) return;
    const { data } = await supabase.auth.getUser();
    await (supabase as any).from("hms_audit_log").insert({
      company_id: entry.company_id,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id ?? null,
      action: entry.action,
      performed_by: data?.user?.id ?? null,
      payload: entry.payload ?? {},
    });
  } catch (e) {
    console.warn("hms audit log failed", e);
  }
}
