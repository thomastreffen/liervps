import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | null;
}

export function CatalogSettingsDialog({ open, onOpenChange, companyId }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: "Bestillinger og henvendelser",
    subtitle: "Velg riktig kategori og skjema for å sende inn en bestilling, melding eller forespørsel.",
    help_text: "",
    contact_info: "",
  });

  const { data: settings } = useQuery({
    queryKey: ["catalog-settings", companyId],
    enabled: !!companyId && open,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("order_form_catalog_settings")
        .select("*")
        .eq("company_id", companyId!)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (settings) {
      setForm({
        title: settings.title || "",
        subtitle: settings.subtitle || "",
        help_text: settings.help_text || "",
        contact_info: settings.contact_info || "",
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        company_id: companyId!,
        title: form.title,
        subtitle: form.subtitle,
        help_text: form.help_text || null,
        contact_info: form.contact_info || null,
        updated_at: new Date().toISOString(),
      };
      if (settings?.id) {
        const { error } = await (supabase as any)
          .from("order_form_catalog_settings")
          .update(payload)
          .eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("order_form_catalog_settings")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalog-settings"] });
      toast.success("Innstillinger lagret");
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Portalinnstillinger (/bestilling)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Hovedtittel</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            />
          </div>
          <div>
            <Label>Ingress / undertekst</Label>
            <Textarea
              value={form.subtitle}
              onChange={(e) => setForm((p) => ({ ...p, subtitle: e.target.value }))}
              rows={2}
            />
          </div>
          <div>
            <Label>Hjelpetekst (valgfritt)</Label>
            <Textarea
              value={form.help_text}
              onChange={(e) => setForm((p) => ({ ...p, help_text: e.target.value }))}
              rows={2}
              placeholder="Ekstra veiledning for innsendere..."
            />
          </div>
          <div>
            <Label>Kontaktinfo (valgfritt)</Label>
            <Input
              value={form.contact_info}
              onChange={(e) => setForm((p) => ({ ...p, contact_info: e.target.value }))}
              placeholder="F.eks. e-post eller telefonnummer"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button onClick={() => saveMutation.mutate()}>Lagre</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
