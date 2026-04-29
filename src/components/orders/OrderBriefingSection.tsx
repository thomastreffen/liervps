import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ClipboardList, MapPin, User, Phone, Mail, Calendar, Tag,
  Paperclip, FileText, ExternalLink, KeyRound, Download,
} from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { buildEntries, findValueIn, findValuesIn } from "@/lib/order-field-resolver";

interface OrderBriefingSectionProps {
  /** Event/oppgave id — vi finner koblet bestilling automatisk */
  eventId: string;
  /** Vis som kompakt kort (skjul "Åpne bestilling"-knapp) */
  compact?: boolean;
}

interface BriefingData {
  submission: any;
  values: Array<{ field_key: string; value: unknown }>;
  attachments: Array<{
    id: string;
    file_name: string;
    file_path: string;
    mime_type: string | null;
    file_size: number | null;
  }>;
  latestCustomerMessage: { body: string | null; created_at: string } | null;
}

function formatBytes(b?: number | null): string {
  if (!b || b <= 0) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export function OrderBriefingSection({ eventId, compact = false }: OrderBriefingSectionProps) {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery<BriefingData | null>({
    queryKey: ["order-briefing", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      // Strategy: order can be linked to event in two ways:
      // 1. events.source_order_form_id  (created from order)
      // 2. order_form_submissions.linked_event_id  (manually linked)
      const { data: ev } = await supabase
        .from("events")
        .select("source_order_form_id")
        .eq("id", eventId)
        .maybeSingle();

      let submissionId: string | null = (ev as any)?.source_order_form_id || null;

      if (!submissionId) {
        const { data: linked } = await supabase
          .from("order_form_submissions")
          .select("id")
          .eq("linked_event_id", eventId)
          .is("deleted_at", null)
          .order("last_activity_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        submissionId = (linked as any)?.id || null;
      }

      if (!submissionId) return null;

      const subRes: any = await supabase
        .from("order_form_submissions")
        .select(
          "id, submission_no, status, priority, summary, submitter_name, submitter_email, notification_recipient_name, notification_recipient_email, notification_recipient_phone"
        )
        .eq("id", submissionId)
        .maybeSingle();
      const valRes: any = await supabase
        .from("order_form_submission_values")
        .select("field_key, value")
        .eq("submission_id", submissionId);
      const attRes: any = await supabase
        .from("order_form_submission_attachments")
        .select("id, file_name, file_path, mime_type, file_size")
        .eq("submission_id", submissionId)
        .order("uploaded_at", { ascending: true });
      const msgRes: any = await (supabase as any)
        .from("order_form_messages")
        .select("body, created_at, direction")
        .eq("submission_id", submissionId)
        .eq("direction", "inbound")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const submission = subRes.data;
      const values = valRes.data;
      const attachments = attRes.data;
      const msg = msgRes.data;

      return {
        submission,
        values: (values || []) as any,
        attachments: (attachments || []) as any,
        latestCustomerMessage: msg ? { body: (msg as any).body, created_at: (msg as any).created_at } : null,
      };
    },
  });

  const briefing = useMemo(() => {
    if (!data?.submission) return null;
    const sub = data.submission as any;
    const summary = (sub.summary as Record<string, unknown> | null) ?? {};
    const entries = buildEntries(data.values);

    const find = (...keys: string[]) => findValueIn(entries, summary, ...keys);
    const findAll = (...keys: string[]) => findValuesIn(entries, summary, ...keys);

    const tittel = find("oppdragstittel", "tittel", "prosjektnavn", "emne");
    const beskrivelse = find(
      "detaljert_arbeidsbeskrivelse",
      "arbeidsbeskrivelse",
      "beskrivelse",
      "problem_beskrivelse",
      "melding"
    );
    const oppdragssted = findAll("anleggsadresse", "oppdragssted", "adresse").join(", ");
    const kunde = find("kundenavn", "firmanavn", "bestiller_firma", "kunde", "company_name");
    const kontaktperson =
      find("kontaktperson_navn", "kontaktperson_kunde", "kontaktperson") ||
      sub.notification_recipient_name ||
      sub.submitter_name ||
      "";
    const kontaktTelefon =
      find("kontaktperson_telefon", "telefon_kunde", "telefon", "kontakt_telefon") ||
      sub.notification_recipient_phone ||
      "";
    const kontaktEpost =
      find("kontaktperson_epost", "epost_kunde", "epost", "kontakt_epost") ||
      sub.notification_recipient_email ||
      sub.submitter_email ||
      "";
    const referanse = find("referanse_po", "fakturamerking", "midlertidig_referanse", "po", "referanse");
    const tilgang = find("tilgang", "tilgang_notat", "adgang", "nokler", "noekler");
    const materiell = find("materiell", "materialer", "verktoy", "verktoey", "medbring");
    const onsketDato = find("oensket_dato", "onsket_utfort_dato", "onsket_dato", "dato");
    const onsketTid = find("oensket_tid", "onsket_klokkeslett", "onsket_tid", "tidsvindu");
    const hastegrad = find("hastegrad", "prioritet");

    return {
      tittel,
      beskrivelse,
      oppdragssted,
      kunde,
      kontaktperson,
      kontaktTelefon,
      kontaktEpost,
      referanse,
      tilgang,
      materiell,
      onsketDato,
      onsketTid,
      hastegrad,
    };
  }, [data]);

  if (isLoading || !data?.submission || !briefing) return null;

  const sub = data.submission as any;

  const handleOpenAttachment = async (path: string) => {
    const { data: signed } = await supabase.storage
      .from("order-form-attachments")
      .createSignedUrl(path, 60 * 10);
    if (signed?.signedUrl) {
      window.open(signed.signedUrl, "_blank");
    }
  };

  return (
    <Card className="border-primary/20 bg-primary/[0.02]">
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          Fra bestilling
          <Badge variant="outline" className="text-[10px] h-4 font-mono">
            {sub.submission_no}
          </Badge>
        </CardTitle>
        {!compact && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => navigate(`/orders/${sub.id}`)}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Åpne bestilling
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        {briefing.tittel && (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Oppdrag
            </div>
            <div className="font-medium">{briefing.tittel}</div>
          </div>
        )}

        {briefing.beskrivelse && (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <FileText className="h-3 w-3" /> Arbeidsbeskrivelse
            </div>
            <div className="whitespace-pre-wrap text-sm leading-snug mt-0.5">
              {briefing.beskrivelse}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
          {briefing.kunde && (
            <InfoRow icon={<User className="h-3.5 w-3.5" />} label="Kunde" value={briefing.kunde} />
          )}
          {briefing.oppdragssted && (
            <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="Oppdragssted" value={briefing.oppdragssted} />
          )}
          {briefing.kontaktperson && (
            <InfoRow icon={<User className="h-3.5 w-3.5" />} label="Kontaktperson" value={briefing.kontaktperson} />
          )}
          {briefing.kontaktTelefon && (
            <InfoRow
              icon={<Phone className="h-3.5 w-3.5" />}
              label="Telefon"
              value={
                <a href={`tel:${briefing.kontaktTelefon}`} className="text-primary hover:underline">
                  {briefing.kontaktTelefon}
                </a>
              }
            />
          )}
          {briefing.kontaktEpost && (
            <InfoRow
              icon={<Mail className="h-3.5 w-3.5" />}
              label="E-post"
              value={
                <a href={`mailto:${briefing.kontaktEpost}`} className="text-primary hover:underline">
                  {briefing.kontaktEpost}
                </a>
              }
            />
          )}
          {(briefing.onsketDato || briefing.onsketTid) && (
            <InfoRow
              icon={<Calendar className="h-3.5 w-3.5" />}
              label="Ønsket utført"
              value={[briefing.onsketDato, briefing.onsketTid].filter(Boolean).join(" – ")}
            />
          )}
          {briefing.referanse && (
            <InfoRow
              icon={<Tag className="h-3.5 w-3.5" />}
              label="PO / referanse"
              value={briefing.referanse}
            />
          )}
          {briefing.hastegrad && (
            <InfoRow
              icon={<Tag className="h-3.5 w-3.5" />}
              label="Hastegrad"
              value={briefing.hastegrad}
            />
          )}
        </div>

        {(briefing.tilgang || briefing.materiell) && (
          <div className="space-y-2 pt-1 border-t border-border/50">
            {briefing.materiell && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Materiell / hva som må medbringes
                </div>
                <div className="text-sm whitespace-pre-wrap leading-snug">{briefing.materiell}</div>
              </div>
            )}
            {briefing.tilgang && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <KeyRound className="h-3 w-3" /> Tilgang / nøkler
                </div>
                <div className="text-sm whitespace-pre-wrap leading-snug">{briefing.tilgang}</div>
              </div>
            )}
          </div>
        )}

        {data.attachments.length > 0 && (
          <div className="pt-1 border-t border-border/50">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1 mb-1.5">
              <Paperclip className="h-3 w-3" /> Vedlegg fra bestillingen ({data.attachments.length})
            </div>
            <div className="space-y-1">
              {data.attachments.map((att) => (
                <button
                  key={att.id}
                  onClick={() => handleOpenAttachment(att.file_path)}
                  className="w-full flex items-center gap-2 rounded-md border bg-background hover:bg-accent/40 px-2.5 py-1.5 text-left text-sm transition"
                >
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate flex-1 font-medium">{att.file_name}</span>
                  {att.file_size && (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatBytes(att.file_size)}
                    </span>
                  )}
                  <Download className="h-3 w-3 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {data.latestCustomerMessage?.body && (
          <div className="pt-1 border-t border-border/50">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
              Siste melding fra kunde ·{" "}
              {format(new Date(data.latestCustomerMessage.created_at), "d. MMM HH:mm", { locale: nb })}
            </div>
            <div className="text-sm bg-muted/40 rounded-md px-2.5 py-1.5 whitespace-pre-wrap leading-snug line-clamp-4">
              {data.latestCustomerMessage.body}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-sm break-words">{value}</div>
      </div>
    </div>
  );
}
