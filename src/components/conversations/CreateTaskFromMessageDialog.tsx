import { useState } from "react";
import { type ConversationPost } from "@/hooks/useConversations";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { format, addDays } from "date-fns";

interface Props {
  post: ConversationPost;
  projectId: string;
  threadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function CreateTaskFromMessageDialog({ post, projectId, threadId, open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const { activeCompanyId } = useCompanyContext();
  const body = (post as any).body_clean || post.body_text || "";
  const firstSentence = body.split(/[.\n!?]/)[0]?.trim() || "Ny oppgave";

  const [title, setTitle] = useState(firstSentence.substring(0, 100));
  const [description, setDescription] = useState(body);
  const [dueOption, setDueOption] = useState("today");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!user || !activeCompanyId) return;
    setSaving(true);

    const dueAt = dueOption === "today"
      ? format(new Date(), "yyyy-MM-dd'T'23:59:59")
      : dueOption === "tomorrow"
        ? format(addDays(new Date(), 1), "yyyy-MM-dd'T'23:59:59")
        : null;

    // Get user_account_id
    const { data: ua } = await supabase
      .from("user_accounts")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    const { error } = await (supabase as any).from("tasks").insert({
      company_id: activeCompanyId,
      title,
      description: `${description}\n\n---\nFra samtale: ${threadId}`,
      status: "open",
      priority: "medium",
      due_at: dueAt,
      created_by: ua?.id || user.id,
      linked_project_id: projectId,
    });

    if (error) {
      toast.error("Kunne ikke opprette oppgave");
    } else {
      // Post system message in thread
      await (supabase as any).from("conversation_posts").insert({
        thread_id: threadId,
        company_id: activeCompanyId,
        author_id: ua?.id || null,
        post_type: "system",
        body_text: `✅ Oppgave opprettet: "${title}"`,
      });

      toast.success("Oppgave opprettet");
      onOpenChange(false);
      onCreated?.();
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Opprett oppgave fra melding</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs">Tittel</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Beskrivelse</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="mt-1 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Frist</Label>
            <Select value={dueOption} onValueChange={setDueOption}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">I dag</SelectItem>
                <SelectItem value="tomorrow">I morgen</SelectItem>
                <SelectItem value="none">Ingen frist</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">Avbryt</Button>
          <Button onClick={handleCreate} disabled={saving || !title.trim()} size="sm">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
            Opprett
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
