import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building } from "lucide-react";
import { toast } from "sonner";

interface CompanyPlannable {
  person_id: string;
  company_id: string;
  company_name: string;
  department_name: string | null;
  is_plannable_resource: boolean;
}

interface Props {
  technicianId: string;
}

export function CompanyPlannableSection({ technicianId }: Props) {
  const [items, setItems] = useState<CompanyPlannable[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const { data: tech } = await supabase
      .from("technicians")
      .select("user_id")
      .eq("id", technicianId)
      .single();

    if (!tech?.user_id) {
      setItems([]);
      setLoading(false);
      return;
    }

    const { data: ua } = await supabase
      .from("user_accounts")
      .select("person_id")
      .eq("auth_user_id", tech.user_id)
      .eq("is_active", true)
      .single();

    if (!ua?.person_id) {
      setItems([]);
      setLoading(false);
      return;
    }

    const [{ data: profiles }, { data: companies }, { data: departments }] = await Promise.all([
      supabase
        .from("employment_profiles")
        .select("company_id, department_id, is_plannable_resource")
        .eq("person_id", ua.person_id)
        .is("archived_at", null),
      supabase.from("internal_companies").select("id, name").eq("is_active", true),
      supabase.from("departments").select("id, name"),
    ]);

    const compMap = new Map((companies || []).map((c: any) => [c.id, c.name]));
    const deptMap = new Map((departments || []).map((d: any) => [d.id, d.name]));

    setItems(
      (profiles || []).map((ep: any) => ({
        person_id: ua.person_id,
        company_id: ep.company_id,
        company_name: compMap.get(ep.company_id) || "Ukjent",
        department_name: ep.department_id ? deptMap.get(ep.department_id) || null : null,
        is_plannable_resource: ep.is_plannable_resource,
      }))
    );
    setLoading(false);
  }, [technicianId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const togglePlannable = async (personId: string, companyId: string, current: boolean) => {
    const nextValue = !current;

    const { error } = await supabase
      .from("employment_profiles")
      .update({ is_plannable_resource: nextValue })
      .eq("person_id", personId)
      .eq("company_id", companyId);

    if (error) {
      toast.error("Feil ved oppdatering");
      return;
    }

    toast.success(nextValue ? "Satt som planleggbar" : "Fjernet fra planleggbar");
    setItems((prev) =>
      prev.map((item) =>
        item.person_id === personId && item.company_id === companyId
          ? { ...item, is_plannable_resource: nextValue }
          : item
      )
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        Ingen selskapstilknytninger funnet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Planleggbar per selskap</p>
        <p className="text-[11px] text-muted-foreground">Styrer om personen vises i ressursplanen for hvert selskap</p>
      </div>
      <div className="rounded-lg border divide-y">
        {items.map((item) => (
          <div key={`${item.person_id}-${item.company_id}`} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Building className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{item.company_name}</p>
                {item.department_name && (
                  <p className="text-[11px] text-muted-foreground">{item.department_name}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {item.is_plannable_resource ? (
                <Badge variant="success" className="text-[10px]">Planleggbar</Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">Kun tilgang</Badge>
              )}
              <Switch
                checked={item.is_plannable_resource}
                onCheckedChange={() => togglePlannable(item.person_id, item.company_id, item.is_plannable_resource)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
