import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Building2 } from "lucide-react";

export interface CustomerOption {
  id: string;
  name: string;
  main_email: string | null;
}

interface Props {
  value: string | null;
  onChange: (customerId: string | null, customer: CustomerOption | null) => void;
  disabled?: boolean;
  companyId?: string | null;
}

export function CustomerSelect({ value, onChange, disabled, companyId }: Props) {
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    let q = supabase
      .from("customers")
      .select("id, name, main_email")
      .is("deleted_at", null)
      .order("name");
    if (companyId) q = q.eq("company_id", companyId);
    q.then(({ data }) => {
      setCustomers((data as CustomerOption[]) || []);
      setLoading(false);
    });
  }, [companyId]);

  return (
    <div className="space-y-1.5">
      <Label className="text-sm">Kunde / firma</Label>
      <Select
        value={value || "none"}
        onValueChange={(v) => {
          if (v === "none") {
            onChange(null, null);
          } else {
            const c = customers.find((ct) => ct.id === v) || null;
            onChange(v, c);
          }
        }}
        disabled={disabled || loading}
      >
        <SelectTrigger className="rounded-xl">
          <SelectValue placeholder={loading ? "Laster..." : "Velg kunde"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Ingen valgt (fritekst)</SelectItem>
          {customers.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              <span className="flex items-center gap-2">
                <Building2 className="h-3 w-3 text-muted-foreground" />
                {c.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
