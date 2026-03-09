import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Users } from "lucide-react";

export function SalesHeader() {
  const nav = useNavigate();

  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 px-4 sm:px-6 pt-2 pb-1">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Salg</h1>
        <p className="text-sm text-muted-foreground/70 mt-0.5">
          Oversikt, prioriteringer og innganger til handling
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" variant="outline" onClick={() => nav("/sales/leads")} className="gap-1.5 text-xs">
          <Users className="h-3.5 w-3.5" /> Se alle leads
        </Button>
        <Button size="sm" variant="outline" onClick={() => nav("/sales/offers")} className="gap-1.5 text-xs">
          <FileText className="h-3.5 w-3.5" /> Nytt tilbud
        </Button>
        <Button size="sm" onClick={() => nav("/sales/leads/new")} className="gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> Ny lead
        </Button>
      </div>
    </div>
  );
}
