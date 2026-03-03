import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ThreadDetail } from "@/components/conversations/ThreadDetail";
import { ArrowLeft, Loader2, MessageSquare, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ConversationDetailPage() {
  const { id: projectId, threadId } = useParams<{ id: string; threadId: string }>();
  const navigate = useNavigate();

  const [thread, setThread] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
            onClick={() => {
              navigate(`/projects/${projectId}`);
              // Set active room to samtaler via state if needed
            }}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft className="h-4 w-4" />
            Samtaler
          </button>
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${isEmail ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"}`}>
              {isEmail ? <Mail className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-foreground truncate">{thread.title}</h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge
                  variant="outline"
                  className={`text-[9px] px-1.5 py-0 ${isEmail ? "border-accent/30 text-accent" : "border-primary/30 text-primary"}`}
                >
                  {isEmail ? "E-posttråd" : "Samtale"}
                </Badge>
                <span>{thread.post_count} innlegg</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Thread content */}
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6">
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
