import { useState, useMemo } from "react";
import { Search, ChevronRight, Star, CalendarDays, Sun, FolderKanban, ClipboardCheck, FileText, Globe, Receipt, Bell, Filter, Bot, ArrowLeft, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  helpArticles,
  searchArticles,
  CATEGORY_LABELS,
  ROLE_LABELS,
  type HelpCategory,
  type HelpRole,
  type HelpArticle,
} from "@/lib/help-articles";
import { cn } from "@/lib/utils";
import { HelpAIChat } from "@/components/help/HelpAIChat";

const CATEGORY_ICON_MAP: Record<HelpCategory, React.ElementType> = {
  ressursplan: CalendarDays,
  "min-dag": Sun,
  prosjekter: FolderKanban,
  skjema: ClipboardCheck,
  servicejournal: FileText,
  kundeportal: Globe,
  fakturagrunnlag: Receipt,
  varsler: Bell,
};

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as HelpCategory[];
const ALL_ROLES: HelpRole[] = ["all", "admin", "montør", "kunde"];

export default function HelpCenterPage() {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<HelpCategory | null>(null);
  const [selectedRole, setSelectedRole] = useState<HelpRole>("all");
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
  const [showChat, setShowChat] = useState(false);

  const results = useMemo(
    () => searchArticles(query, selectedRole, selectedCategory || undefined),
    [query, selectedRole, selectedCategory]
  );

  const popularArticles = useMemo(
    () => helpArticles.filter((a) => a.popular),
    []
  );

  const showResults = query.length > 0 || selectedCategory !== null;

  if (selectedArticle) {
    return <ArticleView article={selectedArticle} onBack={() => setSelectedArticle(null)} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="bg-primary/5 px-4 sm:px-8 py-10 sm:py-16 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Hjelpesenter</h1>
        <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
          Finn svar på hvordan du bruker systemet, eller spør AI-assistenten.
        </p>
        <div className="relative max-w-lg mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Søk i hjelpeartikler…"
            className="pl-10 h-12 rounded-xl text-sm"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Role filter */}
        <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          {ALL_ROLES.map((r) => (
            <button
              key={r}
              onClick={() => setSelectedRole(r)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                selectedRole === r
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 space-y-8">
        {/* AI chat CTA */}
        <Card className="border-primary/20 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors" onClick={() => setShowChat(true)}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Spør AI-assistenten</p>
              <p className="text-xs text-muted-foreground">Få svar på spørsmål om funksjoner og arbeidsflyt.</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardContent>
        </Card>

        {/* Categories grid */}
        {!showResults && (
          <>
            <section>
              <h2 className="text-sm font-semibold text-foreground mb-3">Kategorier</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {ALL_CATEGORIES.map((cat) => {
                  const Icon = CATEGORY_ICON_MAP[cat];
                  const count = helpArticles.filter((a) => a.category === cat).length;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className="flex flex-col items-center gap-2 rounded-xl border border-border/40 p-4 hover:bg-muted/60 active:scale-[0.98] transition-all"
                    >
                      <Icon className="h-5 w-5 text-primary" />
                      <span className="text-xs font-medium text-foreground">{CATEGORY_LABELS[cat]}</span>
                      <span className="text-[10px] text-muted-foreground">{count} artikler</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Popular */}
            <section>
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <Star className="h-4 w-4 text-warning" /> Populære spørsmål
              </h2>
              <div className="space-y-2">
                {popularArticles.map((a) => (
                  <ArticleRow key={a.id} article={a} onClick={() => setSelectedArticle(a)} />
                ))}
              </div>
            </section>
          </>
        )}

        {/* Search / category results */}
        {showResults && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">
                {selectedCategory ? CATEGORY_LABELS[selectedCategory] : "Søkeresultater"}{" "}
                <span className="text-muted-foreground font-normal">({results.length})</span>
              </h2>
              {selectedCategory && (
                <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setSelectedCategory(null)}>
                  <X className="h-3 w-3" /> Fjern filter
                </Button>
              )}
            </div>
            {results.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-sm text-muted-foreground">Ingen artikler funnet.</p>
                  <p className="text-xs text-muted-foreground mt-1">Prøv et annet søkeord, eller spør AI-assistenten.</p>
                  <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => setShowChat(true)}>
                    <Bot className="h-3.5 w-3.5" /> Spør AI
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {results.map((a) => (
                  <ArticleRow key={a.id} article={a} onClick={() => setSelectedArticle(a)} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* AI Chat overlay */}
      {showChat && <HelpAIChat onClose={() => setShowChat(false)} />}
    </div>
  );
}

/* ─── Article Row ─── */
function ArticleRow({ article, onClick }: { article: HelpArticle; onClick: () => void }) {
  return (
    <Card className="cursor-pointer hover:bg-muted/40 active:scale-[0.995] transition-all" onClick={onClick}>
      <CardContent className="p-3 sm:p-4 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{article.title}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-0 bg-muted text-muted-foreground">
              {CATEGORY_LABELS[article.category]}
            </Badge>
            {article.roles.filter((r) => r !== "all").map((r) => (
              <span key={r} className="text-[9px] text-muted-foreground/60">{ROLE_LABELS[r as HelpRole]}</span>
            ))}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </CardContent>
    </Card>
  );
}

/* ─── Article Detail ─── */
function ArticleView({ article, onBack }: { article: HelpArticle; onBack: () => void }) {
  const related = (article.relatedIds || [])
    .map((id) => helpArticles.find((a) => a.id === id))
    .filter(Boolean) as HelpArticle[];

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 px-4 sm:px-8 py-4 border-b border-border/40">
        <button onClick={onBack} className="p-1 -ml-1 rounded-lg hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[article.category]}</p>
          <h1 className="text-sm font-semibold truncate">{article.title}</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* Roles */}
        <div className="flex gap-2 flex-wrap">
          {article.roles.map((r) => (
            <Badge key={r} variant="outline" className="text-[10px]">{ROLE_LABELS[r]}</Badge>
          ))}
        </div>

        {/* Summary */}
        <p className="text-sm text-foreground leading-relaxed">{article.summary}</p>

        {/* Steps */}
        {article.steps && article.steps.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Steg for steg</h2>
            <ol className="space-y-2">
              {article.steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="shrink-0 h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <p className="text-sm text-foreground pt-0.5">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Related */}
        {related.length > 0 && (
          <div className="space-y-2 pt-4 border-t border-border/40">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Relaterte artikler</h2>
            {related.map((a) => (
              <button key={a.id} className="w-full text-left text-sm text-primary hover:underline" onClick={() => {}}>
                {a.title}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
