import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BookOpen, Plus, FileCheck2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

interface Handbook {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  current_version_id: string | null;
  updated_at: string;
}

export default function HmsHandbooksPage() {
  const { activeCompanyId } = useCompanyContext();

  const { data: handbooks = [], isLoading } = useQuery({
    queryKey: ["hms-handbooks", activeCompanyId],
    enabled: !!activeCompanyId,
    queryFn: async () => {
      const sb = supabase as any;
      const { data, error } = await sb
        .from("hms_handbooks")
        .select("id, title, description, kind, current_version_id, updated_at")
        .eq("company_id", activeCompanyId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Handbook[];
    },
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
            <BookOpen className="h-3.5 w-3.5" />
            HMS &amp; HR
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Håndbøker</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            HMS-håndbok, arbeidshåndbok og spesifikke verneregler. Alle versjoner og lesebekreftelser
            samles her.
          </p>
        </div>
        <Button size="sm" disabled title="Kommer i runde B">
          <Plus className="h-4 w-4 mr-1.5" />
          Ny håndbok
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : handbooks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground space-y-3">
            <BookOpen className="h-8 w-8 mx-auto text-muted-foreground/40" />
            <div className="font-medium text-foreground">Ingen håndbøker enda</div>
            <p className="max-w-sm mx-auto">
              Når runde B er klar kan du opprette HMS-håndbok, arbeidshåndbok og MCS-spesifikke
              prosedyrer med versjonering og lesebekreftelse.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {handbooks.map((h) => (
            <Card key={h.id} className="border-border/60">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{h.title}</CardTitle>
                  <Badge variant="outline" className="text-[10px] uppercase">{h.kind}</Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-3">
                {h.description && <p className="line-clamp-2">{h.description}</p>}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs">
                    Oppdatert {format(new Date(h.updated_at), "d. MMM yyyy", { locale: nb })}
                  </span>
                  <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                    <Link to={`/hms/handbooks/${h.id}`}>
                      <FileCheck2 className="h-3.5 w-3.5 mr-1" /> Åpne
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
