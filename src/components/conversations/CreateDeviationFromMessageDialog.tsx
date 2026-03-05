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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";

interface Props {
  post: ConversationPost;
  suggestion?: SuggestedMessageAction;
  projectId: string;
  threadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function CreateDeviationFromMessageDialog({ post, suggestion, projectId, threadId, open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const { activeCompanyId } = useCompanyContext();
  const body = (post as any).body_clean || post.body_text || "";

  const [title, setTitle] = useState(suggestion?.title || body.split(/[.\n!?]/)[0]?.trim().substring(0, 100) || "Nytt avvik");
  const [description, setDescription] = useState(suggestion?.description || body);
  const [priority, setPriority] = useState<string>(suggestion?.priority || "medium");
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
      title: `⚠️ ${title}`,
      description: `AVVIK: ${description}\n\n---\nFra samtale: ${threadId}`,
      status: "open",
      priority,
      task_type: "deviation",
      created_by: ua?.id || user.id,
      linked_project_id: projectId,
    });

    if (error) {
      toast.error("Kunne ikke registrere avvik");
    } else {
      await (supabase as any).from("conversation_posts").insert({
        thread_id: threadId,
        company_id: activeCompanyId,
        author_id: ua?.id || null,
        post_type: "system",
        body_text: `⚠️ Avvik registrert: "${title}"`,
      });
      toast.success("Avvik registrert");
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
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Registrer avvik fra melding
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label className="text-xs">Tittel</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Beskrivelse</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} className="mt-1 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Prioritet</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Lav</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">Høy</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleCreate} disabled={saving || !title.trim()} className="w-full">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <AlertTriangle className="h-3.5 w-3.5 mr-1" />}
            Registrer avvik
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
