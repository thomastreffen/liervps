import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send, CalendarRange, CalendarDays, CalendarCheck, ChevronLeft, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useAuth } from "@/hooks/useAuth";
import { ABSENCE_TYPE_LABELS, type AbsenceType } from "@/hooks/useAbsenceRequests";
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  getISOWeek,
  isAfter,
  isBefore,
  isSameDay,
  isWithinInterval,
  startOfISOWeek,
  startOfMonth,
  endOfISOWeek,
} from "date-fns";
import { nb } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface PersonOption {
  person_id: string;
  full_name: string;
}

type Mode = "range" | "week" | "single";

interface Period {
  id: string;
  start: Date;
  end: Date;
  kind: Mode;
  label: string;
}

const TEAL = "#1D9E75";

const fmtDate = (d: Date) => format(d, "yyyy-MM-dd");
const fmtNice = (d: Date) => format(d, "d. MMM", { locale: nb });
const fmtShort = (d: Date) => format(d, "dd.MM", { locale: nb });

function buildMonthGrid(month: Date) {
  const start = startOfISOWeek(startOfMonth(month));
  const end = endOfISOWeek(endOfMonth(month));
  const weeks: { weekNum: number; days: Date[] }[] = [];
  let cursor = start;
  while (cursor <= end) {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(cursor, i));
    }
    weeks.push({ weekNum: getISOWeek(cursor), days });
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

