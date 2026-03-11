import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BookOpen, Send, Loader2, X, Camera, MapPin,
  FolderKanban, Sparkles, MessageCircle, Plus, ImageIcon,
  ChevronRight, Clock, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFagRequests, type FagRegime, type FagPriority, type FagRequest, type FagAnswer } from "@/hooks/useFagRequests";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { supabase } from "@/integrations/supabase/client";

// ─── Constants ─────────────────────────────────────────────

const REGIMES: { value: FagRegime; label: string; short: string }[] = [
  { value: "nek", label: "NEK 439 / NEK 400", short: "NEK" },
  { value: "fel", label: "Forskrift om elektriske lavspenningsanlegg", short: "FEL" },
  { value: "fse", label: "Sikkerhet ved arbeid i elektriske anlegg", short: "FSE" },
  { value: "fsl", label: "Sikkerhet – lavspent", short: "FSL" },
  { value: "annet", label: "La AI-en foreslå riktig regelverk", short: "Usikker" },
];

const EXAMPLE_QUESTIONS = [
  "Hvilke konstruksjonskrav gjelder for tavler iht. NEK 439?",
  "Hvordan vurderes temperaturstigning i fordelingstavler?",
  "Krav til kortslutningsytelse og vernselektivitet",
  "Hvilke kapslingskrav gjelder i tavlerom?",
  "Dokumentasjonskrav ved levering av tavleanlegg",
  "Krav og klaringer ved bruk av strømskinner",
];

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

// ─── Types ─────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  imagePath?: string;
  confidence?: number | null;
  followups?: string[];
  status?: string;
}

// ─── Main Page ─────────────────────────────────────────────

