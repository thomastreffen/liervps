import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Target, BarChart3, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Oversikt", url: "/sales", icon: BarChart3, exact: true },
  { label: "Leads", url: "/sales/leads", icon: Target },
  { label: "Tilbud", url: "/sales/offers", icon: FileText },
  { label: "Kalkyler", url: "/sales/calc-engine", icon: Calculator },
];

export function SalesHeader() {
  const nav = useNavigate();
  const location = useLocation();

  const isActive = (url: string, exact?: boolean) =>
    exact ? location.pathname === url : location.pathname.startsWith(url);

  return (
    <div className="flex flex-col gap-4 px-4 sm:px-6 pt-2 pb-1">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Salg</h1>
          <p className="text-sm text-muted-foreground/70 mt-0.5">
            Oversikt, prioriteringer og innganger til handling
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => nav("/sales/offers/new")}
          className="gap-1.5 text-xs self-start sm:self-auto bg-primary hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" /> Nytt tilbud
        </Button>
      </div>

      {/* Segmented tab navigation */}
      <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-xl w-fit">
        {tabs.map((tab) => {
          const active = isActive(tab.url, tab.exact);
          const Icon = tab.icon;
          return (
            <button
              key={tab.url}
              onClick={() => nav(tab.url)}
              className={cn(
                "inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-all duration-150 cursor-pointer",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
