import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";

export interface CustomerValueLevel {
  id: string;
  company_id: string;
  code: string;
  label: string;
  color: string;
  sort_order: number;
}

export function useCustomerValueLevels() {
  const { activeCompanyId } = useCompanyContext();
  const [levels, setLevels] = useState<CustomerValueLevel[]>([]);

  const fetchLevels = useCallback(async () => {
    if (!activeCompanyId) { setLevels([]); return; }
    const { data } = await supabase
      .from("customer_value_levels")
      .select("*")
      .eq("company_id", activeCompanyId)
      .order("sort_order");
    setLevels((data as any[]) || []);
  }, [activeCompanyId]);

  useEffect(() => { fetchLevels(); }, [fetchLevels]);

  const getLevelByCode = useCallback((code: string | null) => {
    if (!code) return null;
    return levels.find((l) => l.code === code) || null;
  }, [levels]);

  return { levels, getLevelByCode, refetch: fetchLevels };
}
