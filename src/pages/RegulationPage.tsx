import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BookOpen, Send, Loader2, X, Camera, MapPin,
  FolderKanban, Sparkles, MessageCircle, Plus, ImageIcon,
  ChevronRight, Clock, ArrowRight, MoreHorizontal,
  Archive, ArchiveRestore, Trash2, FlaskConical, CheckSquare, Square,
  Pin, PinOff, ArrowLeft, Mic, Thermometer, FileDown,
  AlertTriangle, Shield, Zap, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { useFagRequests, type FagRegime, type FagPriority, type FagRequest, type FagAnswer } from "@/hooks/useFagRequests";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { CameraCapture } from "@/components/conversations/CameraCapture";
import { VoiceRecorder } from "@/components/conversations/VoiceRecorder";

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
  analysisType?: "general" | "thermography";
  thermography?: ThermographyData | null;
  nekReferences?: NekReference[] | null;
}

interface NekReference {
  reference: string;
  relevance: "high" | "supplementary" | "related";
  plain_summary: string;
  why_relevant: string;
  used_in_assessment: boolean;
}

interface ThermographyData {
  overall_risk: "critical" | "warning" | "normal";
  hotspots: Array<{
    component: string;
    location: string;
    severity: "critical" | "warning" | "normal";
    temperature_estimate?: string;
    description: string;
    confidence: number;
  }>;
  possible_causes: Array<{
    cause: string;
    likelihood: "high" | "medium" | "low";
    explanation: string;
  }>;
  action_items: Array<{
    action: string;
    priority: "immediate" | "planned" | "monitoring";
    description: string;
  }>;
  nek_references: NekReference[];
  max_temperature?: string;
  delta_t?: string;
  load_estimate?: string;
}

type SidebarFilter = "active" | "archived" | "test";

// ─── Main Page ─────────────────────────────────────────────

