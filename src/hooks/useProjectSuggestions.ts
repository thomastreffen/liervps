import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProjectSuggestion {
  id: string;
  title: string;
  customer: string | null;
  internal_number: string | null;
  job_number: string | null;
  external_tripletex_number: string | null;
  status: string;
  project_type: string | null;
  matchField: string; // what matched
}

export function useProjectSuggestions(query: string, enabled = true) {
  const [suggestions, setSuggestions] = useState<ProjectSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!enabled || query.length < 2) {
      setSuggestions([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const q = query.trim();

      const { data, error } = await supabase
        .from("events")
        .select("id, title, customer, internal_number, job_number, external_tripletex_number, status, project_type")
        .is("deleted_at", null)
        .is("archived_at", null)
        .or(
          `title.ilike.%${q}%,customer.ilike.%${q}%,internal_number.ilike.%${q}%,job_number.ilike.%${q}%,external_tripletex_number.ilike.%${q}%`
        )
        .order("created_at", { ascending: false })
        .limit(8);

      if (error || !data) {
        setSuggestions([]);
        setLoading(false);
        return;
      }

      const results: ProjectSuggestion[] = (data as any[]).map((row) => {
        let matchField = "tittel";
        const lq = q.toLowerCase();
        if (row.internal_number?.toLowerCase().includes(lq)) matchField = "JOB-ID";
        else if (row.job_number?.toLowerCase().includes(lq)) matchField = "jobbnummer";
        else if (row.external_tripletex_number?.toLowerCase().includes(lq)) matchField = "Tripletex";
        else if (row.customer?.toLowerCase().includes(lq)) matchField = "kunde";
        return { ...row, matchField };
      });

      setSuggestions(results);
      setLoading(false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, enabled]);

  return { suggestions, loading };
}
