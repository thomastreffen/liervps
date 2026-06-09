import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, Users, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";

interface Row {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  company_name: string | null;
  department_name: string | null;
  is_plannable_resource: boolean | null;
  hms_card_number: string | null;
  hms_card_expires_at: string | null;
  archived_at: string | null;
  clearance_status: string | null;
  pob_status: string | null;
  nda_status: string | null;
}

type ActiveFilter = "all" | "active" | "archived";
type SecFilter = "all" | "ok" | "missing" | "check" | "unknown";

function hmsCardStatus(expires: string | null): { label: string; tone: "ok" | "warn" | "bad" | "muted" } {
  if (!expires) return { label: "Ikke registrert", tone: "muted" };
  const exp = new Date(expires).getTime();
  if (Number.isNaN(exp)) return { label: "Ikke registrert", tone: "muted" };
  const now = Date.now();
  const days = (exp - now) / (1000 * 60 * 60 * 24);
  if (days < 0) return { label: "Utløpt", tone: "bad" };
  if (days <= 60) return { label: "Utløper snart", tone: "warn" };
  return { label: "OK", tone: "ok" };
}

function securityBucket(r: Row): "ok" | "missing" | "check" | "unknown" {
  if (!r.clearance_status && !r.pob_status && !r.nda_status) return "unknown";
  const cl = r.clearance_status ?? "";
  if (cl === "approved" || cl === "clearance_valid") return "ok";
  if (cl === "expired" || cl === "blocked") return "missing";
  if (
    cl === "pob_required" ||
    cl === "authorization_required" ||
    cl === "needs_check" ||
    r.pob_status === "needs_check" ||
    r.nda_status === "needs_check"
  )
    return "check";
  return "unknown";
}

function SecurityCell({ r }: { r: Row }) {
  const b = securityBucket(r);
  if (b === "ok")
    return (
      <Badge variant="outline" className="gap-1 border-emerald-300 text-emerald-700 dark:text-emerald-300">
        <ShieldCheck className="h-3 w-3" /> OK
      </Badge>
    );
  if (b === "missing")
    return (
      <Badge variant="destructive" className="gap-1">
        <ShieldAlert className="h-3 w-3" /> Mangler
      </Badge>
    );
  if (b === "check")
    return (
      <Badge variant="outline" className="gap-1 border-amber-300 text-amber-700 dark:text-amber-300">
        <ShieldAlert className="h-3 w-3" /> Må sjekkes
      </Badge>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <ShieldQuestion className="h-3 w-3" /> Ikke vurdert
    </span>
  );
}

