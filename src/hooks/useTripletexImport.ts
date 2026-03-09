import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import {
  parseCSV,
  detectFileType,
  getCol,
  parseNorwegianDate,
  parseNorwegianDecimal,
  groupOfferRows,
  type ParsedCSV,
  type DetectedFileType,
  type GroupedOffer,
} from "@/lib/tripletex-csv-parser";

export type MatchStatus = "match" | "new" | "needs_review" | "ignored" | "error" | "imported";
export type ImportAction = "create" | "update" | "ignore";

export interface ProjectRow {
  idx: number;
  projectNumber: string;
  projectName: string;
  customerName: string;
  customerNumber: string;
  startDate: string | null;
  endDate: string | null;
  description: string;
  reference: string;
  projectLeader: string;
  department: string;
  matchStatus: MatchStatus;
  matchedEntityId?: string;
  matchedEntityTitle?: string;
  action: ImportAction;
  error?: string;
  raw: Record<string, string>;
}

export interface OfferRow {
  offer: GroupedOffer;
  matchStatus: MatchStatus;
  matchedOfferId?: string;
  matchedOfferNumber?: string;
  matchedCustomerId?: string;
  matchedCustomerName?: string;
  matchedProjectId?: string;
  matchedProjectTitle?: string;
  action: ImportAction;
  error?: string;
}

