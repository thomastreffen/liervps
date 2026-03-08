import { useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  description: string;
  className?: string;
}

export function ContextualHelpButton({ title, description, className }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("relative inline-block", className)}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1 rounded-full hover:bg-muted/60 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        title="Hjelp"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-full right-0 mt-1 w-64 rounded-xl border border-border/60 bg-card shadow-lg p-3 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">{title}</p>
              <button onClick={() => setOpen(false)} className="p-0.5 rounded hover:bg-muted">
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{description}</p>
          </div>
        </>
      )}
    </div>
  );
}
