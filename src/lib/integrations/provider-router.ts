/**
 * Provider-router (frontend).
 *
 * Resolves which integration provider (google | microsoft | none) is active
 * for a given company + scope. Backed by `integration_providers` table.
 *
 * Backend/edge functions must use their own copy in `_shared/provider-router.ts`.
 */
import { supabase } from "@/integrations/supabase/client";

export type IntegrationScope = "sso" | "calendar" | "mail" | "files" | "meetings";
export type IntegrationProvider = "google" | "microsoft" | "none";

export interface ProviderConfig {
  company_id: string;
  scope: IntegrationScope;
  provider: IntegrationProvider;
  is_active: boolean;
}

/** In-memory cache – config changes rarely. Cleared on sign-out via queryClient. */
const cache = new Map<string, ProviderConfig[]>();

export async function loadProviderConfig(companyId: string): Promise<ProviderConfig[]> {
  if (!companyId) return [];
  if (cache.has(companyId)) return cache.get(companyId)!;
  const { data, error } = await supabase
    .from("integration_providers")
    .select("company_id, scope, provider, is_active")
    .eq("company_id", companyId);
  if (error) {
    console.warn("[provider-router] failed to load config", error);
    return [];
  }
  const rows = (data as ProviderConfig[]) || [];
  cache.set(companyId, rows);
  return rows;
}

export function invalidateProviderCache(companyId?: string) {
  if (companyId) cache.delete(companyId);
  else cache.clear();
}

export async function getActiveProvider(
  companyId: string,
  scope: IntegrationScope,
): Promise<IntegrationProvider> {
  const rows = await loadProviderConfig(companyId);
  const match = rows.find((r) => r.scope === scope && r.is_active);
  return (match?.provider as IntegrationProvider) ?? "none";
}
