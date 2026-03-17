import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { toast } from "sonner";

export interface CustomerTag {
  id: string;
  name: string;
  color: string;
  company_id: string;
}

export function useCustomerTags() {
  const { activeCompanyId } = useCompanyContext();
  const [tags, setTags] = useState<CustomerTag[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTags = useCallback(async () => {
    if (!activeCompanyId) { setTags([]); setLoading(false); return; }
    const { data } = await supabase
      .from("customer_tags")
      .select("*")
      .eq("company_id", activeCompanyId)
      .order("name");
    setTags((data as any[]) || []);
    setLoading(false);
  }, [activeCompanyId]);

  useEffect(() => { fetchTags(); }, [fetchTags]);

  const createTag = useCallback(async (name: string, color: string) => {
    if (!activeCompanyId) return null;
    const { data, error } = await supabase
      .from("customer_tags")
      .insert({ company_id: activeCompanyId, name: name.trim(), color } as any)
      .select()
      .single();
    if (error) { toast.error("Kunne ikke opprette tag"); return null; }
    await fetchTags();
    return data as any as CustomerTag;
  }, [activeCompanyId, fetchTags]);

  const deleteTag = useCallback(async (tagId: string) => {
    const { error } = await supabase.from("customer_tags").delete().eq("id", tagId);
    if (error) toast.error("Kunne ikke slette tag");
    else await fetchTags();
  }, [fetchTags]);

  const addTagToCustomer = useCallback(async (customerId: string, tagId: string) => {
    const { error } = await supabase
      .from("customer_tag_relations")
      .insert({ customer_id: customerId, tag_id: tagId } as any);
    if (error && !error.message.includes("duplicate")) toast.error("Kunne ikke legge til tag");
  }, []);

  const removeTagFromCustomer = useCallback(async (customerId: string, tagId: string) => {
    await supabase
      .from("customer_tag_relations")
      .delete()
      .eq("customer_id", customerId)
      .eq("tag_id", tagId);
  }, []);

  const getCustomerTagIds = useCallback(async (customerId: string): Promise<string[]> => {
    const { data } = await supabase
      .from("customer_tag_relations")
      .select("tag_id")
      .eq("customer_id", customerId);
    return (data as any[] || []).map((r: any) => r.tag_id);
  }, []);

  return { tags, loading, createTag, deleteTag, addTagToCustomer, removeTagFromCustomer, getCustomerTagIds, refetch: fetchTags };
}
