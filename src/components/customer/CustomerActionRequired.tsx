import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, TrendingUp, FileText, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  customerId: string;
  customerName: string;
  leadCount: number;
  offerCount: number;
  lastActivity: string | null;
}

export function CustomerActionRequired({ customerId, customerName, leadCount, offerCount, lastActivity }: Props) {
  const navigate = useNavigate();

  const actions: { icon: React.ElementType; text: string; action: () => void; variant: "default" | "outline" }[] = [];

  if (leadCount === 0) {
    actions.push({
      icon: TrendingUp,
      text: "Opprett lead",
      action: () => navigate(`/sales/leads/new?customer=${customerId}`),
      variant: "default",
    });
  }

  if (offerCount === 0) {
    actions.push({
      icon: FileText,
      text: "Lag tilbud",
      action: () => navigate(`/sales/offers/new?customer=${customerId}&customerName=${encodeURIComponent(customerName)}`),
      variant: "default",
    });
  }

  const daysSinceActivity = lastActivity
    ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  if (daysSinceActivity !== null && daysSinceActivity > 30) {
    actions.push({
      icon: MessageSquare,
      text: "Følg opp kunde",
      action: () => {},
      variant: "outline",
    });
  }

  if (actions.length === 0) return null;

  return (
    <Card className="rounded-2xl border-accent/30 bg-accent/5">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2 text-accent">
          <AlertTriangle className="h-4 w-4" /> Krever handling
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 flex flex-wrap gap-2">
        {actions.map((a, i) => (
          <Button key={i} size="sm" variant={a.variant} onClick={a.action} className="rounded-xl gap-1.5 text-xs h-8">
            <a.icon className="h-3.5 w-3.5" /> {a.text}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
