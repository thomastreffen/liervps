import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { Search, Link2, CalendarDays, MapPin, User, Star, Loader2 } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string;
  submissionNo?: string;
  customerId?: string | null;
  currentLinkedEventId?: string | null;
}

export function LinkExistingTaskDialog({
  open,
  onOpenChange,
  submissionId,
  submissionNo,
  customerId,
  currentLinkedEventId,
}: Props) {
  const { user } = useAuth();
  const { activeCompanyId } = useCompanyContext();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 250);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedId(null);
    }
  }, [open]);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["link-task-search", activeCompanyId, debounced, customerId],
    enabled: open && !!activeCompanyId,
    queryFn: async () => {
      let q = supabase
        .from("events")
        .select(`
          id, title, internal_number, project_number, project_type,
          status, start_time, end_time, address, customer, customer_id,
          event_technicians(technician:technicians(person:people(full_name)))
        `)
        .eq("company_id", activeCompanyId!)
        .is("deleted_at", null)
        .order("start_time", { ascending: false, nullsFirst: false })
        .limit(40);

      const term = debounced.trim();
      if (term) {
        // Try a broad ilike on key fields
        q = q.or(
          [
            `title.ilike.%${term}%`,
            `internal_number.ilike.%${term}%`,
            `project_number.ilike.%${term}%`,
            `address.ilike.%${term}%`,
            `customer.ilike.%${term}%`,
          ].join(",")
        );
      }

      const { data } = await q;
      return (data || []) as any[];
    },
  });

  // Sort: customer match first, then by start_time desc
  const sorted = useMemo(() => {
    const list = [...events];
    list.sort((a, b) => {
      const aMatch = customerId && a.customer_id === customerId ? 1 : 0;
      const bMatch = customerId && b.customer_id === customerId ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
      const aT = a.start_time ? new Date(a.start_time).getTime() : 0;
      const bT = b.start_time ? new Date(b.start_time).getTime() : 0;
      return bT - aT;
    });
    return list;
  }, [events, customerId]);

  const linkMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error("Velg en oppgave");
      const event = sorted.find((e: any) => e.id === selectedId);
      if (!event) throw new Error("Oppgave ikke funnet");

      // Resolve actor name
      let actorName = "Saksbehandler";
      if (user?.id) {
        const { data: ua } = await supabase
          .from("user_accounts")
          .select("person:people(full_name)")
          .eq("auth_user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();
        actorName = (ua as any)?.person?.full_name || actorName;
      }

      const { error } = await supabase
        .from("order_form_submissions")
        .update({ linked_event_id: selectedId, last_activity_at: new Date().toISOString() } as any)
        .eq("id", submissionId);
      if (error) throw error;

      await supabase.from("order_form_activity_log").insert({
        submission_id: submissionId,
        event_type: "linked_to_existing_task",
        payload: {
          event_id: selectedId,
          event_title: event.title,
          event_number: event.project_number || event.internal_number,
          actor_name: actorName,
          previous_event_id: currentLinkedEventId,
          summary: `Koblet til oppgave ${event.project_number || event.internal_number || ""} ${event.title || ""}`.trim(),
        },
        created_by: user?.id,
      } as any);

      return event;
    },
    onSuccess: (event: any) => {
      toast.success(`Koblet til ${event.project_number || event.internal_number || event.title}`);
      qc.invalidateQueries({ queryKey: ["order-form-submission", submissionId] });
      qc.invalidateQueries({ queryKey: ["linked-task-for-order", submissionId] });
      qc.invalidateQueries({ queryKey: ["order-form-activity", submissionId] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Kunne ikke koble"),
  });

  const unlinkMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("order_form_submissions")
        .update({ linked_event_id: null, last_activity_at: new Date().toISOString() } as any)
        .eq("id", submissionId);
      if (error) throw error;

      await supabase.from("order_form_activity_log").insert({
        submission_id: submissionId,
        event_type: "unlinked_task",
        payload: {
          previous_event_id: currentLinkedEventId,
          summary: "Kobling til eksisterende oppgave fjernet",
        },
        created_by: user?.id,
      } as any);
    },
    onSuccess: () => {
      toast.success("Kobling fjernet");
      qc.invalidateQueries({ queryKey: ["order-form-submission", submissionId] });
      qc.invalidateQueries({ queryKey: ["linked-task-for-order", submissionId] });
      qc.invalidateQueries({ queryKey: ["order-form-activity", submissionId] });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Koble til eksisterende oppgave
            {submissionNo && <span className="text-sm text-muted-foreground font-normal">· {submissionNo}</span>}
          </DialogTitle>
          <DialogDescription>
            Søk etter en eksisterende oppgave i ressursplanen og koble bestillingen til den.
            Planlagt tid og status vises på kundesiden.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pt-3 pb-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Søk på tittel, jobbnummer, prosjekt, adresse, kunde…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
              autoFocus
            />
          </div>
          {customerId && (
            <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
              <Star className="h-3 w-3 text-amber-500" />
              Oppgaver hos samme kunde vises øverst.
            </p>
          )}
        </div>

        <ScrollArea className="flex-1 px-2 py-2">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              Ingen oppgaver funnet
            </p>
          ) : (
            <div className="space-y-1">
              {sorted.map((e: any) => {
                const isSelected = selectedId === e.id;
                const isCurrent = currentLinkedEventId === e.id;
                const customerMatch = customerId && e.customer_id === customerId;
                const techNames = (e.event_technicians || [])
                  .map((et: any) => et.technician?.person?.full_name)
                  .filter(Boolean)
                  .join(", ");
                return (
                  <button
                    key={e.id}
                    onClick={() => setSelectedId(e.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-md border transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-transparent hover:bg-muted/50 hover:border-muted"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-medium truncate">{e.title || "(uten tittel)"}</span>
                          {isCurrent && <Badge variant="outline" className="text-[9px] h-4">Koblet nå</Badge>}
                          {customerMatch && (
                            <Badge variant="outline" className="text-[9px] h-4 bg-amber-50 text-amber-700 border-amber-200">
                              <Star className="h-2.5 w-2.5 mr-0.5" /> Samme kunde
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {e.project_number || e.internal_number}
                          {e.customer && ` · ${e.customer}`}
                        </p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
                          {e.start_time && (
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {format(new Date(e.start_time), "d. MMM yyyy HH:mm", { locale: nb })}
                            </span>
                          )}
                          {e.address && (
                            <span className="flex items-center gap-1 truncate max-w-[200px]">
                              <MapPin className="h-3 w-3" />
                              {e.address}
                            </span>
                          )}
                          {techNames && (
                            <span className="flex items-center gap-1 truncate max-w-[200px]">
                              <User className="h-3 w-3" />
                              {techNames}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="px-6 py-3 border-t flex-row sm:justify-between gap-2">
          <div>
            {currentLinkedEventId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => unlinkMutation.mutate()}
                disabled={unlinkMutation.isPending}
                className="text-destructive hover:text-destructive"
              >
                Fjern kobling
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
            <Button
              onClick={() => linkMutation.mutate()}
              disabled={!selectedId || linkMutation.isPending || selectedId === currentLinkedEventId}
            >
              {linkMutation.isPending ? "Kobler..." : "Koble til"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
