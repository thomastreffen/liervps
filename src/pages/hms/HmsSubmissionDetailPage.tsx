import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ShieldCheck, CheckCircle2, XCircle, Users, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRbac } from "@/hooks/useRbac";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { reviewSubmission, STATUS_LABELS, type SubmissionStatus, type TemplateSnapshot } from "@/lib/hms/submissions";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function HmsSubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { hasPermission } = useRbac();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  const canReview = hasPermission("hms.manage");

  const { data: sub } = useQuery({
    queryKey: ["hms-detail", id],
    enabled: !!id,
    queryFn: async () => {
      const sb = supabase as any;
      const { data } = await sb.from("hms_submissions").select("*").eq("id", id).maybeSingle();
      return data;
    },
  });
  const { data: answers } = useQuery({
    queryKey: ["hms-detail-answers", id],
    enabled: !!id,
    queryFn: async () => {
      const sb = supabase as any;
      const { data } = await sb.from("hms_submission_answers").select("*").eq("submission_id", id);
      return data ?? [];
    },
  });
  const { data: parts } = useQuery({
    queryKey: ["hms-detail-parts", id],
    enabled: !!id,
    queryFn: async () => {
      const sb = supabase as any;
      const { data } = await sb.from("hms_submission_participants").select("*").eq("submission_id", id);
      return data ?? [];
    },
  });
  const { data: sigs } = useQuery({
    queryKey: ["hms-detail-sigs", id],
    enabled: !!id,
    queryFn: async () => {
      const sb = supabase as any;
      const { data } = await sb.from("hms_submission_signatures").select("*").eq("submission_id", id).order("signed_at", { ascending: true });
      return data ?? [];
    },
  });

  if (!sub) return <div className="p-6 text-center text-sm text-muted-foreground">Laster…</div>;

  const snap = sub.template_snapshot as TemplateSnapshot;
  const status = sub.status as SubmissionStatus;
  const ansByItem = new Map<string, any>();
  for (const a of (answers ?? []) as any[]) ansByItem.set(a.item_id, a);

  async function approve() {
    if (!id || !user) return;
    try {
      await reviewSubmission({ submissionId: id, approve: true, reviewerUserId: user.id });
      toast({ title: "Godkjent" });
      qc.invalidateQueries({ queryKey: ["hms-detail"] });
    } catch (e: any) {
      toast({ title: "Feil", description: e?.message, variant: "destructive" });
    }
  }
  async function reject() {
    if (!id || !user) return;
    try {
      await reviewSubmission({ submissionId: id, approve: false, reviewerUserId: user.id, reason });
      toast({ title: "Avvist" });
      setRejectOpen(false);
      qc.invalidateQueries({ queryKey: ["hms-detail"] });
    } catch (e: any) {
      toast({ title: "Feil", description: e?.message, variant: "destructive" });
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm"><Link to="/hms/submissions"><ArrowLeft className="h-4 w-4 mr-1" /> Tilbake</Link></Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
                <ShieldCheck className="h-3.5 w-3.5" /> {snap?.kind === "sja" ? "SJA" : "Sjekkliste"}
              </div>
              <CardTitle className="text-xl mt-1">{sub.title}</CardTitle>
              <div className="text-xs text-muted-foreground mt-1">
                Mal-versjon v{sub.template_version ?? 1}
                {sub.submitted_at && ` · Sendt inn ${format(new Date(sub.submitted_at), "dd.MM.yyyy HH:mm")}`}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={
                status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                status === "rejected" ? "bg-rose-50 text-rose-700 border-rose-200" :
                status === "submitted" ? "bg-blue-50 text-blue-700 border-blue-200" :
                "bg-amber-50 text-amber-700 border-amber-200"
              }>{STATUS_LABELS[status] ?? status}</Badge>
              {canReview && status === "submitted" && (
                <>
                  <Button size="sm" onClick={approve}><CheckCircle2 className="h-4 w-4 mr-1" /> Godkjenn</Button>
                  <Button size="sm" variant="outline" onClick={() => setRejectOpen(true)}><XCircle className="h-4 w-4 mr-1" /> Avvis</Button>
                </>
              )}
            </div>
          </div>
          {sub.rejection_reason && (
            <div className="mt-2 text-xs p-2 rounded-md bg-rose-50 border border-rose-200 text-rose-800">
              <strong>Avvist:</strong> {sub.rejection_reason}
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Sections + answers */}
      {(snap?.sections ?? []).map((sec) => (
        <Card key={sec.id}>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{sec.title}</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {sec.items.map((item) => {
              const a = ansByItem.get(item.id);
              return (
                <div key={item.id} className="text-sm">
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                  <div className="font-medium">{renderValue(a?.value, item.item_type)}</div>
                  {a?.photos?.length > 0 && (
                    <div className="flex gap-1.5 mt-1.5">
                      {a.photos.map((p: string) => (
                        <PhotoThumb key={p} path={p} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {/* Participants */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Deltakere</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {(parts ?? []).map((p: any) => (
            <div key={p.id} className="flex items-center justify-between text-sm p-2 rounded-md border border-border/60">
              <div>
                <div className="font-medium">{p.display_name}</div>
                {p.role && <div className="text-[11px] text-muted-foreground">{p.role}</div>}
              </div>
              {p.signed_at ? (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  Signert {format(new Date(p.signed_at), "dd.MM HH:mm")}
                </Badge>
              ) : (
                <Badge variant="outline">Mangler signatur</Badge>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Audit signatures */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Signaturlogg</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(sigs ?? []).length === 0 && <div className="text-xs text-muted-foreground">Ingen signaturer ennå.</div>}
          {(sigs ?? []).map((s: any) => (
            <div key={s.id} className="text-xs p-2 rounded-md border border-border/60 space-y-1">
              <div className="flex items-center justify-between">
                <strong>{s.signer_name}</strong>
                <span className="text-muted-foreground">{format(new Date(s.signed_at), "dd.MM.yyyy HH:mm:ss")}</span>
              </div>
              <div className="text-muted-foreground">
                Type: {s.signature_type === "drawn_signature" ? "Tegnet signatur" : "Intern bekreftelse"}
                {" · "}Mal v{s.template_version}
                {" · "}Bruker-ID: <code className="text-[10px]">{s.signer_user_id?.slice(0, 8)}</code>
              </div>
              {s.signature_data && (
                <img src={s.signature_data} alt="signatur" className="h-12 bg-white border rounded" />
              )}
              <div className="italic text-muted-foreground">"{s.confirmation_text}"</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Avvis innsending</DialogTitle></DialogHeader>
          <Textarea
            placeholder="Begrunnelse for avvisning…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Avbryt</Button>
            <Button variant="destructive" onClick={reject} disabled={!reason.trim()}>Avvis</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function renderValue(v: any, type: string) {
  if (v === undefined || v === null || v === "") return <span className="text-muted-foreground italic">–</span>;
  if (type === "yes_no_na") return v === "yes" ? "Ja" : v === "no" ? "Nei" : "N/A";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function PhotoThumb({ path }: { path: string }) {
  const [url, setUrl] = useState<string>("");
  useState(() => {
    supabase.storage.from("hms-attachments").createSignedUrl(path, 3600).then(({ data }) => {
      if (data?.signedUrl) setUrl(data.signedUrl);
    });
    return undefined;
  });
  if (!url) return <div className="h-12 w-12 rounded bg-muted grid place-items-center"><ImageIcon className="h-3 w-3 text-muted-foreground" /></div>;
  return <img src={url} alt="" className="h-12 w-12 rounded object-cover border" />;
}
