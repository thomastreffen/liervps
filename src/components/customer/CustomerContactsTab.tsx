import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Phone, Plus, Trash2, UserPlus, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { ContactTagBadges } from "@/components/customer/ContactTagBadges";
import { useContactTags, type ContactTag } from "@/hooks/useContactTags";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
}

interface Props {
  contacts: Contact[];
  isAdmin: boolean;
  onAdd: (contact: { name: string; email: string; phone: string; role: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function CustomerContactsTab({ contacts, isAdmin, onAdd, onDelete }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [adding, setAdding] = useState(false);

  const { tags: allTags, createTag, addTagToContact, removeTagFromContact, getContactsTagIds } = useContactTags();
  const [contactTagMap, setContactTagMap] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const ids = contacts.map(c => c.id);
    if (ids.length === 0) { setContactTagMap({}); return; }
    getContactsTagIds(ids).then(setContactTagMap);
  }, [contacts, getContactsTagIds]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setAdding(true);
    await onAdd({ name: name.trim(), email: email.trim(), phone: phone.trim(), role: role.trim() });
    setName(""); setEmail(""); setPhone(""); setRole("");
    setAdding(false);
  };

  const handleAddTag = async (contactId: string, tagId: string) => {
    await addTagToContact(contactId, tagId);
    setContactTagMap(prev => ({ ...prev, [contactId]: [...(prev[contactId] || []), tagId] }));
  };

  const handleRemoveTag = async (contactId: string, tagId: string) => {
    await removeTagFromContact(contactId, tagId);
    setContactTagMap(prev => ({ ...prev, [contactId]: (prev[contactId] || []).filter(id => id !== tagId) }));
  };

  const handleCreateTag = async (contactId: string, name: string, color: string) => {
    const tag = await createTag(name, color);
    if (tag) {
      await addTagToContact(contactId, tag.id);
      setContactTagMap(prev => ({ ...prev, [contactId]: [...(prev[contactId] || []), tag.id] }));
    }
  };

  const getAssignedTags = (contactId: string): ContactTag[] => {
    const ids = contactTagMap[contactId] || [];
    return allTags.filter(t => ids.includes(t.id));
  };

  return (
    <div className="space-y-3">
      {contacts.length === 0 && !isAdmin && (
        <p className="text-sm text-muted-foreground text-center py-8">Ingen kontakter registrert.</p>
      )}

      {contacts.map(c => (
        <Card key={c.id} className="rounded-2xl">
          <CardContent className="flex items-center justify-between py-3 px-4">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">{c.name}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                {c.role && <span className="text-foreground/70">{c.role}</span>}
                {c.email && (
                  <a href={`mailto:${c.email}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
                    <Mail className="h-3 w-3" />{c.email}
                  </a>
                )}
                {c.phone && (
                  <a href={`tel:${c.phone}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
                    <Phone className="h-3 w-3" />{c.phone}
                  </a>
                )}
              </div>
              <ContactTagBadges
                assignedTags={getAssignedTags(c.id)}
                allTags={allTags}
                onAdd={(tagId) => handleAddTag(c.id, tagId)}
                onRemove={(tagId) => handleRemoveTag(c.id, tagId)}
                onCreate={(name, color) => handleCreateTag(c.id, name, color)}
                editable={isAdmin}
              />
            </div>
            {isAdmin && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onDelete(c.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </CardContent>
        </Card>
      ))}

      {isAdmin && (
        <Card className="rounded-2xl border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><UserPlus className="h-4 w-4" /> Legg til kontakt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Navn *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Kontaktnavn" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Rolle</Label>
                <Input value={role} onChange={e => setRole(e.target.value)} placeholder="F.eks. Prosjektleder" className="h-8 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">E-post</Label>
                <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="epost@firma.no" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Telefon</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="12345678" className="h-8 text-sm" />
              </div>
            </div>
            <Button size="sm" onClick={handleSubmit} disabled={!name.trim() || adding} className="rounded-xl gap-1.5">
              {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Legg til
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
