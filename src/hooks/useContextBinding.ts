import { useState, useCallback, useEffect } from "react";

export interface MessageContext {
  location_text: string;
  object_type: string | null;
  object_ref: string | null;
  tags: string[];
}

const STORAGE_KEY = "chat-recent-locations";
const MAX_RECENT = 8;

const WORK_TYPE_OPTIONS = [
  { value: "service", label: "Service" },
  { value: "avvik", label: "Avvik" },
  { value: "fdv", label: "FDV" },
  { value: "tilbud", label: "Tilbud" },
  { value: "montasje", label: "Montasje" },
  { value: "annet", label: "Annet" },
];

const OBJECT_TYPE_OPTIONS = [
  { value: "room", label: "Rom" },
  { value: "board", label: "Tavle" },
  { value: "field", label: "Område" },
  { value: "other", label: "Annet" },
];

export function useContextBinding() {
  const [context, setContext] = useState<MessageContext>({
    location_text: "",
    object_type: null,
    object_ref: null,
    tags: [],
  });
  const [recentLocations, setRecentLocations] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setRecentLocations(JSON.parse(stored));
    } catch {}
  }, []);

  const saveLocation = useCallback((loc: string) => {
    if (!loc.trim()) return;
    setRecentLocations(prev => {
      const next = [loc, ...prev.filter(l => l !== loc)].slice(0, MAX_RECENT);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setLocationText = useCallback((text: string) => {
    setContext(prev => ({ ...prev, location_text: text }));
  }, []);

  const setObjectType = useCallback((type: string | null) => {
    setContext(prev => ({ ...prev, object_type: type }));
  }, []);

  const setObjectRef = useCallback((ref: string | null) => {
    setContext(prev => ({ ...prev, object_ref: ref }));
  }, []);

  const addTag = useCallback((tag: string) => {
    setContext(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags : [...prev.tags, tag],
    }));
  }, []);

  const removeTag = useCallback((tag: string) => {
    setContext(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag),
    }));
  }, []);

  const clearContext = useCallback(() => {
    setContext({ location_text: "", object_type: null, object_ref: null, tags: [] });
  }, []);

  const hasContext = !!(context.location_text || context.object_type || context.tags.length > 0);

  const commitContext = useCallback(() => {
    if (context.location_text) saveLocation(context.location_text);
  }, [context.location_text, saveLocation]);

  return {
    context,
    hasContext,
    recentLocations,
    setLocationText,
    setObjectType,
    setObjectRef,
    addTag,
    removeTag,
    clearContext,
    commitContext,
    WORK_TYPE_OPTIONS,
    OBJECT_TYPE_OPTIONS,
  };
}
