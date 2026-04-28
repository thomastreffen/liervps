import { useNavigate } from "react-router-dom";
import { useCalcPackages } from "@/hooks/useCalcPackages";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calculator, Loader2, Package, Sparkles, PencilLine } from "lucide-react";
import { isPackageSupported } from "@/lib/calc-engine/registry";

export default function CalcPackagePickerPage() {
  const navigate = useNavigate();
  const { packages, loading } = useCalcPackages();

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" /> Velg kalkylepakke
          </h1>
          <p className="text-sm text-muted-foreground">
            Velg pakke, så bestemmer du om du vil starte manuelt eller la AI lage et førsteutkast.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : packages.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground rounded-2xl">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
          Ingen kalkylepakker er tilgjengelige enda.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {packages.map((p) => {
            const supported = isPackageSupported(p.slug);
            return (
              <Card
                key={p.id}
                className={`p-5 rounded-2xl border transition-all
                  ${supported ? "hover:border-primary/40 hover:shadow-md" : "opacity-60"}`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-semibold text-base">{p.name}</h3>
                  <Badge variant="outline" className="rounded-lg text-[10px] uppercase tracking-wide">
                    v{p.version}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3 line-clamp-3 min-h-[3rem]">
                  {p.description}
                </p>
                <div className="flex items-center gap-2 flex-wrap mb-4">
                  <Badge className="bg-primary-soft text-primary rounded-lg text-[10px]">
                    {p.category}
                  </Badge>
                  {p.company_id === null && (
                    <Badge variant="secondary" className="rounded-lg text-[10px]">Global</Badge>
                  )}
                  {!supported && (
                    <Badge variant="outline" className="rounded-lg text-[10px] text-muted-foreground">
                      Kommer
                    </Badge>
                  )}
                </div>
                {supported && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="rounded-xl gap-1.5"
                      onClick={() => navigate(`/sales/calc-engine/new?package=${p.id}`)}
                    >
                      <PencilLine className="h-4 w-4" /> Manuell
                    </Button>
                    <Button
                      className="rounded-xl gap-1.5"
                      onClick={() => navigate(`/sales/calc-engine/ai-start?package=${p.id}`)}
                    >
                      <Sparkles className="h-4 w-4" /> AI-assistert
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
