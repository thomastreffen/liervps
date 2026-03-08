import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePortal } from "@/hooks/usePortal";
import { Bell, Mail, Loader2, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Prefs {
  notify_new_report: boolean;
  notify_pending_approval: boolean;
  notify_new_message: boolean;
  notify_new_document: boolean;
  notify_project_update: boolean;
  notify_weekly_summary: boolean;
  channel_email: boolean;
  channel_portal: boolean;
}

const DEFAULT_PREFS: Prefs = {
  notify_new_report: true,
  notify_pending_approval: true,
  notify_new_message: true,
  notify_new_document: false,
  notify_project_update: false,
  notify_weekly_summary: false,
  channel_email: true,
  channel_portal: true,
};

const NOTIFICATION_OPTIONS: { key: keyof Prefs; label: string; description: string; alwaysOn?: boolean }[] = [
  { key: "notify_new_report", label: "Nye rapporter og dokumentasjon", description: "Når en ny rapport eller servicejournal er klar til gjennomgang." },
  { key: "notify_pending_approval", label: "Venter på min godkjenning", description: "Når noe krever din godkjenning. Denne kan ikke deaktiveres.", alwaysOn: true },
  { key: "notify_new_message", label: "Nye meldinger", description: "Når du mottar en ny melding i kundeportalen." },
  { key: "notify_new_document", label: "Nye dokumenter", description: "Når nye dokumenter eller bilder legges til på et oppdrag." },
  { key: "notify_project_update", label: "Oppdragsoppdateringer", description: "Når det skjer statusendringer på dine oppdrag." },
  { key: "notify_weekly_summary", label: "Ukentlig oppsummering", description: "En samlet oversikt over uken som var." },
];

export default function PortalNotificationSettings() {
  const { user } = usePortal();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("portal_notification_preferences")
        .select("*")
        .eq("portal_user_id", user.id)
        .maybeSingle();

      if (data) {
        setPrefs({
          notify_new_report: data.notify_new_report,
          notify_pending_approval: data.notify_pending_approval,
          notify_new_message: data.notify_new_message,
          notify_new_document: data.notify_new_document,
          notify_project_update: data.notify_project_update,
          notify_weekly_summary: data.notify_weekly_summary,
          channel_email: data.channel_email,
          channel_portal: data.channel_portal,
        });
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const updatePref = async (key: keyof Prefs, value: boolean) => {
    if (!user) return;

    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    setSaving(true);

    const { error } = await supabase
      .from("portal_notification_preferences")
      .upsert({
        portal_user_id: user.id,
        ...updated,
        updated_at: new Date().toISOString(),
      }, { onConflict: "portal_user_id" });

    setSaving(false);

    if (error) {
      toast.error("Kunne ikke lagre innstillinger");
      setPrefs(prefs); // revert
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2].map(i => <div key={i} className="h-20 rounded-2xl bg-muted" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Varslingsinnstillinger</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Velg hvilke varsler du ønsker å motta. Endringer lagres automatisk.
        </p>
      </div>

      {/* Notification types */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Varsler
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {NOTIFICATION_OPTIONS.map((opt) => (
            <div key={opt.key} className="flex items-start justify-between gap-4 rounded-xl border p-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-semibold text-card-foreground">{opt.label}</Label>
                  {opt.alwaysOn && (
                    <Badge variant="secondary" className="text-[10px]">Alltid på</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{opt.description}</p>
              </div>
              <Switch
                checked={opt.alwaysOn ? true : prefs[opt.key]}
                disabled={opt.alwaysOn || saving}
                onCheckedChange={(val) => updatePref(opt.key, val)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Channel preferences */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Kanaler
          </CardTitle>
          <p className="text-xs text-muted-foreground">Velg hvordan du vil motta varsler.</p>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="flex items-center justify-between rounded-xl border p-4">
            <div>
              <Label className="text-sm font-semibold text-card-foreground">E-post</Label>
              <p className="text-xs text-muted-foreground">Motta varsler på e-post</p>
            </div>
            <Switch
              checked={prefs.channel_email}
              disabled={saving}
              onCheckedChange={(val) => updatePref("channel_email", val)}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border p-4">
            <div>
              <Label className="text-sm font-semibold text-card-foreground">I portalen</Label>
              <p className="text-xs text-muted-foreground">Vis varsler i kundeportalen</p>
            </div>
            <Switch
              checked={prefs.channel_portal}
              disabled={saving}
              onCheckedChange={(val) => updatePref("channel_portal", val)}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border p-4 opacity-50">
            <div>
              <Label className="text-sm font-semibold text-card-foreground">SMS</Label>
              <p className="text-xs text-muted-foreground">Kommer snart</p>
            </div>
            <Switch checked={false} disabled />
          </div>
        </CardContent>
      </Card>

      {saving && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Lagrer...
        </div>
      )}
    </div>
  );
}
