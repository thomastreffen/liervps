import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ThreadDetail } from "@/components/conversations/ThreadDetail";
import { ThreadParticipants } from "@/components/conversations/ThreadParticipants";
import { ArrowLeft, Loader2, MessageSquare, Mail, Lock, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

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

  // Check if current user is admin
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Samtale ikke funnet</p>
      </div>
    );
  }

  const isEmail = thread.thread_type === "email_thread";

  return (
    <div className="min-h-screen bg-background">
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
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${isEmail ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"}`}>
              {isEmail ? <Mail className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-foreground truncate">{thread.title}</h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge
                  variant="outline"
                  className={`text-[9px] px-1.5 py-0 ${isEmail ? "border-accent/30 text-accent" : "border-primary/30 text-primary"}`}
                >
                  {isEmail ? "E-posttråd" : "Samtale"}
                </Badge>
                <span>{thread.post_count} innlegg</span>
                {thread.participants_only && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-warning/30 text-warning gap-0.5">
                    <Lock className="h-2.5 w-2.5" />
                    Kun deltakere
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 space-y-6">
        {/* Participants + access toggle */}
        <div className="rounded-xl border border-border/30 bg-card/50 p-4 space-y-3">
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
        <ThreadDetail
          threadId={thread.id}
          threadTitle={thread.title}
          threadType={thread.thread_type}
          projectId={projectId!}
          companyId={thread.company_id}
        />
      </div>
    </div>
  );
}
