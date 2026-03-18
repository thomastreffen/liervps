import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, Send, X, Loader2, FileText } from "lucide-react";

interface Props {
  onSend: (body: string, files?: File[]) => Promise<void>;
  sending: boolean;
  canUpload: boolean;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function TaskThreadComposer({ onSend, sending, canUpload }: Props) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const canSend = (body.trim().length > 0 || files.length > 0) && !sending;

  const handleSend = async () => {
    if (!canSend) return;
    await onSend(body, files.length > 0 ? files : undefined);
    setBody("");
    setFiles([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []).filter((f) => {
      if (f.size > MAX_FILE_SIZE) return false;
      return true;
    });
    setFiles((prev) => [...prev, ...newFiles]);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="border-t border-border bg-card p-3 space-y-2">
      {/* File preview */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <div
              key={`${f.name}-${i}`}
              className="flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/50 px-2 py-1 text-xs"
            >
              <FileText className="h-3 w-3 text-muted-foreground" />
              <span className="truncate max-w-[120px]">{f.name}</span>
              <button
                type="button"
                onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Skriv en melding…"
          className="min-h-[40px] max-h-[120px] resize-none text-sm flex-1"
          rows={1}
          disabled={sending}
        />

        <div className="flex items-center gap-1 shrink-0">
          {canUpload && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => inputRef.current?.click()}
                disabled={sending}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <input
                ref={inputRef}
                type="file"
                multiple
                onChange={handleAddFiles}
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp"
              />
            </>
          )}
          <Button
            type="button"
            size="icon"
            className="h-9 w-9"
            onClick={handleSend}
            disabled={!canSend}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Future: toggle between internal / email mode */}
      {/* <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Intern melding</span>
      </div> */}
    </div>
  );
}
