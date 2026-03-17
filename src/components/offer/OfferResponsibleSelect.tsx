import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { User } from "lucide-react";

interface UserOption {
  id: string;
  name: string;
}

interface OfferResponsibleSelectProps {
  value: string | null;
  onChange: (userId: string | null) => void;
  companyId?: string | null;
}

export function OfferResponsibleSelect({ value, onChange, companyId }: OfferResponsibleSelectProps) {
  const [users, setUsers] = useState<UserOption[]>([]);

  useEffect(() => {
    (async () => {
      let query = supabase
        .from("user_accounts")
        .select("auth_user_id, person:people(full_name)")
        .eq("is_active", true);

      const { data } = await query;
      if (data) {
        setUsers(
          (data as any[])
            .filter(u => u.person?.full_name)
            .map(u => ({ id: u.auth_user_id, name: u.person.full_name }))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      }
    })();
  }, [companyId]);

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs">
        <User className="h-3 w-3" /> Ansvarlig
      </Label>
      <Select value={value || "none"} onValueChange={(v) => onChange(v === "none" ? null : v)}>
        <SelectTrigger className="h-8 text-sm rounded-lg">
          <SelectValue placeholder="Velg ansvarlig" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Ingen ansvarlig</SelectItem>
          {users.map(u => (
            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
