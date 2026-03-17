import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import {
  Send, MessageCircle, CalendarDays, CheckSquare, ArrowRightLeft,
  FileDown, Mail, Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface Comment {
  id: string;
  calculation_id: string;
  author_id: string | null;
  comment_type: string;
  content: string;
  metadata: any;
  created_at: string;
  author_name?: string;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  comment: <MessageCircle className="h-3.5 w-3.5 text-primary" />,
  system: <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />,
  meeting: <CalendarDays className="h-3.5 w-3.5 text-blue-500" />,
  task: <CheckSquare className="h-3.5 w-3.5 text-green-600" />,
  offer_generated: <FileDown className="h-3.5 w-3.5 text-primary" />,
  email: <Mail className="h-3.5 w-3.5 text-blue-600" />,
  status_change: <ArrowRightLeft className="h-3.5 w-3.5 text-amber-600" />,
};

const TYPE_LABELS: Record<string, string> = {
  comment: "Kommentar",
  system: "System",
  meeting: "Møte",
  task: "Oppgave",
  offer_generated: "Tilbud generert",
  email: "E-post",
  status_change: "Statusendring",
};

interface OfferCommentFeedProps {
  calculationId: string;
  companyId: string | null;
}

export function OfferCommentFeed({ calculationId, companyId }: OfferCommentFeedProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchComments = useCallback(async () => {
    const { data } = await supabase
      .from("offer_comments" as any)
      .select("*")
      .eq("calculation_id", calculationId)
      .order("created_at", { ascending: true });

    if (data) {
      // Fetch author names
      const authorIds = [...new Set((data as any[]).filter(c => c.author_id).map(c => c.author_id))];
      let authorMap: Record<string, string> = {};
      if (authorIds.length > 0) {
        const { data: people } = await supabase
          .from("user_accounts")
          .select("auth_user_id, person:people(full_name)")
          .in("auth_user_id", authorIds);
        if (people) {
          for (const p of people as any[]) {
            authorMap[p.auth_user_id] = p.person?.full_name || "Ukjent";
          }
        }
      }
      setComments((data as any[]).map(c => ({
        ...c,
        author_name: c.author_id ? (authorMap[c.author_id] || "Ukjent") : "System",
      })));
    }
    setLoading(false);
  }, [calculationId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`offer-comments-${calculationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "offer_comments", filter: `calculation_id=eq.${calculationId}` },
        () => fetchComments()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [calculationId, fetchComments]);

  // Auto-scroll on new comments
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  const handleSend = async () => {
    if (!newComment.trim() || !user) return;
    setSending(true);
    try {
      const { error } = await supabase.from("offer_comments" as any).insert({
        calculation_id: calculationId,
        company_id: companyId,
        author_id: user.id,
        comment_type: "comment",
        content: newComment.trim(),
      } as any);
      if (error) throw error;
      setNewComment("");
      // Also update last_activity_at
      await supabase.from("calculations").update({
        last_activity_at: new Date().toISOString(),
      } as any).eq("id", calculationId);
    } catch (err: any) {
      toast.error("Kunne ikke sende kommentar");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-12 w-1/2 ml-auto" />
        <Skeleton className="h-12 w-2/3" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/40 bg-card overflow-hidden flex flex-col">
      {/* Comment feed */}
      <div className="flex-1 max-h-[400px] overflow-y-auto p-4 space-y-3">
        {comments.length === 0 ? (
          <div className="text-center py-8">
            <MessageCircle className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Ingen aktivitet ennå</p>
            <p className="text-xs text-muted-foreground/60">Skriv en kommentar for å starte dialogen</p>
          </div>
        ) : (
          comments.map((c) => {
            const isOwn = c.author_id === user?.id;
            const isSystem = c.comment_type !== "comment";

            if (isSystem) {
              return (
                <div key={c.id} className="flex items-center gap-2 py-1">
                  <div className="h-px flex-1 bg-border/40" />
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 shrink-0">
                    {TYPE_ICONS[c.comment_type] || TYPE_ICONS.system}
                    <span>{c.content}</span>
                  </div>
                  <div className="h-px flex-1 bg-border/40" />
                </div>
              );
            }

            return (
              <div key={c.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                  isOwn
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted rounded-bl-md"
                }`}>
                  {!isOwn && (
                    <p className={`text-[11px] font-medium mb-0.5 ${isOwn ? "text-primary-foreground/70" : "text-foreground/70"}`}>
                      {c.author_name}
                    </p>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                  <p className={`text-[10px] mt-1 ${isOwn ? "text-primary-foreground/50" : "text-muted-foreground/50"}`}>
                    {format(new Date(c.created_at), "d. MMM HH:mm", { locale: nb })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border/40 p-3 flex items-end gap-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Skriv en kommentar..."
          rows={1}
          className="min-h-[40px] max-h-[120px] resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!newComment.trim() || sending}
          className="rounded-lg shrink-0 h-10 w-10"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

/** Helper to log a system comment (status change, meeting, etc.) */
export async function logOfferComment(
  calculationId: string,
  companyId: string | null,
  authorId: string | null,
  type: string,
  content: string,
  metadata?: any,
) {
  await supabase.from("offer_comments" as any).insert({
    calculation_id: calculationId,
    company_id: companyId,
    author_id: authorId,
    comment_type: type,
    content,
    metadata,
  } as any);
  // Update last_activity_at
  await supabase.from("calculations").update({
    last_activity_at: new Date().toISOString(),
  } as any).eq("id", calculationId);
}
