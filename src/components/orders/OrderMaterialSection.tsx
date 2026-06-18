import { useCompanyContext } from "@/hooks/useCompanyContext";
import { MaterialListSection } from "@/components/material/MaterialListSection";

interface Props {
  orderId: string;
  linkedEventId?: string | null;
  customer?: string;
  address?: string;
  description?: string | null;
  orderNumber?: string | null;
}

/**
 * Materialliste-inngang fra bestillingsside.
 * Knyttes til job_id hvis bestillingen er koblet til jobb, ellers til order_id direkte.
 */
export function OrderMaterialSection({
  orderId,
  linkedEventId,
  customer = "",
  address = "",
  description = null,
  orderNumber = null,
}: Props) {
  const { activeCompany, allowedCompanyIds } = useCompanyContext();
  const companyId = activeCompany?.id ?? allowedCompanyIds[0] ?? null;
  const hasJob = !!linkedEventId;

  return (
    <MaterialListSection
      jobId={hasJob ? linkedEventId : null}
      orderId={hasJob ? null : orderId}
      companyId={companyId}
      meta={{
        jobNumber: orderNumber,
        customer,
        address,
        description,
      }}
      showStatusSelector={false}
      showCopyFromJob={hasJob}
    />
  );
}
