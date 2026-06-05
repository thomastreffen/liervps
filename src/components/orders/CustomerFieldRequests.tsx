import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { HelpCircle, CheckCircle2, Send } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

interface Props {
  token: string;
  submitterName?: string | null;
}

export function CustomerFieldRequests({ token, submitterName }: Props) {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, any>>({});

  const { data: requests = [] } = useQuery({
    queryKey: ["tracking-field-requests", token],
    enabled: !!token,
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("get_field_requests_by_token", { _token: token });
      return (data || []) as any[];
    },
    refetchInterval: 30000,
  });

  const open = useMemo(() => requests.filter((r: any) => r.status === "open"), [requests]);
  const answered = useMemo(() => requests.filter((r: any) => r.status === "answered"), [requests]);

  useEffect(() => {
    setDrafts(prev => {
      const next = { ...prev };
      let changed = false;
      for (const r of open) {
        if (!(r.id in next)) {
          next[r.id] = "";
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [open]);

  const submit = useMutation({
    mutationFn: async (req: any) => {
      const raw = drafts[req.id];
      if (raw == null || raw === "") throw new Error("Fyll inn et svar");
      let value: any = raw;
      if (req.field_type === "number") value = Number(raw);
      const { data, error } = await (supabase as any).rpc("answer_field_request_by_token", {
        _token: token,
        _request_id: req.id,
        _value: JSON.stringify(value === null ? null : value) === "null"
          ? null
          : (typeof value === "string" ? value : value),
        _submitter_name: submitterName || null,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return req;
    },
    onSuccess: (req) => {
      toast.success(`Takk! "${req.field_label}" er lagret.`);
      qc.invalidateQueries({ queryKey: ["tracking-field-requests", token] });
      qc.invalidateQueries({ queryKey: ["tracking-timeline", token] });
      qc.invalidateQueries({ queryKey: ["tracking-values", token] });
    },
    onError: (e: any) => toast.error(e?.message || "Kunne ikke lagre"),
  });

  if (open.length === 0 && answered.length === 0) return null;

  const renderInput = (r: any) => {
    const v = drafts[r.id] ?? "";
    const set = (val: any) => setDrafts(prev => ({ ...prev, [r.id]: val }));
    switch (r.field_type) {
      case "long_text":
        return <Textarea value={v} onChange={(e) => set(e.target.value)} className="min-h-[80px]" />;
      case "number":
        return <Input type="number" value={v} onChange={(e) => set(e.target.value)} />;
      case "date":
        return <Input type="date" value={v} onChange={(e) => set(e.target.value)} />;
      case "email":
        return <Input type="email" value={v} onChange={(e) => set(e.target.value)} />;
      case "phone":
        return <Input type="tel" value={v} onChange={(e) => set(e.target.value)} />;
      default:
        return <Input value={v} onChange={(e) => set(e.target.value)} />;
    }
  };

  return (
    <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
      <CardContent className="pt-5 pb-4 space-y-4">
        <div className="flex items-start gap-3">
          <HelpCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Vi trenger litt mer informasjon for å komme videre
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              Fyll inn feltene under, så går vi videre med bestillingen.
            </p>
          </div>
        </div>

        {open.length > 0 && (
          <div className="space-y-3">
            {open.map((r: any) => (
              <div key={r.id} className="bg-background rounded-md border p-3 space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  {r.field_label}
                  {r.is_free_text && (
                    <Badge variant="outline" className="text-[9px] h-4">Tilleggsspørsmål</Badge>
                  )}
                </Label>
                {renderInput(r)}
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => submit.mutate(r)}
                    disabled={submit.isPending || !drafts[r.id]}
                  >
                    <Send className="h-3 w-3 mr-1.5" />
                    Lagre svar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {answered.length > 0 && (
          <div className="pt-2 border-t border-amber-200 space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Allerede besvart
            </p>
            {answered.map((r: any) => (
              <div key={r.id} className="text-xs flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-medium">{r.field_label}:</span>{" "}
                  <span className="text-foreground/80">
                    {(() => {
                      const v = r.answer_value;
                      if (v == null) return "(tom)";
                      if (typeof v === "string") return v;
                      if (typeof v === "object") return JSON.stringify(v);
                      return String(v);
                    })()}
                  </span>
                  {r.answered_at && (
                    <span className="text-muted-foreground ml-2 text-[10px]">
                      {format(new Date(r.answered_at), "d. MMM HH:mm", { locale: nb })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
