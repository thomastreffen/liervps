import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { toast } from "sonner";

export interface ContactTag {
  id: string;
  name: string;
  color: string;
  company_id: string;
}

export function useContactTags() {
  const { activeCompanyId } = useCompanyContext();
  const [tags, setTags] = useState<ContactTag[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTags = useCallback(async () => {
    if (!activeCompanyId) { setTags([]); setLoading(false); return; }
    const { data } = await supabase
      .from("customer_contact_tags")
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
      .from("customer_contact_tags")
      .insert({ company_id: activeCompanyId, name: name.trim(), color } as any)
      .select()
      .single();
    if (error) { toast.error("Kunne ikke opprette tag"); return null; }
    await fetchTags();
    return data as any as ContactTag;
  }, [activeCompanyId, fetchTags]);

  const deleteTag = useCallback(async (tagId: string) => {
    const { error } = await supabase.from("customer_contact_tags").delete().eq("id", tagId);
    if (error) toast.error("Kunne ikke slette tag");
    else await fetchTags();
  }, [fetchTags]);

  const addTagToContact = useCallback(async (contactId: string, tagId: string) => {
    const { error } = await supabase
      .from("customer_contact_tag_relations")
      .insert({ contact_id: contactId, tag_id: tagId } as any);
    if (error && !error.message.includes("duplicate")) toast.error("Kunne ikke legge til tag");
  }, []);

  const removeTagFromContact = useCallback(async (contactId: string, tagId: string) => {
    await supabase
      .from("customer_contact_tag_relations")
      .delete()
      .eq("contact_id", contactId)
      .eq("tag_id", tagId);
  }, []);

  const getContactTagIds = useCallback(async (contactId: string): Promise<string[]> => {
    const { data } = await supabase
      .from("customer_contact_tag_relations")
      .select("tag_id")
      .eq("contact_id", contactId);
    return (data as any[] || []).map((r: any) => r.tag_id);
  }, []);

  const getContactsTagIds = useCallback(async (contactIds: string[]): Promise<Record<string, string[]>> => {
    if (contactIds.length === 0) return {};
    const { data } = await supabase
      .from("customer_contact_tag_relations")
      .select("contact_id, tag_id")
      .in("contact_id", contactIds);
    const map: Record<string, string[]> = {};
    for (const r of (data as any[] || [])) {
      if (!map[r.contact_id]) map[r.contact_id] = [];
      map[r.contact_id].push(r.tag_id);
    }
    return map;
  }, []);

  return { tags, loading, createTag, deleteTag, addTagToContact, removeTagFromContact, getContactTagIds, getContactsTagIds, refetch: fetchTags };
}
