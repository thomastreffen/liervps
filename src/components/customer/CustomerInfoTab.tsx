import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Loader2 } from "lucide-react";
import { useState } from "react";
import { SourceMetadataSection } from "@/components/SourceMetadataBadge";

interface Customer {
  id: string;
  name: string;
  org_number: string | null;
  main_email: string | null;
  main_phone: string | null;
  billing_address: string | null;
  billing_zip: string | null;
  billing_city: string | null;
  external_tripletex_id: string | null;
  created_at: string;
}

interface Props {
  customer: Customer;
  isAdmin: boolean;
  companyName: string | null | undefined;
  onSave: (data: {
    name: string;
    org_number: string;
    main_email: string;
    main_phone: string;
    billing_address: string;
    billing_zip: string;
    billing_city: string;
  }) => Promise<void>;
}

export function CustomerInfoTab({ customer, isAdmin, companyName, onSave }: Props) {
  const [editName, setEditName] = useState(customer.name);
  const [editOrg, setEditOrg] = useState(customer.org_number || "");
  const [editEmail, setEditEmail] = useState(customer.main_email || "");
  const [editPhone, setEditPhone] = useState(customer.main_phone || "");
  const [editAddress, setEditAddress] = useState(customer.billing_address || "");
  const [editZip, setEditZip] = useState(customer.billing_zip || "");
  const [editCity, setEditCity] = useState(customer.billing_city || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      name: editName.trim(),
      org_number: editOrg.trim(),
      main_email: editEmail.trim(),
      main_phone: editPhone.trim(),
      billing_address: editAddress.trim(),
      billing_zip: editZip.trim(),
      billing_city: editCity.trim(),
    });
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Kundeinformasjon</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Kundenavn</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} disabled={!isAdmin} />
            </div>
            <div className="space-y-1.5">
              <Label>Org.nr</Label>
              <Input value={editOrg} onChange={e => setEditOrg(e.target.value)} placeholder="123 456 789" disabled={!isAdmin} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>E-post</Label>
              <Input value={editEmail} onChange={e => setEditEmail(e.target.value)} type="email" disabled={!isAdmin} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefon</Label>
              <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} disabled={!isAdmin} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Fakturaadresse</Label>
            <Input value={editAddress} onChange={e => setEditAddress(e.target.value)} disabled={!isAdmin} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Postnr</Label>
              <Input value={editZip} onChange={e => setEditZip(e.target.value)} disabled={!isAdmin} />
            </div>
            <div className="space-y-1.5">
              <Label>Sted</Label>
              <Input value={editCity} onChange={e => setEditCity(e.target.value)} disabled={!isAdmin} />
            </div>
          </div>
          {isAdmin && (
            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} disabled={saving} className="rounded-xl gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Lagre
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Integration & source metadata */}
      <Card className="rounded-2xl border-border/50">
        <CardContent className="p-4">
          <SourceMetadataSection
            source={customer.external_tripletex_id ? "tripletex" : "local"}
            externalId={customer.external_tripletex_id}
            companyName={companyName}
            lastSynced={customer.external_tripletex_id ? customer.created_at : null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
