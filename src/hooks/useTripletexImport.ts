import { useState, useCallback, useRef } from "react";
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
  readFileWithEncoding,
  stringSimilarity,
  type ParsedCSV,
  type DetectedFileType,
  type GroupedOffer,
} from "@/lib/tripletex-csv-parser";

export type MatchStatus = "match" | "new" | "needs_review" | "ignored" | "error" | "imported" | "possible_duplicate";
export type ImportAction = "create" | "update" | "ignore" | "link";

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
  /** Fuzzy match candidates for manual linking */
  candidates?: { id: string; title: string; customer: string | null; score: number }[];
  action: ImportAction;
  error?: string;
  /** True when customer was not found locally */
  missingCustomer?: boolean;
  /** Resolved local customer id (set during matching) */
  resolvedCustomerId?: string;
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

  type CustomerMaps = {
    customerByOrgNr: Map<string, { id: string; name: string }>;
    customerByTripletexId: Map<string, { id: string; name: string }>;
    customerByName: Map<string, { id: string; name: string }>;
  };
  const customerMapsRef = useRef<CustomerMaps | null>(null);

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
    // Use encoding-aware reader (UTF-8 first, fallback Windows-1252)
    const text = await readFileWithEncoding(file);
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

  /** Resolve a customer id from maps using priority: tripletex_id → org_nr → name */
  const resolveCustomerFromMaps = (
    maps: CustomerMaps, customerName: string, customerNumber: string
  ): string | null => {
    // 1. Tripletex customer ID (highest priority – stable & unique)
    if (customerNumber) {
      const byTx = maps.customerByTripletexId.get(customerNumber.trim());
      if (byTx) return byTx.id;
    }
    // 2. Org number
    if (customerNumber) {
      const byOrg = maps.customerByOrgNr.get(customerNumber.trim());
      if (byOrg) return byOrg.id;
    }
    // 3. Exact name match (case-insensitive)
    if (customerName) {
      const byName = maps.customerByName.get(customerName.toLowerCase().trim());
      if (byName) return byName.id;
    }
    return null;
  };

  const matchProjects = async (parsed: ParsedCSV) => {
    // Fetch existing projects and customers for matching
    const [{ data: existing }, { data: customers }] = await Promise.all([
      supabase
        .from("events")
        .select("id, title, project_number, external_tripletex_id, customer, project_type")
        .is("deleted_at", null),
      supabase
        .from("customers")
        .select("id, name, org_number, external_tripletex_id"),
    ]);

    const allProjects = (existing || []);
    const allCustomers = (customers || []);

    // Build customer lookup maps
    const customerByOrgNr = new Map<string, { id: string; name: string }>();
    const customerByTripletexId = new Map<string, { id: string; name: string }>();
    const customerByName = new Map<string, { id: string; name: string }>();
    allCustomers.forEach(c => {
      if (c.org_number) customerByOrgNr.set(c.org_number.trim(), { id: c.id, name: c.name });
      if ((c as any).external_tripletex_id) customerByTripletexId.set(((c as any).external_tripletex_id as string).trim(), { id: c.id, name: c.name });
      customerByName.set(c.name.toLowerCase().trim(), { id: c.id, name: c.name });
    });

    // Build exact-match maps for projects
    const byProjectNumber = new Map<string, { id: string; title: string; customer: string | null }>();
    const byTripletexId = new Map<string, { id: string; title: string; customer: string | null }>();

    allProjects.forEach(e => {
      if (e.project_number) byProjectNumber.set(e.project_number.toLowerCase(), { id: e.id, title: e.title, customer: e.customer });
      if ((e as any).external_tripletex_id) byTripletexId.set(((e as any).external_tripletex_id as string).toLowerCase(), { id: e.id, title: e.title, customer: e.customer });
    });

    const maps: CustomerMaps = { customerByOrgNr, customerByTripletexId, customerByName };

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
      let candidates: ProjectRow["candidates"] = undefined;
      let error: string | undefined;
      let action: ImportAction = "create";

      if (!projectNumber) {
        matchStatus = "error";
        error = "Mangler prosjektnummer";
        action = "ignore";
      } else {
        // 1. Exact match on tripletex ID
        const tripletexMatch = byTripletexId.get(projectNumber.toLowerCase());
        if (tripletexMatch) {
          matchStatus = "match";
          matchedEntityId = tripletexMatch.id;
          matchedEntityTitle = tripletexMatch.title;
          action = "update";
        } else {
          // 2. Exact match on project number
          const numMatch = byProjectNumber.get(projectNumber.toLowerCase());
          if (numMatch) {
            matchStatus = "match";
            matchedEntityId = numMatch.id;
            matchedEntityTitle = numMatch.title;
            action = "update";
          } else {
            // 3. Fuzzy matching on name + customer
            const fuzzyMatches = allProjects
              .map(e => {
                const nameScore = stringSimilarity(projectName, e.title);
                const customerScore = stringSimilarity(customerName, e.customer || "");
                const combined = nameScore * 0.6 + customerScore * 0.4;
                return { id: e.id, title: e.title, customer: e.customer, score: combined };
              })
              .filter(m => m.score > 0.5)
              .sort((a, b) => b.score - a.score)
              .slice(0, 3);

            if (fuzzyMatches.length > 0) {
              matchStatus = "possible_duplicate";
              candidates = fuzzyMatches;
              matchedEntityId = fuzzyMatches[0].id;
              matchedEntityTitle = fuzzyMatches[0].title;
              action = "create";
            }
          }
        }
      }

      // Resolve customer
      const resolvedCustomerId = customerName || customerNumber
        ? resolveCustomerFromMaps(maps, customerName, customerNumber) ?? undefined
        : undefined;

      const missingCustomer = !!(customerName && !resolvedCustomerId);

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
        candidates,
        action,
        error,
        missingCustomer,
        resolvedCustomerId,
        raw: row,
      };
    });

    // Store customer maps for use during import execution
    customerMapsRef.current = maps;

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

  const updateProjectAction = (idx: number, action: ImportAction, linkedEntityId?: string) => {
    setProjectRows(prev => prev.map(r => {
      if (r.idx !== idx) return r;
      const newRow = { ...r, action };
      if (action === "ignore") {
        newRow.matchStatus = "ignored";
      } else if (action === "link" && linkedEntityId) {
        newRow.matchedEntityId = linkedEntityId;
        const candidate = r.candidates?.find(c => c.id === linkedEntityId);
        newRow.matchedEntityTitle = candidate?.title || r.matchedEntityTitle;
        newRow.matchStatus = "match";
      }
      return newRow;
    }));
  };

  const updateOfferAction = (number: string, action: ImportAction) => {
    setOfferRows(prev => prev.map(r => r.offer.number === number ? { ...r, action, matchStatus: action === "ignore" ? "ignored" : r.matchStatus } : r));
  };

  const canConfirm = () => {
    if (detectedType === "project") {
      return !projectRows.some(r =>
        (r.matchStatus === "needs_review" || r.matchStatus === "possible_duplicate") && r.action !== "ignore" && r.action !== "link" && r.action !== "create"
      );
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
      // Helper to resolve customer_id from CSV row data
      const resolveCustomerId = (customerName: string, customerNumber: string): string | null => {
        const maps = customerMapsRef.current;
        if (!maps) return null;
        // 1. Try org number / tripletex customer ID
        if (customerNumber) {
          const byOrg = maps.customerByOrgNr.get(customerNumber.trim());
          if (byOrg) return byOrg.id;
          const byTx = maps.customerByTripletexId.get(customerNumber.trim());
          if (byTx) return byTx.id;
        }
        // 2. Try exact name match (case-insensitive)
        if (customerName) {
          const byName = maps.customerByName.get(customerName.toLowerCase().trim());
          if (byName) return byName.id;
        }
        return null;
      };

      if (detectedType === "project") {
        for (const row of projectRows) {
          if (row.action === "ignore" || row.matchStatus === "error") {
            ignored++;
            await insertResult(logId, row.projectNumber, "project", "ignored", "Ignorert", row.raw);
            continue;
          }
          const customerId = resolveCustomerId(row.customerName, row.customerNumber);
          try {
            if (row.action === "link" && row.matchedEntityId) {
              // Link to existing project: store tripletex ID + customer_id on it
              await supabase.from("events").update({
                external_tripletex_id: row.projectNumber,
                customer: row.customerName || undefined,
                customer_id: customerId || undefined,
              } as any).eq("id", row.matchedEntityId);
              updated++;
              await insertResult(logId, row.projectNumber, "project", "linked", "Koblet til eksisterende", row.raw, row.matchedEntityId);
            } else if (row.action === "create") {
              // Create as a real MCS project in the events table
              const { data, error: insertError } = await supabase.from("events").insert({
                title: row.projectName || row.projectNumber,
                project_number: row.projectNumber,
                customer: row.customerName,
                customer_id: customerId,
                description: row.description,
                start_time: row.startDate ? `${row.startDate}T08:00:00` : new Date().toISOString(),
                end_time: row.endDate ? `${row.endDate}T16:00:00` : new Date(Date.now() + 86400000 * 90).toISOString(),
                status: "approved" as any,
                project_type: "project",
                company_id: companyId,
                external_tripletex_id: row.projectNumber,
                created_by: user.id,
              } as any).select("id").single();

              if (insertError) {
                console.error("Project insert error:", insertError);
                failed++;
                await insertResult(logId, row.projectNumber, "project", "failed", insertError.message, row.raw);
              } else {
                created++;
                await insertResult(logId, row.projectNumber, "project", "created", "Opprettet", row.raw, data?.id);
              }
            } else if (row.action === "update" && row.matchedEntityId) {
              await supabase.from("events").update({
                title: row.projectName || undefined,
                customer: row.customerName || undefined,
                customer_id: customerId || undefined,
                description: row.description || undefined,
                external_tripletex_id: row.projectNumber,
              } as any).eq("id", row.matchedEntityId);
              updated++;
              await insertResult(logId, row.projectNumber, "project", "updated", "Oppdatert", row.raw, row.matchedEntityId);
            }
          } catch (e: any) {
            failed++;
            await insertResult(logId, row.projectNumber, "project", "failed", e?.message || "Feil ved import", row.raw);
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