export default function RegulationPage() {
  const { activeCompanyId } = useCompanyContext();
  const { requests, loading, fetchRequests, fetchAnswers, createRequest, uploadImage, updateImagePaths, analyzeRequest } = useFagRequests();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project");

  // Active conversation
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Project context
  const [projectContext, setProjectContext] = useState<{ title: string; customer: string; address: string } | null>(null);

  // Input state
  const [regime, setRegime] = useState<FagRegime>("nek");
  const [question, setQuestion] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showRegimeSelector, setShowRegimeSelector] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

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
  }, [projectId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  // ─── Open conversation ─────────────────────────────────

  const openConversation = useCallback(async (req: FagRequest) => {
    setActiveRequestId(req.id);
    setChatLoading(true);

    const msgs: ChatMessage[] = [{
      id: `q-${req.id}`,
      role: "user",
      content: req.question,
      timestamp: req.created_at,
      imagePath: req.image_paths?.[0],
    }];

    try {
      const answers = await fetchAnswers(req.id);
      for (const a of answers.reverse()) {
        msgs.push({
          id: `a-${a.id}`,
          role: "assistant",
          content: a.answer_markdown,
          timestamp: a.created_at,
          confidence: null,
          followups: req.ai_followup_questions,
        });
      }
    } catch (err) {
      console.warn("Failed to load answers:", err);
    }

    // Load child requests (follow-ups)
    try {
      const { data: children } = await supabase
        .from("fag_requests")
        .select("*")
        .eq("parent_request_id" as any, req.id)
        .order("created_at", { ascending: true });

      if (children) {
        for (const child of children) {
          msgs.push({
            id: `q-${child.id}`,
            role: "user",
            content: child.question,
            timestamp: child.created_at,
            imagePath: (child as any).image_paths?.[0],
          });

          const childAnswers = await fetchAnswers(child.id);
          for (const a of childAnswers.reverse()) {
            msgs.push({
              id: `a-${a.id}`,
              role: "assistant",
              content: a.answer_markdown,
              timestamp: a.created_at,
              followups: (child as any).ai_followup_questions || [],
            });
          }
        }
      }
    } catch {}

    setChatMessages(msgs);
    setChatLoading(false);
  }, [fetchAnswers]);

  // ─── Handle image ──────────────────────────────────────

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) { toast.error("Kun JPG, PNG og WebP"); return; }
    if (file.size > MAX_IMAGE_SIZE) { toast.error("Maks 10 MB"); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }, []);

  const removeImage = useCallback(() => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [imagePreview]);

  // ─── Send message ──────────────────────────────────────

  const handleSend = useCallback(async () => {
    if (!question.trim() || !activeCompanyId) return;
    setSubmitting(true);
    const text = question.trim();
    setQuestion("");

    const isNewConversation = !activeRequestId;

    try {
      // Create request (with parent_request_id if follow-up)
      const insertPayload: any = { regime, question: text, priority: "normal" as FagPriority };
      const req = await createRequest(insertPayload);

      // If this is a follow-up, link to parent
      if (activeRequestId) {
        await supabase
          .from("fag_requests")
          .update({ parent_request_id: activeRequestId } as any)
          .eq("id", req.id);
      }

      let imagePaths: string[] = [];
      let images: Array<{ path: string; mime_type: string }> = [];
      if (imageFile) {
        const path = await uploadImage(req.id, imageFile);
        imagePaths = [path];
        images = [{ path, mime_type: imageFile.type }];
        await updateImagePaths(req.id, imagePaths);
      }
      removeImage();

      // Add user message to chat immediately
      const userMsg: ChatMessage = {
        id: `q-${req.id}`,
        role: "user",
        content: text,
        timestamp: new Date().toISOString(),
        imagePath: imagePaths[0],
      };

      if (isNewConversation) {
        setActiveRequestId(req.id);
        setChatMessages([userMsg]);
      } else {
        setChatMessages(prev => [...prev, userMsg]);
      }

      // Build conversation history for context
      const history = chatMessages
        .filter(m => m.role === "user" || m.role === "assistant")
        .map(m => ({
          role: m.role,
          content: m.role === "assistant" ? (m.content.substring(0, 500) + "...") : m.content,
        }));

      // Analyze
      const result = await analyzeRequest({
        fag_request_id: req.id,
        company_id: activeCompanyId,
        regime,
        question: text,
        images,
        context: projectContext
          ? { site: projectContext.address, notes: `Prosjekt: ${projectContext.title}, Kunde: ${projectContext.customer}` }
          : undefined,
      });

      // Add AI response to chat
      if (result?.answer_markdown) {
        const aiMsg: ChatMessage = {
          id: `a-${req.id}`,
          role: "assistant",
          content: result.answer_markdown,
          timestamp: new Date().toISOString(),
          confidence: result.ai_confidence,
          followups: result.followup_questions || [],
        };
        setChatMessages(prev => [...prev, aiMsg]);
      }

      await fetchRequests();
    } catch (err: any) {
      console.error("Send error:", err);
      toast.error("Kunne ikke sende", { description: err.message });
      await fetchRequests();
    } finally {
      setSubmitting(false);
    }
  }, [question, regime, imageFile, activeCompanyId, activeRequestId, chatMessages, createRequest, uploadImage, updateImagePaths, analyzeRequest, removeImage, fetchRequests, projectContext]);

  // ─── New conversation ──────────────────────────────────

  const startNewConversation = useCallback(() => {
    setActiveRequestId(null);
    setChatMessages([]);
    setQuestion("");
    removeImage();
    inputRef.current?.focus();
  }, [removeImage]);

  // ─── Handle example/followup click ────────────────────

  const handleSuggestionClick = useCallback((text: string) => {
    setQuestion(text);
    inputRef.current?.focus();
  }, []);

  // ─── Keyboard ──────────────────────────────────────────

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // ─── Conversations list (root requests only) ──────────

  const conversations = useMemo(() =>
    requests.filter(r => !(r as any).parent_request_id),
    [requests]
  );

  const lastFollowups = useMemo(() => {
    const last = chatMessages.filter(m => m.role === "assistant").slice(-1)[0];
    return last?.followups || [];
  }, [chatMessages]);

  // ─── View: Empty / Chat ────────────────────────────────

  const isInChat = activeRequestId !== null || chatMessages.length > 0;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* ─── Sidebar: Conversation history ─── */}
      <div className="hidden md:flex w-72 border-r border-border flex-col bg-muted/30">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <BookOpen className="h-4 w-4 text-primary" />
            Fagstøtte
          </h2>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={startNewConversation}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {loading && <div className="text-xs text-muted-foreground p-3 text-center">Laster…</div>}
            {conversations.map(conv => {
              const isActive = activeRequestId === conv.id;
              const preview = conv.ai_summary || conv.question.substring(0, 60);
              return (
                <button
                  key={conv.id}
                  onClick={() => openConversation(conv)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-lg transition-colors group",
                    isActive
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-secondary/60"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <MessageCircle className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{conv.question.split("\n")[0].substring(0, 50)}</p>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">{preview}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {format(new Date(conv.last_activity_at || conv.created_at), "d. MMM", { locale: nb })}
                        </span>
                        <Badge variant="outline" className={cn("text-[9px] h-4 px-1", regimeChipClass(conv.regime))}>
                          {conv.regime.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* ─── Main chat area ─── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Context stripe */}
        {projectContext && (
          <div className="flex items-center gap-3 border-b border-border bg-primary/[0.03] px-4 py-2">
            <FolderKanban className="h-3.5 w-3.5 text-primary shrink-0" />
            <p className="text-xs font-medium truncate">{projectContext.title}</p>
            {projectContext.customer && <span className="text-[10px] text-muted-foreground">· {projectContext.customer}</span>}
            {projectContext.address && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <MapPin className="h-2.5 w-2.5" /> {projectContext.address}
              </span>
            )}
          </div>
        )}

        {/* Chat messages area */}
        <ScrollArea className="flex-1">
          <div className="max-w-3xl mx-auto px-4 py-6">
            {!isInChat && !loading ? (
              /* ─── Welcome / Empty state ─── */
              <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-7 w-7 text-primary" />
                </div>
                <div className="text-center space-y-1">
                  <h2 className="text-lg font-semibold">Hva kan jeg hjelpe med?</h2>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Spør om NEK 439, tavlekonstruksjon, kapslingskrav, vernselektivitet eller annet fagstoff.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
                  {EXAMPLE_QUESTIONS.map((eq, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestionClick(eq)}
                      className="text-left px-4 py-3 rounded-xl border border-border/60 bg-card hover:bg-secondary/40 hover:border-primary/20 transition-all text-sm text-foreground/80 hover:text-foreground group"
                    >
                      <span className="flex items-start gap-2">
                        <ArrowRight className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span>{eq}</span>
                      </span>
                    </button>
                  ))}
                </div>

                {/* Mobile: show recent conversations */}
                {conversations.length > 0 && (
                  <div className="md:hidden w-full max-w-xl space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Tidligere samtaler</p>
                    {conversations.slice(0, 5).map(conv => (
                      <button
                        key={conv.id}
                        onClick={() => openConversation(conv)}
                        className="w-full text-left px-4 py-3 rounded-xl border border-border/60 bg-card hover:bg-secondary/40 transition-all flex items-center gap-3"
                      >
                        <MessageCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm truncate">{conv.question.split("\n")[0].substring(0, 50)}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {format(new Date(conv.last_activity_at || conv.created_at), "d. MMM HH:mm", { locale: nb })}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* ─── Chat thread ─── */
              <div className="space-y-4">
                {chatLoading && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                )}

                {chatMessages.map(msg => (
                  <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-3",
                      msg.role === "user"
                        ? "rounded-tr-md bg-primary text-primary-foreground"
                        : "rounded-tl-md bg-muted/60"
                    )}>
                      {msg.role === "assistant" && (
                        <div className="flex items-center gap-1.5 mb-2">
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                          <span className="text-[11px] font-medium text-primary">Fagassistent</span>
                          {msg.confidence != null && (
                            <span className="text-[10px] text-muted-foreground ml-auto">{msg.confidence}%</span>
                          )}
                        </div>
                      )}

                      {msg.role === "user" ? (
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <div className="prose prose-sm max-w-none text-foreground">
                          <MarkdownRenderer content={msg.content} />
                        </div>
                      )}

                      {msg.imagePath && (
                        <div className="mt-2">
                          <FagImagePreview path={msg.imagePath} />
                        </div>
                      )}

                      <p className={cn(
                        "text-[10px] mt-1.5",
                        msg.role === "user" ? "text-primary-foreground/60 text-right" : "text-muted-foreground"
                      )}>
                        {format(new Date(msg.timestamp), "d. MMM HH:mm", { locale: nb })}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Analyzing indicator */}
                {submitting && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-2xl rounded-tl-md bg-muted/60 px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">Analyserer…</span>
                    </div>
                  </div>
                )}

                {/* Follow-up suggestions */}
                {lastFollowups.length > 0 && !submitting && (
                  <div className="flex flex-wrap gap-2 pl-2">
                    {lastFollowups.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestionClick(q)}
                        className="px-3 py-1.5 rounded-full text-xs bg-primary/5 text-primary border border-primary/20 hover:bg-primary/10 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>
            )}
          </div>
        </ScrollArea>

        {/* ─── Input bar ─── */}
        <div className="border-t border-border bg-card p-3">
          <div className="max-w-3xl mx-auto">
            {/* Regime selector (inline toggle) */}
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => setShowRegimeSelector(!showRegimeSelector)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
              >
                <Badge variant="outline" className={cn("text-[9px] h-4 px-1.5", regimeChipClass(regime))}>
                  {REGIMES.find(r => r.value === regime)?.short}
                </Badge>
                Regelverk
              </button>
              {showRegimeSelector && (
                <div className="flex flex-wrap gap-1">
                  {REGIMES.map(r => (
                    <button
                      key={r.value}
                      onClick={() => { setRegime(r.value); setShowRegimeSelector(false); }}
                      className={cn(
                        "px-2 py-1 rounded-full text-[10px] font-medium transition-colors border",
                        regime === r.value
                          ? "bg-accent text-accent-foreground border-accent"
                          : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80"
                      )}
                    >
                      {r.short}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Image preview */}
            {imagePreview && (
              <div className="mb-2 relative inline-block">
                <img src={imagePreview} alt="Vedlegg" className="h-20 w-auto rounded-lg border border-border object-cover" />
                <button
                  onClick={removeImage}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Input row */}
            <div className="flex items-end gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="h-10 w-10 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors shrink-0"
              >
                {imageFile ? <ImageIcon className="h-4 w-4 text-primary" /> : <Camera className="h-4 w-4" />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={handleImageSelect}
                className="hidden"
              />
              <Textarea
                ref={inputRef}
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Still et fagspørsmål…"
                className="min-h-[40px] max-h-[120px] resize-none flex-1"
                rows={1}
              />
              <Button
                onClick={handleSend}
                disabled={submitting || !question.trim()}
                size="icon"
                className="h-10 w-10 shrink-0"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>

            <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
              AI gir veiledning – sjekk alltid original forskrift ved tvil
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────

function FagImagePreview({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    supabase.storage.from("fag-attachments").createSignedUrl(path, 3600).then(({ data }) => {
      if (data?.signedUrl) setUrl(data.signedUrl);
    });
  }, [path]);
  if (!url) return <div className="h-24 w-24 rounded-lg bg-muted/40 animate-pulse" />;
  return <img src={url} alt="Vedlegg" className="max-h-48 rounded-lg border border-border object-contain" />;
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