export function useTripletexImport() {
  const { user } = useAuth();
  const { activeCompanyId: companyId } = useCompanyContext();

  const [parsedData, setParsedData] = useState<ParsedCSV | null>(null);
  const [detectedType, setDetectedType] = useState<DetectedFileType>("unknown");
  const [fileName, setFileName] = useState("");
  const [projectRows, setProjectRows] = useState<ProjectRow[]>([]);
  const [offerRows, setOfferRows] = useState<OfferRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<"upload" | "preview" | "confirm" | "result">("upload");
  const [importResult, setImportResult] = useState<{
    created: number; updated: number; ignored: number; failed: number; logId: string;
  } | null>(null);

  const reset = useCallback(() => {
    setParsedData(null);
    setDetectedType("unknown");
    setFileName("");
    setProjectRows([]);
    setOfferRows([]);
    setStep("upload");
    setImportResult(null);
  }, []);

  const handleFile = useCallback(async (file: File) => {
    const text = await file.text();
    const parsed = parseCSV(text);
    const type = detectFileType(parsed.headers);
    setParsedData(parsed);
    setDetectedType(type);
    setFileName(file.name);

    if (type === "project") {
      await matchProjects(parsed);
    } else if (type === "quote") {
      await matchOffers(parsed);
    }

    setStep("preview");
  }, [companyId]);

  const matchProjects = async (parsed: ParsedCSV) => {
    // Fetch existing projects for matching
    const { data: existing } = await supabase
      .from("events")
      .select("id, title, project_number, external_tripletex_id, customer")
      .is("deleted_at", null);

    const existingMap = new Map<string, { id: string; title: string }>();
    (existing || []).forEach(e => {
      if (e.project_number) existingMap.set(e.project_number.toLowerCase(), { id: e.id, title: e.title });
      if ((e as any).external_tripletex_id) existingMap.set((e as any).external_tripletex_id.toLowerCase(), { id: e.id, title: e.title });
    });

    const rows: ProjectRow[] = parsed.rows.map((row, idx) => {
      const projectNumber = getCol(row, "Prosjektnummer");
      const projectName = getCol(row, "Prosjektnavn");
      const customerName = getCol(row, "Kundenavn");
      const customerNumber = getCol(row, "Kundenummer");
      const startDate = parseNorwegianDate(getCol(row, "Startdato"));
      const endDate = parseNorwegianDate(getCol(row, "Sluttdato"));

      let matchStatus: MatchStatus = "new";
      let matchedEntityId: string | undefined;
      let matchedEntityTitle: string | undefined;
      let error: string | undefined;
      let action: ImportAction = "create";

      if (!projectNumber) {
        matchStatus = "error";
        error = "Mangler prosjektnummer";
        action = "ignore";
      } else {
        const match = existingMap.get(projectNumber.toLowerCase());
        if (match) {
          matchStatus = "match";
          matchedEntityId = match.id;
          matchedEntityTitle = match.title;
          action = "update";
        }
      }

      if (startDate === null && getCol(row, "Startdato")) {
        error = (error ? error + "; " : "") + "Ugyldig startdato";
        if (matchStatus !== "error") matchStatus = "needs_review";
      }
      if (endDate === null && getCol(row, "Sluttdato")) {
        error = (error ? error + "; " : "") + "Ugyldig sluttdato";
        if (matchStatus !== "error") matchStatus = "needs_review";
      }

      return {
        idx,
        projectNumber,
        projectName,
        customerName,
        customerNumber,
        startDate,
        endDate,
        description: getCol(row, "Prosjektbeskrivelse"),
        reference: getCol(row, "Referanse"),
        projectLeader: getCol(row, "Prosjektleder"),
        department: getCol(row, "Avdeling"),
        matchStatus,
        matchedEntityId,
        matchedEntityTitle,
        action,
        error,
        raw: row,
      };
    });

    setProjectRows(rows);
  };

  const matchOffers = async (parsed: ParsedCSV) => {
    const grouped = groupOfferRows(parsed.rows);

    // Fetch existing offers, customers, projects
    const [offersRes, customersRes, projectsRes] = await Promise.all([
      supabase.from("offers").select("id, offer_number, external_tripletex_number").is("deleted_at", null),
      supabase.from("customers").select("id, name, org_number, external_tripletex_id"),
      supabase.from("events").select("id, title, project_number").is("deleted_at", null),
    ]);

    const existingOffers = new Map<string, { id: string; number: string }>();
    (offersRes.data || []).forEach(o => {
      if ((o as any).external_tripletex_number) existingOffers.set((o as any).external_tripletex_number, { id: o.id, number: o.offer_number });
    });

    const customersByOrg = new Map<string, { id: string; name: string }>();
    const customersByName = new Map<string, { id: string; name: string }>();
    (customersRes.data || []).forEach(c => {
      if (c.org_number) customersByOrg.set(c.org_number, { id: c.id, name: c.name });
      customersByName.set(c.name.toLowerCase(), { id: c.id, name: c.name });
    });

    const rows: OfferRow[] = grouped.map(offer => {
      let matchStatus: MatchStatus = "new";
      let matchedOfferId: string | undefined;
      let matchedOfferNumber: string | undefined;
      let matchedCustomerId: string | undefined;
      let matchedCustomerName: string | undefined;
      let action: ImportAction = "create";

      // Match offer
      const existingOffer = existingOffers.get(offer.number);
      if (existingOffer) {
        matchStatus = "match";
        matchedOfferId = existingOffer.id;
        matchedOfferNumber = existingOffer.number;
        action = "update";
      }

      // Match customer
      if (offer.orgNumber) {
        const cm = customersByOrg.get(offer.orgNumber);
        if (cm) { matchedCustomerId = cm.id; matchedCustomerName = cm.name; }
      }
      if (!matchedCustomerId && offer.customerName) {
        const cm = customersByName.get(offer.customerName.toLowerCase());
        if (cm) { matchedCustomerId = cm.id; matchedCustomerName = cm.name; }
      }

      if (!matchedCustomerId && offer.customerName) {
        if (matchStatus === "new") matchStatus = "needs_review";
      }

      return {
        offer,
        matchStatus,
        matchedOfferId,
        matchedOfferNumber,
        matchedCustomerId,
        matchedCustomerName,
        action,
      };
    });

    setOfferRows(rows);
  };

  const updateProjectAction = (idx: number, action: ImportAction) => {
    setProjectRows(prev => prev.map(r => r.idx === idx ? { ...r, action, matchStatus: action === "ignore" ? "ignored" : r.matchStatus } : r));
  };

  const updateOfferAction = (number: string, action: ImportAction) => {
    setOfferRows(prev => prev.map(r => r.offer.number === number ? { ...r, action, matchStatus: action === "ignore" ? "ignored" : r.matchStatus } : r));
  };

  const canConfirm = () => {
    if (detectedType === "project") {
      return !projectRows.some(r => r.matchStatus === "needs_review" && r.action !== "ignore");
    }
    if (detectedType === "quote") {
      return !offerRows.some(r => r.matchStatus === "needs_review" && r.action !== "ignore");
    }
    return false;
  };

  const executeImport = async () => {
    if (!user) return;
    setImporting(true);

    let created = 0, updated = 0, ignored = 0, failed = 0;
    const totalRows = detectedType === "project" ? projectRows.length : offerRows.length;

    // Create import log
    const { data: logData } = await (supabase.from("import_logs" as any) as any).insert({
      import_type: detectedType,
      file_name: fileName,
      imported_by: user.id,
      total_rows: totalRows,
      status: "pending",
    }).select("id").single();

    const logId = (logData as any)?.id || "";

    try {
      if (detectedType === "project") {
        for (const row of projectRows) {
          if (row.action === "ignore" || row.matchStatus === "error") {
            ignored++;
            await insertResult(logId, row.projectNumber, "project", "ignored", "Ignorert", row.raw);
            continue;
          }
          try {
            if (row.action === "create") {
              const { data } = await supabase.from("events").insert({
                title: row.projectName || row.projectNumber,
                project_number: row.projectNumber,
                customer: row.customerName,
                description: row.description,
                start_time: row.startDate || new Date().toISOString(),
                end_time: row.endDate || new Date(Date.now() + 86400000 * 30).toISOString(),
                status: "requested" as any,
                technician_id: user.id,
                company_id: companyId,
                external_tripletex_id: row.projectNumber,
                created_by: user.id,
              } as any).select("id").single();
              created++;
              await insertResult(logId, row.projectNumber, "project", "created", "Opprettet", row.raw, data?.id);
            } else if (row.action === "update" && row.matchedEntityId) {
              await supabase.from("events").update({
                title: row.projectName || undefined,
                customer: row.customerName || undefined,
                description: row.description || undefined,
                external_tripletex_id: row.projectNumber,
              } as any).eq("id", row.matchedEntityId);
              updated++;
              await insertResult(logId, row.projectNumber, "project", "updated", "Oppdatert", row.raw, row.matchedEntityId);
            }
          } catch {
            failed++;
            await insertResult(logId, row.projectNumber, "project", "failed", "Feil ved import", row.raw);
          }
        }
      } else if (detectedType === "quote") {
        for (const row of offerRows) {
          if (row.action === "ignore") {
            ignored++;
            await insertResult(logId, row.offer.number, "quote", "ignored", "Ignorert", row.offer.rawRows[0]);
            continue;
          }
          try {
            if (row.action === "create") {
              // Create calculation first
              const totalAmount = parseNorwegianDecimal(row.offer.orderAmount) || 
                row.offer.lines.reduce((s, l) => s + (l.amount || 0), 0);

              const { data: calc } = await supabase.from("calculations").insert({
                project_title: `Tilbud ${row.offer.number} - ${row.offer.customerName}`,
                customer_name: row.offer.customerName || "Ukjent",
                customer_email: "",
                created_by: user.id,
                company_id: companyId,
                status: "draft" as any,
                total_price: totalAmount,
                external_tripletex_number: row.offer.number,
              } as any).select("id").single();

              if (calc) {
                // Create calculation items for each line
                const items = row.offer.lines.filter(l => l.description).map(l => ({
                  calculation_id: calc.id,
                  title: l.description,
                  quantity: l.quantity || 1,
                  unit_price: l.unitPrice || 0,
                  total_price: l.amount || (l.quantity || 1) * (l.unitPrice || 0),
                  type: "material" as any,
                }));

                if (items.length > 0) {
                  await supabase.from("calculation_items").insert(items);
                }

                // Create offer
                await supabase.from("offers").insert({
                  calculation_id: calc.id,
                  offer_number: `TX-${row.offer.number}`,
                  created_by: user.id,
                  company_id: companyId,
                  status: "draft" as any,
                  total_ex_vat: totalAmount,
                  total_inc_vat: totalAmount * 1.25,
                  external_tripletex_number: row.offer.number,
                  lead_id: null,
                } as any);

                created++;
                await insertResult(logId, row.offer.number, "quote", "created", "Opprettet", row.offer.rawRows[0], calc.id);
              }
            } else if (row.action === "update" && row.matchedOfferId) {
              updated++;
              await insertResult(logId, row.offer.number, "quote", "updated", "Oppdatert", row.offer.rawRows[0], row.matchedOfferId);
            }
          } catch {
            failed++;
            await insertResult(logId, row.offer.number, "quote", "failed", "Feil ved import", row.offer.rawRows[0]);
          }
        }
      }

      // Update log
      await supabase.from("import_logs" as any).update({
        status: failed > 0 ? "partial" : "completed",
        created_count: created,
        updated_count: updated,
        ignored_count: ignored,
        failed_count: failed,
        summary_json: { created, updated, ignored, failed },
      } as any).eq("id", logId);

      setImportResult({ created, updated, ignored, failed, logId });
      setStep("result");
    } finally {
      setImporting(false);
    }
  };

  return {
    parsedData, detectedType, fileName, projectRows, offerRows,
    importing, step, importResult, handleFile, reset,
    updateProjectAction, updateOfferAction, canConfirm,
    executeImport, setStep,
  };
}

async function insertResult(
  logId: string, key: string, entityType: string, action: string, message: string,
  raw: Record<string, string>, entityId?: string
) {
  await supabase.from("import_results" as any).insert({
    import_log_id: logId,
    external_key: key,
    entity_type: entityType,
    action_taken: action,
    status: action === "failed" ? "error" : "ok",
    message,
    raw_payload_json: raw,
    resolved_entity_id: entityId,
  } as any);
}
