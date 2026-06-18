import { Card, CardContent } from "@/components/ui/card";
import { ScrollText } from "lucide-react";
import { useMaterialActivityLog } from "@/hooks/useMaterialProcurements";

interface Props {
  materialListId: string;
}

export function MaterialActivityPanel({ materialListId }: Props) {
  const { rows, loading } = useMaterialActivityLog(materialListId);

  return (
    <Card className="rounded-xl">
      <CardContent className="p-4 space-y-3">
        <div>
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-primary" /> Materiell-logg
          </h4>
          <p className="text-xs text-muted-foreground">
            Viktige hendelser på materiallisten.
          </p>
        </div>

        {loading && rows.length === 0 && <p className="text-xs text-muted-foreground">Laster…</p>}
        {!loading && rows.length === 0 && (
          <p className="text-xs text-muted-foreground">Ingen hendelser ennå.</p>
        )}

        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start gap-3 text-sm">
              <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-foreground">{r.message}</p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" })}
                  {r.actor_name ? ` • ${r.actor_name}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
