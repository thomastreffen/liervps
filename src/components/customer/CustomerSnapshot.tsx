import { Card, CardContent } from "@/components/ui/card";
import { FolderKanban, FileText, TrendingUp, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";

interface Props {
  projectCount: number;
  offerCount: number;
  leadCount: number;
  lastActivity: string | null;
}

export function CustomerSnapshot({ projectCount, offerCount, leadCount, lastActivity }: Props) {
  const stats = [
    { icon: FolderKanban, label: "Prosjekter", value: projectCount, color: "text-primary" },
    { icon: FileText, label: "Tilbud", value: offerCount, color: "text-info" },
    { icon: TrendingUp, label: "Leads", value: leadCount, color: "text-accent" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((s) => (
        <Card key={s.label} className="rounded-2xl">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <div className={`rounded-xl bg-secondary p-2 ${s.color}`}>
              <s.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-lg font-bold leading-none">{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
      <Card className="rounded-2xl">
        <CardContent className="py-3 px-4 flex items-center gap-3">
          <div className="rounded-xl bg-secondary p-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-medium leading-tight">
              {lastActivity
                ? formatDistanceToNow(new Date(lastActivity), { addSuffix: true, locale: nb })
                : "Ingen"}
            </p>
            <p className="text-[10px] text-muted-foreground">Sist aktivitet</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
