import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ThreadDetail } from "@/components/conversations/ThreadDetail";
import { ThreadParticipants } from "@/components/conversations/ThreadParticipants";
import { ThreadAdminActions } from "@/components/conversations/ThreadAdminActions";
import {
  ArrowLeft, Loader2, MessageSquare, Mail, Lock, Globe,
  AlertTriangle, Repeat, Gavel, XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function ConversationDetailPage() {
  const { id: projectId, threadId } = useParams<{ id: string; threadId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [thread, setThread] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!threadId) return;
    (async () => {
      const { data } = await supabase
        .from("conversation_threads")
        .select("*")
        .eq("id", threadId)
        .single();
      setThread(data);
      setLoading(false);
    })();
  }, [threadId]);

  useEffect(() => {
    if (!user || !projectId) return;
    (async () => {
      const { data } = await supabase.rpc("is_project_admin", {
        _auth_user_id: user.id,
        _project_id: projectId,
      });
      setIsAdmin(!!data);
    })();
  }, [user, projectId]);

  const toggleParticipantsOnly = async () => {
    if (!thread) return;
    const newValue = !thread.participants_only;
    const { error } = await (supabase as any)
      .from("conversation_threads")
      .update({ participants_only: newValue })
      .eq("id", thread.id);
    if (error) {
      toast.error("Kunne ikke endre tilgang");
    } else {
      setThread({ ...thread, participants_only: newValue });
      toast.success(newValue ? "Begrenset til deltakere" : "Åpen for alle med romtilgang");
    }
  };

  const handleThreadUpdate = (patch: Record<string, any>) => {
    setThread((prev: any) => prev ? { ...prev, ...patch } : prev);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F6F7F9]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F6F7F9]">
        <p className="text-muted-foreground">Samtale ikke funnet</p>
      </div>
    );
  }

  const isEmail = thread.thread_type === "email_thread";
  const isClosed = thread.status === "closed";
  const category = thread.thread_category || "normal";

  return (
    <div className="min-h-screen bg-[#F6F7F9]">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-border/40 bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-4">
          <button
            onClick={() => navigate(`/projects/${projectId}`)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft className="h-4 w-4" />
            Samtaler
          </button>
          <div className="flex items-start gap-3">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl shrink-0",
              category === "risk"
                ? "bg-destructive/10 text-destructive"
                : category === "change"
                ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                : isEmail
                ? "bg-accent/10 text-accent"
                : "bg-primary/10 text-primary"
            )}>
              {category === "risk" ? (
                <AlertTriangle className="h-5 w-5" />
              ) : category === "change" ? (
                <Repeat className="h-5 w-5" />
              ) : isEmail ? (
                <Mail className="h-5 w-5" />
              ) : (
                <MessageSquare className="h-5 w-5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-foreground truncate">{thread.title}</h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap mt-0.5">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[9px] px-1.5 py-0",
                    isEmail ? "border-accent/30 text-accent" : "border-primary/30 text-primary"
                  )}
                >
                  {isEmail ? "E-posttråd" : "Samtale"}
                </Badge>
                <span>{thread.post_count} innlegg</span>

                {category === "risk" && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-destructive/30 text-destructive gap-0.5">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    Risiko
                  </Badge>
                )}
                {category === "change" && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-orange-400/30 text-orange-600 dark:text-orange-400 gap-0.5">
                    <Repeat className="h-2.5 w-2.5" />
                    Endring
                  </Badge>
                )}
                {thread.is_formal_decision && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-primary/30 text-primary gap-0.5">
                    <Gavel className="h-2.5 w-2.5" />
                    Beslutning
                  </Badge>
                )}
                {isClosed && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-muted-foreground/30 text-muted-foreground gap-0.5">
                    <XCircle className="h-2.5 w-2.5" />
                    Lukket
                  </Badge>
                )}
                {thread.participants_only && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-warning/30 text-warning gap-0.5">
                    <Lock className="h-2.5 w-2.5" />
                    Kun deltakere
                  </Badge>
                )}
              </div>

              {/* Decision summary */}
              {thread.is_formal_decision && thread.decision_summary && (
                <div className="mt-2 p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                  <p className="text-xs font-medium text-primary flex items-center gap-1.5">
                    <Gavel className="h-3 w-3" />
                    Beslutning
                  </p>
                  <p className="text-xs text-foreground/80 mt-1">{thread.decision_summary}</p>
                </div>
              )}
            </div>

            {/* Admin actions */}
            <ThreadAdminActions
              thread={thread}
              isAdmin={isAdmin}
              onUpdate={handleThreadUpdate}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 space-y-4">
        {/* Participants + access toggle */}
        <div className="rounded-[14px] border border-border/30 bg-card p-4 space-y-3 shadow-sm">
          <ThreadParticipants
            threadId={thread.id}
            companyId={thread.company_id}
            projectId={projectId!}
            isAdmin={isAdmin}
          />

          {isAdmin && (
            <div className="flex items-center justify-between pt-2 border-t border-border/20">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {thread.participants_only ? (
                  <>
                    <Lock className="h-3 w-3" />
                    <span>Kun deltakere kan se tråden</span>
                  </>
                ) : (
                  <>
                    <Globe className="h-3 w-3" />
                    <span>Åpen for alle med romtilgang</span>
                  </>
                )}
              </div>
              <Switch
                checked={thread.participants_only}
                onCheckedChange={toggleParticipantsOnly}
              />
            </div>
          )}
        </div>

        {/* Thread posts */}
        <div className="rounded-[14px] border border-border/30 bg-card shadow-sm overflow-hidden">
          <ThreadDetail
            threadId={thread.id}
            threadTitle={thread.title}
            threadType={thread.thread_type}
            projectId={projectId!}
            companyId={thread.company_id}
            isClosed={isClosed}
          />
        </div>
      </div>
    </div>
  );
}
