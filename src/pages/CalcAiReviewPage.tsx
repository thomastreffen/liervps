import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useCalcAiDraft } from "@/hooks/useCalcAiDraft";
import { useCalcPackageBundle } from "@/hooks/useCalcPackages";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft, Sparkles, Loader2, Send, FileText, Image as ImageIcon,
  FileType2, AlertTriangle, HelpCircle, CheckCircle2, Upload, ArrowRight,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { displayFieldValue, isMissingValue } from "@/lib/calc-engine/display";

function confidenceColor(c: number): string {
  if (c >= 80) return "bg-emerald-500";
  if (c >= 60) return "bg-amber-500";
  if (c >= 30) return "bg-orange-500";
  return "bg-rose-500";
}

function confidenceLabel(c: number): string {
  if (c >= 80) return "Høy";
  if (c >= 60) return "Middels";
  if (c >= 30) return "Lav";
  return "Veldig lav";
}

function fileIcon(mime: string) {
  if (mime?.startsWith("image/")) return <ImageIcon className="h-4 w-4" />;
  if (mime === "application/pdf") return <FileType2 className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

export default function CalcAiReviewPage() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { draft, messages, loading, analyzing, analyze, refresh } = useCalcAiDraft(id ?? null);
  const { pkg, fields } = useCalcPackageBundle(draft?.package_id ?? null);

  const [chatInput, setChatInput] = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const triggeredAutorun = useRef(false);

  // Trigger første analyse automatisk hvis ?autorun=1 og status === 'draft'
  useEffect(() => {
    if (!draft || triggeredAutorun.current) return;
    if (params.get("autorun") === "1" && draft.status === "draft") {
      triggeredAutorun.current = true;
      analyze().catch((e: any) => {
        console.error("[calc-ai-review] autorun analyze failed", e);
        toast({
          title: "AI-analyse feilet",
          description: e?.message ?? "Prøv igjen, eller send en korrigering.",
          variant: "destructive",
        });
      });
    }
  }, [draft, params, analyze]);

  // Auto-scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, analyzing]);

  const fieldMap = useMemo(() => {
    const m = new Map<string, typeof fields[number]>();
    for (const f of fields) m.set(f.field_key, f);
    return m;
  }, [fields]);

  const handleSendChat = async () => {
    const msg = chatInput.trim();
    if (!msg || analyzing) return;
    setChatInput("");
    try {
      await analyze(msg);
    } catch (e: any) {
      toast({ title: "AI-analyse feilet", description: e.message ?? String(e), variant: "destructive" });
    }
  };

  const handleAddFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fl = e.target.files;
    if (!fl || !draft || !user) return;
    const newAtt = [...(draft.attachments ?? [])];
    for (let i = 0; i < fl.length; i++) {
      const f = fl[i];
      if (f.size > 20 * 1024 * 1024) continue;
      const safeName = f.name.replace(/[^\w.\-]+/g, "_");
      const path = `${user.id}/${draft.id}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("calc-ai-drafts")
        .upload(path, f, { contentType: f.type, upsert: false });
      if (!upErr) {
        newAtt.push({
          path, name: f.name, mime_type: f.type || "application/octet-stream",
          size: f.size, bucket: "calc-ai-drafts",
        });
      }
    }
    await supabase.from("calc_ai_drafts").update({ attachments: newAtt as any }).eq("id", draft.id);
    e.target.value = "";
    await refresh();
    toast({ title: "Underlag oppdatert", description: "Send 'Analyser på nytt' for å bruke nye filer." });
  };

  const handleApplyToEditor = (systemIndex: number = 0) => {
    if (!draft) return;
    navigate(`/sales/calc-engine/new?package=${draft.package_id}&from_draft=${draft.id}&system=${systemIndex}`);
  };

  if (loading || !draft || !pkg) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const systems = (Array.isArray(draft.ai_proposed_lines) && draft.ai_proposed_lines.length > 0)
    ? draft.ai_proposed_lines
    : (Object.keys(draft.ai_proposed_input ?? {}).length > 0
        ? [{ name: "System 1", proposed_input: draft.ai_proposed_input, system_confidence: draft.overall_confidence }]
        : []);
  const totalSuggestedFields = systems.reduce(
    (s, sys) => s + Object.keys(sys.proposed_input ?? {}).length, 0,
  );

  const isAnalyzing = analyzing || draft.status === "analyzing";
  const statusMeta = (() => {
    if (isAnalyzing) return { label: "Analyserer", color: "bg-amber-500" };
    if (draft.status === "ready") return { label: "Analysert", color: "bg-emerald-500" };
    if (draft.status === "applied") return { label: "Brukt i editor", color: "bg-primary" };
    if (draft.status === "discarded") return { label: "Forkastet", color: "bg-muted-foreground" };
    return { label: "Utkast", color: "bg-slate-400" };
  })();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1500px] mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Button variant="ghost" size="icon" onClick={() => navigate("/sales/calc-engine/new")} className="rounded-xl">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" /> AI-utkast — {pkg.name}
          </h1>
          <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${statusMeta.color} ${isAnalyzing ? "animate-pulse" : ""}`} />
              <span className="font-medium text-foreground">{statusMeta.label}</span>
            </span>
            {systems.length > 1 && (
              <>· <span className="font-medium text-foreground">{systems.length} systemer</span></>
            )}
            {draft.overall_confidence != null && (
              <>· Samlet confidence: <span className="font-medium text-foreground">{Math.round(draft.overall_confidence)}%</span></>
            )}
            {draft.model_used && <>· Modell: <span className="font-mono text-[10px]">{draft.model_used}</span></>}
          </p>
        </div>
        {!isAnalyzing && draft.status !== "ready" && (
          <Button
            variant="outline"
            onClick={() => analyze().catch((e) => toast({ title: "AI-analyse feilet", description: e?.message ?? String(e), variant: "destructive" }))}
            className="rounded-xl gap-1.5"
          >
            <Sparkles className="h-4 w-4" /> Kjør analyse
          </Button>
        )}
        {systems.length <= 1 && (
          <Button
            onClick={() => handleApplyToEditor(0)}
            disabled={draft.status !== "ready" || totalSuggestedFields === 0}
            className="rounded-xl gap-1.5"
          >
            Bruk forslag i editor <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-5">
        {/* VENSTRE: AI-forslag */}
        <div className="space-y-5">
          {/* Oppsummering */}
          <Card className="p-5 rounded-2xl bg-gradient-to-br from-primary-soft/40 to-transparent">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  AI-oppsummering
                </h3>
                {isAnalyzing && !draft.ai_summary ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Analyserer underlag… dette tar typisk 10–40 sek for tegninger.
                  </div>
                ) : draft.ai_summary ? (
                  <p className="text-sm leading-relaxed">{draft.ai_summary}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Ingen oppsummering enda. Trykk «Kjør analyse» for å starte.</p>
                )}
              </div>
            </div>
          </Card>

          {/* Antakelser & spørsmål */}
          {(draft.ai_assumptions?.length > 0 || draft.ai_open_questions?.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {draft.ai_assumptions?.length > 0 && (
                <Card className="p-4 rounded-2xl">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Antakelser
                  </h4>
                  <ul className="space-y-1.5 text-sm">
                    {draft.ai_assumptions.map((a, i) => (
                      <li key={i} className="text-muted-foreground leading-snug">• {a}</li>
                    ))}
                  </ul>
                </Card>
              )}
              {draft.ai_open_questions?.length > 0 && (
                <Card className="p-4 rounded-2xl">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                    <HelpCircle className="h-3.5 w-3.5 text-primary" /> Åpne spørsmål
                  </h4>
                  <ul className="space-y-1.5 text-sm">
                    {draft.ai_open_questions.map((q, i) => (
                      <li key={i} className="text-muted-foreground leading-snug">• {q}</li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          )}

          {/* Foreslåtte systemer */}
          {systems.length === 0 ? (
            <Card className="p-5 rounded-2xl">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Foreslåtte systemer
              </h3>
              <p className="text-sm text-muted-foreground text-center py-6">
                Ingen forslag enda. AI fyller dette ut etter analyse.
              </p>
            </Card>
          ) : (
            <>
              {systems.length > 1 && (
                <Card className="p-4 rounded-2xl border-primary/30 bg-primary/5">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-sm font-semibold">AI foreslår {systems.length} separate kalkyler</div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Underlaget inneholder flere systemer ({systems.map((s) => s.name).join(", ")}). Hvert system blir én egen kalkyle.
                      </p>
                    </div>
                  </div>
                </Card>
              )}
              {systems.map((sys, sysIdx) => {
                const inp = sys.proposed_input ?? {};
                const keys = Object.keys(inp);
                const sConf = Math.round(sys.system_confidence ?? draft.overall_confidence ?? 0);
                return (
                  <Card key={sysIdx} className="p-5 rounded-2xl">
                    <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold">
                            {systems.length > 1 ? `Kalkyle ${sysIdx + 1}: ` : ""}{sys.name}
                          </h3>
                          {sys.system_confidence != null && (
                            <Badge variant="outline" className="rounded-md text-[10px] gap-1">
                              <span className={`h-1.5 w-1.5 rounded-full ${confidenceColor(sConf)}`} />
                              {sConf}%
                            </Badge>
                          )}
                        </div>
                        {sys.note && <p className="text-xs text-muted-foreground mt-0.5">{sys.note}</p>}
                        <div className="text-[11px] text-muted-foreground mt-1">{keys.length} foreslåtte felter</div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleApplyToEditor(sysIdx)}
                        disabled={draft.status !== "ready" || keys.length === 0}
                        className="rounded-xl gap-1.5"
                      >
                        Bruk i editor <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {keys.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Ingen felter foreslått for dette systemet.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {keys.map((key) => {
                          const f = fieldMap.get(key);
                          const p = inp[key];
                          const conf = Math.round(p.confidence ?? 0);
                          return (
                            <div key={key} className="p-3 rounded-xl border border-border bg-card/50">
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <div className="text-xs font-medium text-muted-foreground">
                                  {f?.label ?? key}
                                </div>
                                <Badge variant="outline" className="rounded-md text-[10px] gap-1 shrink-0">
                                  <span className={`h-1.5 w-1.5 rounded-full ${confidenceColor(conf)}`} />
                                  {conf}%
                                </Badge>
                              </div>
                              <div className={`text-sm font-semibold mb-1 break-words ${isMissingValue(p.value) ? "text-amber-600 dark:text-amber-400 italic" : ""}`}>
                                {displayFieldValue(f, p.value)}
                                {!isMissingValue(p.value) && f?.unit && <span className="text-xs text-muted-foreground font-normal ml-1">{f.unit}</span>}
                              </div>
                              {p.reason && (
                                <p className="text-[11px] text-muted-foreground/80 leading-snug">{p.reason}</p>
                              )}
                              <div className="text-[10px] text-muted-foreground/60 mt-1">{confidenceLabel(conf)}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                );
              })}
            </>
          )}

          {/* Underlag */}
          <Card className="p-5 rounded-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Underlag ({draft.attachments?.length ?? 0})
              </h3>
              <label className="cursor-pointer">
                <input type="file" multiple accept="image/*,application/pdf" onChange={handleAddFiles} className="hidden" />
                <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-accent">
                  <Upload className="h-3.5 w-3.5" /> Legg til
                </span>
              </label>
            </div>
            {(draft.attachments?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Ingen vedlegg.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {draft.attachments.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-card/50">
                    <div className="text-muted-foreground">{fileIcon(a.mime_type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{a.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {(a.size / 1024).toFixed(0)} kB
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* HØYRE: chat-korrigering */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card className="rounded-2xl flex flex-col h-[calc(100vh-8rem)] max-h-[800px]">
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" /> Korriger AI
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                F.eks. «Det er Eaton, ikke Schneider», «Bruk 6300A», «Legg til 2 ekstra vinkler».
              </p>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {messages.length === 0 && !analyzing && (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    Ingen meldinger enda. Send en korrigering for å forbedre forslaget.
                  </p>
                )}
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm
                      ${m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"}
                    `}>
                      <div className="whitespace-pre-wrap leading-snug">{m.content}</div>
                      {m.role === "assistant" && m.metadata?.overall_confidence != null && (
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] opacity-70">
                          <CheckCircle2 className="h-3 w-3" />
                          Forslag oppdatert · {Math.round(m.metadata.overall_confidence)}%
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {analyzing && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl px-3 py-2 text-sm flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span className="text-muted-foreground">AI tenker…</span>
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>
            </ScrollArea>

            <Separator />
            <div className="p-3 space-y-2">
              <Textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSendChat();
                  }
                }}
                placeholder="Skriv en korrigering…"
                rows={2}
                className="rounded-xl resize-none text-sm"
                disabled={analyzing}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted-foreground">⌘/Ctrl + Enter for å sende</span>
                <Button
                  size="sm"
                  onClick={handleSendChat}
                  disabled={analyzing || !chatInput.trim()}
                  className="rounded-lg gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" /> Send
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
