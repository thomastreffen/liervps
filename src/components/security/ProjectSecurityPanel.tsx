import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Loader2, Shield, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { SecurityStatusBadge } from "./SecurityStatusBadge";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";

interface Requirements {
  id?: string;
  project_id: string;
  requires_clearance: boolean;
  requires_customer_authorization: boolean;
  requires_pob: boolean;
  requires_nda: boolean;
  customer_name: string | null;
  deadline: string | null;
  notes: string | null;
}

interface PersonStatus {
  person_id: string;
  full_name: string;
  clearance_status: string;
  pob_status: string;
  nda_status: string;
  customer_authorization_status: string | null;
}

async function writeAudit(action: string, targetId: string, metadata?: any) {
  try {
    const { data: sess } = await supabase.auth.getSession();
    await (supabase as any).from("security_audit_log").insert({
      actor_user_id: sess?.session?.user?.id ?? null,
      action,
      target_type: "project_security_requirement",
      target_id: targetId,
      metadata: metadata ?? null,
    });
  } catch {}
}

interface Props {
  projectId: string;
  selectedPersonIds: string[];
}

export function ProjectSecurityPanel({ projectId, selectedPersonIds }: Props) {
  const { hasPermission } = usePermissions();
  const { isSuperAdmin } = useAuth();
  const canManage = isSuperAdmin || hasPermission("security.manage");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [req, setReq] = useState<Requirements>({
    project_id: projectId,
    requires_clearance: false,
    requires_customer_authorization: false,
    requires_pob: false,
    requires_nda: false,
    customer_name: null,
    deadline: null,
    notes: null,
  });
  const [people, setPeople] = useState<PersonStatus[]>([]);

  const loadAll = useCallback(async () => {
    setLoading(true);

    const { data: rData } = await (supabase as any)
      .from("project_security_requirements")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();

    if (rData) setReq(rData as Requirements);

    const customer = (rData as any)?.customer_name as string | null;

    if (selectedPersonIds.length > 0) {
      // selectedPersonIds = technician ids. Map: technicians.user_id -> user_accounts.auth_user_id -> person_id.
      const { data: techs } = await supabase
        .from("technicians")
        .select("id, name, user_id")
        .in("id", selectedPersonIds);

      const authIds = (techs ?? []).map((t: any) => t.user_id).filter(Boolean);
      let personByAuth: Record<string, string> = {};
      if (authIds.length) {
        const { data: accs } = await supabase
          .from("user_accounts")
          .select("auth_user_id, person_id")
          .in("auth_user_id", authIds);
        for (const a of accs ?? []) personByAuth[(a as any).auth_user_id] = (a as any).person_id;
      }

      const personIds = (techs ?? [])
        .map((t: any) => personByAuth[t.user_id])
        .filter(Boolean) as string[];

      const [profilesRes, authsRes, peopleRes] = await Promise.all([
        personIds.length
          ? (supabase as any).from("person_security_profiles").select("*").in("person_id", personIds)
          : Promise.resolve({ data: [] }),
        personIds.length && customer
          ? (supabase as any)
              .from("person_customer_authorizations")
              .select("*")
              .in("person_id", personIds)
              .eq("customer_name", customer)
          : Promise.resolve({ data: [] }),
        personIds.length
          ? supabase.from("people").select("id, full_name").in("id", personIds)
          : Promise.resolve({ data: [] }),
      ]);

      const profByPerson: Record<string, any> = {};
      for (const p of (profilesRes as any).data ?? []) profByPerson[p.person_id] = p;
      const authByPerson: Record<string, any> = {};
      for (const a of (authsRes as any).data ?? []) authByPerson[a.person_id] = a;
      const nameByPerson: Record<string, string> = {};
      for (const p of (peopleRes as any).data ?? []) nameByPerson[p.id] = p.full_name;

      const rows: PersonStatus[] = personIds.map((pid: string) => ({
        person_id: pid,
        full_name: nameByPerson[pid] ?? "Ukjent",
        clearance_status: profByPerson[pid]?.clearance_status ?? "unknown",
        pob_status: profByPerson[pid]?.pob_status ?? "not_required",
        nda_status: profByPerson[pid]?.nda_status ?? "not_required",
        customer_authorization_status: customer ? authByPerson[pid]?.authorization_status ?? null : null,
      }));
      setPeople(rows);
    } else {
      setPeople([]);
    }

    setLoading(false);
  }, [projectId, selectedPersonIds]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const save = async () => {
    setSaving(true);
    const payload = {
      project_id: projectId,
      requires_clearance: req.requires_clearance,
      requires_customer_authorization: req.requires_customer_authorization,
      requires_pob: req.requires_pob,
      requires_nda: req.requires_nda,
      customer_name: req.customer_name,
      deadline: req.deadline,
      notes: req.notes,
    };

    let savedId = req.id;
    if (req.id) {
      const { error } = await (supabase as any)
        .from("project_security_requirements")
        .update(payload)
        .eq("id", req.id);
      if (error) {
        toast.error("Kunne ikke lagre sikkerhetskrav", { description: error.message });
        setSaving(false);
        return;
      }
    } else {
      const { data, error } = await (supabase as any)
        .from("project_security_requirements")
        .insert(payload)
        .select()
        .single();
      if (error) {
        toast.error("Kunne ikke opprette sikkerhetskrav", { description: error.message });
        setSaving(false);
        return;
      }
      savedId = (data as any).id;
      setReq({ ...req, id: savedId });
    }
    await writeAudit("requirements_saved", savedId!, payload);
    toast.success("Sikkerhetskrav lagret");
    setSaving(false);
    loadAll();
  };

  const evaluatePerson = (p: PersonStatus): "ok" | "missing" | "check" => {
    const issues: string[] = [];
    if (req.requires_clearance && p.clearance_status !== "clearance_valid") issues.push("klarering");
    if (req.requires_pob && p.pob_status !== "approved") issues.push("POB");
    if (req.requires_nda && p.nda_status !== "approved") issues.push("NDA");
    if (req.requires_customer_authorization && p.customer_authorization_status !== "approved") issues.push("autorisasjon");
    if (issues.length === 0) return "ok";
    if (issues.some((i) => i === "klarering" || i === "POB")) return "missing";
    return "check";
  };

  const missingCount = useMemo(
    () => people.filter((p) => evaluatePerson(p) !== "ok").length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [people, req]
  );

  if (loading) {
    return (
      <div className="rounded-lg border p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Laster sikkerhetskrav...
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4 sm:p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-medium">Sikkerhet & autorisasjon</h3>
        {missingCount > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            {missingCount} person(er) mangler
          </span>
        )}
      </div>
      <Separator />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          ["requires_clearance", "Krever sikkerhetsklarering"],
          ["requires_customer_authorization", "Krever kundeautorisasjon"],
          ["requires_pob", "Krever POB"],
          ["requires_nda", "Krever NDA"],
        ].map(([key, label]) => (
          <div key={key} className="flex items-center justify-between rounded border p-3">
            <Label className="text-sm">{label}</Label>
            <Switch
              checked={(req as any)[key]}
              onCheckedChange={(v) => setReq({ ...req, [key]: v } as Requirements)}
              disabled={!canManage}
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Kunde</Label>
          <Input
            value={req.customer_name ?? ""}
            onChange={(e) => setReq({ ...req, customer_name: e.target.value || null })}
            className="mt-1.5"
            disabled={!canManage}
          />
        </div>
        <div>
          <Label>Frist</Label>
          <Input
            type="date"
            value={req.deadline ?? ""}
            onChange={(e) => setReq({ ...req, deadline: e.target.value || null })}
            className="mt-1.5"
            disabled={!canManage}
          />
        </div>
      </div>

      <div>
        <Label>Notat</Label>
        <Textarea
          value={req.notes ?? ""}
          onChange={(e) => setReq({ ...req, notes: e.target.value || null })}
          rows={2}
          className="mt-1.5"
          disabled={!canManage}
        />
      </div>

      {canManage && (
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} size="sm">
            {saving ? "Lagrer..." : "Lagre sikkerhetskrav"}
          </Button>
        </div>
      )}

      <Separator />

      <div className="space-y-2">
        <p className="text-sm font-medium">Personellstatus ({people.length})</p>
        {people.length === 0 && (
          <p className="text-xs text-muted-foreground">Ingen montører valgt enda.</p>
        )}
        <div className="space-y-1.5">
          {people.map((p) => {
            const res = evaluatePerson(p);
            return (
              <div key={p.person_id} className="flex items-center justify-between gap-3 rounded border p-2.5 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{p.full_name}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <SecurityStatusBadge status={p.clearance_status} label={`Klar: ${p.clearance_status}`} />
                    <SecurityStatusBadge status={p.pob_status} label={`POB: ${p.pob_status}`} />
                    <SecurityStatusBadge status={p.nda_status} label={`NDA: ${p.nda_status}`} />
                    {req.customer_name && (
                      <SecurityStatusBadge
                        status={p.customer_authorization_status ?? "unknown"}
                        label={`Auth: ${p.customer_authorization_status ?? "ingen"}`}
                      />
                    )}
                  </div>
                </div>
                {res === "ok" ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" /> OK
                  </span>
                ) : res === "missing" ? (
                  <span className="inline-flex items-center gap-1 text-xs text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" /> Mangler
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5" /> Må sjekkes
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
