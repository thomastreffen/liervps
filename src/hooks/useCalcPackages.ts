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

/** Hent ett pakke-objekt + felter + standard sats- og normtidstabell + baseline-profiler. */
export function useCalcPackageBundle(packageId: string | null) {
  const [pkg, setPkg] = useState<CalcPackage | null>(null);
  const [fields, setFields] = useState<PackageField[]>([]);
  const [rateTables, setRateTables] = useState<RateTable[]>([]);
  const [normTables, setNormTables] = useState<NormTable[]>([]);
  const [baselineProfiles, setBaselineProfiles] = useState<import("@/lib/calc-engine/types").BaselineProfile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!packageId) return;
    let mounted = true;
    setLoading(true);
    (async () => {
      const [pkgRes, fieldsRes, ratesRes, normsRes, baselineRes] = await Promise.all([
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
        supabase.from("calc_baseline_profiles")
          .select("id, slug, name, hourly_rate_cost, profit_factor, lift_cost_per_day, calc_baseline_amp_rows(amp_key, amp_label, amp_min, amp_max, hours_per_meter, hours_per_vinkel, support_cost_per_meter, trafo_connect_cost, sort_order)")
          .eq("package_id", packageId).eq("is_active", true),
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
      setBaselineProfiles(((baselineRes.data ?? []) as any[]).map(p => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        hourly_rate_cost: Number(p.hourly_rate_cost ?? 0),
        profit_factor: Number(p.profit_factor ?? 1.4),
        lift_cost_per_day: Number(p.lift_cost_per_day ?? 0),
        rows: (p.calc_baseline_amp_rows ?? [])
          .map((r: any) => ({
            amp_key: r.amp_key,
            amp_label: r.amp_label,
            amp_min: r.amp_min,
            amp_max: r.amp_max,
            hours_per_meter: Number(r.hours_per_meter ?? 0),
            hours_per_vinkel: Number(r.hours_per_vinkel ?? 0),
            support_cost_per_meter: Number(r.support_cost_per_meter ?? 0),
            trafo_connect_cost: Number(r.trafo_connect_cost ?? 0),
            sort_order: Number(r.sort_order ?? 0),
          }))
          .sort((a: any, b: any) => a.sort_order - b.sort_order),
      })));
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [packageId]);

  return { pkg, fields, rateTables, normTables, baselineProfiles, loading };
}

