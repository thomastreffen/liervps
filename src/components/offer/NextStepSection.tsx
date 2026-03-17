import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarClock, CheckCircle2, Edit2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

interface NextStepSectionProps {
  nextStep: string | null;
  nextStepAt: string | null;
  onSave: (nextStep: string, nextStepAt: string | null) => Promise<void>;
  readOnly?: boolean;
}

export function NextStepSection({ nextStep, nextStepAt, onSave, readOnly }: NextStepSectionProps) {
  const [editing, setEditing] = useState(false);
  const [step, setStep] = useState(nextStep || "");
  const [date, setDate] = useState(nextStepAt ? nextStepAt.split("T")[0] : "");
  const [saving, setSaving] = useState(false);

  const isOverdue = nextStepAt && new Date(nextStepAt).getTime() < Date.now();
  const isEmpty = !nextStep;

  const handleSave = async () => {
    setSaving(true);
    await onSave(step, date ? new Date(date).toISOString() : null);
    setSaving(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">Neste steg</h4>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={step}
            onChange={(e) => setStep(e.target.value)}
            placeholder="F.eks. Ring kunden, send revidert tilbud..."
            className="flex-1"
            autoFocus
          />
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-[160px]"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} disabled={saving || !step.trim()} className="rounded-lg">
            {saving ? "Lagrer..." : "Lagre"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="rounded-lg">
            Avbryt
          </Button>
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <button
        onClick={() => !readOnly && setEditing(true)}
        className="w-full rounded-xl border-2 border-dashed border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-950/30 p-4 flex items-center gap-3 hover:bg-orange-50 dark:hover:bg-orange-950/50 transition-colors"
        disabled={readOnly}
      >
        <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
        <div className="text-left">
          <p className="text-sm font-medium text-orange-800 dark:text-orange-200">Ingen neste steg definert</p>
          <p className="text-xs text-orange-600 dark:text-orange-400">Klikk for å legge til oppfølging</p>
        </div>
      </button>
    );
  }

  return (
    <div className={`rounded-xl border p-4 flex items-center gap-3 ${
      isOverdue
        ? "border-destructive/40 bg-destructive/5"
        : "border-primary/30 bg-primary/5"
    }`}>
      <CalendarClock className={`h-5 w-5 shrink-0 ${isOverdue ? "text-destructive" : "text-primary"}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{nextStep}</p>
        {nextStepAt && (
          <p className={`text-xs ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
            {isOverdue ? "⚠ Forfalt: " : ""}
            {format(new Date(nextStepAt), "d. MMMM yyyy", { locale: nb })}
          </p>
        )}
      </div>
      {!readOnly && (
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setEditing(true)}>
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg text-green-600"
            onClick={() => onSave("", null)}
            title="Marker som fullført"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
