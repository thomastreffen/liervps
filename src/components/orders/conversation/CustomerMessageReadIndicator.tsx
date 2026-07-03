import { Check, CheckCheck } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Props {
  /** Has anyone internal read it yet? */
  readByInternal: boolean;
  readAt?: string | null;
  className?: string;
}

/**
 * Compact "Sendt" / "Lest av Lier VPS" status for customer's own messages on the tracking page.
 * Does NOT expose internal participant names.
 */
export function CustomerMessageReadIndicator({ readByInternal, readAt, className }: Props) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px]", className)}>
      {readByInternal ? (
        <>
          <CheckCheck className="h-3 w-3" />
          <span>
            Lest av Lier VPS
            {readAt ? ` · ${format(new Date(readAt), "d. MMM HH:mm", { locale: nb })}` : ""}
          </span>
        </>
      ) : (
        <>
          <Check className="h-3 w-3" />
          <span>Sendt</span>
        </>
      )}
    </span>
  );
}
