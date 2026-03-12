import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Inbox } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

interface CaseRow {
  id: string;
  case_number: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  open: "Åpen",
  in_progress: "Under behandling",
  waiting: "Venter",
  resolved: "Løst",
  closed: "Lukket",
};

const PRIORITY_VARIANTS: Record<string, "default" | "destructive" | "warning" | "secondary"> = {
  critical: "destructive",
  high: "warning",
  normal: "default",
  low: "secondary",
};

export function CustomerCasesSection({ customerId }: { customerId: string }) {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCases = useCallback(async () => {
    const { data } = await supabase
      .from("cases")
      .select("id, case_number, title, status, priority, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) setCases(data as any);
    setLoading(false);
  }, [customerId]);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  if (loading) return null;

  if (cases.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-center space-y-2">
        <Inbox className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Ingen saker knyttet til denne kunden.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {cases.map(c => (
        <Card key={c.id} className="rounded-2xl">
          <CardContent className="flex items-center justify-between py-3 px-4">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{c.title}</p>
              <p className="text-xs text-muted-foreground">
                <span className="font-mono mr-2">{c.case_number}</span>
                {format(new Date(c.created_at), "d. MMM yyyy", { locale: nb })}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={PRIORITY_VARIANTS[c.priority] || "default"} className="text-[10px] rounded-lg">
                {c.priority}
              </Badge>
              <Badge variant="outline" className="text-[10px] rounded-lg">
                {STATUS_LABELS[c.status] || c.status}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
