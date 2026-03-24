import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, AlertTriangle, Check } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";

interface TripletexExportPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string;
  values: Record<string, any>;
  summary: Record<string, any> | null;
  submissionNo: string;
}

interface ExportField {
  key: string;
  label: string;
  tripletexColumn: string;
  value: string;
  required: boolean;
}

export function TripletexExportPanel({
  open, onOpenChange, submissionId, values, summary, submissionNo,
}: TripletexExportPanelProps) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const defaultFields = useMemo((): ExportField[] => {
    const kundenavn = values.kundenavn || summary?.kundenavn || "";
    const oppdragstittel = values.oppdragstittel || summary?.oppdragstittel || "";
    const onsketDato = values.onsket_utfort_dato || "";
    const kontaktperson = values.kontaktperson_kunde || "";
    const [fornavn = "", ...etternavn] = kontaktperson.split(" ");
    const adresse = values.anleggsadresse || "";
    const beskrivelse = values.detaljert_arbeidsbeskrivelse || "";
    const referanse = values.referanse_po || values.midlertidig_referanse || "";
    const bestillingstype = values.bestillingstype || "";

    return [
      { key: "prosjektnavn", label: "Prosjektnavn", tripletexColumn: "Prosjektnavn", value: kundenavn ? `${kundenavn} - ${oppdragstittel}` : oppdragstittel, required: true },
      { key: "prosjektnummer", label: "Prosjektnummer", tripletexColumn: "Prosjektnummer", value: "", required: false },
      { key: "startdato", label: "Startdato", tripletexColumn: "Startdato", value: onsketDato || format(new Date(), "yyyy-MM-dd"), required: false },
      { key: "sluttdato", label: "Sluttdato", tripletexColumn: "Sluttdato", value: "", required: false },
      { key: "kundenavn", label: "Kundenavn", tripletexColumn: "Kundenavn", value: kundenavn, required: true },
      { key: "kundenummer", label: "Kundenummer", tripletexColumn: "Kundenummer", value: "", required: false },
      { key: "kontakt_fornavn", label: "Kontakt fornavn", tripletexColumn: "Kontakt fornavn", value: fornavn, required: false },
      { key: "kontakt_etternavn", label: "Kontakt etternavn", tripletexColumn: "Kontakt etternavn", value: etternavn.join(" "), required: false },
      { key: "referanse", label: "Referanse", tripletexColumn: "Referanse", value: referanse, required: false },
      { key: "prosjektbeskrivelse", label: "Prosjektbeskrivelse", tripletexColumn: "Prosjektbeskrivelse", value: `${beskrivelse}\n\nAdresse: ${adresse}`.trim(), required: false },
      { key: "prosjektleder", label: "Prosjektleder", tripletexColumn: "Prosjektleder", value: "", required: false },
      { key: "avdeling", label: "Avdeling", tripletexColumn: "Avdeling", value: "", required: false },
      { key: "avdelingsnummer", label: "Avdelingsnummer", tripletexColumn: "Avdelingsnummer", value: "", required: false },
      { key: "kategori", label: "Kategori", tripletexColumn: "Kategori", value: "", required: false },
      { key: "internprosjekt", label: "Internprosjekt", tripletexColumn: "Internprosjekt", value: bestillingstype === "intern" ? "Ja" : "Nei", required: false },
      { key: "valuta", label: "Valuta", tripletexColumn: "Valuta", value: "NOK", required: false },
    ];
  }, [values, summary]);

  const [fields, setFields] = useState<ExportField[]>(defaultFields);

  const updateField = (key: string, value: string) => {
    setFields((prev) => prev.map((f) => f.key === key ? { ...f, value } : f));
  };

  const missingRequired = fields.filter((f) => f.required && !f.value.trim());

  const generateCSV = () => {
    const headers = fields.map((f) => f.tripletexColumn);
    const values = fields.map((f) => {
      const v = f.value.replace(/"/g, '""');
      return v.includes(";") || v.includes('"') || v.includes("\n") ? `"${v}"` : v;
    });
    return headers.join(";") + "\n" + values.join(";");
  };

  const exportMutation = useMutation({
    mutationFn: async () => {
      const csv = generateCSV();
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tripletex-import-${submissionNo}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      // Log export
      await supabase.from("order_form_activity_log").insert({
        submission_id: submissionId,
        event_type: "exported_to_tripletex",
        payload: { fields: Object.fromEntries(fields.map((f) => [f.key, f.value])) },
        created_by: user?.id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-form-activity", submissionId] });
      toast.success("Tripletex-fil eksportert");
      onOpenChange(false);
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Eksporter til Tripletex</SheetTitle>
          <SheetDescription>
            Generer CSV-fil for prosjektimport i Tripletex. Juster verdier før eksport.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {missingRequired.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-amber-800">Manglende felt</p>
                <ul className="text-[11px] text-amber-700 mt-1 space-y-0.5">
                  {missingRequired.map((f) => <li key={f.key}>• {f.label}</li>)}
                </ul>
              </div>
            </div>
          )}

          {fields.map((field) => (
            <div key={field.key}>
              <Label className="text-xs flex items-center gap-1.5">
                {field.label}
                {field.required && <span className="text-destructive">*</span>}
                <Badge variant="outline" className="text-[8px] ml-auto">{field.tripletexColumn}</Badge>
              </Label>
              <Input
                value={field.value}
                onChange={(e) => updateField(field.key, e.target.value)}
                className="h-8 text-sm mt-1"
                placeholder={`Fyll inn ${field.label.toLowerCase()}`}
              />
            </div>
          ))}

          <Separator />

          <Button
            className="w-full"
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
          >
            <Download className="h-4 w-4 mr-1.5" />
            Last ned Tripletex CSV
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
