import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, FileText, TrendingUp, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

interface ActivityItem {
  id: string;
  type: "offer" | "lead" | "case";
  title: string;
  status: string;
  date: string;
}

interface Props {
  customerId: string;
}

export function CustomerActivityList({ customerId }: Props) {
  const [items, setItems] = useState<ActivityItem[]>([]);

  const fetchActivity = useCallback(async () => {
    // Fetch offers linked to customer
    const { data: offers } = await supabase
      .from("calculations")
      .select("id, project_title, status, created_at")
      .eq("customer_name", customerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(10);

    // Fetch leads linked to customer
    const { data: leads } = await supabase
      .from("leads")
      .select("id, title, status, created_at")
      .eq("customer_id", customerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(10);

    // Fetch cases
    const { data: cases } = await supabase
      .from("cases")
      .select("id, title, status, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(10);

    const all: ActivityItem[] = [
      ...(offers || []).map((o: any) => ({ id: o.id, type: "offer" as const, title: o.project_title, status: o.status, date: o.created_at })),
      ...(leads || []).map((l: any) => ({ id: l.id, type: "lead" as const, title: l.title, status: l.status, date: l.created_at })),
      ...(cases || []).map((c: any) => ({ id: c.id, type: "case" as const, title: c.title, status: c.status, date: c.created_at })),
    ];

    all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setItems(all.slice(0, 15));
  }, [customerId]);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  const iconMap = { offer: FileText, lead: TrendingUp, case: MessageSquare };
  const typeLabel = { offer: "Tilbud", lead: "Lead", case: "Sak" };

  if (items.length === 0) {
    return (
      <Card className="rounded-2xl border-dashed">
        <CardContent className="flex flex-col items-center py-8 text-center space-y-2">
          <Activity className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Ingen aktivitet registrert ennå.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" /> Aktivitet
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-1">
        {items.map((item) => {
          const Icon = iconMap[item.type];
          return (
            <div key={item.id} className="flex items-center gap-3 py-1.5 border-b border-border/30 last:border-0">
              <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{item.title}</p>
                <p className="text-[10px] text-muted-foreground">
                  {typeLabel[item.type]} · {format(new Date(item.date), "d. MMM yyyy", { locale: nb })}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] rounded-lg shrink-0">{item.status}</Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
