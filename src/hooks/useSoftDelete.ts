import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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

const TABLE_LABELS: Record<SoftDeletableTable, string> = {
  events: "Oppdrag",
  offers: "Tilbud",
  leads: "Lead",
  calculations: "Kalkyle",
  contracts: "Kontrakt",
  cases: "Henvendelse",
  customers: "Kunde",
  customer_accounts: "Kundekonto",
  technicians: "Montør",
};

interface UseSoftDeleteOptions {
  table: SoftDeletableTable;
  onSuccess?: () => void;
  onUndo?: (id: string) => void;
}

export function useSoftDelete({ table, onSuccess, onUndo }: UseSoftDeleteOptions) {
  const [isDeleting, setIsDeleting] = useState(false);
  const label = TABLE_LABELS[table] ?? table;

  const softDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Ikke autentisert");

      const { error } = await supabase
        .from(table)
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
        } as any)
        .eq("id", id as any);

      if (error) throw error;

      toast({
        title: `${label} slettet`,
        description: "Elementet er fjernet fra aktive lister. Kan gjenopprettes.",
        action: onUndo
          ? undefined // Could add undo button here
          : undefined,
      });

      onSuccess?.();
    } catch (err: any) {
      console.error(`[SoftDelete] Failed to delete ${table}/${id}:`, err);
      toast({
        title: "Feil ved sletting",
        description: err.message ?? "Noe gikk galt.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const restore = async (id: string) => {
    try {
      const { error } = await supabase
        .from(table)
        .update({
          deleted_at: null,
          deleted_by: null,
        } as any)
        .eq("id", id as any);

      if (error) throw error;

      toast({ title: `${label} gjenopprettet` });
      onUndo?.(id);
    } catch (err: any) {
      console.error(`[SoftDelete] Failed to restore ${table}/${id}:`, err);
      toast({
        title: "Feil ved gjenoppretting",
        description: err.message ?? "Noe gikk galt.",
        variant: "destructive",
      });
    }
  };

  return { softDelete, restore, isDeleting, label };
}
