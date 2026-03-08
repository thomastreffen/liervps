import { MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function PortalMessages() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-foreground">Meldinger</h2>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12">
          <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
          <div className="text-center">
            <p className="font-medium text-card-foreground">Meldinger kommer snart</p>
            <p className="text-sm text-muted-foreground">
              Her vil du kunne kommunisere direkte med prosjektlederne.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
