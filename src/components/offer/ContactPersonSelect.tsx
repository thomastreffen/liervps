import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Loader2, User, Mail, Phone } from "lucide-react";
import { toast } from "sonner";

export interface ContactPerson {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
}

interface Props {
  customerId: string | null;
  value: string | null;
  onChange: (contactId: string | null, contact: ContactPerson | null) => void;
  disabled?: boolean;
}

export function ContactPersonSelect({ customerId, value, onChange, disabled }: Props) {
  const [contacts, setContacts] = useState<ContactPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRole, setNewRole] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!customerId) {
      setContacts([]);
      return;
    }
    setLoading(true);
    supabase
      .from("customer_contacts")
      .select("id, name, email, phone, role")
      .eq("customer_id", customerId)
      .order("name")
      .then(({ data }) => {
        setContacts((data as ContactPerson[]) || []);
        setLoading(false);
      });
  }, [customerId]);

  const handleCreateContact = async () => {
    if (!customerId || !newName.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("customer_contacts")
      .insert({
        customer_id: customerId,
        name: newName.trim(),
        email: newEmail.trim() || null,
        phone: newPhone.trim() || null,
        role: newRole.trim() || null,
      })
      .select("id, name, email, phone, role")
      .single();
    setSaving(false);
    if (error) {
      toast.error("Kunne ikke opprette kontakt");
      return;
    }
    const contact = data as ContactPerson;
    setContacts((prev) => [...prev, contact].sort((a, b) => a.name.localeCompare(b.name)));
    onChange(contact.id, contact);
    setDialogOpen(false);
    setNewName("");
    setNewEmail("");
    setNewPhone("");
    setNewRole("");
    toast.success("Kontaktperson opprettet og valgt");
  };

  const selected = contacts.find((c) => c.id === value) || null;

  if (!customerId) {
    return (
      <div className="space-y-1.5">
        <Label className="text-sm">Kontaktperson</Label>
        <p className="text-xs text-muted-foreground">Velg kunde først</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-sm">Kontaktperson</Label>
      <div className="flex gap-2">
        <Select
          value={value || "none"}
          onValueChange={(v) => {
            if (v === "none") {
              onChange(null, null);
            } else {
              const c = contacts.find((ct) => ct.id === v) || null;
              onChange(v, c);
            }
          }}
          disabled={disabled || loading}
        >
          <SelectTrigger className="rounded-xl">
            <SelectValue placeholder={loading ? "Laster..." : "Velg kontaktperson"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Ingen valgt</SelectItem>
            {contacts.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <span className="flex items-center gap-2">
                  <User className="h-3 w-3 text-muted-foreground" />
                  {c.name}
                  {c.role && <span className="text-muted-foreground text-xs">({c.role})</span>}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0 rounded-xl"
          onClick={() => setDialogOpen(true)}
          disabled={disabled}
          title="Ny kontaktperson"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {selected && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
          {selected.email && (
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {selected.email}
            </span>
          )}
          {selected.phone && (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {selected.phone}
            </span>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ny kontaktperson</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Navn *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Kontaktnavn" className="h-9" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">E-post</Label>
                <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="epost@firma.no" className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Telefon</Label>
                <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="12345678" className="h-9" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Rolle</Label>
              <Input value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="F.eks. Prosjektleder" className="h-9" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Avbryt</Button>
            <Button onClick={handleCreateContact} disabled={!newName.trim() || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Opprett og velg
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
