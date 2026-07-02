import { useQuery } from "@tanstack/react-query";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import {
  loadProviderConfig,
  type IntegrationProvider,
  type IntegrationScope,
  type ProviderConfig,
} from "@/lib/integrations/provider-router";

/**
 * Returns the active integration provider for the current company + scope.
 * Defaults to "none" while loading or when no config exists.
 */
export function useIntegrationProvider(scope: IntegrationScope): {
  provider: IntegrationProvider;
  isLoading: boolean;
  isGoogle: boolean;
  isMicrosoft: boolean;
} {
  const { activeCompanyId } = useCompanyContext();

  const { data, isLoading } = useQuery({
    queryKey: ["integration-providers", activeCompanyId],
    queryFn: () => (activeCompanyId ? loadProviderConfig(activeCompanyId) : Promise.resolve([])),
    enabled: !!activeCompanyId,
    staleTime: 5 * 60 * 1000,
  });

  const rows: ProviderConfig[] = data ?? [];
  const match = rows.find((r) => r.scope === scope && r.is_active);
  const provider: IntegrationProvider = (match?.provider as IntegrationProvider) ?? "none";

  return {
    provider,
    isLoading,
    isGoogle: provider === "google",
    isMicrosoft: provider === "microsoft",
  };
}
