import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCompanyContext } from "@/hooks/useCompanyContext";

interface CreatePersonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

interface RoleOption { id: string; name: string; }
interface DeptOption { id: string; name: string; }

export function CreatePersonDialog({ open, onOpenChange, onCreated }: CreatePersonDialogProps) {
  const { companies, activeCompanyId } = useCompanyContext();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyId, setCompanyId] = useState<string>(activeCompanyId || "");
  const [departmentId, setDepartmentId] = useState<string>("none");
  const [isPlannable, setIsPlannable] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setFullName("");
      setEmail("");
      setPhone("");
      setCompanyId(activeCompanyId || "");
      setDepartmentId("none");
      setIsPlannable(false);
      setIsActive(true);
      setSelectedRoles(new Set());
      fetchMeta();
    }
  }, [open, activeCompanyId]);

  useEffect(() => {
    if (companyId) fetchDepartments();
  }, [companyId]);

  const fetchMeta = async () => {
    const { data } = await supabase.from("roles").select("id, name").order("name");
    setRoles((data as any[]) || []);
  };

  const fetchDepartments = async () => {
    const { data } = await supabase
      .from("departments")
      .select("id, name")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("name");
    setDepartments((data as any[]) || []);
  };

  const handleCreate = async () => {
    if (!fullName.trim() || !email.trim() || !companyId) {
      toast.error("Fyll ut navn, e-post og selskap");
      return;
    }
    setSaving(true);
    try {
      // 1. Create person
      const { data: person, error: pErr } = await supabase
        .from("people")
        .insert({
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          is_active: isActive,
        })
        .select("id")
        .single();

      if (pErr || !person) {
        toast.error("Kunne ikke opprette person", { description: pErr?.message });
        setSaving(false);
        return;
      }

      // 2. Create employment profile
      const { error: epErr } = await supabase
        .from("employment_profiles")
        .insert({
          person_id: person.id,
          company_id: companyId,
          department_id: departmentId === "none" ? null : departmentId,
          is_plannable_resource: isPlannable,
        });

      if (epErr) {
        toast.error("Feil ved ansattprofil", { description: epErr.message });
      }

      toast.success(`${fullName} ble opprettet`);
      onCreated();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Feil", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Legg til person manuelt</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-2">
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Fullt navn *</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ola Nordmann" />
            </div>
            <div>
              <Label className="text-xs">E-post *</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="ola@firma.no" />
            </div>
            <div>
              <Label className="text-xs">Telefon</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+47 123 45 678" />
            </div>
            <div>
              <Label className="text-xs">Selskap *</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger><SelectValue placeholder="Velg selskap" /></SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Avdeling</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ingen avdeling</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Planleggbar ressurs</Label>
                <p className="text-[11px] text-muted-foreground">Vises i ressursplanen</p>
              </div>
              <Switch checked={isPlannable} onCheckedChange={setIsPlannable} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Aktiv</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Opprett person
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