export default function HmsPeoplePage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { isSuperAdmin, isAdmin } = useAuth();
  const canViewSecurity = isSuperAdmin || isAdmin || hasPermission("security.view") || hasPermission("security.manage");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("active");
  const [secFilter, setSecFilter] = useState<SecFilter>("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: people, error: pErr } = await supabase
          .from("people")
          .select("id, full_name, email, phone, is_active")
          .order("full_name", { ascending: true });
        if (pErr) throw pErr;
        const ids = (people ?? []).map((p: any) => p.id);

        const [emps, comps, depts, profilesRes] = await Promise.all([
          ids.length
            ? (supabase as any).from("employment_profiles").select(
                "person_id, company_id, department_id, is_plannable_resource, hms_card_number, hms_card_expires_at, archived_at"
              ).in("person_id", ids)
            : Promise.resolve({ data: [] }),
          supabase.from("internal_companies").select("id, name"),
          supabase.from("departments").select("id, name"),
          ids.length && canViewSecurity
            ? (supabase as any).from("person_security_profiles").select(
                "person_id, clearance_status, pob_status, nda_status"
              ).in("person_id", ids)
            : Promise.resolve({ data: [] }),
        ]);

        const empByPerson = new Map<string, any>();
        for (const e of (emps as any).data ?? []) empByPerson.set(e.person_id, e);
        const compById = new Map<string, string>();
        for (const c of (comps as any).data ?? []) compById.set(c.id, c.name);
        const deptById = new Map<string, string>();
        for (const d of (depts as any).data ?? []) deptById.set(d.id, d.name);
        const profByPerson = new Map<string, any>();
        for (const p of (profilesRes as any).data ?? []) profByPerson.set(p.person_id, p);

        const merged: Row[] = (people ?? []).map((p: any) => {
          const e = empByPerson.get(p.id);
          const prof = profByPerson.get(p.id);
          return {
            id: p.id,
            full_name: p.full_name,
            email: p.email,
            phone: p.phone,
            is_active: p.is_active,
            company_name: e?.company_id ? compById.get(e.company_id) ?? null : null,
            department_name: e?.department_id ? deptById.get(e.department_id) ?? null : null,
            is_plannable_resource: e?.is_plannable_resource ?? null,
            hms_card_number: e?.hms_card_number ?? null,
            hms_card_expires_at: e?.hms_card_expires_at ?? null,
            archived_at: e?.archived_at ?? null,
            clearance_status: prof?.clearance_status ?? null,
            pob_status: prof?.pob_status ?? null,
            nda_status: prof?.nda_status ?? null,
          };
        });

        if (!cancelled) setRows(merged);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Kunne ikke laste ansatte");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canViewSecurity]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (activeFilter === "active" && (r.archived_at || !r.is_active)) return false;
      if (activeFilter === "archived" && !r.archived_at) return false;
      if (secFilter !== "all" && canViewSecurity) {
        const b = securityBucket(r);
        if (secFilter === "ok" && b !== "ok") return false;
        if (secFilter === "missing" && b !== "missing") return false;
        if (secFilter === "check" && b !== "check") return false;
        if (secFilter === "unknown" && b !== "unknown") return false;
      }
      if (!term) return true;
      return (
        r.full_name?.toLowerCase().includes(term) ||
        r.email?.toLowerCase().includes(term) ||
        r.phone?.toLowerCase().includes(term)
      );
    });
  }, [rows, q, activeFilter, secFilter, canViewSecurity]);

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Ansatte</h1>
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} av {rows.length}</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Søk navn eller e-post..."
            className="pl-8"
          />
        </div>
        <Select value={activeFilter} onValueChange={(v) => setActiveFilter(v as ActiveFilter)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Aktive</SelectItem>
            <SelectItem value="archived">Arkiverte</SelectItem>
            <SelectItem value="all">Alle</SelectItem>
          </SelectContent>
        </Select>
        {canViewSecurity && (
          <Select value={secFilter} onValueChange={(v) => setSecFilter(v as SecFilter)}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Sikkerhet" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Sikkerhet: Alle</SelectItem>
              <SelectItem value="ok">OK</SelectItem>
              <SelectItem value="missing">Mangler</SelectItem>
              <SelectItem value="check">Må sjekkes</SelectItem>
              <SelectItem value="unknown">Ikke vurdert</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive">Kunne ikke laste ansatte</p>
          <p className="text-xs text-muted-foreground mt-1">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border p-10 text-center text-sm text-muted-foreground">
          Ingen ansatte å vise.
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Navn</TableHead>
                <TableHead>Kontakt</TableHead>
                <TableHead>Firma</TableHead>
                <TableHead>Avdeling</TableHead>
                <TableHead>Planleggbar</TableHead>
                <TableHead>HMS-kort</TableHead>
                {canViewSecurity && <TableHead>Sikkerhet</TableHead>}
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => navigate(`/hms/people/${r.id}`)}
                >
                  <TableCell className="font-medium">{r.full_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <div>{r.email ?? "-"}</div>
                    {r.phone && <div className="text-xs">{r.phone}</div>}
                  </TableCell>
                  <TableCell className="text-sm">{r.company_name ?? "-"}</TableCell>
                  <TableCell className="text-sm">{r.department_name ?? "-"}</TableCell>
                  <TableCell>
                    {r.is_plannable_resource ? (
                      <Badge variant="secondary">Ja</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Nei</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.hms_card_number ? (
                      <div className="space-y-0.5">
                        <div className="font-mono text-xs">{r.hms_card_number}</div>
                        {(() => {
                          const s = hmsCardStatus(r.hms_card_expires_at);
                          const cls =
                            s.tone === "ok"
                              ? "border-emerald-300 text-emerald-700 dark:text-emerald-300"
                              : s.tone === "warn"
                              ? "border-amber-300 text-amber-700 dark:text-amber-300"
                              : s.tone === "bad"
                              ? "border-destructive/40 text-destructive"
                              : "text-muted-foreground";
                          return (
                            <Badge variant="outline" className={`text-[11px] ${cls}`}>
                              {s.label}
                              {r.hms_card_expires_at && s.tone !== "muted" ? ` · ${r.hms_card_expires_at}` : ""}
                            </Badge>
                          );
                        })()}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Ikke registrert</span>
                    )}
                  </TableCell>
                  {canViewSecurity && (
                    <TableCell><SecurityCell r={r} /></TableCell>
                  )}
                  <TableCell>
                    {r.archived_at ? (
                      <Badge variant="outline" className="text-muted-foreground">Arkivert</Badge>
                    ) : r.is_active ? (
                      <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:text-emerald-300">Aktiv</Badge>
                    ) : (
                      <Badge variant="outline">Inaktiv</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
