import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { BookOpen, Search, Send, Loader2, ImageIcon, X, AlertTriangle, ChevronDown, ChevronUp, Camera, MapPin, FolderKanban, Sparkles, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useFagRequests, type FagRegime, type FagPriority, type FagRequest, type FagAnswer } from "@/hooks/useFagRequests";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { supabase } from "@/integrations/supabase/client";

const REGIMES: { value: FagRegime; label: string; description: string }[] = [
  { value: "nek", label: "NEK", description: "Norsk Elektroteknisk Komité" },
  { value: "fel", label: "FEL", description: "Forskrift om elektriske lavspenningsanlegg" },
  { value: "fse", label: "FSE", description: "Forskrift om sikkerhet ved arbeid i elektriske anlegg" },
  { value: "fsl", label: "FSL", description: "Forskrift om sikkerhet ved vassdragsanlegg" },
  { value: "annet", label: "Usikker / Annet", description: "La AI-en foreslå riktig regelverk" },
];

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  new: { label: "Venter", className: "bg-muted text-muted-foreground" },
  analyzing: { label: "Analyserer…", className: "bg-primary/10 text-primary" },
  answered: { label: "Besvart", className: "bg-success/10 text-success" },
  needs_followup: { label: "Trenger oppfølging", className: "bg-accent/10 text-accent" },
  error: { label: "Feil", className: "bg-destructive/10 text-destructive" },
};

