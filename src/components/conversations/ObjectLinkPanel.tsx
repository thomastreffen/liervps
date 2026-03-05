import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Check, X, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useObjectCatalog } from "@/hooks/useObjectCatalog";
import { useObjectSuggestions } from "@/hooks/useObjectSuggestions";

interface ObjectLinkPanelProps {
  projectId: string;
  extractedText?: string;
  conversationContext?: string[];
  onLink: (objectType: string, label: string, objectId?: string) => void;
  onSkip: () => void;
}

const OBJECT_TYPES = [
  { id: "board", label: "Tavle" },
  { id: "field", label: "Felt" },
  { id: "component", label: "Komponent" },
  { id: "room", label: "Rom" },
  { id: "other", label: "Annet" },
];

export function ObjectLinkPanel({
  projectId, extractedText, conversationContext, onLink, onSkip,
}: ObjectLinkPanelProps) {
  const [mode, setMode] = useState<"suggest" | "search">("suggest");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("board");
  const [customLabel, setCustomLabel] = useState("");

  const catalog = useObjectCatalog(projectId);
  const suggestions = useObjectSuggestions(projectId, extractedText, conversationContext);

  const filteredCatalog = useMemo(() => {
    if (!searchQuery.trim()) return catalog.objects.filter(o => o.object_type === selectedType).slice(0, 10);
    const q = searchQuery.toLowerCase();
    return catalog.objects
      .filter(o => o.label.toLowerCase().includes(q) || (o.synonyms || []).some((s: string) => s.toLowerCase().includes(q)))
      .slice(0, 10);
  }, [catalog.objects, searchQuery, selectedType]);

  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-[340px] max-w-[95vw] bg-card rounded-xl shadow-2xl border border-border/40 overflow-hidden z-20">
      <div className="px-4 py-3 border-b border-border/20">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground">Knytt til objekt</h4>
          <button onClick={onSkip} className="text-muted-foreground hover:text-foreground cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex gap-1 mt-2">
          <button
            onClick={() => setMode("suggest")}
            className={cn(
              "text-[10px] px-2 py-1 rounded-md transition-colors cursor-pointer",
              mode === "suggest" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"
            )}
          >
            <Sparkles className="h-3 w-3 inline mr-1" />
            Forslag
          </button>
          <button
            onClick={() => setMode("search")}
            className={cn(
              "text-[10px] px-2 py-1 rounded-md transition-colors cursor-pointer",
              mode === "search" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"
            )}
          >
            <Search className="h-3 w-3 inline mr-1" />
            Søk i katalog
          </button>
        </div>
      </div>

      {mode === "suggest" && (
        <div className="p-3 space-y-2 max-h-[200px] overflow-y-auto">
          {suggestions.loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : suggestions.candidates.length > 0 ? (
            suggestions.candidates.slice(0, 5).map((c, i) => (
              <button
                key={i}
                onClick={() => onLink(c.object_type, c.label, c.id)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <Badge variant="outline" className="text-[9px] shrink-0">{c.object_type}</Badge>
                <span className="text-sm text-foreground flex-1 truncate">{c.label}</span>
                {c.confidence_base > 0.7 && (
                  <span className="text-[9px] text-emerald-600">Sterk match</span>
                )}
              </button>
            ))
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">Ingen forslag funnet</p>
          )}
          <button
            onClick={onSkip}
            className="w-full text-xs text-muted-foreground hover:text-foreground py-2 cursor-pointer"
          >
            Ingen match – hopp over
          </button>
        </div>
      )}

      {mode === "search" && (
        <div className="p-3 space-y-2">
          <div className="flex gap-1 mb-2">
            {OBJECT_TYPES.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedType(t.id)}
                className={cn(
                  "text-[10px] px-2 py-1 rounded-md transition-colors cursor-pointer",
                  selectedType === t.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm bg-muted/30 rounded-lg border border-border/30 text-foreground placeholder:text-muted-foreground/50"
              placeholder="Søk på label..."
              autoFocus
            />
          </div>
          <div className="max-h-[150px] overflow-y-auto space-y-1">
            {filteredCatalog.map(obj => (
              <button
                key={obj.id}
                onClick={() => onLink(obj.object_type, obj.label, obj.id)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <Badge variant="outline" className="text-[9px] shrink-0">{obj.object_type}</Badge>
                <span className="text-sm text-foreground truncate">{obj.label}</span>
              </button>
            ))}
            {filteredCatalog.length === 0 && (
              <div className="py-3">
                <p className="text-xs text-muted-foreground text-center mb-2">Ikke funnet – legg til nytt</p>
                <div className="flex gap-2">
                  <input
                    value={customLabel}
                    onChange={e => setCustomLabel(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-sm bg-muted/30 rounded-lg border border-border/30 text-foreground"
                    placeholder="Label..."
                  />
                  <Button
                    size="sm"
                    className="h-8"
                    disabled={!customLabel.trim()}
                    onClick={() => {
                      catalog.addObject(selectedType, customLabel.trim());
                      onLink(selectedType, customLabel.trim());
                    }}
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
