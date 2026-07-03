import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { OFFER_STATUS_CONFIG, type OfferStatus } from "@/lib/offer-status";
import {
  Loader2, CheckCircle2, FileText, AlertTriangle, XCircle,
  Download, Building2, Mail, Phone, Globe, MapPin,
} from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface OfferData {
  id: string;
  offer_number: string;
  status: OfferStatus;
  total_ex_vat: number;
  total_inc_vat: number;
  valid_until: string | null;
  created_at: string;
  generated_pdf_url: string | null;
  accepted_at: string | null;
  accepted_name: string | null;
  accepted_email: string | null;
  rejected_at: string | null;
  rejected_comment: string | null;
  calculations: {
    customer_name: string;
    customer_email: string | null;
    project_title: string;
    description: string | null;
  };
}

interface LineItem {
  id: string;
  title: string;
  description: string | null;
  type: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  total_price: number;
}

interface CompanyInfo {
  company_name: string;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  org_number: string | null;
  website: string | null;
}

export default function OfferAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const [offer, setOffer] = useState<OfferData | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Accept dialog
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [acceptName, setAcceptName] = useState("");
  const [acceptEmail, setAcceptEmail] = useState("");
  const [acceptComment, setAcceptComment] = useState("");
  const [acceptConfirmed, setAcceptConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Reject dialog
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState("");

  // Success state
  const [actionResult, setActionResult] = useState<"accepted" | "rejected" | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/offer-public-view?token=${encodeURIComponent(token)}`,
          { headers: { "Content-Type": "application/json" } }
        );
        if (!res.ok) {
          setError("Tilbudet ble ikke funnet eller lenken er ugyldig.");
          setLoading(false);
          return;
        }
        const data = await res.json();
        setOffer(data.offer);
        setItems(data.items || []);
        setCompany(data.company);

        if (data.offer?.status === "accepted") setActionResult("accepted");
        if (data.offer?.status === "rejected") setActionResult("rejected");
      } catch {
        setError("Kunne ikke laste tilbudet. Prøv igjen senere.");
      }
      setLoading(false);
    })();
  }, [token]);

  const handleAccept = async () => {
    if (!acceptConfirmed || !acceptName.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/offer-public-view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          action: "accept",
          name: acceptName.trim(),
          email: acceptEmail.trim(),
          comment: acceptComment.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setActionResult("accepted");
        setAcceptOpen(false);
        setOffer((prev) => prev ? { ...prev, status: "accepted", accepted_at: new Date().toISOString(), accepted_name: acceptName } : null);
      } else {
        setError(data.error || "Kunne ikke godkjenne tilbudet.");
      }
    } catch {
      setError("Noe gikk galt. Prøv igjen.");
    }
    setSubmitting(false);
  };

  const handleReject = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/offer-public-view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          action: "reject",
          comment: rejectComment.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setActionResult("rejected");
        setRejectOpen(false);
        setOffer((prev) => prev ? { ...prev, status: "rejected", rejected_at: new Date().toISOString() } : null);
      } else {
        setError(data.error || "Kunne ikke avslå tilbudet.");
      }
    } catch {
      setError("Noe gikk galt. Prøv igjen.");
    }
    setSubmitting(false);
  };

  const fmtCurrency = (v: number) =>
    `kr ${v.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Laster tilbud...</p>
        </div>
      </div>
    );
  }

  if (error && !offer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full rounded-2xl">
          <CardContent className="p-8 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 mx-auto text-destructive" />
            <h2 className="text-lg font-bold">Ugyldig lenke</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!offer) return null;

  const isExpired = offer.valid_until && new Date(offer.valid_until) < new Date();
  const canAct = !["accepted", "rejected"].includes(offer.status) && !isExpired;
  const calc = offer.calculations;

  return (
    <div className="min-h-screen bg-background">
      {/* Company header */}
      <header className="border-b border-border/40 bg-card">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center gap-4">
            {company?.logo_url ? (
              <img src={company.logo_url} alt={company.company_name} className="h-10 sm:h-12 object-contain" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
            )}
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-foreground">
                {company?.company_name || "Lier Varmepumpeservice AS"}
              </h1>
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                {company?.phone && (
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{company.phone}</span>
                )}
                {company?.email && (
                  <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{company.email}</span>
                )}
                {company?.website && (
                  <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{company.website}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        {/* Offer header card */}
        <Card className="rounded-2xl border-border/40 shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-primary to-primary/40" />
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Tilbud</p>
                <CardTitle className="text-xl">{offer.offer_number}</CardTitle>
              </div>
              <Badge className={`${OFFER_STATUS_CONFIG[offer.status]?.className} text-sm px-3 py-1 rounded-lg`}>
                {OFFER_STATUS_CONFIG[offer.status]?.label || offer.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Kunde</p>
                <p className="font-medium">{calc.customer_name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Prosjekt</p>
                <p className="font-medium">{calc.project_title}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Dato</p>
                <p className="font-medium">{format(new Date(offer.created_at), "d. MMMM yyyy", { locale: nb })}</p>
              </div>
              {offer.valid_until && (
                <div>
                  <p className="text-xs text-muted-foreground">Gyldig til</p>
                  <p className={`font-medium ${isExpired ? "text-destructive" : ""}`}>
                    {format(new Date(offer.valid_until), "d. MMMM yyyy", { locale: nb })}
                    {isExpired && " (Utløpt)"}
                  </p>
                </div>
              )}
            </div>
            {calc.description && (
              <div className="rounded-xl bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground mb-1">Beskrivelse</p>
                <p className="text-sm">{calc.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Line items */}
        {items.length > 0 && (
          <Card className="rounded-2xl border-border/40 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground">Tilbudsspesifikasjon</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border/30">
                      <TableHead className="text-xs">Beskrivelse</TableHead>
                      <TableHead className="text-xs text-right">Ant.</TableHead>
                      <TableHead className="text-xs text-right hidden sm:table-cell">Enhetspris</TableHead>
                      <TableHead className="text-xs text-right">Sum</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id} className="border-b border-border/20">
                        <TableCell>
                          <p className="text-sm font-medium">{item.title}</p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm whitespace-nowrap">
                          {item.quantity}{item.unit ? ` ${item.unit}` : ""}
                        </TableCell>
                        <TableCell className="text-right text-sm font-mono hidden sm:table-cell">
                          {fmtCurrency(item.unit_price)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-mono font-medium">
                          {fmtCurrency(item.total_price)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Totals */}
        <Card className="rounded-2xl border-border/40 shadow-sm">
          <CardContent className="p-5">
            <div className="flex justify-between items-center text-sm mb-2">
              <span className="text-muted-foreground">Sum eks. MVA</span>
              <span className="font-mono font-semibold text-lg">{fmtCurrency(offer.total_ex_vat)}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-t border-border/30 pt-2">
              <span className="text-muted-foreground">Sum inkl. MVA (25%)</span>
              <span className="font-mono font-bold text-xl text-foreground">{fmtCurrency(offer.total_inc_vat)}</span>
            </div>
          </CardContent>
        </Card>

        {/* PDF download */}
        {offer.generated_pdf_url && (
          <Button
            variant="outline"
            className="w-full gap-2 rounded-xl h-11"
            onClick={async () => {
              const { getOfferPdfUrl } = await import("@/lib/pdf-url");
              const url = await getOfferPdfUrl(offer.generated_pdf_url!);
              if (url) window.open(url, "_blank");
            }}
          >
            <Download className="h-4 w-4" />
            Last ned tilbud som PDF
          </Button>
        )}

        {/* Terms */}
        <Card className="rounded-2xl border-border/40">
          <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground text-sm mb-2">Vilkår</p>
            <p>• Priser er eks. MVA med mindre annet er oppgitt.</p>
            <p>• Arbeid utføres i henhold til gjeldende forskrifter.</p>
            <p>• Uforutsette forhold kan medføre tillegg etter medgått tid og materiell.</p>
            <p>• Betalingsbetingelser: 14 dager netto.</p>
          </CardContent>
        </Card>

        {/* Action / Status section */}
        {actionResult === "accepted" ? (
          <Card className="rounded-2xl border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10">
            <CardContent className="p-6 text-center space-y-3">
              <CheckCircle2 className="h-14 w-14 mx-auto text-green-600" />
              <h2 className="text-xl font-bold text-green-800 dark:text-green-200">Tilbudet er godkjent!</h2>
              {offer.accepted_at && (
                <p className="text-sm text-muted-foreground">
                  Godkjent {format(new Date(offer.accepted_at), "d. MMMM yyyy 'kl' HH:mm", { locale: nb })}
                  {offer.accepted_name && ` av ${offer.accepted_name}`}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Vi tar kontakt for å planlegge gjennomføringen. Takk for tilliten!
              </p>
            </CardContent>
          </Card>
        ) : actionResult === "rejected" ? (
          <Card className="rounded-2xl border-destructive/30">
            <CardContent className="p-6 text-center space-y-3">
              <XCircle className="h-14 w-14 mx-auto text-destructive" />
              <h2 className="text-xl font-bold">Tilbudet er avslått</h2>
              {offer.rejected_comment && (
                <p className="text-sm text-muted-foreground">Kommentar: {offer.rejected_comment}</p>
              )}
              <p className="text-sm text-muted-foreground">Kontakt oss gjerne for et oppdatert tilbud.</p>
            </CardContent>
          </Card>
        ) : isExpired ? (
          <Card className="rounded-2xl border-destructive/30">
            <CardContent className="p-6 text-center space-y-3">
              <AlertTriangle className="h-14 w-14 mx-auto text-destructive" />
              <h2 className="text-xl font-bold">Tilbudet har utløpt</h2>
              <p className="text-sm text-muted-foreground">Kontakt oss for et oppdatert tilbud.</p>
            </CardContent>
          </Card>
        ) : canAct ? (
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              size="lg"
              className="flex-1 gap-2 rounded-xl h-12 text-base"
              onClick={() => setAcceptOpen(true)}
            >
              <CheckCircle2 className="h-5 w-5" />
              Godkjenn tilbud
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="flex-1 gap-2 rounded-xl h-12 text-base text-destructive hover:text-destructive"
              onClick={() => setRejectOpen(true)}
            >
              <XCircle className="h-5 w-5" />
              Avslå tilbud
            </Button>
          </div>
        ) : null}

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground space-y-1 pt-4 pb-8">
          {company && (
            <>
              <p className="font-medium">{company.company_name}</p>
              {company.address && (
                <p className="flex items-center justify-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {company.address}, {company.postal_code} {company.city}
                </p>
              )}
              {company.org_number && <p>Org.nr: {company.org_number}</p>}
            </>
          )}
        </div>
      </div>

      {/* Accept dialog */}
      <Dialog open={acceptOpen} onOpenChange={setAcceptOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Godkjenn tilbud</DialogTitle>
            <DialogDescription>
              Vennligst fyll ut informasjonen under for å godkjenne tilbudet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="accept-name">Ditt navn *</Label>
              <Input
                id="accept-name"
                placeholder="Ola Nordmann"
                value={acceptName}
                onChange={(e) => setAcceptName(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accept-email">E-post</Label>
              <Input
                id="accept-email"
                type="email"
                placeholder="ola@firma.no"
                value={acceptEmail}
                onChange={(e) => setAcceptEmail(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accept-comment">Kommentar (valgfritt)</Label>
              <Textarea
                id="accept-comment"
                placeholder="Eventuelle kommentarer..."
                value={acceptComment}
                onChange={(e) => setAcceptComment(e.target.value)}
                className="rounded-xl"
                rows={3}
              />
            </div>
            <div className="flex items-start gap-2 pt-2">
              <Checkbox
                id="accept-confirm"
                checked={acceptConfirmed}
                onCheckedChange={(v) => setAcceptConfirmed(v === true)}
              />
              <Label htmlFor="accept-confirm" className="text-sm leading-tight cursor-pointer">
                Jeg bekrefter at tilbudet godkjennes på vegne av {calc.customer_name}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcceptOpen(false)} className="rounded-xl">
              Avbryt
            </Button>
            <Button
              onClick={handleAccept}
              disabled={!acceptConfirmed || !acceptName.trim() || submitting}
              className="gap-2 rounded-xl"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Bekreft godkjenning
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Avslå tilbud</DialogTitle>
            <DialogDescription>
              Er du sikker på at du vil avslå tilbudet?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="reject-comment">Begrunnelse (valgfritt)</Label>
              <Textarea
                id="reject-comment"
                placeholder="Fortell oss gjerne hvorfor..."
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                className="rounded-xl"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} className="rounded-xl">
              Avbryt
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={submitting}
              className="gap-2 rounded-xl"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Bekreft avslag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error toast */}
      {error && offer && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground px-4 py-2 rounded-xl text-sm shadow-lg z-50">
          {error}
        </div>
      )}
    </div>
  );
}
