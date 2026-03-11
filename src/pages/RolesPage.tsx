import { RolesTab } from "@/components/access-control/RolesTab";
import { Info } from "lucide-react";

export default function RolesPage() {
  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Roller</h1>
        <p className="text-sm text-muted-foreground">
          Administrer roller og tilhørende rettigheter
        </p>
      </div>

      {/* Layer explanation */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5" />
          Tilgangssystemet har fire lag
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="space-y-0.5">
            <p className="font-semibold text-foreground">🎭 Rolle</p>
            <p className="text-muted-foreground">Standardpakke med anbefalte rettigheter. F.eks. Montør, Prosjektleder.</p>
          </div>
          <div className="space-y-0.5">
            <p className="font-semibold text-foreground">🔭 Omfang</p>
            <p className="text-muted-foreground">Hvilke selskaper og avdelinger brukeren kan se data fra.</p>
          </div>
          <div className="space-y-0.5">
            <p className="font-semibold text-foreground">🔑 Rettigheter</p>
            <p className="text-muted-foreground">Detaljert kontroll over hva brukeren kan gjøre i hver modul.</p>
          </div>
          <div className="space-y-0.5">
            <p className="font-semibold text-foreground">👁 Modulsynlighet</p>
            <p className="text-muted-foreground">Styrer hva som vises i meny. Erstatter ikke ekte tilgangskontroll.</p>
          </div>
        </div>
      </div>

      <RolesTab />
    </div>
  );
}
