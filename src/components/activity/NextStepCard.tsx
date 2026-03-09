import { useState } from "react";
import { format, isPast, isToday } from "date-fns";
import { nb } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CheckCircle2, Clock, AlertTriangle, ChevronDown, ChevronUp,
  Calendar, Edit3, CalendarClock, User,
} from "lucide-react";
import { NEXT_ACTION_TYPES } from "@/lib/lead-status";
import { cn } from "@/lib/utils";

interface NextStepCardProps {
  nextActionType: string | null;
  nextActionDate: string | null;
  nextActionNote: string | null;
  ownerName?: string;
  onComplete: () => void;
  onUpdate: (data: { type: string; date: string; note: string }) => void;
  onPostpone: (newDate: string) => void;
}

export function NextStepCard({
  nextActionType,
  nextActionDate,
  nextActionNote,
  ownerName,
  onComplete,
  onUpdate,
  onPostpone,
}: NextStepCardProps) {
  const [editing, setEditing] = useState(false);
  const [editType, setEditType] = useState(nextActionType || "");
  const [editDate, setEditDate] = useState(nextActionDate?.substring(0, 16) || "");
  const [editNote, setEditNote] = useState(nextActionNote || "");
  const [showPostpone, setShowPostpone] = useState(false);
  const [postponeDate, setPostponeDate] = useState("");

  const hasStep = !!nextActionType || !!nextActionDate;
  const actionLabel = NEXT_ACTION_TYPES.find(t => t.key === nextActionType)?.label || nextActionType || "Ikke satt";
  const isOverdue = nextActionDate && isPast(new Date(nextActionDate)) && !isToday(new Date(nextActionDate));
  const isDueToday = nextActionDate && isToday(new Date(nextActionDate));

  const borderColor = isOverdue
    ? "border-destructive/40"
    : isDueToday
      ? "border-amber-400/50"
      : "border-border/40";

  const bgColor = isOverdue
    ? "bg-destructive/[0.03]"
    : isDueToday
      ? "bg-amber-50/50 dark:bg-amber-950/10"
      : "bg-card";

  if (!hasStep && !editing) {
    return (
      <Card className="rounded-2xl shadow-sm border-dashed border-2 border-border/30">
        <CardContent className="py-5 flex flex-col items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground/60">Ingen neste steg definert</p>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs rounded-xl"
            onClick={() => {
              setEditing(true);
              setEditType("");
              setEditDate("");
              setEditNote("");
            }}
          >
            <Calendar className="h-3.5 w-3.5" /> Sett neste steg
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (editing) {
    return (
      <Card className="rounded-2xl shadow-sm border-primary/30">
        <CardContent className="py-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/70 flex items-center gap-1.5">
            <Edit3 className="h-3.5 w-3.5" /> Rediger neste steg
          </h3>
          <div className="space-y-1.5">
            <Label className="text-xs">Handlingstype</Label>
            <Select value={editType || "__none__"} onValueChange={v => setEditType(v === "__none__" ? "" : v)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Velg type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Velg type...</SelectItem>
                {NEXT_ACTION_TYPES.map(t => (
                  <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Frist</Label>
            <Input type="datetime-local" value={editDate} onChange={e => setEditDate(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notat (valgfritt)</Label>
            <Input value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="Kort beskrivelse..." className="h-9" />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              className="gap-1.5 text-xs rounded-xl flex-1"
              onClick={() => {
                onUpdate({ type: editType, date: editDate, note: editNote });
                setEditing(false);
              }}
              disabled={!editType}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Lagre
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs rounded-xl"
              onClick={() => setEditing(false)}
            >
              Avbryt
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("rounded-2xl shadow-sm transition-colors", borderColor, bgColor)}>
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center gap-1.5">
          {isOverdue ? (
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          ) : isDueToday ? (
            <Clock className="h-4 w-4 text-amber-500 shrink-0" />
          ) : (
            <Calendar className="h-4 w-4 text-primary/60 shrink-0" />
          )}
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/70">
            Neste steg
          </h3>
          {isOverdue && (
            <span className="text-[10px] font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded-full ml-auto">
              Forfalt
            </span>
          )}
          {isDueToday && !isOverdue && (
            <span className="text-[10px] font-medium text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/30 px-2 py-0.5 rounded-full ml-auto">
              I dag
            </span>
          )}
        </div>

        <div className="rounded-xl bg-background/60 p-3 space-y-1.5">
          <p className="text-sm font-semibold text-foreground">{actionLabel}</p>
          {nextActionDate && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CalendarClock className="h-3 w-3" />
              {format(new Date(nextActionDate), "EEEE d. MMMM yyyy 'kl.' HH:mm", { locale: nb })}
            </p>
          )}
          {ownerName && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <User className="h-3 w-3" /> {ownerName}
            </p>
          )}
          {nextActionNote && (
            <p className="text-xs text-muted-foreground/70 mt-1">{nextActionNote}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="gap-1.5 text-xs rounded-xl flex-1"
            onClick={onComplete}
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Fullfør steg
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs rounded-xl"
            onClick={() => {
              setEditType(nextActionType || "");
              setEditDate(nextActionDate?.substring(0, 16) || "");
              setEditNote(nextActionNote || "");
              setEditing(true);
            }}
          >
            <Edit3 className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs rounded-xl"
            onClick={() => setShowPostpone(!showPostpone)}
          >
            <CalendarClock className="h-3 w-3" />
          </Button>
        </div>

        {showPostpone && (
          <div className="flex items-center gap-2 pt-1">
            <Input
              type="datetime-local"
              value={postponeDate}
              onChange={e => setPostponeDate(e.target.value)}
              className="h-8 text-xs flex-1"
            />
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 rounded-xl"
              disabled={!postponeDate}
              onClick={() => {
                onPostpone(postponeDate);
                setShowPostpone(false);
                setPostponeDate("");
              }}
            >
              Utsett
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
