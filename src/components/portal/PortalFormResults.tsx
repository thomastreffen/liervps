import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, CheckCircle, PenLine, User, RefreshCw, Info } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

const TYPE_LABELS: Record<string, string> = {
  checklist: "Sjekkliste",
  control: "Kontrollskjema",
  signature: "Signering",
  hms: "HMS-skjema",
  handover: "Overleveringsskjema",
};

interface Props {
  projectId: string;
}

interface FormResult {
  id: string;
  title: string;
  form_type: string;
  status: string;
  filled_by: string | null;
  updated_at: string;
  has_signature: boolean;
}

export function PortalFormResults({ projectId }: Props) {
  const [results, setResults] = useState<FormResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setError(false);
    try {
      // Get completed instances for this project
      const { data: instances, error: instErr } = await supabase
        .from("form_instances")
        .select("id, template_id, status, created_by, updated_at, answers")
        .eq("project_id", projectId)
        .in("status", ["completed", "signed"]);

      if (instErr) throw instErr;

      if (!instances || instances.length === 0) {
        setLoading(false);
        return;
      }

      // Get templates that are portal-visible
      const tplIds = [...new Set((instances as any[]).map((i: any) => i.template_id))];
      const { data: tpls, error: tplErr } = await (supabase as any)
        .from("form_templates")
        .select("id, title, form_type, available_in_customer_portal")
        .in("id", tplIds)
        .eq("available_in_customer_portal", true)
        .eq("is_active", true);

      if (tplErr) throw tplErr;

      if (!tpls || tpls.length === 0) {
        setLoading(false);
        return;
      }

      const tplMap = new Map(tpls.map((t: any) => [t.id, t]));
      const portalInstances = (instances as any[]).filter((i: any) => tplMap.has(i.template_id));

      // Get user names
      const userIds = [...new Set(portalInstances.filter((i: any) => i.created_by).map((i: any) => i.created_by))];
      let userMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: accounts } = await supabase
          .from("user_accounts")
          .select("auth_user_id, people!inner(full_name)")
          .in("auth_user_id", userIds) as any;
        for (const a of accounts || []) {
          userMap.set(a.auth_user_id, a.people?.full_name || "");
        }
      }

      setResults(portalInstances.map((inst: any) => {
        const tpl: any = tplMap.get(inst.template_id);
        const answers = inst.answers || {};
        const hasSignature = Object.values(answers).some((v: any) => typeof v === "string" && v.startsWith("data:image"));
        return {
          id: inst.id,
          title: tpl?.title || "Skjema",
          form_type: tpl?.form_type || "checklist",
          status: inst.status,
          filled_by: userMap.get(inst.created_by) || null,
          updated_at: inst.updated_at,
          has_signature: hasSignature,
        };
      }));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [projectId]);

  if (loading) return null;

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-2">
          <p className="text-xs text-muted-foreground">Kunne ikke laste kontrollskjema</p>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => { setLoading(true); load(); }}>
            <RefreshCw className="h-3 w-3" /> Prøv igjen
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (results.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <ClipboardCheck className="h-4 w-4" />
          Kontroller og sjekklister
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Dokumentasjon fra utført arbeid på dette oppdraget.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {results.map((form) => (
          <div key={form.id} className="rounded-xl border border-border/40 p-3 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-semibold truncate">{form.title}</span>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-0 bg-muted text-muted-foreground shrink-0">
                  {TYPE_LABELS[form.form_type] || form.form_type}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {form.has_signature && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-primary font-medium">
                    <PenLine className="h-2.5 w-2.5" /> Signert
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-full border border-success/20 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                  <CheckCircle className="h-2.5 w-2.5" /> Fullført
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {form.filled_by && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />{form.filled_by}
                </span>
              )}
              <span>{format(new Date(form.updated_at), "d. MMM yyyy", { locale: nb })}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
