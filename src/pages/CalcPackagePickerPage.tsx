import { useNavigate } from "react-router-dom";
import { useCalcPackages } from "@/hooks/useCalcPackages";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calculator, Loader2, Package } from "lucide-react";
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
            Hver pakke definerer egne inputfelt, normtider og satser.
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
                className={`p-5 rounded-2xl border transition-all hover:shadow-md cursor-pointer
                  ${supported ? "hover:border-primary/40" : "opacity-60 cursor-not-allowed"}`}
                onClick={() => supported && navigate(`/sales/calc-engine/new?package=${p.id}`)}
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
                <div className="flex items-center gap-2 flex-wrap">
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
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