const EXAMPLE_QUESTIONS = [
  "Hva er kravet til kapslingsgrad (IP) for installasjoner i våtrom?",
  "Hvilke krav gjelder for jordfeilbryter i boliger etter NEK 400?",
  "Er det krav om nødlyssystem i dette bygget?",
  "Hva er minstekrav til tverrsnitt for jordleder i TN-S system?",
  "Hvilke krav stilles til dokumentasjon ved ferdigmelding?",
  "Trenger jeg FDV-dokumentasjon for denne typen installasjon?",
];

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function RegulationPage() {
  const { activeCompanyId } = useCompanyContext();
  const { requests, loading, fetchRequests, fetchAnswers, createRequest, uploadImage, updateImagePaths, analyzeRequest } = useFagRequests();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project");

  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, FagAnswer[]>>({});

  // Project context
  const [projectContext, setProjectContext] = useState<{ title: string; customer: string; address: string } | null>(null);

  // Form state
  const [regime, setRegime] = useState<FagRegime>("nek");
  const [question, setQuestion] = useState("");
  const [priority, setPriority] = useState<FagPriority>("normal");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const newRequestRef = useRef<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Load project context
  useEffect(() => {
    if (!projectId) return;
    supabase
      .from("events")
      .select("title, customer, address")
      .eq("id", projectId)
      .single()
      .then(({ data }) => {
        if (data) setProjectContext(data as any);
      });
    // Auto-open form in project context mode
    setShowForm(true);
  }, [projectId]);

  // Scroll to new request after creation
  useEffect(() => {
    if (newRequestRef.current) {
      const el = document.getElementById(`fag-${newRequestRef.current}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setExpandedId(newRequestRef.current);
        newRequestRef.current = null;
      }
    }
  }, [requests]);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Kun JPG, PNG og WebP er støttet");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error("Bildet er for stort. Maks 10 MB.");
      return;
    }
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  }, []);

  const removeImage = useCallback(() => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [imagePreview]);

  const handleSubmit = useCallback(async () => {
    if (!question.trim() || !activeCompanyId) return;
    setSubmitting(true);
    try {
      const req = await createRequest({ regime, question: question.trim(), priority });

      let imagePaths: string[] = [];
      let images: Array<{ path: string; mime_type: string }> = [];
      if (imageFile) {
        const path = await uploadImage(req.id, imageFile);
        imagePaths = [path];
        images = [{ path, mime_type: imageFile.type }];
        await updateImagePaths(req.id, imagePaths);
      }

      setQuestion("");
      setRegime("nek");
      setPriority("normal");
      removeImage();
      setShowForm(false);
      toast.success("Spørsmål sendt – faglig vurdering pågår…");
      newRequestRef.current = req.id;

      await analyzeRequest({
        fag_request_id: req.id,
        company_id: activeCompanyId,
        regime,
        question: question.trim(),
        images,
        context: projectContext ? { site: projectContext.address, notes: `Prosjekt: ${projectContext.title}, Kunde: ${projectContext.customer}` } : undefined,
      });

      await fetchRequests();
    } catch (err: any) {
      console.error("Submit error:", err);
      toast.error("Kunne ikke sende spørsmål", { description: err.message });
      await fetchRequests();
    } finally {
      setSubmitting(false);
    }
  }, [question, regime, priority, imageFile, activeCompanyId, createRequest, uploadImage, updateImagePaths, analyzeRequest, removeImage, fetchRequests, projectContext]);

  const toggleExpand = useCallback(async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!answers[id]) {
      try {
        const a = await fetchAnswers(id);
        setAnswers(prev => ({ ...prev, [id]: a }));
      } catch (err) {
        console.warn("Failed to fetch answers:", err);
      }
    }
  }, [expandedId, answers, fetchAnswers]);

  const handleFollowupClick = useCallback((text: string) => {
    setQuestion(text);
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  const openForm = useCallback(() => {
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return requests;
    const s = search.toLowerCase();
    return requests.filter(r =>
      r.question.toLowerCase().includes(s) ||
      r.regime.includes(s) ||
      r.ai_summary?.toLowerCase().includes(s)
    );
  }, [requests, search]);

  const showEmptyState = !loading && requests.length === 0 && !showForm;

  return (
    <div className="w-full p-5 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Fagstøtte
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Din digitale fagassistent — spør om regelverk, krav og beste praksis
          </p>
        </div>
        {!showForm && !showEmptyState && (
          <Button onClick={openForm} className="gap-1.5">
            <HelpCircle className="h-4 w-4" />
            Still fagspørsmål
          </Button>
        )}
      </div>

      {/* Context stripe */}
      {projectContext && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/[0.03] px-4 py-2.5">
          <FolderKanban className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate">{projectContext.title}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {projectContext.customer && <span>{projectContext.customer}</span>}
              {projectContext.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {projectContext.address}
                </span>
              )}
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] border-primary/20 text-primary shrink-0">
            Prosjektkontekst
          </Badge>
        </div>
      )}

      {/* Inline form */}
      {showForm && (
        <div ref={formRef}>
          <Card className="border-primary/30">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Still fagspørsmål
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} className="h-7 text-xs">
                  Avbryt
                </Button>
              </div>

              {/* Regime chips */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Hvilket regelverk gjelder?</label>
                <div className="flex flex-wrap gap-2">
                  {REGIMES.map(r => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRegime(r.value)}
                      title={r.description}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
                        regime === r.value
                          ? "bg-accent text-accent-foreground border-accent"
                          : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80"
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Hva lurer du på?</label>
                <Textarea
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  placeholder="Beskriv situasjonen eller still et konkret spørsmål…"
                  className="min-h-[140px] resize-y"
                />
              </div>

              {/* Image upload */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Bilde (valgfritt)</label>
                {imagePreview ? (
                  <div className="relative inline-block">
                    <img
                      src={imagePreview}
                      alt="Vedlagt bilde"
                      className="h-32 w-auto rounded-lg border border-border object-cover"
                    />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      const file = e.dataTransfer.files?.[0];
                      if (file) {
                        const fakeEvent = { target: { files: [file] } } as any;
                        handleImageSelect(fakeEvent);
                      }
                    }}
                    className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/[0.02] transition-colors"
                  >
                    <Camera className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-xs text-muted-foreground">
                      Dra og slipp eller klikk for å velge bilde
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      JPG, PNG, WebP · Maks 10 MB
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Hvor raskt trenger du svar?</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPriority("normal")}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
                      priority === "normal"
                        ? "bg-primary/10 text-primary border-primary/30"
                        : "bg-secondary text-secondary-foreground border-border"
                    )}
                  >
                    Normalt
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriority("viktig")}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
                      priority === "viktig"
                        ? "bg-accent/10 text-accent border-accent/30"
                        : "bg-secondary text-secondary-foreground border-border"
                    )}
                  >
                    Haster
                  </button>
                </div>
              </div>

              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={submitting || !question.trim()}
                className="w-full gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyserer…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Få faglig vurdering
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty state with example questions */}
      {showEmptyState && (
        <div className="text-center py-8 space-y-6">
          <div>
            <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Hva lurer du på?</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Still spørsmål om regelverk, krav og beste praksis. AI-en gir deg faglig veiledning basert på NEK, FEL, FSE og FSL.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl mx-auto">
            {EXAMPLE_QUESTIONS.map((eq, i) => (
              <button
                key={i}
                onClick={() => handleFollowupClick(eq)}
                className="text-left px-4 py-3 rounded-xl border border-border/60 bg-card hover:bg-secondary/40 hover:border-primary/20 transition-all text-sm text-foreground/80 hover:text-foreground"
              >
                <span className="text-primary mr-1.5">→</span>
                {eq}
              </button>
            ))}
          </div>

          <Button onClick={openForm} variant="outline" className="gap-1.5 mt-2">
            <HelpCircle className="h-4 w-4" />
            Skriv eget spørsmål
          </Button>
        </div>
      )}

      {/* Search — only show if there are requests */}
      {requests.length > 0 && (
        <>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Søk i tidligere spørsmål…"
              className="pl-9"
            />
          </div>

          {/* Request list */}
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Laster…</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/40" />
                <p className="text-muted-foreground">Ingen treff</p>
              </div>
            ) : (
              filtered.map(req => (
                <FagRequestCard
                  key={req.id}
                  request={req}
                  expanded={expandedId === req.id}
                  onToggle={() => toggleExpand(req.id)}
                  answers={answers[req.id] || []}
                  onFollowupClick={handleFollowupClick}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

// --- Sub-components ---

function FagRequestCard({
  request,
  expanded,
  onToggle,
  answers,
  onFollowupClick,
}: {
  request: FagRequest;
  expanded: boolean;
  onToggle: () => void;
  answers: FagAnswer[];
  onFollowupClick: (text: string) => void;
}) {
  const statusCfg = STATUS_CONFIG[request.status] || STATUS_CONFIG.new;
  const firstLine = request.question.split("\n")[0].substring(0, 120);
  const hasImage = request.image_paths.length > 0;
  const isAnswered = request.status === "answered" && answers.length > 0;

  return (
    <div id={`fag-${request.id}`} className="rounded-xl border border-border/60 bg-card overflow-hidden">
      {/* Compact row */}
      <button onClick={onToggle} className="w-full text-left p-4 hover:bg-secondary/30 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge variant="outline" className={cn("text-[10px]", regimeChipClass(request.regime))}>
                {request.regime.toUpperCase()}
              </Badge>
              <Badge variant="outline" className={cn("text-[10px]", statusCfg.className)}>
                {statusCfg.label}
              </Badge>
              {request.priority === "viktig" && (
                <Badge variant="outline" className="text-[10px] bg-accent/10 text-accent border-accent/20">
                  Haster
                </Badge>
              )}
              {hasImage && <ImageIcon className="h-3 w-3 text-muted-foreground" />}
              {request.ai_confidence != null && (
                <span className="text-[10px] text-muted-foreground">
                  {request.ai_confidence}% sikkerhet
                </span>
              )}
            </div>
            <p className="text-sm font-medium truncate">{firstLine}</p>
            {request.ai_summary && !expanded && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{request.ai_summary}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-muted-foreground">
              {format(new Date(request.created_at), "d. MMM HH:mm", { locale: nb })}
            </span>
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </button>

      {/* Expanded: conversation-style */}
      {expanded && (
        <div className="border-t border-border/40">
          {/* User's question bubble */}
          <div className="p-5 space-y-3">
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-primary/10 px-4 py-3">
                <p className="text-sm whitespace-pre-wrap text-foreground">{request.question}</p>
                <p className="text-[10px] text-muted-foreground mt-1.5 text-right">
                  {format(new Date(request.created_at), "d. MMM HH:mm", { locale: nb })}
                </p>
              </div>
            </div>

            {/* Image */}
            {hasImage && (
              <div className="flex justify-end">
                <div className="max-w-[60%]">
                  <FagImagePreview path={request.image_paths[0]} />
                </div>
              </div>
            )}

            {/* AI analyzing */}
            {request.status === "analyzing" && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-md bg-muted/60 px-4 py-3 text-primary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Analyserer spørsmålet…</span>
                </div>
              </div>
            )}

            {/* AI error */}
            {request.status === "error" && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-md bg-destructive/5 px-4 py-3 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">Analysen feilet. Prøv igjen senere.</span>
                </div>
              </div>
            )}

            {/* AI answer bubble */}
            {answers.length > 0 && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-muted/50 px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span className="text-[11px] font-medium text-primary">Faglig vurdering</span>
                  </div>
                  <div className="prose prose-sm max-w-none text-foreground">
                    <MarkdownRenderer content={answers[0].answer_markdown} />
                  </div>
                  {answers[0].model && (
                    <p className="text-[10px] text-muted-foreground mt-3">
                      {format(new Date(answers[0].created_at), "d. MMM HH:mm", { locale: nb })}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Followup questions */}
          {request.ai_followup_questions.length > 0 && (
            <div className="px-5 pb-4">
              <p className="text-[11px] font-medium text-muted-foreground mb-2">Spør videre</p>
              <div className="flex flex-wrap gap-2">
                {request.ai_followup_questions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => onFollowupClick(q)}
                    className="px-3 py-1.5 rounded-full text-xs bg-primary/5 text-primary border border-primary/20 hover:bg-primary/10 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="px-5 py-3 bg-muted/30">
            <p className="text-[11px] text-muted-foreground italic">
              ⚠️ AI gir veiledning basert på kjente prinsipper. Original forskrift må alltid sjekkes ved tvil.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function FagImagePreview({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    supabase.storage.from("fag-attachments").createSignedUrl(path, 3600).then(({ data }) => {
      if (data?.signedUrl) setUrl(data.signedUrl);
    });
  }, [path]);

  if (!url) return <div className="h-32 w-32 rounded-lg bg-muted animate-pulse" />;
  return <img src={url} alt="Vedlagt bilde" className="max-h-64 rounded-lg border border-border object-contain" />;
}

function MarkdownRenderer({ content }: { content: string }) {
  const html = content
    .replace(/^### (.+)$/gm, '<h4 class="text-sm font-semibold mt-3 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="text-sm font-bold mt-4 mb-2 text-primary">$1</h3>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-sm">$1</li>')
    .replace(/^⚠️ (.+)$/gm, '<p class="text-sm text-accent flex items-start gap-1.5"><span class="shrink-0">⚠️</span>$1</p>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-muted-foreground">$1</em>')
    .replace(/^---$/gm, '<hr class="my-3 border-border/40" />')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

function regimeChipClass(regime: string): string {
  switch (regime) {
    case "nek": return "bg-primary/10 text-primary border-primary/20";
    case "fel": return "bg-accent/10 text-accent border-accent/20";
    case "fse": return "bg-destructive/10 text-destructive border-destructive/20";
    case "fsl": return "bg-success/10 text-success border-success/20";
    default: return "bg-muted text-muted-foreground border-border";
  }
}
