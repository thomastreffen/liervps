import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Building, Palette, FileText, Mail } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";

interface CompanyProfile {
  id: string;
  name: string;
  org_number: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  default_offer_conditions: string | null;
  default_offer_footer: string | null;
  default_payment_terms: string | null;
  email_signature: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
}

export function CompanyProfileTab() {
  const { activeCompanyId, activeCompany } = useCompanyContext();
  const { isSuperAdmin, isAdmin } = useAuth();
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeCompanyId) return;
    fetchProfile();
  }, [activeCompanyId]);

  const fetchProfile = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("company_settings")
      .select("*")
      .eq("id", activeCompanyId!)
      .maybeSingle();

    if (data) {
      setProfile({
        id: data.id,
        name: data.company_name,
        org_number: data.org_number,
        logo_url: data.logo_url,
        primary_color: data.primary_color,
        secondary_color: data.secondary_color,
        default_offer_conditions: data.default_offer_conditions,
        default_offer_footer: data.default_offer_footer,
        default_payment_terms: data.default_payment_terms,
        email_signature: (data as any).email_signature || null,
        address: data.address,
        phone: data.phone,
        email: data.email,
        website: data.website,
      });
    } else {
      // Create stub from internal_companies
      setProfile({
        id: activeCompanyId!,
        name: activeCompany?.name || "",
        org_number: activeCompany?.org_number || null,
        logo_url: null,
        primary_color: null,
        secondary_color: null,
        default_offer_conditions: null,
        default_offer_footer: null,
        default_payment_terms: null,
        email_signature: null,
        address: null,
        phone: null,
        email: null,
        website: null,
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);

    const payload = {
      id: profile.id,
      company_name: profile.name,
      org_number: profile.org_number,
      logo_url: profile.logo_url,
      primary_color: profile.primary_color,
      secondary_color: profile.secondary_color,
      default_offer_conditions: profile.default_offer_conditions,
      default_offer_footer: profile.default_offer_footer,
      default_payment_terms: profile.default_payment_terms,
      address: profile.address,
      phone: profile.phone,
      email: profile.email,
      website: profile.website,
    };

    const { error } = await supabase
      .from("company_settings")
      .upsert(payload, { onConflict: "id" });

    if (error) {
      toast.error("Kunne ikke lagre", { description: error.message });
    } else {
      toast.success("Selskapsprofil oppdatert");
    }
    setSaving(false);
  };

  const canEdit = isSuperAdmin || isAdmin;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Velg et selskap for å se profilen.
      </div>
    );
  }

  const update = (field: keyof CompanyProfile, value: string | null) => {
    setProfile((p) => (p ? { ...p, [field]: value } : p));
  };

  return (
    <div className="space-y-6 mt-4">
      {/* Basic info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building className="h-4 w-4" />
            Grunninfo
          </CardTitle>
          <CardDescription>Firmanavn, kontakt og adresse</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Firmanavn</Label>
            <Input value={profile.name} onChange={(e) => update("name", e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <Label>Org.nr</Label>
            <Input value={profile.org_number || ""} onChange={(e) => update("org_number", e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <Label>E-post</Label>
            <Input value={profile.email || ""} onChange={(e) => update("email", e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <Label>Telefon</Label>
            <Input value={profile.phone || ""} onChange={(e) => update("phone", e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <Label>Adresse</Label>
            <Input value={profile.address || ""} onChange={(e) => update("address", e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <Label>Nettside</Label>
            <Input value={profile.website || ""} onChange={(e) => update("website", e.target.value)} disabled={!canEdit} />
          </div>
        </CardContent>
      </Card>

      {/* Branding */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Merkevare
          </CardTitle>
          <CardDescription>Logo og farger for tilbud og dokumenter</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Logo URL</Label>
            <Input
              placeholder="https://..."
              value={profile.logo_url || ""}
              onChange={(e) => update("logo_url", e.target.value)}
              disabled={!canEdit}
            />
            {profile.logo_url && (
              <img
                src={profile.logo_url}
                alt="Logo"
                className="mt-2 h-12 object-contain rounded border border-border p-1"
              />
            )}
          </div>
          <div className="space-y-3">
            <div>
              <Label>Primærfarge</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={profile.primary_color || ""}
                  onChange={(e) => update("primary_color", e.target.value)}
                  placeholder="#0066CC"
                  disabled={!canEdit}
                  className="flex-1"
                />
                {profile.primary_color && (
                  <div className="h-8 w-8 rounded border border-border" style={{ backgroundColor: profile.primary_color }} />
                )}
              </div>
            </div>
            <div>
              <Label>Sekundærfarge</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={profile.secondary_color || ""}
                  onChange={(e) => update("secondary_color", e.target.value)}
                  placeholder="#004499"
                  disabled={!canEdit}
                  className="flex-1"
                />
                {profile.secondary_color && (
                  <div className="h-8 w-8 rounded border border-border" style={{ backgroundColor: profile.secondary_color }} />
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Offer templates */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Tilbudsmaler
          </CardTitle>
          <CardDescription>Standardtekster for tilbud og fakturaer</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Betalingsbetingelser</Label>
            <Input
              value={profile.default_payment_terms || ""}
              onChange={(e) => update("default_payment_terms", e.target.value)}
              placeholder="30 dager netto"
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label>Tilbudsbetingelser</Label>
            <Textarea
              value={profile.default_offer_conditions || ""}
              onChange={(e) => update("default_offer_conditions", e.target.value)}
              placeholder="Standardvilkår for tilbud..."
              rows={3}
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label>Tilbudsbunntekst</Label>
            <Textarea
              value={profile.default_offer_footer || ""}
              onChange={(e) => update("default_offer_footer", e.target.value)}
              placeholder="Tekst som vises nederst i tilbudet..."
              rows={3}
              disabled={!canEdit}
            />
          </div>
        </CardContent>
      </Card>

      {/* E-post signatur */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            E-postsignatur
          </CardTitle>
          <CardDescription>Standard signatur for utgående e-poster</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={profile.email_signature || ""}
            onChange={(e) => update("email_signature", e.target.value)}
            placeholder="Med vennlig hilsen&#10;{Firmanavn}&#10;Tlf: {Telefon}"
            rows={4}
            disabled={!canEdit}
          />
        </CardContent>
      </Card>

      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Lagre endringer
          </Button>
        </div>
      )}
    </div>
  );
}
