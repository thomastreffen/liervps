import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  MapPin,
  Clock,
  User as UserIcon,
  CalendarClock,
  FolderKanban,
} from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import type { CalendarEvent } from "@/hooks/useCalendarEvents";

interface UnplannedItem {
  id: string;
  title: string;
  customer: string | null;
  address: string | null;
  internal_number: string | null;
  status: string;
  start_time: string | null;
  end_time: string | null;
  description: string | null;
  company_id: string;
  technicians: Array<{ id: string; name: string; color: string | null }>;
}

interface UnplannedDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId?: string | null;
  allowedCompanyIds?: string[];
  onPickJob: (event: CalendarEvent, techId?: string | null) => void;
  refreshKey?: number;
}

const STATUS_LABELS: Record<string, string> = {
  requested: "Forespurt",
  approved: "Godkjent",
  planned: "Planlagt",
  draft: "Utkast",
};

export function UnplannedDrawer({
  open,
  onOpenChange,
  companyId,
  allowedCompanyIds,
  onPickJob,
  refreshKey,
}: UnplannedDrawerProps) {
  const [items, setItems] = useState<UnplannedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("events")
        .select(
          "id, title, customer, address, internal_number, status, start_time, end_time, description, company_id"
        )
        .is("deleted_at", null)
        .is("archived_at", null)
        .is("parent_project_id", null)
        .or("project_type.is.null,project_type.neq.task")
        .in("status", ["requested", "approved"])
        .order("created_at", { ascending: false })
        .limit(100);

      if (companyId) {
        q = q.eq("company_id", companyId);
      } else if (allowedCompanyIds && allowedCompanyIds.length > 0) {
        q = q.in("company_id", allowedCompanyIds);
      }

      const { data, error } = await q;
      if (error) throw error;

      const rows = (data || []) as any[];
      if (rows.length === 0) {
        setItems([]);
        return;
      }

      const ids = rows.map((r) => r.id);

      const [{ data: blockRows }, { data: techRows }] = await Promise.all([
        supabase
          .from("schedule_blocks")
          .select("project_id, job_id")
          .or(`project_id.in.(${ids.join(",")}),job_id.in.(${ids.join(",")})`)
          .is("deleted_at", null),
        supabase
          .from("event_technicians")
          .select("event_id, technician_id, technicians(id, name, color)")
          .in("event_id", ids),
      ]);

      const planned = new Set<string>();
      for (const b of (blockRows || []) as any[]) {
        if (b.project_id) planned.add(b.project_id);
        if (b.job_id) planned.add(b.job_id);
      }

      const techMap = new Map<string, UnplannedItem["technicians"]>();
      for (const t of (techRows || []) as any[]) {
        const arr = techMap.get(t.event_id) || [];
        arr.push({
          id: t.technicians?.id || t.technician_id,
          name: t.technicians?.name || "Ukjent",
          color: t.technicians?.color || null,
        });
        techMap.set(t.event_id, arr);
      }

      const unplanned: UnplannedItem[] = rows
        .filter((r) => !planned.has(r.id))
        .map((r) => ({ ...r, technicians: techMap.get(r.id) || [] }));

      setItems(unplanned);
    } catch (err) {
      console.error("[UnplannedDrawer] fetch error", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, allowedCompanyIds?.join(",")]);

  useEffect(() => {
    if (open) fetchItems();
  }, [open, fetchItems, refreshKey]);

  // Realtime: refresh when schedule_blocks change while drawer open
  useEffect(() => {
    if (!open) return;
    const channel = supabase
      .channel("unplanned-drawer-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "schedule_blocks" },
        () => fetchItems()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        () => fetchItems()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, fetchItems]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items;
    return items.filter((it) => {
      const hay = [
        it.title,
        it.customer,
        it.address,
        it.internal_number,
        ...it.technicians.map((t) => t.name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(s);
    });
  }, [items, search]);

  const handlePick = (it: UnplannedItem) => {
    const calEvent: CalendarEvent = {
      id: it.id,
      microsoftEventId: "",
      title: it.title || "",
      customer: it.customer || "",
      address: it.address || "",
      description: it.description || "",
      start: it.start_time ? new Date(it.start_time) : new Date(),
      end: it.end_time ? new Date(it.end_time) : new Date(),
      status: "Planlagt" as any,
      technicianIds: it.technicians.map((t) => t.id),
      attendeeStatuses: [],
      technicians: it.technicians,
      internalNumber: it.internal_number || null,
    };
    onPickJob(calEvent, it.technicians[0]?.id ?? null);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col p-0"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b">
          <SheetTitle className="flex items-center gap-2 text-base">
            <FolderKanban className="h-4 w-4 text-primary" />
            Uplanlagt kø
            <Badge variant="secondary" className="ml-1 h-5 text-[10px]">
              {items.length}
            </Badge>
          </SheetTitle>
          <SheetDescription className="text-xs">
            Prosjekter og aktiviteter uten planlagte tider. Klikk for å
            planlegge inn i matrisen.
          </SheetDescription>
          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søk tittel, kunde, JOB-nr, montør…"
              className="pl-8 h-9 text-sm"
            />
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {loading && (
            <>
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </>
          )}

          {!loading && filtered.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              {items.length === 0
                ? "Ingen uplanlagte oppgaver. 🎉"
                : "Ingen treff på søket."}
            </div>
          )}

          {!loading &&
            filtered.map((it) => {
              const jobNum = it.internal_number
                ? it.internal_number.startsWith("JOB-")
                  ? it.internal_number
                  : `JOB-${it.internal_number}`
                : null;
              const statusLabel = STATUS_LABELS[it.status] || it.status;
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => handlePick(it)}
                  className="w-full text-left rounded-lg border border-border/60 bg-card hover:bg-accent/40 hover:border-primary/40 transition-colors p-3 group"
                >
                  <div className="flex items-start gap-2 mb-1.5">
                    {jobNum && (
                      <span className="text-[10px] font-mono font-bold bg-primary/10 text-primary rounded px-1.5 py-0.5 shrink-0">
                        {jobNum}
                      </span>
                    )}
                    <Badge
                      variant="outline"
                      className="text-[10px] h-4 px-1.5 shrink-0"
                    >
                      {statusLabel}
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                    {it.title || "Uten tittel"}
                  </p>
                  {it.customer && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {it.customer}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    {it.address && (
                      <span className="inline-flex items-center gap-1 max-w-full truncate">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{it.address}</span>
                      </span>
                    )}
                    {it.start_time && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" />
                        {format(new Date(it.start_time), "d. MMM", {
                          locale: nb,
                        })}
                      </span>
                    )}
                    {it.start_time && it.end_time && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(it.start_time), "HH:mm")}–
                        {format(new Date(it.end_time), "HH:mm")}
                      </span>
                    )}
                  </div>
                  {it.technicians.length > 0 && (
                    <div className="mt-2 flex items-center gap-1 flex-wrap">
                      <UserIcon className="h-3 w-3 text-muted-foreground" />
                      {it.technicians.slice(0, 4).map((t) => (
                        <span
                          key={t.id}
                          className="text-[10px] px-1.5 py-0.5 rounded-full border"
                          style={{
                            borderColor: t.color || undefined,
                            color: t.color || undefined,
                          }}
                        >
                          {t.name.split(" ")[0]}
                        </span>
                      ))}
                      {it.technicians.length > 4 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{it.technicians.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
        </div>

        <div className="border-t px-5 py-3 text-[11px] text-muted-foreground bg-muted/30">
          Klikk en oppgave for å åpne planleggeren og tildele montør + tid.
        </div>
      </SheetContent>
    </Sheet>
  );
}
