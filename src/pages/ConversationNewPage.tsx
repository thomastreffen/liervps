import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { ArrowLeft, Send, Loader2, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function ConversationNewPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeCompanyId } = useCompanyContext();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim() || !user || !projectId) return;
    setSending(true);

    // Get user_account_id and company_id
    const { data: ua } = await supabase
      .from("user_accounts")
      .select("id, company_id")
      .eq("auth_user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    const companyId = ua?.company_id || activeCompanyId;
    if (!companyId) {
      toast.error("Mangler selskaps-tilknytning");
      setSending(false);
      return;
    }

    // Create thread
    const { data: thread, error: threadErr } = await (supabase as any)
      .from("conversation_threads")
      .insert({
        company_id: companyId,
        project_id: projectId,
        title: title.trim(),
        thread_type: "conversation",
        created_by: ua?.id || null,
      })
      .select("id")
      .single();

    if (threadErr || !thread) {
      toast.error("Kunne ikke opprette samtale", { description: threadErr?.message });
      setSending(false);
      return;
    }

    // Create first post
    const { error: postErr } = await (supabase as any)
      .from("conversation_posts")
      .insert({
        thread_id: thread.id,
        company_id: companyId,
        author_id: ua?.id || null,
        post_type: "internal_message",
        subject: title.trim(),
        body_text: body.trim(),
        body_html: `<p>${body.trim().replace(/\n/g, "<br/>")}</p>`,
      });

    if (postErr) {
      toast.error("Samtale opprettet, men innlegg feilet");
    } else {
      toast.success("Samtale startet");
    }

    setSending(false);
    navigate(`/projects/${projectId}/conversations/${thread.id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-border/40 bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(`/projects/${projectId}`)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbake
          </button>
          <h1 className="text-lg font-bold text-foreground">Ny samtale</h1>
        </div>
      </div>

      {/* Form */}
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Tittel</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Hva handler dette om?"
            className="text-base h-12"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Melding</label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Skriv din melding her…"
            className="min-h-[200px] text-sm"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Paperclip className="h-4 w-4" />
            Legg ved fil
          </button>

          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || !body.trim() || sending}
            className="gap-2 rounded-xl h-10 px-6"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Publiser samtale
          </Button>
        </div>
      </div>
    </div>
  );
}