export default function RegulationPage() {
  const { activeCompanyId } = useCompanyContext();
  const isMobile = useIsMobile();
  const {
    requests, loading, fetchRequests, fetchAnswers, createRequest,
    uploadImage, updateImagePaths, analyzeRequest,
    archiveRequest, unarchiveRequest, deleteRequest, toggleTestMode,
    pinRequest, bulkArchive, bulkDelete, bulkMarkTest, purgeTestConversations,
  } = useFagRequests();
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

  // Sidebar state
  const [sidebarFilter, setSidebarFilter] = useState<SidebarFilter>("active");
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [testModeActive, setTestModeActive] = useState(false);

  // Mobile state
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [swipingId, setSwipingId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const touchStartX = useRef(0);

  // Dialogs
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [purgeTestConfirm, setPurgeTestConfirm] = useState(false);

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

  // Scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  // ─── Open conversation ─────────────────────────────────

  const openConversation = useCallback(async (req: FagRequest) => {
    setActiveRequestId(req.id);
    setChatLoading(true);
    setBulkMode(false);
    setSelectedIds(new Set());
    if (isMobile) setMobileShowChat(true);

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
      const { data: children } = await (supabase
        .from("fag_requests")
        .select("*") as any)
        .eq("parent_request_id", req.id)
        .is("deleted_at", null)
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
  }, [fetchAnswers, isMobile]);

  // ─── Handle image ──────────────────────────────────────

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) { toast.error("Kun JPG, PNG og WebP"); return; }
    if (file.size > MAX_IMAGE_SIZE) { toast.error("Maks 10 MB"); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }, []);

  const handleCameraCapture = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    // If from project, suggest starter text
    if (projectContext && !question.trim()) {
      setQuestion("Vurdering iht. NEK 439 for vedlagt komponent");
    }
  }, [projectContext, question]);

  const handleVoiceRecorded = useCallback(async (_blob: Blob, _duration: number) => {
    // For now, show a toast that voice-to-text is coming
    toast.info("Taleopptak mottatt – transkribering krever oppsett av tale-til-tekst-tjeneste");
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
      const insertPayload: any = { regime, question: text, priority: "normal" as FagPriority };
      const req = await createRequest(insertPayload);

      // Link follow-up
      if (activeRequestId) {
        await supabase
          .from("fag_requests")
          .update({ parent_request_id: activeRequestId } as any)
          .eq("id", req.id);
      }

      // Test mode flag
      if (testModeActive && isNewConversation) {
        await supabase
          .from("fag_requests")
          .update({ is_test: true } as any)
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
        if (isMobile) setMobileShowChat(true);
      } else {
        setChatMessages(prev => [...prev, userMsg]);
      }

      const history = chatMessages
        .filter(m => m.role === "user" || m.role === "assistant")
        .map(m => ({
          role: m.role,
          content: m.role === "assistant" ? (m.content.substring(0, 500) + "...") : m.content,
        }));

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
  }, [question, regime, imageFile, activeCompanyId, activeRequestId, chatMessages, createRequest, uploadImage, updateImagePaths, analyzeRequest, removeImage, fetchRequests, projectContext, testModeActive, isMobile]);

  // ─── Navigation ────────────────────────────────────────

  const startNewConversation = useCallback(() => {
    setActiveRequestId(null);
    setChatMessages([]);
    setQuestion("");
    removeImage();
    if (isMobile) setMobileShowChat(false);
    inputRef.current?.focus();
  }, [removeImage, isMobile]);

  const handleMobileBack = useCallback(() => {
    setMobileShowChat(false);
  }, []);

  const handleSuggestionClick = useCallback((text: string) => {
    setQuestion(text);
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // ─── Conversation actions ─────────────────────────────

  const handleArchive = useCallback(async (id: string) => {
    await archiveRequest(id);
    if (activeRequestId === id) { setActiveRequestId(null); setChatMessages([]); if (isMobile) setMobileShowChat(false); }
    toast.success("Samtale arkivert");
  }, [archiveRequest, activeRequestId, isMobile]);

  const handleUnarchive = useCallback(async (id: string) => {
    await unarchiveRequest(id);
    toast.success("Samtale gjenopprettet");
  }, [unarchiveRequest]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteRequest(id);
    if (activeRequestId === id) { setActiveRequestId(null); setChatMessages([]); if (isMobile) setMobileShowChat(false); }
    toast.success("Samtale slettet permanent");
    setDeleteConfirmId(null);
  }, [deleteRequest, activeRequestId, isMobile]);

  const handlePin = useCallback(async (id: string, pinned: boolean) => {
    await pinRequest(id, !pinned);
    toast.success(pinned ? "Samtale løsnet" : "Samtale festet");
  }, [pinRequest]);

  const handleToggleTest = useCallback(async (id: string, isTest: boolean) => {
    await toggleTestMode(id, !isTest);
    toast.success(!isTest ? "Merket som test" : "Fjernet testmerke");
  }, [toggleTestMode]);

  const handlePurgeTest = useCallback(async () => {
    await purgeTestConversations();
    setPurgeTestConfirm(false);
    toast.success("Alle testsamtaler slettet");
  }, [purgeTestConversations]);

  // ─── Bulk handlers ────────────────────────────────────

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleBulkArchive = useCallback(async () => {
    await bulkArchive(Array.from(selectedIds));
    setSelectedIds(new Set());
    setBulkMode(false);
    toast.success(`${selectedIds.size} samtaler arkivert`);
  }, [bulkArchive, selectedIds]);

  const handleBulkMarkTest = useCallback(async () => {
    await bulkMarkTest(Array.from(selectedIds));
    setSelectedIds(new Set());
    setBulkMode(false);
    toast.success(`${selectedIds.size} samtaler merket som test`);
  }, [bulkMarkTest, selectedIds]);

  const handleBulkDelete = useCallback(async () => {
    await bulkDelete(Array.from(selectedIds));
    setSelectedIds(new Set());
    setBulkMode(false);
    setBulkDeleteConfirm(false);
    if (activeRequestId && selectedIds.has(activeRequestId)) {
      setActiveRequestId(null);
      setChatMessages([]);
    }
    toast.success(`${selectedIds.size} samtaler slettet`);
  }, [bulkDelete, selectedIds, activeRequestId]);

  // ─── Mobile swipe ──────────────────────────────────────

  const handleTouchStart = useCallback((id: string, e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setSwipingId(id);
    setSwipeOffset(0);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swipingId) return;
    const diff = touchStartX.current - e.touches[0].clientX;
    setSwipeOffset(Math.max(0, Math.min(diff, 160)));
  }, [swipingId]);

  const handleTouchEnd = useCallback((id: string) => {
    if (swipeOffset > 80) {
      // Show swipe actions
      setSwipeOffset(120);
    } else {
      setSwipingId(null);
      setSwipeOffset(0);
    }
  }, [swipeOffset]);

  const resetSwipe = useCallback(() => {
    setSwipingId(null);
    setSwipeOffset(0);
  }, []);

  // ─── Filtered conversations ───────────────────────────

  const conversations = useMemo(() => {
    const roots = requests.filter(r => !(r as any).parent_request_id);
    let filtered: FagRequest[];
    switch (sidebarFilter) {
      case "archived":
        filtered = roots.filter(r => r.archived_at);
        break;
      case "test":
        filtered = roots.filter(r => r.is_test && !r.archived_at);
        break;
      default:
        filtered = roots.filter(r => !r.archived_at && !r.is_test);
        break;
    }
    // Sort: pinned first, then by date
    return filtered.sort((a, b) => {
      if (a.pinned_at && !b.pinned_at) return -1;
      if (!a.pinned_at && b.pinned_at) return 1;
      return new Date(b.last_activity_at || b.created_at).getTime() - new Date(a.last_activity_at || a.created_at).getTime();
    });
  }, [requests, sidebarFilter]);

  const lastFollowups = useMemo(() => {
    const last = chatMessages.filter(m => m.role === "assistant").slice(-1)[0];
    return last?.followups || [];
  }, [chatMessages]);

  const activeReq = useMemo(() => requests.find(r => r.id === activeRequestId), [requests, activeRequestId]);
  const isInChat = activeRequestId !== null || chatMessages.length > 0;

  const archivedCount = useMemo(() => requests.filter(r => !(r as any).parent_request_id && r.archived_at).length, [requests]);
  const testCount = useMemo(() => requests.filter(r => !(r as any).parent_request_id && r.is_test && !r.archived_at).length, [requests]);

  // ─── Render: Mobile full-screen chat ───────────────────

  if (isMobile && mobileShowChat) {
    return (
      <div className="flex flex-col h-[calc(100vh-3.5rem)]">
        {/* Mobile chat header */}
        <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2.5 shrink-0">
          <button onClick={handleMobileBack} className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-muted/50">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {activeReq ? activeReq.question.split("\n")[0].substring(0, 40) : "Ny samtale"}
            </p>
            {projectContext && (
              <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                <FolderKanban className="h-2.5 w-2.5" /> {projectContext.title}
              </p>
            )}
          </div>
          {activeReq && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <ConversationMenuItems
                  conv={activeReq}
                  onArchive={handleArchive}
                  onUnarchive={handleUnarchive}
                  onDelete={setDeleteConfirmId}
                  onToggleTest={handleToggleTest}
                  onPin={handlePin}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Test/archive banners */}
        {testModeActive && <TestModeBanner />}
        {activeReq?.archived_at && (
          <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-1.5">
            <Archive className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Arkivert samtale</span>
            <Button variant="ghost" size="sm" className="h-6 text-[10px] ml-auto" onClick={() => handleUnarchive(activeReq.id)}>
              Gjenopprett
            </Button>
          </div>
        )}

        {/* Chat body */}
        <ScrollArea className="flex-1">
          <div className="px-3 py-4">
            <ChatThread
              messages={chatMessages}
              loading={chatLoading}
              submitting={submitting}
              followups={lastFollowups}
              onSuggestionClick={handleSuggestionClick}
              chatEndRef={chatEndRef}
            />
          </div>
        </ScrollArea>

        {/* Mobile input bar */}
        <MobileInputBar
          question={question}
          setQuestion={setQuestion}
          imageFile={imageFile}
          imagePreview={imagePreview}
          submitting={submitting}
          regime={regime}
          onSend={handleSend}
          onKeyDown={handleKeyDown}
          onImageSelect={handleImageSelect}
          onCameraCapture={handleCameraCapture}
          onVoiceRecorded={handleVoiceRecorded}
          removeImage={removeImage}
          fileInputRef={fileInputRef}
          inputRef={inputRef}
        />

        <DeleteConfirmDialogs
          deleteConfirmId={deleteConfirmId}
          setDeleteConfirmId={setDeleteConfirmId}
          handleDelete={handleDelete}
          bulkDeleteConfirm={bulkDeleteConfirm}
          setBulkDeleteConfirm={setBulkDeleteConfirm}
          handleBulkDelete={handleBulkDelete}
          selectedCount={selectedIds.size}
          purgeTestConfirm={purgeTestConfirm}
          setPurgeTestConfirm={setPurgeTestConfirm}
          handlePurgeTest={handlePurgeTest}
          testCount={testCount}
        />
      </div>
    );
  }

  // ─── Render: Mobile list view ──────────────────────────

  if (isMobile && !mobileShowChat) {
    return (
      <div className="flex flex-col h-[calc(100vh-3.5rem)]">
        {/* Header */}
        <div className="px-4 pt-4 pb-2 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Fagstøtte
            </h1>
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-1.5 mr-2">
                <FlaskConical className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">Test</span>
                <Switch checked={testModeActive} onCheckedChange={setTestModeActive} className="scale-75" />
              </div>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 mb-2">
            {([
              { key: "active" as SidebarFilter, label: "Aktive" },
              { key: "archived" as SidebarFilter, label: `Arkiv${archivedCount ? ` (${archivedCount})` : ""}` },
              { key: "test" as SidebarFilter, label: `Test${testCount ? ` (${testCount})` : ""}` },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setSidebarFilter(tab.key)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  sidebarFilter === tab.key
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Purge test button */}
          {sidebarFilter === "test" && testCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs text-destructive border-destructive/30 hover:bg-destructive/5 mb-2"
              onClick={() => setPurgeTestConfirm(true)}
            >
              <Trash2 className="h-3 w-3 mr-1.5" /> Tøm alle testsamtaler ({testCount})
            </Button>
          )}
        </div>

        {/* Conversation list with swipe */}
        <ScrollArea className="flex-1 px-3">
          {loading && <div className="text-xs text-muted-foreground p-6 text-center">Laster…</div>}
          {conversations.length === 0 && !loading && (
            <div className="flex flex-col items-center py-12 space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                {sidebarFilter === "archived" ? "Ingen arkiverte samtaler" : sidebarFilter === "test" ? "Ingen testsamtaler" : "Start din første fagsamtale"}
              </p>
            </div>
          )}
          <div className="space-y-1 pb-24">
            {conversations.map(conv => {
              const isSwiping = swipingId === conv.id;
              return (
                <div key={conv.id} className="relative overflow-hidden rounded-xl">
                  {/* Swipe action buttons behind */}
                  {isSwiping && swipeOffset > 20 && (
                    <div className="absolute right-0 top-0 bottom-0 flex items-stretch">
                      <button
                        onClick={() => { handleArchive(conv.id); resetSwipe(); }}
                        className="w-[60px] flex flex-col items-center justify-center bg-accent/20 text-accent-foreground"
                      >
                        <Archive className="h-4 w-4 mb-0.5" />
                        <span className="text-[9px]">Arkiver</span>
                      </button>
                      <button
                        onClick={() => { setDeleteConfirmId(conv.id); resetSwipe(); }}
                        className="w-[60px] flex flex-col items-center justify-center bg-destructive/20 text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mb-0.5" />
                        <span className="text-[9px]">Slett</span>
                      </button>
                    </div>
                  )}

                  <button
                    onTouchStart={(e) => handleTouchStart(conv.id, e)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={() => handleTouchEnd(conv.id)}
                    onClick={() => !isSwiping && openConversation(conv)}
                    className="w-full text-left px-4 py-3 bg-card border border-border/40 rounded-xl transition-transform flex items-center gap-3"
                    style={{ transform: isSwiping ? `translateX(-${swipeOffset}px)` : undefined }}
                  >
                    <MessageCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {conv.pinned_at && <Pin className="h-2.5 w-2.5 text-primary shrink-0" />}
                        <p className="text-sm font-medium truncate">{conv.question.split("\n")[0].substring(0, 45)}</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {conv.ai_summary || conv.question.substring(0, 60)}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {format(new Date(conv.last_activity_at || conv.created_at), "d. MMM HH:mm", { locale: nb })}
                        </span>
                        <ConversationBadge conv={conv} />
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Floating new conversation button */}
        <div className="fixed bottom-20 right-4 z-50">
          <Button
            size="icon"
            className="h-14 w-14 rounded-2xl shadow-lg"
            onClick={startNewConversation}
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>

        {/* Quick input bar for mobile empty state */}
        {!isInChat && (
          <MobileInputBar
            question={question}
            setQuestion={setQuestion}
            imageFile={imageFile}
            imagePreview={imagePreview}
            submitting={submitting}
            regime={regime}
            onSend={handleSend}
            onKeyDown={handleKeyDown}
            onImageSelect={handleImageSelect}
            onCameraCapture={handleCameraCapture}
            onVoiceRecorded={handleVoiceRecorded}
            removeImage={removeImage}
            fileInputRef={fileInputRef}
            inputRef={inputRef}
          />
        )}

        <DeleteConfirmDialogs
          deleteConfirmId={deleteConfirmId}
          setDeleteConfirmId={setDeleteConfirmId}
          handleDelete={handleDelete}
          bulkDeleteConfirm={bulkDeleteConfirm}
          setBulkDeleteConfirm={setBulkDeleteConfirm}
          handleBulkDelete={handleBulkDelete}
          selectedCount={selectedIds.size}
          purgeTestConfirm={purgeTestConfirm}
          setPurgeTestConfirm={setPurgeTestConfirm}
          handlePurgeTest={handlePurgeTest}
          testCount={testCount}
        />
      </div>
    );
  }

  // ─── Render: Desktop layout ────────────────────────────

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* ─── Sidebar ─── */}
      <div className="hidden md:flex w-72 border-r border-border flex-col bg-muted/30">
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-primary" />
              Fagstøtte
            </h2>
            <div className="flex items-center gap-1">
              {bulkMode ? (
                <Button variant="ghost" size="sm" className="h-7 text-[10px] px-2" onClick={() => { setBulkMode(false); setSelectedIds(new Set()); }}>
                  Avbryt
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" className="h-7 text-[10px] px-2.5 gap-1" onClick={() => setBulkMode(true)}>
                    <CheckSquare className="h-3 w-3" /> Velg flere
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={startNewConversation}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1">
            {([
              { key: "active" as SidebarFilter, label: "Aktive" },
              { key: "archived" as SidebarFilter, label: `Arkiv${archivedCount ? ` (${archivedCount})` : ""}` },
              { key: "test" as SidebarFilter, label: `Test${testCount ? ` (${testCount})` : ""}` },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => { setSidebarFilter(tab.key); setBulkMode(false); setSelectedIds(new Set()); }}
                className={cn(
                  "px-2 py-1 rounded-md text-[10px] font-medium transition-colors",
                  sidebarFilter === tab.key
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Test mode toggle */}
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <FlaskConical className="h-3 w-3" /> Testmodus
            </span>
            <Switch
              checked={testModeActive}
              onCheckedChange={setTestModeActive}
              className="scale-75"
            />
          </div>

          {/* Purge test button */}
          {sidebarFilter === "test" && testCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-[10px] h-7 text-destructive border-destructive/30 hover:bg-destructive/5"
              onClick={() => setPurgeTestConfirm(true)}
            >
              <Trash2 className="h-3 w-3 mr-1" /> Tøm alle testsamtaler ({testCount})
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {loading && <div className="text-xs text-muted-foreground p-3 text-center">Laster…</div>}
            {conversations.length === 0 && !loading && (
              <p className="text-xs text-muted-foreground text-center py-6">
                {sidebarFilter === "archived" ? "Ingen arkiverte samtaler" : sidebarFilter === "test" ? "Ingen testsamtaler" : "Ingen samtaler ennå"}
              </p>
            )}
            {conversations.map(conv => {
              const isActive = activeRequestId === conv.id;
              const preview = conv.ai_summary || conv.question.substring(0, 60);
              const isSelected = selectedIds.has(conv.id);
              return (
                <div key={conv.id} className="group relative">
                  <button
                    onClick={() => bulkMode ? toggleSelect(conv.id) : openConversation(conv)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 rounded-lg transition-colors",
                      isActive
                        ? "bg-primary/10 border border-primary/20"
                        : isSelected
                          ? "bg-accent/10 border border-accent/30"
                          : "hover:bg-secondary/60 border border-transparent"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {bulkMode ? (
                        <div className="mt-0.5 shrink-0">
                          {isSelected ? <CheckSquare className="h-3.5 w-3.5 text-primary" /> : <Square className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                      ) : (
                        <MessageCircle className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          {conv.pinned_at && <Pin className="h-2.5 w-2.5 text-primary shrink-0" />}
                          <p className="text-xs font-medium truncate">{conv.question.split("\n")[0].substring(0, 50)}</p>
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">{preview}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {format(new Date(conv.last_activity_at || conv.created_at), "d. MMM", { locale: nb })}
                          </span>
                          <ConversationBadge conv={conv} />
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* ⋯ context menu – always available per item */}
                  {!bulkMode && (
                    <div className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <ConversationMenuItems
                            conv={conv}
                            onArchive={handleArchive}
                            onUnarchive={handleUnarchive}
                            onDelete={setDeleteConfirmId}
                            onToggleTest={handleToggleTest}
                            onPin={handlePin}
                          />
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Bulk action bar */}
        {bulkMode && selectedIds.size > 0 && (
          <div className="border-t border-border bg-card p-2 flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground font-medium px-1">{selectedIds.size} valgt</span>
            <div className="flex-1" />
            <Button variant="outline" size="sm" className="h-7 text-[10px] px-2 gap-1" onClick={handleBulkArchive}>
              <Archive className="h-3 w-3" /> Arkiver
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-[10px] px-2 gap-1" onClick={handleBulkMarkTest}>
              <FlaskConical className="h-3 w-3" /> Test
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-[10px] px-2 gap-1 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => setBulkDeleteConfirm(true)}>
              <Trash2 className="h-3 w-3" /> Slett
            </Button>
          </div>
        )}
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

        {testModeActive && <TestModeBanner />}

        {activeReq?.archived_at && (
          <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-1.5">
            <Archive className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Denne samtalen er arkivert</span>
            <Button variant="ghost" size="sm" className="h-6 text-[10px] ml-auto" onClick={() => handleUnarchive(activeReq.id)}>
              Gjenopprett
            </Button>
          </div>
        )}

        {/* Chat messages area */}
        <ScrollArea className="flex-1">
          <div className="max-w-3xl mx-auto px-4 py-6">
            {!isInChat && !loading ? (
              <WelcomeState
                onSuggestionClick={handleSuggestionClick}
                conversations={conversations}
                onOpenConversation={openConversation}
              />
            ) : (
              <ChatThread
                messages={chatMessages}
                loading={chatLoading}
                submitting={submitting}
                followups={lastFollowups}
                onSuggestionClick={handleSuggestionClick}
                chatEndRef={chatEndRef}
              />
            )}
          </div>
        </ScrollArea>

        {/* ─── Desktop Input bar ─── */}
        <div className="border-t border-border bg-card p-3">
          <div className="max-w-3xl mx-auto">
            {/* Regime selector */}
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
              <CameraCapture onCapture={handleCameraCapture} disabled={submitting} />
              <VoiceRecorder onRecorded={handleVoiceRecorded} disabled={submitting} />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center h-9 w-9 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted/50 cursor-pointer shrink-0 mb-0.5"
                title="Last opp bilde"
              >
                {imageFile ? <ImageIcon className="h-4 w-4 text-primary" /> : <ImageIcon className="h-4 w-4" />}
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

      <DeleteConfirmDialogs
        deleteConfirmId={deleteConfirmId}
        setDeleteConfirmId={setDeleteConfirmId}
        handleDelete={handleDelete}
        bulkDeleteConfirm={bulkDeleteConfirm}
        setBulkDeleteConfirm={setBulkDeleteConfirm}
        handleBulkDelete={handleBulkDelete}
        selectedCount={selectedIds.size}
        purgeTestConfirm={purgeTestConfirm}
        setPurgeTestConfirm={setPurgeTestConfirm}
        handlePurgeTest={handlePurgeTest}
        testCount={testCount}
      />
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────

function ConversationBadge({ conv }: { conv: FagRequest }) {
  return (
    <div className="flex items-center gap-1">
      <Badge variant="outline" className={cn("text-[9px] h-4 px-1", regimeChipClass(conv.regime))}>
        {conv.regime.toUpperCase()}
      </Badge>
      {conv.is_test && (
        <Badge variant="outline" className="text-[9px] h-4 px-1 bg-accent/10 text-accent-foreground border-accent/30">
          🧪 Test
        </Badge>
      )}
      {conv.archived_at && (
        <Badge variant="outline" className="text-[9px] h-4 px-1 bg-muted text-muted-foreground border-border">
          📦 Arkiv
        </Badge>
      )}
      {!conv.archived_at && !conv.is_test && (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" title="Aktiv" />
      )}
    </div>
  );
}

function ConversationMenuItems({
  conv,
  onArchive,
  onUnarchive,
  onDelete,
  onToggleTest,
  onPin,
}: {
  conv: FagRequest;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleTest: (id: string, isTest: boolean) => void;
  onPin: (id: string, pinned: boolean) => void;
}) {
  return (
    <>
      {conv.pinned_at ? (
        <DropdownMenuItem onClick={() => onPin(conv.id, true)} className="gap-2 text-xs">
          <PinOff className="h-3.5 w-3.5" /> Løsne
        </DropdownMenuItem>
      ) : (
        <DropdownMenuItem onClick={() => onPin(conv.id, false)} className="gap-2 text-xs">
          <Pin className="h-3.5 w-3.5" /> Fest til topp
        </DropdownMenuItem>
      )}
      {conv.archived_at ? (
        <DropdownMenuItem onClick={() => onUnarchive(conv.id)} className="gap-2 text-xs">
          <ArchiveRestore className="h-3.5 w-3.5" /> Gjenopprett
        </DropdownMenuItem>
      ) : (
        <DropdownMenuItem onClick={() => onArchive(conv.id)} className="gap-2 text-xs">
          <Archive className="h-3.5 w-3.5" /> Arkiver
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onClick={() => onToggleTest(conv.id, conv.is_test)} className="gap-2 text-xs">
        <FlaskConical className="h-3.5 w-3.5" /> {conv.is_test ? "Fjern testmerke" : "Merk som test"}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      {conv.linked_project_id ? (
        <DropdownMenuItem disabled className="gap-2 text-xs text-muted-foreground">
          <Trash2 className="h-3.5 w-3.5" /> Koblet til prosjekt
        </DropdownMenuItem>
      ) : (
        <DropdownMenuItem onClick={() => onDelete(conv.id)} className="gap-2 text-xs text-destructive focus:text-destructive">
          <Trash2 className="h-3.5 w-3.5" /> Slett permanent
        </DropdownMenuItem>
      )}
    </>
  );
}

function TestModeBanner() {
  return (
    <div className="flex items-center gap-2 border-b border-accent/30 bg-accent/5 px-4 py-1.5">
      <FlaskConical className="h-3.5 w-3.5 text-accent-foreground" />
      <span className="text-xs font-medium text-accent-foreground">Testmodus aktiv – samtaler merkes som test</span>
    </div>
  );
}

function WelcomeState({
  onSuggestionClick,
  conversations,
  onOpenConversation,
}: {
  onSuggestionClick: (text: string) => void;
  conversations: FagRequest[];
  onOpenConversation: (conv: FagRequest) => void;
}) {
  return (
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
            onClick={() => onSuggestionClick(eq)}
            className="text-left px-4 py-3 rounded-xl border border-border/60 bg-card hover:bg-secondary/40 hover:border-primary/20 transition-all text-sm text-foreground/80 hover:text-foreground group"
          >
            <span className="flex items-start gap-2">
              <ArrowRight className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span>{eq}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatThread({
  messages,
  loading,
  submitting,
  followups,
  onSuggestionClick,
  chatEndRef,
}: {
  messages: ChatMessage[];
  loading: boolean;
  submitting: boolean;
  followups: string[];
  onSuggestionClick: (text: string) => void;
  chatEndRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div className="space-y-4">
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}

      {messages.map(msg => (
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

      {submitting && (
        <div className="flex justify-start">
          <div className="flex items-center gap-2 rounded-2xl rounded-tl-md bg-muted/60 px-4 py-3">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Analyserer…</span>
          </div>
        </div>
      )}

      {followups.length > 0 && !submitting && (
        <div className="flex flex-wrap gap-2 pl-2">
          {followups.map((q, i) => (
            <button
              key={i}
              onClick={() => onSuggestionClick(q)}
              className="px-3 py-1.5 rounded-full text-xs bg-primary/5 text-primary border border-primary/20 hover:bg-primary/10 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <div ref={chatEndRef} />
    </div>
  );
}

function MobileInputBar({
  question,
  setQuestion,
  imageFile,
  imagePreview,
  submitting,
  regime,
  onSend,
  onKeyDown,
  onImageSelect,
  onCameraCapture,
  onVoiceRecorded,
  removeImage,
  fileInputRef,
  inputRef,
}: {
  question: string;
  setQuestion: (v: string) => void;
  imageFile: File | null;
  imagePreview: string | null;
  submitting: boolean;
  regime: FagRegime;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCameraCapture: (files: File[]) => void;
  onVoiceRecorded: (blob: Blob, duration: number) => void;
  removeImage: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  inputRef: React.RefObject<HTMLTextAreaElement>;
}) {
  return (
    <div className="border-t border-border bg-card px-3 py-2 pb-[env(safe-area-inset-bottom,8px)] shrink-0">
      {imagePreview && (
        <div className="mb-2 relative inline-block">
          <img src={imagePreview} alt="Vedlegg" className="h-16 w-auto rounded-lg border border-border object-cover" />
          <button
            onClick={removeImage}
            className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      <div className="flex items-end gap-1.5">
        <VoiceRecorder onRecorded={onVoiceRecorded} disabled={submitting} />
        <CameraCapture onCapture={onCameraCapture} disabled={submitting} />
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          onChange={onImageSelect}
          className="hidden"
        />
        <Textarea
          ref={inputRef}
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Still fagspørsmål…"
          className="min-h-[36px] max-h-[80px] resize-none flex-1 text-sm"
          rows={1}
        />
        <Button
          onClick={onSend}
          disabled={submitting || !question.trim()}
          size="icon"
          className="h-9 w-9 shrink-0"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function DeleteConfirmDialogs({
  deleteConfirmId,
  setDeleteConfirmId,
  handleDelete,
  bulkDeleteConfirm,
  setBulkDeleteConfirm,
  handleBulkDelete,
  selectedCount,
  purgeTestConfirm,
  setPurgeTestConfirm,
  handlePurgeTest,
  testCount,
}: {
  deleteConfirmId: string | null;
  setDeleteConfirmId: (id: string | null) => void;
  handleDelete: (id: string) => void;
  bulkDeleteConfirm: boolean;
  setBulkDeleteConfirm: (v: boolean) => void;
  handleBulkDelete: () => void;
  selectedCount: number;
  purgeTestConfirm: boolean;
  setPurgeTestConfirm: (v: boolean) => void;
  handlePurgeTest: () => void;
  testCount: number;
}) {
  return (
    <>
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slett samtale permanent?</AlertDialogTitle>
            <AlertDialogDescription>
              Denne handlingen kan ikke angres. Samtalen og alle meldinger vil bli fjernet permanent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Slett permanent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slett {selectedCount} samtaler permanent?</AlertDialogTitle>
            <AlertDialogDescription>
              Denne handlingen kan ikke angres. Alle valgte samtaler og tilhørende meldinger vil bli fjernet permanent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Slett {selectedCount} samtaler
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={purgeTestConfirm} onOpenChange={setPurgeTestConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tøm alle testsamtaler?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette sletter {testCount} testsamtale{testCount !== 1 ? "r" : ""} permanent. Handlingen kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePurgeTest}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Slett alle testsamtaler
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

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
    case "fsl": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    default: return "bg-muted text-muted-foreground border-border";
  }
}
