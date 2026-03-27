import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";

export interface ProjectSuggestion {
  id: string;
  title: string;
  customer: string | null;
  internal_number: string | null;
  job_number: string | null;
  project_number: string | null;
  external_tripletex_id: string | null;
  status: string;
  project_type: string | null;
  matchField: string;
  matchScore: number; // higher = better
}

export function useProjectSuggestions(query: string, enabled = true) {
  const [suggestions, setSuggestions] = useState<ProjectSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const { activeCompanyId } = useCompanyContext();

  useEffect(() => {
    if (!enabled || query.length < 2) {
      setSuggestions([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const q = query.trim();
      const normalized = q.toLowerCase().replace(/\s+/g, " ").trim();

      let dbQuery = supabase
        .from("events")
        .select("id, title, customer, internal_number, job_number, project_number, external_tripletex_id, status, project_type, normalized_name")
        .is("deleted_at", null)
        .is("archived_at", null)
        .or(
          `title.ilike.%${q}%,customer.ilike.%${q}%,internal_number.ilike.%${q}%,job_number.ilike.%${q}%,project_number.ilike.%${q}%,external_tripletex_id.ilike.%${q}%,normalized_name.ilike.%${normalized}%`
        )
        .order("created_at", { ascending: false })
        .limit(15);

      // Scope to active company if not "all"
      if (activeCompanyId) {
        dbQuery = dbQuery.eq("company_id", activeCompanyId);
      }

      const { data, error } = await dbQuery;

      if (error || !data) {
        setSuggestions([]);
        setLoading(false);
        return;
      }

      const results: ProjectSuggestion[] = (data as any[]).map((row) => {
        let matchField = "tittel";
        let matchScore = 1;
        const lq = q.toLowerCase();

        // Priority scoring: exact project_number > exact external_id > exact normalized_name > partial matches
        if (row.project_number?.toLowerCase() === lq) {
          matchField = "prosjektnr (eksakt)";
          matchScore = 100;
        } else if (row.external_tripletex_id?.toLowerCase() === lq) {
          matchField = "Tripletex-ID (eksakt)";
          matchScore = 95;
        } else if (row.normalized_name === normalized) {
          matchField = "navn (eksakt)";
          matchScore = 90;
        } else if (row.project_number?.toLowerCase().includes(lq)) {
          matchField = "prosjektnr";
          matchScore = 80;
        } else if (row.internal_number?.toLowerCase() === lq) {
          matchField = "JOB-ID";
          matchScore = 75;
        } else if (row.internal_number?.toLowerCase().includes(lq)) {
          matchField = "JOB-ID";
          matchScore = 60;
        } else if (row.job_number?.toLowerCase().includes(lq)) {
          matchField = "jobbnummer";
          matchScore = 55;
        } else if (row.external_tripletex_id?.toLowerCase().includes(lq)) {
          matchField = "Tripletex";
          matchScore = 50;
        } else if (row.customer?.toLowerCase().includes(lq)) {
          matchField = "kunde";
          matchScore = 30;
        } else if (row.title?.toLowerCase().includes(lq)) {
          matchField = "tittel";
          matchScore = 20;
        }

        return { ...row, matchField, matchScore };
      });

      // Sort by matchScore descending
      results.sort((a, b) => b.matchScore - a.matchScore);

      setSuggestions(results.slice(0, 8));
      setLoading(false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, enabled, activeCompanyId]);

  return { suggestions, loading };
}
