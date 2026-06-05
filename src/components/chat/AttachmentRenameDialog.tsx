import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { stripExtension } from "./chat-attachments-util";

export interface RenameTarget {
  id: string;
  file_name: string;
  display_name?: string | null;
  description?: string | null;
  original_filename?: string | null;
}

interface AttachmentRenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attachment: RenameTarget | null;
  onSubmit: (values: { displayName: string; description: string }) => Promise<void> | void;
  saving?: boolean;
}

export function AttachmentRenameDialog({
  open,
  onOpenChange,
  attachment,
  onSubmit,
  saving,
}: AttachmentRenameDialogProps) {
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!attachment) return;
    setDisplayName(attachment.display_name || stripExtension(attachment.file_name) || "");
    setDescription(attachment.description || "");
  }, [attachment]);

  const originalName = attachment?.original_filename || attachment?.file_name || "";

  const handleSave = async () => {
    if (!attachment) return;
    await onSubmit({ displayName, description });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Endre visningsnavn</DialogTitle>
          <DialogDescription>
            Gi vedlegget et beskrivende navn, f.eks. "Tavlerom høyre vegg".
            Det fysiske filnavnet endres ikke.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="att-display-name">Visningsnavn</Label>
            <Input
              id="att-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="F.eks. Tavlerom høyre vegg"
              autoFocus
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="att-description">Beskrivelse (valgfri)</Label>
            <Textarea
              id="att-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kort kontekst om bildet/filen"
              rows={2}
              maxLength={500}
            />
          </div>
          {originalName && (
            <p className="text-[11px] text-muted-foreground">
              Originalfil: <span className="font-mono">{originalName}</span>
            </p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Avbryt
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Lagre
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
