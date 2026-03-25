import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ReminderProfile = "company_default" | "standard" | "urgent" | "none" | "custom";

export interface ReminderConfig {
  responseRequired: boolean;
  profile: ReminderProfile;
  custom?: {
    reminder1Minutes: number;
    reminder2Minutes: number;
    reminder3Minutes: number;
    notifyManager: boolean;
  };
}

const PROFILES: Record<Exclude<ReminderProfile, "custom">, { label: string; desc: string }> = {
  company_default: { label: "Selskapsstandard", desc: "Bruk globale innstillinger" },
  standard: { label: "Standard", desc: "2t → 24t → 48t" },
  urgent: { label: "Haster", desc: "30min → 2t → 6t" },
  none: { label: "Ingen påminnelse", desc: "Ingen automatisk oppfølging" },
};

const TIME_OPTIONS = [
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "60", label: "1 time" },
  { value: "120", label: "2 timer" },
  { value: "360", label: "6 timer" },
  { value: "720", label: "12 timer" },
  { value: "1440", label: "24 timer" },
  { value: "2880", label: "48 timer" },
];

interface Props {
  value: ReminderConfig;
  onChange: (config: ReminderConfig) => void;
  disabled?: boolean;
  /** When true, shows a warning that company reminders are disabled */
  companyRemindersDisabled?: boolean;
}

export function ReminderProfileSelect({ value, onChange, disabled, companyRemindersDisabled }: Props) {
  const [showCustom] = useState(value.profile === "custom");

  const setProfile = (p: ReminderProfile) => {
    if (p === "none") {
      onChange({ responseRequired: false, profile: "none" });
    } else if (p === "custom") {
      onChange({
        responseRequired: true,
        profile: "custom",
        custom: value.custom || { reminder1Minutes: 120, reminder2Minutes: 1440, reminder3Minutes: 2880, notifyManager: false },
      });
    } else {
      onChange({ responseRequired: true, profile: p });
    }
  };

  return (
    <section className="space-y-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
        <Bell className="h-3 w-3" />
        Svar og påminnelse
      </h3>

      {/* Company reminders disabled warning */}
      {companyRemindersDisabled && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-xs text-amber-700 dark:text-amber-400">
            Påminnelser er deaktivert i selskapsinnstillinger
          </span>
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl border border-border/40 p-3">
        <div>
          <p className="text-xs font-medium">Krev bekreftelse fra montør</p>
          <p className="text-[10px] text-muted-foreground">Montør må godkjenne oppdraget</p>
        </div>
        <Switch
          checked={value.responseRequired}
          onCheckedChange={(v) => onChange({ ...value, responseRequired: v, profile: v ? value.profile === "none" ? "company_default" : value.profile : "none" })}
          disabled={disabled}
        />
      </div>

      {value.responseRequired && (
        <>
          {/* Profile badge for selected profile */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Valgt:</span>
            <span className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium",
              value.profile === "urgent" && "bg-amber-500/10 text-amber-700 dark:text-amber-400",
              value.profile === "standard" && "bg-blue-500/10 text-blue-700 dark:text-blue-400",
              value.profile === "company_default" && "bg-primary/10 text-primary",
              value.profile === "none" && "bg-muted text-muted-foreground",
              value.profile === "custom" && "bg-violet-500/10 text-violet-700 dark:text-violet-400",
            )}>
              {value.profile === "custom" ? "Egendefinert" : PROFILES[value.profile]?.label}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(PROFILES) as [Exclude<ReminderProfile, "custom">, typeof PROFILES["standard"]][]).map(([key, cfg]) => (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => setProfile(key)}
                className={cn(
                  "rounded-xl border p-2.5 text-left transition-all",
                  value.profile === key
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border/40 hover:border-border/70"
                )}
              >
                <span className="text-xs font-medium block">{cfg.label}</span>
                <span className="text-[10px] text-muted-foreground block leading-tight">{cfg.desc}</span>
              </button>
            ))}
            <button
              type="button"
              disabled={disabled}
              onClick={() => setProfile("custom")}
              className={cn(
                "rounded-xl border p-2.5 text-left transition-all col-span-2",
                value.profile === "custom"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border/40 hover:border-border/70"
              )}
            >
              <span className="text-xs font-medium block">Egendefinert</span>
              <span className="text-[10px] text-muted-foreground block leading-tight">Tilpass intervaller</span>
            </button>
          </div>

          {value.profile === "custom" && value.custom && (
            <div className="space-y-2 rounded-lg border border-border/40 bg-card p-3">
              {(["reminder1Minutes", "reminder2Minutes", "reminder3Minutes"] as const).map((key, i) => (
                <div key={key} className="flex items-center gap-2">
                  <Label className="text-xs w-24 shrink-0">Påminnelse {i + 1}</Label>
                  <Select
                    value={String(value.custom![key])}
                    onValueChange={(v) =>
                      onChange({
                        ...value,
                        custom: { ...value.custom!, [key]: Number(v) },
                      })
                    }
                    disabled={disabled}
                  >
                    <SelectTrigger className="flex-1 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs">Varsle leder</span>
                <Switch
                  checked={value.custom.notifyManager}
                  onCheckedChange={(v) =>
                    onChange({ ...value, custom: { ...value.custom!, notifyManager: v } })
                  }
                  disabled={disabled}
                />
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
