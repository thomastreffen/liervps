import { Card, CardContent } from "@/components/ui/card";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { MaterialListSection } from "./MaterialListSection";

interface MaterialTabProps {
  jobId: string;
  jobNumber: string | null;
  customer: string;
  address: string;
  contactName?: string | null;
  contactPhone?: string | null;
  plannedAt?: Date | null;
  technicianNames?: string[];
  description?: string | null;
}

function Info({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-medium truncate">{value}</div>
    </div>
  );
}

export function MaterialTab(props: MaterialTabProps) {
  const { jobId, jobNumber, customer, address, contactName, contactPhone, plannedAt, technicianNames, description } = props;
  const { activeCompany, allowedCompanyIds } = useCompanyContext();
  const companyId = activeCompany?.id ?? allowedCompanyIds[0] ?? null;

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl">
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Info label="Jobbnummer" value={jobNumber ?? "—"} />
            <Info label="Kunde" value={customer || "—"} />
            <Info label="Adresse" value={address || "—"} className="md:col-span-2" />
            <Info label="Kontakt" value={contactName ?? "—"} />
            <Info label="Telefon" value={contactPhone ?? "—"} />
            <Info
              label="Planlagt"
              value={plannedAt ? plannedAt.toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" }) : "—"}
            />
            <Info label="Montør" value={(technicianNames ?? []).join(", ") || "—"} />
          </div>
          {description && <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{description}</p>}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <MaterialListSection
          jobId={jobId}
          orderId={null}
          companyId={companyId}
          meta={{ jobNumber, customer, address, description }}
          showStatusSelector
          showCopyFromJob
          variant="bare"
        />
      </Card>
    </div>
  );
}
