import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "./useCompanyContext";
import type {
  CalcPackage, PackageField, RateTable, NormTable,
} from "@/lib/calc-engine/types";

/** Liste over kalkylepakker som er tilgjengelige for aktivt selskap (+ globale). */
export function useCalcPackages() {
  const { activeCompanyId, allowedCompanyIds } = useCompanyContext();
  const [packages, setPackages] = useState<CalcPackage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      let q = supabase
        .from("calc_packages")
        .select("id, company_id, slug, name, category, description, version, is_active, default_sections")
        .eq("is_active", true)
        .order("name");
      const { data, error } = await q;
      if (!mounted) return;
      if (error) { console.error(error); setPackages([]); }
      else {
        const filtered = (data ?? []).filter((p: any) =>
          p.company_id === null
          || (activeCompanyId && p.company_id === activeCompanyId)
          || allowedCompanyIds.includes(p.company_id)
        );
        setPackages(filtered as CalcPackage[]);
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [activeCompanyId, allowedCompanyIds.join(",")]);

  return { packages, loading };
}

/** Hent ett pakke-objekt + felter + standard sats- og normtidstabell. */
export function useCalcPackageBundle(packageId: string | null) {
  const [pkg, setPkg] = useState<CalcPackage | null>(null);
  const [fields, setFields] = useState<PackageField[]>([]);
  const [rateTables, setRateTables] = useState<RateTable[]>([]);
  const [normTables, setNormTables] = useState<NormTable[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!packageId) return;
    let mounted = true;
    setLoading(true);
    (async () => {
      const [pkgRes, fieldsRes, ratesRes, normsRes] = await Promise.all([
        supabase.from("calc_packages")
          .select("id, company_id, slug, name, category, description, version, is_active, default_sections")
          .eq("id", packageId).maybeSingle(),
        supabase.from("calc_package_fields")
          .select("*").eq("package_id", packageId).order("sort_order"),
        supabase.from("calc_rate_tables")
          .select("id, name, version, calc_rate_table_rows(rate_key, label, value, unit, context, sort_order)")
          .eq("package_id", packageId).eq("is_active", true)
          .order("version", { ascending: false }),
        supabase.from("calc_norm_tables")
          .select("id, name, version, calc_norm_table_rows(element_key, label, hours, unit, context, sort_order)")
          .eq("package_id", packageId).eq("is_active", true)
          .order("version", { ascending: false }),
      ]);
      if (!mounted) return;
      setPkg((pkgRes.data ?? null) as CalcPackage | null);
      setFields((fieldsRes.data ?? []) as unknown as PackageField[]);
      setRateTables(((ratesRes.data ?? []) as any[]).map(t => ({
        id: t.id, name: t.name, version: t.version,
        rows: (t.calc_rate_table_rows ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order),
      })));
      setNormTables(((normsRes.data ?? []) as any[]).map(t => ({
        id: t.id, name: t.name, version: t.version,
        rows: (t.calc_norm_table_rows ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order),
      })));
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [packageId]);

  return { pkg, fields, rateTables, normTables, loading };
}
