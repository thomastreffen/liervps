import { useCompanyContext } from "@/hooks/useCompanyContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building, Globe } from "lucide-react";

export function CompanySelector() {
  const { companies, activeCompanyId, isAllCompanies, setActiveCompanyId } = useCompanyContext();

  // Only show selector if user has access to multiple companies
  const hasMultipleCompanies = companies.length > 1;
  if (!hasMultipleCompanies) return null;

  const displayValue = isAllCompanies ? "__all__" : (activeCompanyId || "");

  return (
    <div className="flex items-center gap-2">
      {isAllCompanies ? (
        <Globe className="h-4 w-4 text-primary shrink-0" />
      ) : (
        <Building className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
      <Select
        value={displayValue}
        onValueChange={(v) => setActiveCompanyId(v === "__all__" ? null : v)}
      >
        <SelectTrigger className="w-[200px] h-8 text-xs">
          <SelectValue placeholder="Velg selskap" />
        </SelectTrigger>
        <SelectContent>
          {hasMultipleCompanies && (
            <SelectItem value="__all__">
              <span className="flex items-center gap-1.5">
                <Globe className="h-3 w-3" />
                Alle mine selskaper
              </span>
            </SelectItem>
          )}
          {companies.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
