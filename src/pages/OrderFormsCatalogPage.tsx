import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, ArrowRight } from "lucide-react";

export default function OrderFormsCatalogPage() {
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["public-order-form-templates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("order_form_templates")
        .select("id, name, external_title, description, slug, audience_type")
        .eq("is_active", true)
        .in("audience_type", ["external", "both"])
        .order("name");
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Bestillinger</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Velg et skjema for å sende inn en bestilling.
          </p>
        </div>

        {templates.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Ingen bestillingsskjemaer er tilgjengelige.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {templates.map((t: any) => (
              <Card key={t.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    {t.external_title || t.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {t.description && (
                    <p className="text-sm text-muted-foreground mb-3">{t.description}</p>
                  )}
                  <Link to={`/bestilling/${t.slug}`}>
                    <Button size="sm" className="gap-1.5">
                      Åpne skjema
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
