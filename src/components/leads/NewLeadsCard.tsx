import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";
import { Inbox, ArrowRight, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNewLeads, isWebsiteLead } from "@/hooks/useNewLeads";
import { cn } from "@/lib/utils";

export function NewLeadsCard({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { newCount, websiteToday, latest, loading } = useNewLeads();

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4",
        newCount > 0 ? "border-primary/25 bg-primary/[0.03]" : "border-border/40 bg-card",
        className,
      )}
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className={cn(
          "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
          newCount > 0 ? "bg-primary/10 text-primary" : "bg-secondary/40 text-muted-foreground/60",
        )}>
          <Inbox className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium">
            Nye henvendelser
          </p>
          <div className="flex items-baseline gap-2">
            <span className={cn(
              "text-[26px] font-extrabold leading-none tracking-tight",
              newCount === 0 ? "text-muted-foreground/25" : "text-foreground",
            )}>
              {loading ? "–" : newCount}
            </span>
            <span className="text-[12px] text-muted-foreground inline-flex items-center gap-1">
              <Globe className="h-3 w-3" /> {websiteToday} fra nettsiden i dag
            </span>
          </div>
          {latest && (
            <p className="text-[12px] text-muted-foreground/80 mt-1 truncate">
              Siste: <span className="text-foreground font-medium">{latest.company_name}</span>
              {" · "}
              {isWebsiteLead(latest.source) ? "Nettside" : latest.source || "Ukjent kilde"}
              {" · "}
              {formatDistanceToNow(new Date(latest.created_at), { addSuffix: true, locale: nb })}
            </p>
          )}
        </div>
      </div>
      <Button
        size="sm"
        variant={newCount > 0 ? "default" : "outline"}
        className="gap-1.5 rounded-xl shrink-0"
        onClick={() => navigate(newCount > 0 ? "/sales/leads?filter=new_website" : "/sales/leads")}
      >
        Åpne henvendelser <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
