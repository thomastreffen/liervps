import { useState, useEffect, useMemo } from "react";
import { useObjectCatalog, type CatalogObject } from "./useObjectCatalog";

export interface ObjectCandidate {
  id?: string;
  object_type: string;
  label: string;
  confidence_base: number;
  reasons: string[];
}

export function useObjectSuggestions(
  projectId: string | null,
  extractedText?: string,
  conversationContext?: string[],
) {
  const catalog = useObjectCatalog(projectId);
  const [loading, setLoading] = useState(false);

  const candidates = useMemo((): ObjectCandidate[] => {
    if (!catalog.objects.length) return [];
    const results: ObjectCandidate[] = [];
    const text = (extractedText || "").toLowerCase();
    const contextStr = (conversationContext || []).join(" ").toLowerCase();

    for (const obj of catalog.objects) {
      let confidence = 0;
      const reasons: string[] = [];

      // Exact label match
      if (text.includes(obj.label.toLowerCase())) {
        confidence += 0.8;
        reasons.push("Eksakt match i OCR-tekst");
      }

      // Synonym match
      for (const syn of (obj.synonyms || [])) {
        if (text.includes(syn.toLowerCase())) {
          confidence += 0.6;
          reasons.push(`Synonym-match: ${syn}`);
          break;
        }
      }

      // Fuzzy match (normalize dots/dashes)
      const normalizedLabel = obj.label.replace(/[.\-_\s]/g, "").toLowerCase();
      const normalizedText = text.replace(/[.\-_\s]/g, "");
      if (normalizedText.includes(normalizedLabel) && confidence < 0.6) {
        confidence += 0.5;
        reasons.push("Lignende match (normalisert)");
      }

      // Boost from conversation context
      if (contextStr.includes(obj.label.toLowerCase())) {
        confidence += 0.15;
        reasons.push("Brukt i samtale nylig");
      }

      if (confidence > 0) {
        results.push({
          id: obj.id,
          object_type: obj.object_type,
          label: obj.label,
          confidence_base: Math.min(confidence, 1),
          reasons,
        });
      }
    }

    return results.sort((a, b) => b.confidence_base - a.confidence_base).slice(0, 5);
  }, [catalog.objects, extractedText, conversationContext]);

  return { candidates, loading: catalog.loading || loading };
}
