import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ClipboardList, FileCheck, Plus, BookOpen, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { startSubmission, STATUS_LABELS, type SubmissionStatus } from "@/lib/hms/submissions";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";

export default function HmsMobilePage() {
  const { user } = useAuth();
  const { activeCompanyId } = useCompanyContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"start" | "mine" | "håndbok">("start");

  const cid = activeCompanyId;

  const { data: templates } = useQuery({
    queryKey: ["hms-mobile-templates", cid],
    enabled: !!cid,
    queryFn: async () => {
      const sb = supabase as any;
      const { data } = await sb
        .from("hms_templates")
        .select("id, name, kind, category, description, hms_areas")
        .eq("company_id", cid)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("kind", { ascending: true })
        .order("name", { ascending: true });
      return (data ?? []) as any[];
    },
  });

  const { data: mySubmissions } = useQuery({
    queryKey: ["hms-mobile-mine", cid, user?.id],
    enabled: !!cid && !!user?.id,
    queryFn: async () => {
      const sb = supabase as any;
      const { data } = await sb
        .from("hms_submissions")
        .select("id, title, status, kind, submitted_at, created_at, updated_at, template_id")
        .eq("company_id", cid)
        .eq("submitted_by", user!.id)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(50);
      return (data ?? []) as any[];
    },
  });

  const { data: handbooks } = useQuery({
    queryKey: ["hms-mobile-handbooks", cid, user?.id],
    enabled: !!cid && tab === "håndbok",
    queryFn: async () => {
      const sb = supabase as any;
      const { data: hbs } = await sb
        .from("hms_handbooks")
        .select("id, title, description, kind, current_version_id")
        .eq("company_id", cid)
        .is("deleted_at", null)
        .order("title", { ascending: true });
      const list = (hbs ?? []) as any[];
      const versionIds = list.map((h) => h.current_version_id).filter(Boolean);
      if (!versionIds.length || !user?.id) {
        return list.map((h) => ({ ...h, requires_ack: false, my_ack: null, version_number: null }));
      }
      const [{ data: vers }, { data: acks }] = await Promise.all([
        sb.from("hms_handbook_versions")
          .select("id, version_number, requires_acknowledgement").in("id", versionIds),
        sb.from("hms_handbook_acknowledgements")
          .select("version_id, acknowledged_at").in("version_id", versionIds).eq("user_id", user.id),
      ]);
      const vMap = new Map((vers ?? []).map((v: any) => [v.id, v]));
      const aMap = new Map((acks ?? []).map((a: any) => [a.version_id, a.acknowledged_at]));
      return list.map((h) => {
        const v = h.current_version_id ? vMap.get(h.current_version_id) : null;
        return {
          ...h,
          version_number: v?.version_number ?? null,
          requires_ack: !!v?.requires_acknowledgement,
          my_ack: h.current_version_id ? aMap.get(h.current_version_id) ?? null : null,
        };
      });
    },
  });

  const startMut = useMutation({
    mutationFn: async (templateId: string) => {
      if (!cid || !user) throw new Error("Mangler kontekst");
      return startSubmission({
        companyId: cid,
        templateId,
        userId: user.id,
        userName: user.name || user.email,
      });
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["hms-mobile-mine"] });
      navigate(`/hms/mobile/fill/${id}`);
    },
    onError: (e: any) => {
      toast({ title: "Kunne ikke starte", description: e?.message ?? "Ukjent feil", variant: "destructive" });
    },
  });

  const sjaTemplates = useMemo(() => (templates ?? []).filter((t) => t.kind === "sja"), [templates]);
  const checklistTemplates = useMemo(() => (templates ?? []).filter((t) => t.kind === "checklist"), [templates]);

  const drafts = (mySubmissions ?? []).filter((s) => s.status === "draft");
  const others = (mySubmissions ?? []).filter((s) => s.status !== "draft");

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 pb-20">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/60">
        <div className="px-4 py-3 max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary grid place-items-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">HMS</div>
              <div className="text-sm font-semibold">Mobil</div>
            </div>
          </div>
          {drafts.length > 0 && (
            <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
              {drafts.length} utkast
            </Badge>
          )}
        </div>
      </header>

      <div className="px-4 py-4 max-w-2xl mx-auto">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="start" className="text-xs">
              <Plus className="h-3.5 w-3.5 mr-1" /> Start
            </TabsTrigger>
            <TabsTrigger value="mine" className="text-xs">
              <FileCheck className="h-3.5 w-3.5 mr-1" /> Mine
            </TabsTrigger>
            <TabsTrigger value="håndbok" className="text-xs">
              <BookOpen className="h-3.5 w-3.5 mr-1" /> Håndbok
            </TabsTrigger>
          </TabsList>

          <TabsContent value="start" className="space-y-4 mt-4">
            {drafts.length > 0 && (
              <Card className="border-amber-200/60 bg-amber-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-600" /> Fortsett utkast
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {drafts.slice(0, 3).map((d) => (
                    <Link
                      key={d.id}
                      to={`/hms/mobile/fill/${d.id}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-background border border-border/60 active:scale-[0.99] transition-transform"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{d.title || "Uten tittel"}</div>
                        <div className="text-[11px] text-muted-foreground">
                          Sist endret {formatDistanceToNow(new Date(d.updated_at), { addSuffix: true, locale: nb })}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px]">Fortsett</Badge>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            )}

            <SectionList
              title="SJA"
              icon={<ClipboardList className="h-4 w-4 text-primary" />}
              items={sjaTemplates}
              onPick={(id) => startMut.mutate(id)}
              busy={startMut.isPending}
            />

            <SectionList
              title="Sjekklister"
              icon={<FileCheck className="h-4 w-4 text-primary" />}
              items={checklistTemplates}
              onPick={(id) => startMut.mutate(id)}
              busy={startMut.isPending}
            />
          </TabsContent>

          <TabsContent value="mine" className="space-y-2 mt-4">
            {(mySubmissions ?? []).length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-12">
                Du har ingen innsendinger ennå.
              </div>
            )}
            {others.map((s) => (
              <Link
                key={s.id}
                to={`/hms/mobile/fill/${s.id}`}
                className="block p-3 rounded-lg border border-border/60 bg-card active:scale-[0.99] transition-transform"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{s.title || "Uten tittel"}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {s.kind?.toUpperCase()} · {formatDistanceToNow(new Date(s.submitted_at || s.updated_at), { addSuffix: true, locale: nb })}
                    </div>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
              </Link>
            ))}
          </TabsContent>

          <TabsContent value="håndbok" className="space-y-2 mt-4">
            {(handbooks ?? []).length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-12">
                Ingen håndbøker funnet.
              </div>
            )}
            {(handbooks ?? []).map((h) => {
              const needsAck = h.requires_ack && !h.my_ack && h.version_number;
              return (
                <Link
                  key={h.id}
                  to={`/hms/handbooks/${h.id}`}
                  className={`block p-3 rounded-lg border bg-card active:scale-[0.99] transition-transform ${needsAck ? "border-amber-300 bg-amber-50/40" : "border-border/60"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{h.title}</div>
                      {h.description && <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{h.description}</div>}
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {h.version_number ? `v${h.version_number}` : "Ikke publisert"}
                      </div>
                    </div>
                    {h.version_number && (
                      h.my_ack ? (
                        <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">Lest</Badge>
                      ) : needsAck ? (
                        <Badge className="text-[10px] bg-amber-600">Les og bekreft</Badge>
                      ) : null
                    )}
                  </div>
                </Link>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function SectionList({ title, icon, items, onPick, busy }: { title: string; icon: React.ReactNode; items: any[]; onPick: (id: string) => void; busy: boolean }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {icon} {title}
      </div>
      {items.map((t) => (
        <button
          key={t.id}
          disabled={busy}
          onClick={() => onPick(t.id)}
          className="w-full text-left p-3 rounded-lg border border-border/60 bg-card hover:border-primary/40 active:scale-[0.99] transition-all disabled:opacity-50"
        >
          <div className="flex items-start gap-2">
            <div className="h-9 w-9 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0">
              <Plus className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{t.name}</div>
              {t.description && (
                <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{t.description}</div>
              )}
              {t.hms_areas?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {t.hms_areas.slice(0, 3).map((a: string) => (
                    <Badge key={a} variant="outline" className="text-[10px] py-0 px-1.5 h-4">{a}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: SubmissionStatus }) {
  const cls =
    status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    status === "rejected" ? "bg-rose-50 text-rose-700 border-rose-200" :
    status === "submitted" ? "bg-blue-50 text-blue-700 border-blue-200" :
    status === "draft" ? "bg-amber-50 text-amber-700 border-amber-200" :
    "bg-muted text-muted-foreground border-border";
  return <Badge variant="outline" className={`text-[10px] ${cls}`}>{STATUS_LABELS[status] ?? status}</Badge>;
}
