import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MaterialTemplate {
  id: string;
  company_id: string;
  name: string;
  category: string | null;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MaterialTemplateItem {
  id: string;
  template_id: string;
  elnr: string | null;
  description: string;
  quantity: number;
  unit: string;
  supplier: string | null;
  comment: string | null;
  sort_order: number;
}

export function useMaterialTemplates(companyId?: string | null) {
  const [templates, setTemplates] = useState<MaterialTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!companyId) {
      setTemplates([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("material_templates")
      .select("*")
      .eq("company_id", companyId)
      .eq("active", true)
      .order("name");
    setTemplates((data ?? []) as MaterialTemplate[]);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const fetchItems = useCallback(async (templateId: string): Promise<MaterialTemplateItem[]> => {
    const { data } = await supabase
      .from("material_template_items")
      .select("*")
      .eq("template_id", templateId)
      .order("sort_order");
    return (data ?? []) as MaterialTemplateItem[];
  }, []);

  return { templates, loading, refresh, fetchItems };
}

export function useMaterialProductSearch(companyId?: string | null) {
  const search = useCallback(
    async (term: string) => {
      if (!companyId || !term || term.length < 2) return [];
      const q = `%${term}%`;
      const { data } = await supabase
        .from("material_products")
        .select("*")
        .eq("company_id", companyId)
        .eq("active", true)
        .or(`elnr.ilike.${q},description.ilike.${q},supplier_sku.ilike.${q}`)
        .limit(20);
      return data ?? [];
    },
    [companyId],
  );
  return { search };
}
