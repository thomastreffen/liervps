import { useState } from "react";
import { type ConversationPost } from "@/hooks/useConversations";
import { type SuggestedMessageAction } from "@/hooks/useAIMessageActions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, FileText } from "lucide-react";

interface Props {
  post: ConversationPost;
  suggestion?: SuggestedMessageAction;
  projectId: string;
  threadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function CreateFDVNoteFromMessageDialog({ post, suggestion, projectId, threadId, open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const { activeCompanyId } = useCompanyContext();
  const body = (post as any).body_clean || post.body_text || "";

  const [title, setTitle] = useState(suggestion?.title || "FDV-notat");
  const [description, setDescription] = useState(suggestion?.description || body);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!user || !activeCompanyId) return;
    setSaving(true);

    const { data: ua } = await supabase
      .from("user_accounts")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    const { error } = await (supabase as any).from("tasks").insert({
      company_id: activeCompanyId,
      title: `📋 FDV: ${title}`,
      description: `FDV-NOTAT: ${description}\n\n---\nFra samtale: ${threadId}`,
      status: "open",
      priority: "low",
      task_type: "fdv",
      created_by: ua?.id || user.id,
      linked_project_id: projectId,
    });

    if (error) {
      toast.error("Kunne ikke opprette FDV-notat");
    } else {
      await (supabase as any).from("conversation_posts").insert({
        thread_id: threadId,
        company_id: activeCompanyId,
        author_id: ua?.id || null,
        post_type: "system",
        body_text: `📋 FDV-notat opprettet: "${title}"`,
      });
      toast.success("FDV-notat opprettet");
      onOpenChange(false);
      onCreated?.();
    }
    setSaving(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-blue-500" />
            Opprett FDV-notat fra melding
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label className="text-xs">Tittel</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Innhold</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={5} className="mt-1 text-sm" />
          </div>
          <Button onClick={handleCreate} disabled={saving || !title.trim()} className="w-full">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <FileText className="h-3.5 w-3.5 mr-1" />}
            Opprett FDV-notat
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
