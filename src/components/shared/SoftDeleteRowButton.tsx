import { useState } from "react";
import { SoftDeleteButton } from "./SoftDeleteButton";
import { useSoftDelete } from "@/hooks/useSoftDelete";

type SoftDeletableTable =
  | "events"
  | "offers"
  | "leads"
  | "calculations"
  | "contracts"
  | "cases"
  | "customers"
  | "customer_accounts"
  | "technicians";

interface SoftDeleteRowButtonProps {
  table: SoftDeletableTable;
  id: string;
  entityLabel: string;
  entityName?: string;
  onDeleted?: () => void;
}

/**
 * Drop-in soft-delete button for table rows.
 * Combines useSoftDelete + SoftDeleteButton into one component.
 */
export function SoftDeleteRowButton({
  table,
  id,
  entityLabel,
  entityName,
  onDeleted,
}: SoftDeleteRowButtonProps) {
  const { softDelete, isDeleting } = useSoftDelete({
    table,
    onSuccess: onDeleted,
  });

  return (
    <SoftDeleteButton
      entityLabel={entityLabel}
      entityName={entityName}
      onConfirm={() => softDelete(id)}
      isDeleting={isDeleting}
    />
  );
}
