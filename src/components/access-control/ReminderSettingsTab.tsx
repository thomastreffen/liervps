import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Bell, Clock, ShieldAlert } from "lucide-react";
import { useReminderSettings, type ReminderSettings } from "@/hooks/useReminderSettings";
import { toast } from "sonner";

const TIME_OPTIONS = [
  { value: "15", label: "15 minutter" },
  { value: "30", label: "30 minutter" },
  { value: "60", label: "1 time" },
  { value: "120", label: "2 timer" },
  { value: "360", label: "6 timer" },
  { value: "720", label: "12 timer" },
  { value: "1440", label: "24 timer" },
  { value: "2880", label: "48 timer" },
  { value: "4320", label: "72 timer" },
];

export function ReminderSettingsTab() {
  const { settings, loading, saving, save } = useReminderSettings();
  const [form, setForm] = useState<ReminderSettings | null>(null);

  useEffect(() => {
    if (settings) setForm({ ...settings });
  }, [settings]);

  if (loading || !form) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const update = <K extends keyof ReminderSettings>(key: K, value: ReminderSettings[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const handleSave = async () => {
    if (!form) return;
    await save(form);
    toast.success("Påminnelsesinnstillinger lagret ✓");
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center justify-between rounded-xl border border-border/40 p-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bell className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">Automatiske påminnelser</p>
            <p className="text-xs text-muted-foreground">Send påminnelser ved manglende montørsvar</p>
          </div>
        </div>
        <Switch checked={form.enabled} onCheckedChange={(v) => update("enabled", v)} />
      </div>

      {form.enabled && (
        <>
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Påminnelsesintervaller (standard)
            </h3>

            <div className="space-y-3">
              {[1, 2, 3].map((n) => {
                const key = `reminder_${n}_minutes` as keyof ReminderSettings;
                return (
                  <div key={n} className="flex items-center gap-3">
                    <Label className="text-sm w-32 shrink-0">Påminnelse {n}</Label>
                    <Select
                      value={String(form[key])}
                      onValueChange={(v) => update(key, Number(v) as any)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <Label className="text-sm w-32 shrink-0">Maks påminnelser</Label>
              <Select value={String(form.max_reminders)} onValueChange={(v) => update("max_reminders", Number(v))}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5" />
              Eskalering
            </h3>

            <div className="flex items-center justify-between rounded-xl border border-border/40 p-4">
              <div>
                <p className="text-sm font-medium">Varsle leder</p>
                <p className="text-xs text-muted-foreground">Hvis montøren ikke svarer etter alle påminnelser</p>
              </div>
              <Switch checked={form.notify_manager} onCheckedChange={(v) => update("notify_manager", v)} />
            </div>

            {form.notify_manager && (
              <div className="flex items-center gap-3">
                <Label className="text-sm w-32 shrink-0">Ventetid etter siste</Label>
                <Select
                  value={String(form.escalation_delay_minutes)}
                  onValueChange={(v) => update("escalation_delay_minutes", Number(v))}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </section>
        </>
      )}

      <Button onClick={handleSave} disabled={saving} className="gap-1.5">
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        Lagre innstillinger
      </Button>
    </div>
  );
}
