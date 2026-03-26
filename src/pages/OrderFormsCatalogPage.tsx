import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2, ArrowRight, Search, Tag } from "lucide-react";

export default function OrderFormsCatalogPage() {
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");

  // Catalog settings (editable header)
  const { data: settings } = useQuery({
    queryKey: ["catalog-settings"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("order_form_catalog_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      return data as { title: string; subtitle: string; help_text: string | null; contact_info: string | null } | null;
    },
  });

  // Categories
  const { data: categories = [] } = useQuery({
    queryKey: ["public-categories"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("order_form_categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      return data || [];
    },
  });

  // Templates
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["public-order-form-templates"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("order_form_templates")
        .select("id, name, external_title, description, slug, audience_type, show_in_catalog, category, category_id, requires_login")
        .eq("is_active", true)
        .in("audience_type", ["external", "both"])
        .eq("show_in_catalog", true)
        .order("name");
      return data || [];
    },
  });

  // Group templates by category
  const grouped = useMemo(() => {
    let filtered = templates;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((t: any) =>
        (t.external_title || t.name).toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q)
      );
    }
    if (activeCat !== "all") {
      filtered = filtered.filter((t: any) => {
        const catMatch = categories.find((c: any) => c.id === activeCat);
        return catMatch ? (t.category_id === catMatch.id || t.category === catMatch.name) : false;
      });
    }

    const groups: Record<string, any[]> = {};
    for (const t of filtered) {
      const catName = t.category || "Annet";
      if (!groups[catName]) groups[catName] = [];
      groups[catName].push(t);
    }
    return groups;
  }, [templates, search, activeCat, categories]);

  const categoryNames = useMemo(() => {
    const names = new Set<string>();
    templates.forEach((t: any) => names.add(t.category || "Annet"));
    return Array.from(names);
  }, [templates]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const title = settings?.title || "Bestillinger og henvendelser";
  const subtitle = settings?.subtitle || "Velg riktig kategori og skjema for å sende inn en bestilling, melding eller forespørsel.";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        {/* Editable header */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold text-foreground">{title}</h1>
          <p className="text-base text-muted-foreground max-w-xl mx-auto">{subtitle}</p>
          {settings?.help_text && (
            <p className="text-sm text-muted-foreground/80 max-w-lg mx-auto">{settings.help_text}</p>
          )}
          {settings?.contact_info && (
            <p className="text-xs text-muted-foreground/60">{settings.contact_info}</p>
          )}
        </div>

        {/* Search + category filter */}
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Søk etter skjema..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {categoryNames.length > 1 && (
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setActiveCat("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeCat === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted"
                }`}
              >
                Alle
              </button>
              {categories.map((cat: any) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCat(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeCat === cat.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Grouped templates */}
        {Object.keys(grouped).length === 0 ? (
          <div className="text-center py-16">
            <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Ingen bestillingsskjemaer funnet.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([catName, items]) => (
              <div key={catName}>
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="h-4 w-4 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground">{catName}</h2>
                  <span className="text-xs text-muted-foreground">({items.length})</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {items.map((t: any) => (
                    <Card key={t.id} className="hover:shadow-md transition-shadow group">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-primary shrink-0" />
                              <h3 className="text-sm font-semibold text-foreground truncate">
                                {t.external_title || t.name}
                              </h3>
                            </div>
                            {t.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2 pl-6">{t.description}</p>
                            )}
                            <div className="flex items-center gap-1.5 pl-6">
                              {t.audience_type === "internal" && (
                                <Badge variant="outline" className="text-[10px]">Intern</Badge>
                              )}
                              {t.requires_login && (
                                <Badge variant="outline" className="text-[10px]">Krever innlogging</Badge>
                              )}
                            </div>
                          </div>
                          <Link to={`/bestilling/${t.slug}`}>
                            <Button size="sm" className="gap-1 shrink-0 group-hover:bg-primary/90">
                              Åpne
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