export function AbsenceRequestForm() {
  const { user } = useAuth();
  const { activeCompanyId, companies } = useCompanyContext();
  const [absenceType, setAbsenceType] = useState<AbsenceType>("ferie");
  const [comment, setComment] = useState("");
  const [companyId, setCompanyId] = useState(activeCompanyId || "");
  const [personId, setPersonId] = useState("");
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [isOnBehalf, setIsOnBehalf] = useState(false);
  const [myPersonId, setMyPersonId] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("range");
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [periods, setPeriods] = useState<Period[]>([]);

  // Drag state for range mode
  const [dragAnchor, setDragAnchor] = useState<Date | null>(null);
  const [dragCurrent, setDragCurrent] = useState<Date | null>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_accounts")
      .select("person_id")
      .eq("auth_user_id", user.id)
      .eq("is_active", true)
      .single()
      .then(({ data }) => {
        if (data?.person_id) {
          setMyPersonId(data.person_id);
          if (!isOnBehalf) setPersonId(data.person_id);
        }
      });
  }, [user]);

  useEffect(() => {
    if (!isOnBehalf) return;
    const cid = companyId || activeCompanyId;
    if (!cid) return;
    supabase
      .from("employment_profiles")
      .select("person_id")
      .eq("company_id", cid)
      .is("archived_at", null)
      .then(async ({ data: eps }) => {
        if (!eps || eps.length === 0) { setPeople([]); return; }
        const pids = [...new Set(eps.map((e: any) => e.person_id))];
        const { data: ppl } = await supabase
          .from("people")
          .select("id, full_name")
          .in("id", pids)
          .eq("is_active", true)
          .order("full_name");
        setPeople((ppl || []).map((p: any) => ({ person_id: p.id, full_name: p.full_name })));
      });
  }, [isOnBehalf, companyId, activeCompanyId]);

  useEffect(() => {
    if (activeCompanyId) setCompanyId(activeCompanyId);
  }, [activeCompanyId]);

  const weeks = useMemo(() => buildMonthGrid(month), [month]);

  // helpers
  const addPeriod = (p: Period) => setPeriods((prev) => [...prev, p]);
  const removePeriod = (id: string) => setPeriods((prev) => prev.filter((p) => p.id !== id));

  const dayInExistingPeriods = (d: Date) =>
    periods.find((p) => isWithinInterval(d, { start: p.start, end: p.end }));

  const dayInDragPreview = (d: Date) => {
    if (mode !== "range" || !dragAnchor || !dragCurrent) return false;
    const [a, b] = isBefore(dragAnchor, dragCurrent) ? [dragAnchor, dragCurrent] : [dragCurrent, dragAnchor];
    return isWithinInterval(d, { start: a, end: b });
  };

  const isRangeEdge = (d: Date) => {
    for (const p of periods) {
      if (isSameDay(d, p.start) || isSameDay(d, p.end)) return true;
    }
    if (dragAnchor && dragCurrent) {
      const [a, b] = isBefore(dragAnchor, dragCurrent) ? [dragAnchor, dragCurrent] : [dragCurrent, dragAnchor];
      if (isSameDay(d, a) || isSameDay(d, b)) return true;
    }
    return false;
  };

  // Mouse handlers per mode
  const handleDayMouseDown = (d: Date) => {
    if (mode === "range") {
      isDraggingRef.current = true;
      setDragAnchor(d);
      setDragCurrent(d);
    } else if (mode === "single") {
      const existing = periods.find((p) => p.kind === "single" && isSameDay(p.start, d));
      if (existing) {
        removePeriod(existing.id);
      } else {
        addPeriod({
          id: crypto.randomUUID(),
          start: d,
          end: d,
          kind: "single",
          label: fmtShort(d),
        });
      }
    }
  };

  const handleDayMouseEnter = (d: Date) => {
    if (mode === "range" && isDraggingRef.current) {
      setDragCurrent(d);
    }
  };

  const finishDrag = () => {
    if (mode === "range" && dragAnchor && dragCurrent) {
      const [a, b] = isBefore(dragAnchor, dragCurrent) ? [dragAnchor, dragCurrent] : [dragCurrent, dragAnchor];
      addPeriod({
        id: crypto.randomUUID(),
        start: a,
        end: b,
        kind: "range",
        label: isSameDay(a, b) ? fmtShort(a) : `${fmtShort(a)} – ${fmtShort(b)}`,
      });
    }
    isDraggingRef.current = false;
    setDragAnchor(null);
    setDragCurrent(null);
  };

  useEffect(() => {
    const up = () => { if (isDraggingRef.current) finishDrag(); };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  });

  const handleWeekClick = (weekDays: Date[]) => {
    const monday = weekDays[0];
    const friday = weekDays[4];
    const weekNum = getISOWeek(monday);
    const existing = periods.find(
      (p) => p.kind === "week" && isSameDay(p.start, monday) && isSameDay(p.end, friday),
    );
    if (existing) {
      removePeriod(existing.id);
    } else {
      addPeriod({
        id: crypto.randomUUID(),
        start: monday,
        end: friday,
        kind: "week",
        label: `Uke ${weekNum}`,
      });
    }
  };

  const submittingRef = useRef(false);

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    if (!companyId || !personId) {
      toast.error("Velg ansatt og selskap");
      return;
    }
    if (periods.length === 0) {
      toast.error("Velg minst én periode");
      return;
    }

    // Dedupe periods by start/end (same person, same range)
    const seen = new Set<string>();
    const uniquePeriods = periods.filter((p) => {
      const key = `${fmtDate(p.start)}__${fmtDate(p.end)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    submittingRef.current = true;
    setSubmitting(true);

    try {
      // Check for existing approved/pending overlapping requests for the same person
      const minStart = uniquePeriods.reduce((m, p) => (p.start < m ? p.start : m), uniquePeriods[0].start);
      const maxEnd = uniquePeriods.reduce((m, p) => (p.end > m ? p.end : m), uniquePeriods[0].end);

      const { data: existing } = await supabase
        .from("absence_requests")
        .select("start_date, end_date, status")
        .eq("person_id", personId)
        .in("status", ["approved", "pending"])
        .lte("start_date", fmtDate(maxEnd))
        .gte("end_date", fmtDate(minStart));

      const conflicting = uniquePeriods.filter((p) =>
        (existing || []).some((e: any) => {
          const es = new Date(e.start_date + "T00:00:00");
          const ee = new Date(e.end_date + "T00:00:00");
          return p.start <= ee && p.end >= es;
        }),
      );

      if (conflicting.length > 0) {
        toast.error("Overlappende fravær finnes allerede", {
          description: conflicting.map((c) => c.label).join(", "),
        });
        return;
      }

      const rows = uniquePeriods.map((p) => ({
        person_id: personId,
        company_id: companyId,
        absence_type: absenceType,
        start_date: fmtDate(p.start),
        end_date: fmtDate(p.end),
        start_time: null,
        end_time: null,
        is_full_day: true,
        comment: comment || null,
        requested_by: user?.id || null,
      }));
      const { error } = await supabase.from("absence_requests").insert(rows);
      if (error) {
        toast.error("Feil ved innsending", { description: error.message });
      } else {
        toast.success(`${rows.length} ${rows.length === 1 ? "forespørsel" : "forespørsler"} sendt`);
        setPeriods([]);
        setComment("");
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const modeButtons: { id: Mode; label: string; icon: any }[] = [
    { id: "range", label: "Datoperiode", icon: CalendarRange },
    { id: "week", label: "Ukevelger", icon: CalendarCheck },
    { id: "single", label: "Enkeltdager", icon: CalendarDays },
  ];

  const monthLabel = format(month, "LLLL yyyy", { locale: nb });

  return (
    <div className="rounded-2xl border bg-card p-5 sm:p-7 space-y-6 max-w-3xl">
      {/* På vegne av */}
      <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3">
        <div className="text-sm font-medium">På vegne av en annen ansatt</div>
        <Switch
          checked={isOnBehalf}
          onCheckedChange={(v) => {
            setIsOnBehalf(v);
            if (!v && myPersonId) setPersonId(myPersonId);
            else setPersonId("");
          }}
        />
      </div>

      {/* Ansatt + Type */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {isOnBehalf ? (
          <div>
            <Label className="text-xs">Ansatt</Label>
            <Select value={personId} onValueChange={setPersonId}>
              <SelectTrigger><SelectValue placeholder="Velg ansatt..." /></SelectTrigger>
              <SelectContent>
                {people.map((p) => (
                  <SelectItem key={p.person_id} value={p.person_id}>{p.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div>
            <Label className="text-xs">Ansatt</Label>
            <div className="h-10 px-3 flex items-center rounded-md border bg-muted/30 text-sm text-muted-foreground">
              Meg selv
            </div>
          </div>
        )}
        <div>
          <Label className="text-xs">Type fravær</Label>
          <Select value={absenceType} onValueChange={(v) => setAbsenceType(v as AbsenceType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(ABSENCE_TYPE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!activeCompanyId && (
        <div>
          <Label className="text-xs">Selskap</Label>
          <Select value={companyId} onValueChange={setCompanyId}>
            <SelectTrigger><SelectValue placeholder="Velg selskap..." /></SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Mode toggle */}
      <div className="grid grid-cols-3 gap-2">
        {modeButtons.map((b) => {
          const Icon = b.icon;
          const active = mode === b.id;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setMode(b.id)}
              className={cn(
                "flex items-center justify-center gap-2 h-11 rounded-lg border text-sm font-medium transition-colors",
                active
                  ? "border-2 text-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/40",
              )}
              style={active ? { borderColor: TEAL, color: TEAL } : undefined}
            >
              <Icon className="h-4 w-4" />
              {b.label}
            </button>
          );
        })}
      </div>

      {/* Calendar */}
      <div className="rounded-xl border bg-background p-4 select-none">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold capitalize">{monthLabel}</div>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setMonth(addMonths(month, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setMonth(addMonths(month, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-[40px_repeat(7,1fr)] gap-y-1 text-center text-[11px] text-muted-foreground mb-1">
          <div>Uke</div>
          {["ma", "ti", "on", "to", "fr", "lø", "sø"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        {weeks.map(({ weekNum, days }) => {
          const weekSelected = periods.some(
            (p) => p.kind === "week" && isSameDay(p.start, days[0]) && isSameDay(p.end, days[4]),
          );
          return (
            <div key={weekNum + "-" + fmtDate(days[0])} className="grid grid-cols-[40px_repeat(7,1fr)] gap-y-1 mb-1">
              <button
                type="button"
                disabled={mode !== "week"}
                onClick={() => mode === "week" && handleWeekClick(days)}
                className={cn(
                  "h-10 flex items-center justify-center text-xs rounded-md transition-colors",
                  mode === "week" ? "cursor-pointer hover:bg-muted text-foreground" : "text-muted-foreground cursor-default",
                  weekSelected && "font-semibold",
                )}
                style={weekSelected ? { backgroundColor: `${TEAL}20`, color: TEAL } : undefined}
              >
                {weekNum}
              </button>
              {days.map((d) => {
                const isOtherMonth = d.getMonth() !== month.getMonth();
                const existing = dayInExistingPeriods(d);
                const inDrag = dayInDragPreview(d);
                const selected = !!existing || inDrag;
                const isEdge = isRangeEdge(d) || (mode === "single" && existing);

                return (
                  <button
                    key={fmtDate(d)}
                    type="button"
                    onMouseDown={() => handleDayMouseDown(d)}
                    onMouseEnter={() => handleDayMouseEnter(d)}
                    disabled={mode === "week"}
                    className={cn(
                      "h-10 flex items-center justify-center text-sm rounded-md transition-colors",
                      isOtherMonth && "text-muted-foreground/50",
                      mode === "week" && "cursor-default",
                      mode !== "week" && !selected && "hover:bg-muted",
                    )}
                    style={
                      selected
                        ? isEdge
                          ? { backgroundColor: TEAL, color: "white" }
                          : { backgroundColor: `${TEAL}33`, color: TEAL }
                        : undefined
                    }
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
          );
        })}

        <div className="mt-3 text-[11px] text-muted-foreground">
          {mode === "range" && "Klikk og dra for å velge periode"}
          {mode === "week" && "Klikk ukenummer for å velge hele uken (man–fre)"}
          {mode === "single" && "Klikk dager for å velge enkeltvis"}
        </div>
      </div>

      {/* Selected periods */}
      {periods.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs">Valgte perioder ({periods.length})</Label>
          <div className="flex flex-wrap gap-2">
            {periods.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full text-xs font-medium border"
                style={{ backgroundColor: `${TEAL}15`, borderColor: `${TEAL}40`, color: TEAL }}
              >
                {p.label}
                <button
                  type="button"
                  onClick={() => removePeriod(p.id)}
                  className="h-5 w-5 inline-flex items-center justify-center rounded-full hover:bg-white/40"
                  aria-label="Fjern"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <Label className="text-xs">Kommentar (valgfritt)</Label>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          placeholder="F.eks. Familieferie, syk barn, etc."
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={submitting || periods.length === 0} style={{ backgroundColor: TEAL }}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
          Send forespørsel
        </Button>
      </div>
    </div>
  );
}
