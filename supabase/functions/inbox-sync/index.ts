import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

// ── Debug flag ──
const DEBUG = Deno.env.get("MAIL_INGEST_DEBUG") === "1";
function dbg(...args: any[]) {
  if (DEBUG) console.log("[inbox-sync][DEBUG]", ...args);
}

// ── Azure App Token ──
async function getAppToken(): Promise<string | null> {
  const tenantId = Deno.env.get("AZURE_TENANT_ID");
  const clientId = Deno.env.get("AZURE_CLIENT_ID");
  const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET");
  if (!tenantId || !clientId || !clientSecret) {
    console.error("[inbox-sync] Missing Azure env vars");
    return null;
  }
  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
        scope: "https://graph.microsoft.com/.default",
      }),
    }
  );
  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error(`[inbox-sync] Token error: ${tokenRes.status} ${errText.substring(0, 300)}`);
    return null;
  }
  const tokenData = await tokenRes.json();
  console.log("[inbox-sync] Acquired APPLICATION token");
  return tokenData.access_token;
}

// ── Resolve real Inbox folder ID ──
async function resolveInboxFolderId(msToken: string, mailboxAddress: string): Promise<string | null> {
  try {
    const url = `${GRAPH_BASE}/users/${encodeURIComponent(mailboxAddress)}/mailFolders?$filter=displayName eq 'Inbox' or displayName eq 'Innboks'&$select=id,displayName`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${msToken}` } });
    if (!res.ok) {
      // Fallback: try well-known name
      const url2 = `${GRAPH_BASE}/users/${encodeURIComponent(mailboxAddress)}/mailFolders('Inbox')?$select=id,displayName`;
      const res2 = await fetch(url2, { headers: { Authorization: `Bearer ${msToken}` } });
      if (res2.ok) {
        const d = await res2.json();
        dbg("Resolved inbox folder via well-known:", d.id, d.displayName);
        return d.id;
      }
      return null;
    }
    const data = await res.json();
    const folder = (data.value || [])[0];
    if (folder) {
      dbg("Resolved inbox folder:", folder.id, folder.displayName);
      return folder.id;
    }
    return null;
  } catch (e) {
    console.error("[inbox-sync] resolveInboxFolderId error:", e);
    return null;
  }
}

// ── Fetch Mailbox Messages (FIXED: proper delta handling, folder path, debug logging) ──
async function fetchMailboxMessages(
  msToken: string,
  mailboxAddress: string,
  sinceDate: string,
  isShared: boolean,
  deltaLink: string | null,
  inboxFolderId: string | null,
): Promise<{ messages: any[]; newDeltaLink: string | null; usedEndpoint: string; resetDelta: boolean }> {
  const selectFields = "id,subject,bodyPreview,body,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,hasAttachments,isDraft,isRead,conversationId,internetMessageId,internetMessageHeaders,webLink";
  
  // Use folder ID if available, otherwise use well-known name with parentheses syntax
  const folderRef = inboxFolderId ? `mailFolders/${inboxFolderId}` : "mailFolders('Inbox')";
  
  let url: string;
  let usedEndpoint: string;
  
  if (deltaLink) {
    url = deltaLink;
    usedEndpoint = `deltaLink (cached)`;
  } else if (isShared) {
    url = `${GRAPH_BASE}/users/${encodeURIComponent(mailboxAddress)}/${folderRef}/messages/delta?$top=50&$select=${selectFields}`;
    usedEndpoint = url;
  } else {
    const filter = `receivedDateTime ge ${sinceDate}`;
    url = `${GRAPH_BASE}/users/${encodeURIComponent(mailboxAddress)}/${folderRef}/messages?$filter=${encodeURIComponent(filter)}&$top=50&$orderby=receivedDateTime desc&$select=${selectFields}`;
    usedEndpoint = url;
  }

  dbg("Using endpoint:", usedEndpoint);
  dbg("mailboxAddress:", mailboxAddress);
  dbg("folderRef:", folderRef);

  const allMessages: any[] = [];
  let newDeltaLink: string | null = null;
  let nextLink: string | null = url;
  let pageCount = 0;
  let resetDelta = false;

  while (nextLink) {
    pageCount++;
    const graphRes = await fetch(nextLink, {
      headers: { Authorization: `Bearer ${msToken}` },
    });
    if (!graphRes.ok) {
      const errText = await graphRes.text();
      const status = graphRes.status;
      console.error(`[inbox-sync] Graph error for ${mailboxAddress}: ${status} ${errText.substring(0, 300)}`);
      
      // If delta token is stale/invalid (410 Gone or 400), reset it
      if (deltaLink && (status === 410 || status === 400)) {
        console.warn(`[inbox-sync] Delta token expired/invalid (${status}). Resetting delta for ${mailboxAddress}`);
        resetDelta = true;
        // Retry without delta
        const freshUrl = `${GRAPH_BASE}/users/${encodeURIComponent(mailboxAddress)}/${folderRef}/messages/delta?$top=50&$select=${selectFields}`;
        nextLink = freshUrl;
        continue;
      }
      return { messages: [], newDeltaLink: null, usedEndpoint, resetDelta };
    }
    const graphData = await graphRes.json();
    // Filter out drafts and deleted items (delta can return @removed)
    const msgs = (graphData.value || []).filter((m: any) => !m.isDraft && !m["@removed"]);
    
    dbg(`Page ${pageCount}: ${msgs.length} msgs (raw: ${(graphData.value || []).length})`);
    if (msgs.length > 0) {
      // Log 3 newest for debugging
      const top3 = msgs.slice(0, 3);
      for (const m of top3) {
        dbg(`  -> subject="${m.subject}", received=${m.receivedDateTime}, id=${m.id}, isRead=${m.isRead}`);
      }
    }
    
    allMessages.push(...msgs);
    nextLink = graphData["@odata.nextLink"] || null;
    
    // CRITICAL: Only capture deltaLink from LAST page (when no nextLink)
    if (!nextLink && graphData["@odata.deltaLink"]) {
      newDeltaLink = graphData["@odata.deltaLink"];
      dbg("Captured deltaLink from final page");
    }
  }

  dbg(`Total pages: ${pageCount}, total messages: ${allMessages.length}`);
  return { messages: allMessages, newDeltaLink, usedEndpoint, resetDelta };
}

// ── Verify inbox has messages (fallback check) ──
async function verifyInboxHasMessages(
  msToken: string,
  mailboxAddress: string,
  inboxFolderId: string | null,
): Promise<{ count: number; newest: any[] }> {
  const folderRef = inboxFolderId ? `mailFolders/${inboxFolderId}` : "mailFolders('Inbox')";
  const url = `${GRAPH_BASE}/users/${encodeURIComponent(mailboxAddress)}/${folderRef}/messages?$top=5&$orderby=receivedDateTime desc&$select=id,subject,receivedDateTime,from,isRead`;
  
  const res = await fetch(url, { headers: { Authorization: `Bearer ${msToken}` } });
  if (!res.ok) return { count: 0, newest: [] };
  const data = await res.json();
  const msgs = data.value || [];
  return { count: msgs.length, newest: msgs };
}

// ── Classification Heuristics ──
function classifyMessage(subject: string, bodyPreview: string) {
  const text = `${subject} ${bodyPreview}`.toLowerCase();
  if (text.match(/feil|haste|kritisk|akutt|stopp|nedetid/))
    return { category: "urgent_support", urgency: "critical", recommended_next_action: "call" };
  if (text.match(/bestilling|ordre|po\b|vi aksepterer|vi bestiller|bekreft/))
    return { category: "order", urgency: "high", recommended_next_action: "schedule" };
  if (text.match(/tilbud|pris|kostnadsestimat|gi pris|prisforespørsel|forespørsel/))
    return { category: "quote_request", urgency: "normal", recommended_next_action: "quote" };
  if (text.match(/tavle|samleskinne|busbar|strømskinne|skinne|bryter|ampere|enlinje/))
    return { category: "technical", urgency: "normal", recommended_next_action: "clarify" };
  if (text.match(/schneider|eaton|siemens|3va|pxr|ups|generator|aggregat|datasenter|abb|rittal/))
    return { category: "technical", urgency: "normal", recommended_next_action: "clarify" };
  if (text.match(/125a|160a|250a|400a|630a|800a|1000a|1250a|1600a/))
    return { category: "technical", urgency: "normal", recommended_next_action: "clarify" };
  if (text.match(/faktura|betaling|kreditnota/))
    return { category: "invoice", urgency: "normal", recommended_next_action: "document" };
  if (text.match(/befaring|prosjekt|anlegg|installasjon/))
    return { category: "site_visit", urgency: "normal", recommended_next_action: "schedule" };
  return { category: "general", urgency: "normal", recommended_next_action: "none" };
}

// ── Routing Rules ──
function applyRoutingRules(
  rules: any[], subject: string, bodyPreview: string, fromEmail: string, mailboxAddress: string
): Record<string, any> {
  const result: any = {};
  for (const rule of rules) {
    if (!rule.is_enabled) continue;
    if (rule.mailbox_address && rule.mailbox_address !== mailboxAddress) continue;
    let matched = false;
    if (rule.subject_contains) {
      const keywords = rule.subject_contains.split(",").map((k: string) => k.trim().toLowerCase());
      if (keywords.some((kw: string) => subject.toLowerCase().includes(kw))) matched = true;
    }
    if (rule.body_contains) {
      const keywords = rule.body_contains.split(",").map((k: string) => k.trim().toLowerCase());
      if (keywords.some((kw: string) => bodyPreview.toLowerCase().includes(kw) || subject.toLowerCase().includes(kw))) matched = true;
    }
    if (rule.from_contains && fromEmail.toLowerCase().includes(rule.from_contains.toLowerCase())) matched = true;
    if (matched) {
      if (rule.priority_set) result.priority = rule.priority_set;
      if (rule.status_set) result.status = rule.status_set;
      if (rule.next_action_set) result.next_action = rule.next_action_set;
      if (rule.owner_user_id_set) result.owner_user_id = rule.owner_user_id_set;
      if (rule.scope_set) result.scope = rule.scope_set;
    }
  }
  return result;
}

// ── Subject Normalization ──
function normalizeSubject(raw: string): string {
  let s = raw.trim();
  while (/^(re|sv|vs|fw|fwd)\s*:\s*/i.test(s)) {
    s = s.replace(/^(re|sv|vs|fw|fwd)\s*:\s*/i, "").trim();
  }
  return s;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

// ═══════════════════════════════════════════════════════════════
// ID EXTRACTION ENGINE (v2)
// ═══════════════════════════════════════════════════════════════

type IdType = "case" | "job" | "offer" | "lead" | "project";

interface IdMatch {
  type: IdType;
  pattern: string;
  rawMatch: string;
  lookupValue: string;
  source: "subject" | "body";
}

interface ExtractedIds {
  caseIds: IdMatch[];
  jobIds: IdMatch[];
  offerIds: IdMatch[];
  leadIds: IdMatch[];
  projectIds: IdMatch[];
  standaloneNumbers: IdMatch[];
}

function extractIdsFromText(text: string, source: "subject" | "body"): IdMatch[] {
  const matches: IdMatch[] = [];
  const seen = new Set<string>();

  for (const m of text.matchAll(/[\[\(]?(CASE-(\d{4,6}))[\]\)]?/gi)) {
    const padded = m[2].padStart(6, "0");
    const key = `case:${padded}`;
    if (!seen.has(key)) {
      seen.add(key);
      matches.push({ type: "case", pattern: "full_case", rawMatch: m[0], lookupValue: `CASE-${padded}`, source });
    }
  }

  for (const m of text.matchAll(/[\[\(]?JOB-(\d{4,6})[\]\)]?/gi)) {
    const padded = m[1].padStart(6, "0");
    const key = `job:${padded}`;
    if (!seen.has(key)) {
      seen.add(key);
      matches.push({ type: "job", pattern: "full_job", rawMatch: m[0], lookupValue: `JOB-${padded}`, source });
    }
  }

  for (const m of text.matchAll(/[\[\(]?PROJ-(\d{4,6})[\]\)]?/gi)) {
    const padded = m[1].padStart(6, "0");
    const key = `project:${padded}`;
    if (!seen.has(key)) {
      seen.add(key);
      matches.push({ type: "project", pattern: "full_project", rawMatch: m[0], lookupValue: `PROJ-${padded}`, source });
    }
  }

  for (const m of text.matchAll(/[\[\(]?OFFER-(\d{3,6})[\]\)]?/gi)) {
    const key = `offer:OFFER-${m[1]}`;
    if (!seen.has(key)) {
      seen.add(key);
      matches.push({ type: "offer", pattern: "offer_prefix", rawMatch: m[0], lookupValue: `OFFER-${m[1]}`, source });
    }
  }

  for (const m of text.matchAll(/\bMCS-(\d{4})-(\d{4,6})\b/gi)) {
    const val = `MCS-${m[1]}-${m[2]}`;
    const key = `offer:${val}`;
    if (!seen.has(key)) {
      seen.add(key);
      matches.push({ type: "offer", pattern: "mcs_offer", rawMatch: m[0], lookupValue: val, source });
    }
  }

  for (const m of text.matchAll(/[\[\(]?LEAD-(\d{4})-(\d{4,6})[\]\)]?/gi)) {
    const val = `LEAD-${m[1]}-${m[2]}`;
    const key = `lead:${val}`;
    if (!seen.has(key)) {
      seen.add(key);
      matches.push({ type: "lead", pattern: "full_lead", rawMatch: m[0], lookupValue: val, source });
    }
  }
  for (const m of text.matchAll(/[\[\(]?LEAD-(\d{4,6})[\]\)]?/gi)) {
    if (text.match(new RegExp(`LEAD-\\d{4}-${m[1]}`, "i"))) continue;
    const key = `lead:LEAD-${m[1]}`;
    if (!seen.has(key)) {
      seen.add(key);
      matches.push({ type: "lead", pattern: "short_lead", rawMatch: m[0], lookupValue: `LEAD-${m[1]}`, source });
    }
  }

  return matches;
}

function extractAllIds(normalizedSubject: string, bodyText: string): ExtractedIds {
  const subjectMatches = extractIdsFromText(normalizedSubject, "subject");
  const bodyMatches = extractIdsFromText(bodyText, "body");

  const all: IdMatch[] = [...subjectMatches];
  const seenKeys = new Set(subjectMatches.map(m => `${m.type}:${m.lookupValue}`));
  for (const m of bodyMatches) {
    const key = `${m.type}:${m.lookupValue}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      all.push(m);
    }
  }

  const result: ExtractedIds = { caseIds: [], jobIds: [], offerIds: [], leadIds: [], projectIds: [], standaloneNumbers: [] };
  for (const m of all) {
    switch (m.type) {
      case "case": result.caseIds.push(m); break;
      case "job": result.jobIds.push(m); break;
      case "offer": result.offerIds.push(m); break;
      case "lead": result.leadIds.push(m); break;
      case "project": result.projectIds.push(m); break;
    }
  }

  if (all.length === 0) {
    const combined = normalizedSubject + "\n" + bodyText;
    const sixMatch = combined.match(/\b(\d{6})\b/);
    if (sixMatch) {
      result.standaloneNumbers.push({
        type: "job", pattern: "standalone_6digit", rawMatch: sixMatch[0],
        lookupValue: sixMatch[1], source: normalizedSubject.includes(sixMatch[0]) ? "subject" : "body",
      });
    }
  }

  if (all.length === 0 && result.standaloneNumbers.length === 0) {
    const combined = normalizedSubject + "\n" + bodyText;
    const shortMatch = combined.match(/(?:#|(?:case|sak)\s+)(\d{1,5})\b/i);
    if (shortMatch) {
      result.caseIds.push({
        type: "case", pattern: "short_prefix", rawMatch: shortMatch[0],
        lookupValue: `CASE-${shortMatch[1].padStart(6, "0")}`,
        source: normalizedSubject.includes(shortMatch[0]) ? "subject" : "body",
      });
    }
  }

  return result;
}

// ── Resolve ID matches to UUIDs ──
interface ResolvedLink {
  field: string;
  id: string;
  displayRef: string;
  type: IdType;
  matchSource: "subject" | "body";
  matchedText: string;
}

async function resolveJobId(match: IdMatch, companyId: string, admin: any): Promise<ResolvedLink | null> {
  const { data } = await admin
    .from("events")
    .select("id, internal_number")
    .eq("company_id", companyId)
    .or(`internal_number.eq.${match.lookupValue},job_number.eq.${match.lookupValue}`)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;
  return {
    field: "linked_work_order_id", id: data.id, displayRef: match.lookupValue,
    type: "job", matchSource: match.source, matchedText: match.rawMatch.substring(0, 80),
  };
}

async function resolveCaseId(match: IdMatch, companyId: string, admin: any): Promise<string | null> {
  const { data } = await admin
    .from("cases")
    .select("id")
    .eq("case_number", match.lookupValue)
    .eq("company_id", companyId)
    .maybeSingle();
  return data?.id || null;
}

async function resolveOfferId(match: IdMatch, companyId: string, admin: any): Promise<ResolvedLink | null> {
  const { data } = await admin
    .from("offers")
    .select("id, offer_number")
    .eq("company_id", companyId)
    .or(`offer_number.eq.${match.lookupValue}`)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;
  return {
    field: "linked_offer_id", id: data.id, displayRef: match.lookupValue,
    type: "offer", matchSource: match.source, matchedText: match.rawMatch.substring(0, 80),
  };
}

async function resolveLeadId(match: IdMatch, companyId: string, admin: any): Promise<ResolvedLink | null> {
  const { data } = await admin
    .from("leads")
    .select("id")
    .eq("company_id", companyId)
    .or(`lead_ref_code.eq.${match.lookupValue}`)
    .maybeSingle();
  if (!data) return null;
  return {
    field: "linked_lead_id", id: data.id, displayRef: match.lookupValue,
    type: "lead", matchSource: match.source, matchedText: match.rawMatch.substring(0, 80),
  };
}

async function resolveProjectId(match: IdMatch, companyId: string, admin: any): Promise<ResolvedLink | null> {
  const { data } = await admin
    .from("events")
    .select("id, project_number")
    .eq("company_id", companyId)
    .eq("project_number", match.lookupValue)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;
  return {
    field: "linked_project_id", id: data.id, displayRef: match.lookupValue,
    type: "project", matchSource: match.source, matchedText: match.rawMatch.substring(0, 80),
  };
}

// ── Log system items on case ──
async function logAutoLinkSuccess(admin: any, caseId: string, companyId: string, link: ResolvedLink) {
  await admin.from("case_items").insert({
    case_id: caseId, company_id: companyId, type: "system",
    subject: "auto_link_success",
    body_preview: `Automatisk koblet til ${link.displayRef} (${link.type}) fra e-post ${link.matchSource}. Matchet tekst: "${link.matchedText}"`,
  });
}

async function logAutoLinkFailed(admin: any, caseId: string, companyId: string, match: IdMatch, reason: string) {
  await admin.from("case_items").insert({
    case_id: caseId, company_id: companyId, type: "system",
    subject: "auto_link_failed",
    body_preview: `ID funnet (${match.lookupValue}, type: ${match.type}) i ${match.source}, men ${reason}.`,
  });
}

async function logSuggestedLink(admin: any, caseId: string, companyId: string, match: IdMatch) {
  await admin.from("case_items").insert({
    case_id: caseId, company_id: companyId, type: "system",
    subject: "suggested_link",
    body_preview: `Tall "${match.rawMatch}" funnet i ${match.source}. Mulig referanse – verifiser manuelt.`,
  });
}

async function hasManualLink(admin: any, caseId: string, field: string): Promise<boolean> {
  const { data } = await admin.from("case_items")
    .select("id")
    .eq("case_id", caseId)
    .eq("type", "system")
    .in("subject", ["Koblet til eksisterende", "Tildelt", "Konvertert til lead"])
    .limit(1);
  return (data && data.length > 0);
}

async function logSuggestedAutoLink(admin: any, caseId: string, companyId: string, link: ResolvedLink) {
  await admin.from("case_items").insert({
    case_id: caseId, company_id: companyId, type: "system",
    subject: "suggested_link",
    body_preview: `Auto-kobling til ${link.displayRef} (${link.type}) blokkert – eksisterende manuell kobling bevart. Verifiser manuelt om ønskelig.`,
  });
}

// ── Download & store email attachments ──
async function downloadAndStoreAttachments(
  msToken: string,
  mailboxAddress: string,
  messageId: string,
  caseId: string,
  companyId: string,
  admin: any,
  jobId: string | null,
): Promise<{ meta: any[]; documentIds: string[] }> {
  const attachmentsMeta: any[] = [];
  const documentIds: string[] = [];

  try {
    const url = `${GRAPH_BASE}/users/${encodeURIComponent(mailboxAddress)}/messages/${messageId}/attachments?$select=id,name,contentType,size,isInline`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${msToken}` } });
    if (!res.ok) {
      console.error(`[inbox-sync] Attachments list error: ${res.status}`);
      return { meta: [], documentIds: [] };
    }
    const data = await res.json();
    const attachments = (data.value || []).filter((a: any) => !a.isInline && a["@odata.type"] === "#microsoft.graph.fileAttachment");

    for (const att of attachments.slice(0, 10)) {
      try {
        const contentUrl = `${GRAPH_BASE}/users/${encodeURIComponent(mailboxAddress)}/messages/${messageId}/attachments/${att.id}`;
        const contentRes = await fetch(contentUrl, { headers: { Authorization: `Bearer ${msToken}` } });
        if (!contentRes.ok) continue;
        const contentData = await contentRes.json();
        const base64Content = contentData.contentBytes;
        if (!base64Content) continue;

        const binaryStr = atob(base64Content);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

        const safeName = (att.name || "attachment").replace(/[^\w.\-()]/g, "_");
        const storagePath = `${companyId}/email/${caseId}/${crypto.randomUUID()}-${safeName}`;

        const { error: uploadErr } = await admin.storage
          .from("email-attachments")
          .upload(storagePath, bytes, { contentType: att.contentType || "application/octet-stream" });

        if (uploadErr) {
          console.error(`[inbox-sync] Upload error: ${uploadErr.message}`);
          continue;
        }

        const entityId = jobId || caseId;
        const entityType = jobId ? "job" : "case";

        const { data: docRow, error: docErr } = await admin.from("documents").insert({
          entity_type: entityType, entity_id: entityId,
          file_name: att.name || "attachment", file_path: storagePath,
          mime_type: att.contentType || "application/octet-stream",
          file_size: att.size || bytes.length, storage_bucket: "email-attachments",
          company_id: companyId, source_type: "email", category: "other",
        }).select("id").single();

        if (docErr) {
          console.error(`[inbox-sync] Document insert error: ${docErr.message}`);
        } else {
          documentIds.push(docRow.id);
        }

        attachmentsMeta.push({
          filename: att.name, size: att.size, contentType: att.contentType,
          storagePath, documentId: docRow?.id || null,
        });
      } catch (attErr) {
        console.error(`[inbox-sync] Attachment processing error:`, attErr);
      }
    }
  } catch (err) {
    console.error(`[inbox-sync] Attachments download error:`, err);
  }

  return { meta: attachmentsMeta, documentIds };
}

// ── Trigger AI classification ──
async function triggerClassification(documentIds: string[], supabaseUrl: string, serviceRoleKey: string) {
  if (documentIds.length === 0) return;
  try {
    await fetch(`${supabaseUrl}/functions/v1/classify-attachment`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ document_ids: documentIds }),
    });
    console.log(`[inbox-sync] Triggered classification for ${documentIds.length} attachments`);
  } catch (err) {
    console.error("[inbox-sync] Classification trigger error:", err);
  }
}

// ── Mention parsing ──
function parseMentionsFromText(text: string): { emails: string[]; names: string[] } {
  const emails: string[] = [];
  const names: string[] = [];
  for (const m of text.matchAll(/@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g)) {
    const email = m[1].toLowerCase();
    if (!emails.includes(email)) emails.push(email);
  }
  for (const m of text.matchAll(/@"([^"]+)"|@(\w{2,30})/g)) {
    const name = m[1] || m[2];
    if (name && !name.includes("@") && !names.includes(name)) names.push(name);
  }
  return { emails, names };
}

async function parseMentionsAndResolve(
  text: string, companyId: string, admin: any
): Promise<{ mentionedEmails: string[]; mentionedUserIds: string[] }> {
  const { emails, names } = parseMentionsFromText(text);
  if (emails.length === 0 && names.length === 0) return { mentionedEmails: [], mentionedUserIds: [] };

  const resolvedUserIds: string[] = [];

  if (emails.length > 0) {
    const { data: techs } = await admin.from("technicians").select("user_id, email").not("user_id", "is", null);
    if (techs) {
      for (const email of emails) {
        const match = techs.find((t: any) => t.email?.toLowerCase() === email);
        if (match?.user_id && !resolvedUserIds.includes(match.user_id)) resolvedUserIds.push(match.user_id);
      }
    }
  }

  if (names.length > 0) {
    const { data: techs } = await admin.from("technicians").select("user_id, name").not("user_id", "is", null);
    if (techs) {
      for (const mention of names) {
        const lower = mention.toLowerCase();
        const match = techs.find((t: any) =>
          t.name?.toLowerCase() === lower ||
          t.name?.toLowerCase().startsWith(lower) ||
          t.name?.toLowerCase().includes(lower)
        );
        if (match?.user_id && !resolvedUserIds.includes(match.user_id)) resolvedUserIds.push(match.user_id);
      }
    }
  }

  dbg(`Mentions: emails=${emails.join(",")}, names=${names.join(",")}, resolved=${resolvedUserIds.length}`);
  return { mentionedEmails: emails, mentionedUserIds: resolvedUserIds };
}

// ═══════════════════════════════════════════════════════════════
// CONVERSATION THREAD MATCHING (NEW)
// Matches inbound mail to conversation_threads via:
//   1. thread+ recipient token
//   2. In-Reply-To / References headers
//   3. Subject token [JOB-XXXXXX]
// ═══════════════════════════════════════════════════════════════

interface ConversationMatchResult {
  threadId: string;
  thread: any;
  matchMethod: string;
}

async function matchToConversationThread(
  msg: any,
  headers: any[],
  normalizedSubject: string,
  admin: any,
): Promise<ConversationMatchResult | null> {
  const toRecipients = (msg.toRecipients || []).map((r: any) => r.emailAddress?.address || "");
  const ccRecipients = (msg.ccRecipients || []).map((r: any) => r.emailAddress?.address || "");
  const allAddresses = [...toRecipients, ...ccRecipients].join(" ");

  // Also check X-MS-Exchange-Original-Recipients and X-Original-To for relay scenarios
  const xOrigRecipients = headers.find((h: any) => 
    h.name?.toLowerCase() === "x-ms-exchange-organization-originalenveloperecipients" || 
    h.name?.toLowerCase() === "x-original-to"
  )?.value || "";
  const allWithRelay = `${allAddresses} ${xOrigRecipients}`;

  // Strategy 1: thread+ token in recipients
  const threadTokenMatch = allWithRelay.match(/thread\+([a-f0-9-]+)@/i);
  if (threadTokenMatch) {
    const token = threadTokenMatch[1];
    const { data } = await admin.from("conversation_threads").select("*")
      .or(`inbound_token.eq.${token},id.eq.${token}`).maybeSingle();
    if (data) {
      dbg(`Conversation match via thread+ token: ${token}`);
      return { threadId: data.id, thread: data, matchMethod: "thread_token" };
    }
  }

  // Strategy 1b: X-MCS-Thread-Token header
  const xMcsThreadToken = headers.find((h: any) => h.name === "X-MCS-Thread-Token")?.value;
  if (xMcsThreadToken) {
    const { data } = await admin.from("conversation_threads").select("*")
      .eq("inbound_token", xMcsThreadToken).maybeSingle();
    if (data) {
      dbg(`Conversation match via X-MCS-Thread-Token: ${xMcsThreadToken}`);
      return { threadId: data.id, thread: data, matchMethod: "x_header_token" };
    }
  }

  // Strategy 2: In-Reply-To / References matching existing conversation_email_messages
  const inReplyTo = headers.find((h: any) => h.name?.toLowerCase() === "in-reply-to")?.value || null;
  const referencesHeader = headers.find((h: any) => h.name?.toLowerCase() === "references")?.value || null;

  if (inReplyTo) {
    const { data: em } = await admin.from("conversation_email_messages")
      .select("thread_id")
      .eq("outlook_internet_message_id", inReplyTo)
      .limit(1).maybeSingle();
    if (em?.thread_id) {
      const { data: t } = await admin.from("conversation_threads").select("*").eq("id", em.thread_id).single();
      if (t) {
        dbg(`Conversation match via In-Reply-To: ${inReplyTo}`);
        return { threadId: t.id, thread: t, matchMethod: "in_reply_to" };
      }
    }
  }

  if (referencesHeader) {
    const refIds = referencesHeader.split(/\s+/).filter(Boolean).slice(0, 5);
    for (const refId of refIds) {
      const { data: em } = await admin.from("conversation_email_messages")
        .select("thread_id")
        .eq("outlook_internet_message_id", refId)
        .limit(1).maybeSingle();
      if (em?.thread_id) {
        const { data: t } = await admin.from("conversation_threads").select("*").eq("id", em.thread_id).single();
        if (t) {
          dbg(`Conversation match via References: ${refId}`);
          return { threadId: t.id, thread: t, matchMethod: "references" };
        }
      }
    }
  }

  // Strategy 3: conversationId match
  if (msg.conversationId) {
    const { data: em } = await admin.from("conversation_email_messages")
      .select("thread_id")
      .eq("outlook_conversation_id", msg.conversationId)
      .limit(1).maybeSingle();
    if (em?.thread_id) {
      const { data: t } = await admin.from("conversation_threads").select("*").eq("id", em.thread_id).single();
      if (t) {
        dbg(`Conversation match via conversationId: ${msg.conversationId}`);
        return { threadId: t.id, thread: t, matchMethod: "conversation_id" };
      }
    }
  }

  // Strategy 4: Subject [JOB-XXXXXX] → project → email-enabled thread
  const jobMatch = normalizedSubject.match(/JOB-(\d{4,6})/i);
  if (jobMatch) {
    const jobRef = `JOB-${jobMatch[1].padStart(6, "0")}`;
    const { data: proj } = await admin.from("events").select("id").eq("internal_number", jobRef).maybeSingle();
    if (proj) {
      const { data: t } = await admin.from("conversation_threads").select("*")
        .eq("project_id", proj.id).eq("email_enabled", true)
        .order("last_activity_at", { ascending: false }).limit(1).maybeSingle();
      if (t) {
        dbg(`Conversation match via subject JOB ref: ${jobRef}`);
        return { threadId: t.id, thread: t, matchMethod: "subject_job_ref" };
      }
    }
  }

  return null;
}

// ── Create conversation post from inbound mail ──
async function createConversationPost(
  msg: any,
  thread: any,
  threadId: string,
  admin: any,
  msToken: string,
  mailboxAddress: string,
): Promise<string | null> {
  const senderEmail = msg.from?.emailAddress?.address?.toLowerCase();
  const senderName = msg.from?.emailAddress?.name || senderEmail;

  // Reopen closed thread
  if (thread.status === "closed") {
    await admin.from("conversation_threads")
      .update({ status: "open", closed_at: null, closed_by: null }).eq("id", threadId);
    await admin.from("conversation_posts").insert({
      thread_id: threadId, company_id: thread.company_id, post_type: "system",
      body_text: `Tråden ble gjenåpnet av innkommende e-post fra ${senderName}`,
    });
  }

  // Create post
  const { data: post } = await admin.from("conversation_posts").insert({
    thread_id: threadId, company_id: thread.company_id,
    post_type: "email", subject: msg.subject,
    body_html: msg.body?.content || "",
    body_text: msg.bodyPreview || "",
    from_email: senderEmail, from_name: senderName,
    to_emails: (msg.toRecipients || []).map((r: any) => r.emailAddress?.address),
    cc_emails: (msg.ccRecipients || []).map((r: any) => r.emailAddress?.address),
    sent_at: msg.receivedDateTime || new Date().toISOString(),
    direction: "inbound",
    outlook_message_id: msg.id,
    outlook_weblink: msg.webLink || null,
  }).select("id").single();

  if (!post) return null;

  // Handle attachments
  if (msg.hasAttachments) {
    try {
      const attResp = await fetch(
        `${GRAPH_BASE}/users/${encodeURIComponent(mailboxAddress)}/messages/${msg.id}/attachments`,
        { headers: { Authorization: `Bearer ${msToken}` } }
      );
      if (attResp.ok) {
        const attData = await attResp.json();
        for (const att of (attData.value || [])) {
          if (att["@odata.type"] === "#microsoft.graph.fileAttachment" && att.contentBytes) {
            const bytes = Uint8Array.from(atob(att.contentBytes), c => c.charCodeAt(0));
            const filePath = `${thread.company_id}/${thread.project_id}/${threadId}/${Date.now()}_${att.name}`;
            const { error: upErr } = await admin.storage
              .from("conversation-files")
              .upload(filePath, bytes, { contentType: att.contentType });
            if (!upErr) {
              await admin.from("conversation_attachments").insert({
                post_id: post.id, file_name: att.name,
                file_size: att.size || bytes.length,
                mime_type: att.contentType || null, storage_path: filePath,
              });
            }
          }
        }
      }
    } catch (attErr) {
      console.error("[inbox-sync] Conversation attachment error:", attErr);
    }
  }

  // Log email message for observability
  const { error: cemErr } = await admin.from("conversation_email_messages").insert({
    company_id: thread.company_id, thread_id: threadId,
    post_id: post.id, direction: "inbound", provider: "graph",
    outlook_message_id: msg.id,
    outlook_conversation_id: msg.conversationId || null,
    outlook_internet_message_id: msg.internetMessageId || null,
    subject: msg.subject,
    from_email: senderEmail,
    to_emails: (msg.toRecipients || []).map((r: any) => r.emailAddress?.address),
    cc_emails: (msg.ccRecipients || []).map((r: any) => r.emailAddress?.address),
    status: "received", processing_status: "ok",
    processed_at: new Date().toISOString(),
  });
  if (cemErr) console.error("[inbox-sync] conversation_email_messages insert error:", cemErr);

  return post.id;
}

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const runId = crypto.randomUUID().substring(0, 8);
  const runStart = Date.now();
  console.log(`[inbox-sync] ▶ Run ${runId} started at ${new Date().toISOString()}`);

  const respond = (data: any, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return respond({ error: "Unauthorized" }, 401);

    const supabaseAuthed = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: authedUser }, error: userErr } = await supabaseAuthed.auth.getUser();
    if (userErr || !authedUser) return respond({ error: "Invalid session" }, 401);
    const userId = authedUser.id;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const msToken = await getAppToken();
    if (!msToken) return respond({ error: "Kunne ikke hente applikasjonstoken for Microsoft Graph." }, 500);

    const { data: mailboxes } = await supabaseAdmin
      .from("mailboxes").select("address, display_name, graph_delta_link, id").eq("is_enabled", true);
    const enabledMailboxes = mailboxes || [];

    const { data: routingRules } = await supabaseAdmin
      .from("case_routing_rules").select("*").eq("is_enabled", true);
    const rules = routingRules || [];

    const { data: companies } = await supabaseAdmin
      .from("internal_companies").select("id").eq("is_active", true).limit(1);
    const companyId = companies?.[0]?.id;
    if (!companyId) return respond({ error: "No active company found" }, 400);

    const { data: soSettings } = await supabaseAdmin
      .from("superoffice_settings").select("*").eq("company_id", companyId).maybeSingle();

    const defaultScope = soSettings?.default_case_scope || "company";
    const defaultStatus = soSettings?.default_case_status || "new";
    const defaultPriority = soSettings?.default_priority || "normal";
    const autoTriageEnabled = soSettings?.auto_triage_enabled || false;
    const autoAssignEnabled = soSettings?.auto_assign_enabled || false;
    const autoAssignSalesUserId = soSettings?.auto_assign_sales_user_id || null;
    const autoAssignServiceUserId = soSettings?.auto_assign_service_user_id || null;

    const sinceDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    let totalFetched = 0, totalNewCases = 0, totalNewItems = 0, totalSkipped = 0, totalLinked = 0;
    let totalConversationMatches = 0, totalDropped = 0;
    const allDocumentIds: string[] = [];
    const dropReasons: Record<string, number> = {};

    function logDrop(reason: string, subject?: string) {
      dropReasons[reason] = (dropReasons[reason] || 0) + 1;
      totalDropped++;
      dbg(`DROP: reason=${reason}, subject="${(subject || "").substring(0, 60)}"`);
    }

    for (const mb of enabledMailboxes) {
      console.log(`[inbox-sync][${runId}] Fetching from: ${mb.address}`);
      let mbError: string | null = null;
      let mbCount = 0;

      try {
        // Resolve real inbox folder ID for robustness
        const inboxFolderId = await resolveInboxFolderId(msToken, mb.address);
        dbg("Resolved inboxFolderId:", inboxFolderId || "(using well-known 'Inbox')");

        const { messages, newDeltaLink, usedEndpoint, resetDelta } = await fetchMailboxMessages(
          msToken, mb.address, sinceDate, true, mb.graph_delta_link, inboxFolderId
        );
        console.log(`[inbox-sync][${runId}] Got ${messages.length} messages from ${mb.address} (endpoint: ${usedEndpoint.substring(0, 120)})`);
        totalFetched += messages.length;
        mbCount = messages.length;

        // CRITICAL FIX: If delta returned 0 messages, verify inbox actually has messages
        if (messages.length === 0 && mb.graph_delta_link) {
          const verification = await verifyInboxHasMessages(msToken, mb.address, inboxFolderId);
          if (verification.count > 0) {
            console.warn(`[inbox-sync][${runId}] Delta returned 0 but inbox has ${verification.count} messages. Newest: "${verification.newest[0]?.subject}". Resetting deltaLink.`);
            // Reset delta and re-fetch
            await supabaseAdmin.from("mailboxes").update({ graph_delta_link: null }).eq("id", mb.id);
            
            // Re-fetch without delta (full sync limited to sinceDate)
            const freshResult = await fetchMailboxMessages(
              msToken, mb.address, sinceDate, true, null, inboxFolderId
            );
            console.log(`[inbox-sync][${runId}] Fresh fetch got ${freshResult.messages.length} messages`);
            
            // Process fresh messages below
            if (freshResult.newDeltaLink) {
              await supabaseAdmin.from("mailboxes").update({ graph_delta_link: freshResult.newDeltaLink }).eq("id", mb.id);
            }
            
            // Replace messages array for processing
            messages.push(...freshResult.messages);
            totalFetched += freshResult.messages.length;
            mbCount = freshResult.messages.length;
          }
        } else if (newDeltaLink) {
          // Only save deltaLink AFTER all pages have been consumed (already ensured in fetchMailboxMessages)
          await supabaseAdmin.from("mailboxes").update({ graph_delta_link: newDeltaLink }).eq("id", mb.id);
        }

        if (resetDelta) {
          await supabaseAdmin.from("mailboxes").update({ graph_delta_link: null }).eq("id", mb.id);
        }

        for (const msg of messages) {
          const msgSubject = msg.subject || "(Ingen emne)";
          
          // ── STEP 0: Check if already processed (case_items by external_id) ──
          const { data: existingItem } = await supabaseAdmin
            .from("case_items").select("id, case_id").eq("external_id", msg.id).maybeSingle();
          if (existingItem) { 
            logDrop("already_processed_case_item", msgSubject);
            totalSkipped++; 
            continue; 
          }

          // ── STEP 0b: Check if already processed (conversation_email_messages by internet_message_id) ──
          if (msg.internetMessageId) {
            const { data: existingConv } = await supabaseAdmin
              .from("conversation_email_messages")
              .select("id")
              .eq("outlook_internet_message_id", msg.internetMessageId)
              .maybeSingle();
            if (existingConv) {
              logDrop("already_processed_conversation", msgSubject);
              totalSkipped++;
              continue;
            }
          }

          // ── STEP 0b2: Check if already processed (conversation_posts by outlook_message_id) ──
          {
            const { data: existingPost } = await supabaseAdmin
              .from("conversation_posts")
              .select("id")
              .eq("outlook_message_id", msg.id)
              .maybeSingle();
            if (existingPost) {
              logDrop("already_processed_conv_post", msgSubject);
              totalSkipped++;
              continue;
            }
          }

          // ── STEP 0c: Check if already processed (case_items by internet_message_id) ──
          if (msg.internetMessageId) {
            const { data: existingByInetId } = await supabaseAdmin
              .from("case_items")
              .select("id")
              .eq("internet_message_id", msg.internetMessageId)
              .maybeSingle();
            if (existingByInetId) {
              logDrop("already_processed_inet_id", msgSubject);
              totalSkipped++;
              continue;
            }
          }

          // ── NOTE: We do NOT filter by isRead. Process all messages not already processed. ──

          const headers = msg.internetMessageHeaders || [];
          const normalizedSubject = normalizeSubject(msgSubject);
          const fromEmail = msg.from?.emailAddress?.address || "";
          const fromName = msg.from?.emailAddress?.name || "";
          const bodyPreview = (msg.bodyPreview || "").substring(0, 500);
          const bodyHtml = msg.body?.content || null;
          const bodyText = bodyHtml ? stripHtml(bodyHtml).substring(0, 5000) : bodyPreview;
          const sentAt = msg.sentDateTime || msg.receivedDateTime || null;
          const internetMessageId = msg.internetMessageId || null;
          const conversationId = msg.conversationId || null;
          const toRecipients = (msg.toRecipients || []).map((r: any) => r.emailAddress?.address).filter(Boolean);
          const ccRecipients = (msg.ccRecipients || []).map((r: any) => r.emailAddress?.address).filter(Boolean);

          const inReplyTo = headers.find((h: any) => h.name?.toLowerCase() === "in-reply-to")?.value || null;
          const referencesHeader = headers.find((h: any) => h.name?.toLowerCase() === "references")?.value || null;

          const xMcsEntity = headers.find((h: any) => h.name?.toLowerCase() === "x-mcs-entity")?.value || null;
          const xMcsId = headers.find((h: any) => h.name?.toLowerCase() === "x-mcs-id")?.value || null;
          const xMcsThread = headers.find((h: any) => h.name?.toLowerCase() === "x-mcs-thread")?.value || null;

          // ═══════════════════════════════════════════════
          // TRY CONVERSATION THREAD MATCHING FIRST
          // ═══════════════════════════════════════════════
          const convMatch = await matchToConversationThread(msg, headers, normalizedSubject, supabaseAdmin);
          if (convMatch) {
            console.log(`[inbox-sync][${runId}] Conversation match: method=${convMatch.matchMethod}, threadId=${convMatch.threadId}, subject="${msgSubject.substring(0, 60)}"`);
            const postId = await createConversationPost(msg, convMatch.thread, convMatch.threadId, supabaseAdmin, msToken, mb.address);
            if (postId) {
              totalConversationMatches++;
              totalNewItems++;
              dbg(`Created conversation post ${postId} in thread ${convMatch.threadId}`);
            }
            continue; // Don't also create a case item
          }

          // ═══════════════════════════════════════════════
          // CASE ROUTING (existing logic)
          // ═══════════════════════════════════════════════
          let routingMethod: string = "new_case";
          const extracted = extractAllIds(normalizedSubject, bodyText);
          let caseId: string | null = null;
          const linkedUpdates: Record<string, string> = {};
          const resolvedLinks: ResolvedLink[] = [];
          const failedMatches: { match: IdMatch; reason: string }[] = [];

          // STEP 0: X-MCS-ID header
          if (xMcsId) {
            dbg(`Found X-MCS-ID header: ${xMcsId}, entity: ${xMcsEntity}`);
            const xMatches = extractIdsFromText(xMcsId, "subject");
            for (const xm of xMatches) {
              if (xm.type === "case") {
                const resolved = await resolveCaseId(xm, companyId, supabaseAdmin);
                if (resolved) { caseId = resolved; routingMethod = "xheader"; break; }
              } else {
                let resolved: ResolvedLink | null = null;
                switch (xm.type) {
                  case "job": resolved = await resolveJobId(xm, companyId, supabaseAdmin); break;
                  case "project": resolved = await resolveProjectId(xm, companyId, supabaseAdmin); break;
                  case "offer": resolved = await resolveOfferId(xm, companyId, supabaseAdmin); break;
                  case "lead": resolved = await resolveLeadId(xm, companyId, supabaseAdmin); break;
                }
                if (resolved) {
                  linkedUpdates[resolved.field] = resolved.id;
                  resolvedLinks.push(resolved);
                  routingMethod = "xheader";
                }
              }
            }
            if (!caseId && xMcsThread) {
              const { data: threadCase } = await supabaseAdmin
                .from("cases").select("id")
                .or(`linked_work_order_id.eq.${xMcsThread},linked_project_id.eq.${xMcsThread},linked_lead_id.eq.${xMcsThread},linked_offer_id.eq.${xMcsThread}`)
                .eq("company_id", companyId).limit(1).maybeSingle();
              if (threadCase) { caseId = threadCase.id; routingMethod = "xheader_thread"; }
            }
          }

          // STEP 1: In-Reply-To / References → outgoing communication_logs
          if (!caseId && !routingMethod.startsWith("xheader")) {
            if (inReplyTo) {
              const { data: outLog } = await supabaseAdmin
                .from("communication_logs").select("entity_type, entity_id")
                .eq("internet_message_id", inReplyTo).eq("direction", "outbound").limit(1).maybeSingle();
              if (outLog) {
                dbg(`Matched outgoing via In-Reply-To -> ${outLog.entity_type}/${outLog.entity_id}`);
                const { data: linkedCase } = await supabaseAdmin
                  .from("cases").select("id")
                  .or(`linked_work_order_id.eq.${outLog.entity_id},linked_project_id.eq.${outLog.entity_id},linked_lead_id.eq.${outLog.entity_id},linked_offer_id.eq.${outLog.entity_id}`)
                  .eq("company_id", companyId).limit(1).maybeSingle();
                if (linkedCase) { caseId = linkedCase.id; routingMethod = "in_reply_to_outgoing"; }
                else {
                  const fieldMap: Record<string, string> = { job: "linked_work_order_id", lead: "linked_lead_id", case: "linked_work_order_id" };
                  linkedUpdates[fieldMap[outLog.entity_type] || "linked_work_order_id"] = outLog.entity_id;
                  routingMethod = "in_reply_to_outgoing";
                }
              }
            }
            if (!caseId && routingMethod === "new_case" && referencesHeader) {
              const refIds = referencesHeader.split(/\s+/).filter(Boolean).slice(0, 5);
              for (const refId of refIds) {
                const { data: outLog } = await supabaseAdmin
                  .from("communication_logs").select("entity_type, entity_id")
                  .eq("internet_message_id", refId).eq("direction", "outbound").limit(1).maybeSingle();
                if (outLog) {
                  const { data: linkedCase } = await supabaseAdmin
                    .from("cases").select("id")
                    .or(`linked_work_order_id.eq.${outLog.entity_id},linked_project_id.eq.${outLog.entity_id},linked_lead_id.eq.${outLog.entity_id},linked_offer_id.eq.${outLog.entity_id}`)
                    .eq("company_id", companyId).limit(1).maybeSingle();
                  if (linkedCase) { caseId = linkedCase.id; routingMethod = "references_outgoing"; }
                  else {
                    const fieldMap: Record<string, string> = { job: "linked_work_order_id", lead: "linked_lead_id" };
                    linkedUpdates[fieldMap[outLog.entity_type] || "linked_work_order_id"] = outLog.entity_id;
                    routingMethod = "references_outgoing";
                  }
                  break;
                }
              }
            }
          }

          // STEP 2: conversationId → existing case thread_id
          if (!caseId && routingMethod === "new_case") {
            const threadId = msg.conversationId || msg.id;
            const { data: existingCase } = await supabaseAdmin
              .from("cases").select("id").eq("thread_id", threadId).eq("company_id", companyId).maybeSingle();
            if (existingCase) { caseId = existingCase.id; routingMethod = "thread_id"; }
          }

          // STEP 3: Subject/body ID extraction
          if (!caseId && routingMethod === "new_case") {
            // Case IDs (highest priority)
            for (const cm of extracted.caseIds) {
              const resolved = await resolveCaseId(cm, companyId, supabaseAdmin);
              if (resolved) { caseId = resolved; routingMethod = "subject_case_id"; break; }
              else failedMatches.push({ match: cm, reason: "CASE-nummer ikke funnet i databasen" });
            }
          }
          if (!caseId && routingMethod === "new_case") {
            for (const jm of extracted.jobIds) {
              const resolved = await resolveJobId(jm, companyId, supabaseAdmin);
              if (resolved) {
                linkedUpdates[resolved.field] = resolved.id;
                resolvedLinks.push(resolved);
                routingMethod = "subject_job_id";
                // Try to find existing case for this job
                const { data: existingCase } = await supabaseAdmin
                  .from("cases").select("id").eq("linked_work_order_id", resolved.id).eq("company_id", companyId).limit(1).maybeSingle();
                if (existingCase) caseId = existingCase.id;
                break;
              } else failedMatches.push({ match: jm, reason: "JOB-nummer ikke funnet i databasen" });
            }
          }
          if (!caseId && routingMethod === "new_case") {
            for (const om of extracted.offerIds) {
              const resolved = await resolveOfferId(om, companyId, supabaseAdmin);
              if (resolved) {
                linkedUpdates[resolved.field] = resolved.id;
                resolvedLinks.push(resolved);
                routingMethod = "subject_offer_id";
                const { data: existingCase } = await supabaseAdmin
                  .from("cases").select("id").eq("linked_offer_id", resolved.id).eq("company_id", companyId).limit(1).maybeSingle();
                if (existingCase) caseId = existingCase.id;
                break;
              } else failedMatches.push({ match: om, reason: "Tilbudsnummer ikke funnet i databasen" });
            }
          }
          if (!caseId && routingMethod === "new_case") {
            for (const lm of extracted.leadIds) {
              const resolved = await resolveLeadId(lm, companyId, supabaseAdmin);
              if (resolved) {
                linkedUpdates[resolved.field] = resolved.id;
                resolvedLinks.push(resolved);
                routingMethod = "subject_lead_id";
                const { data: existingCase } = await supabaseAdmin
                  .from("cases").select("id").eq("linked_lead_id", resolved.id).eq("company_id", companyId).limit(1).maybeSingle();
                if (existingCase) caseId = existingCase.id;
                break;
              } else failedMatches.push({ match: lm, reason: "Lead-referanse ikke funnet i databasen" });
            }
          }
          if (!caseId && routingMethod === "new_case") {
            for (const pm of extracted.projectIds) {
              const resolved = await resolveProjectId(pm, companyId, supabaseAdmin);
              if (resolved) {
                linkedUpdates[resolved.field] = resolved.id;
                resolvedLinks.push(resolved);
                routingMethod = "subject_project_id";
                const { data: existingCase } = await supabaseAdmin
                  .from("cases").select("id").eq("linked_project_id", resolved.id).eq("company_id", companyId).limit(1).maybeSingle();
                if (existingCase) caseId = existingCase.id;
                break;
              } else failedMatches.push({ match: pm, reason: "Prosjektnummer ikke funnet i databasen" });
            }
          }

          // STEP 4: In-Reply-To / References inbound threading
          if (!caseId && inReplyTo) {
            const { data: replyItem } = await supabaseAdmin
              .from("case_items").select("case_id")
              .eq("internet_message_id", inReplyTo).eq("company_id", companyId).maybeSingle();
            if (replyItem) {
              caseId = replyItem.case_id;
              if (routingMethod === "new_case") routingMethod = "in_reply_to";
              dbg(`Matched case via In-Reply-To header -> ${caseId}`);
            }
          }
          if (!caseId && referencesHeader) {
            const refIds = referencesHeader.split(/\s+/).filter(Boolean).slice(0, 5);
            for (const refId of refIds) {
              const { data: refItem } = await supabaseAdmin
                .from("case_items").select("case_id")
                .eq("internet_message_id", refId).eq("company_id", companyId).maybeSingle();
              if (refItem) {
                caseId = refItem.case_id;
                if (routingMethod === "new_case") routingMethod = "references";
                dbg(`Matched case via References header -> ${caseId}`);
                break;
              }
            }
          }

          dbg(`Routing decision: method=${routingMethod}, caseId=${caseId || "new"}, links=${Object.keys(linkedUpdates).join(",") || "none"}`);

          if (caseId) {
            const updatePayload: any = {
              updated_at: new Date().toISOString(),
              last_activity_at: new Date().toISOString(),
            };

            const safeLinkedUpdates: Record<string, string> = {};
            const blockedLinks: ResolvedLink[] = [];

            if (Object.keys(linkedUpdates).length > 0) {
              const { data: currentCase } = await supabaseAdmin
                .from("cases").select("linked_work_order_id, linked_project_id, linked_lead_id, linked_offer_id")
                .eq("id", caseId).single();

              for (const [field, id] of Object.entries(linkedUpdates)) {
                const existingValue = currentCase?.[field as keyof typeof currentCase];
                if (existingValue && existingValue !== id) {
                  const isManual = await hasManualLink(supabaseAdmin, caseId, field);
                  if (isManual) {
                    const link = resolvedLinks.find(l => l.field === field);
                    if (link) blockedLinks.push(link);
                    dbg(`Blocked auto-link ${field}=${id} on case ${caseId}`);
                    continue;
                  }
                }
                safeLinkedUpdates[field] = id;
              }

              if (Object.keys(safeLinkedUpdates).length > 0) {
                Object.assign(updatePayload, safeLinkedUpdates);
                totalLinked++;
              }
            }
            await supabaseAdmin.from("cases").update(updatePayload).eq("id", caseId);

            for (const link of resolvedLinks) {
              if (blockedLinks.includes(link)) await logSuggestedAutoLink(supabaseAdmin, caseId, companyId, link);
              else if (safeLinkedUpdates[link.field]) await logAutoLinkSuccess(supabaseAdmin, caseId, companyId, link);
            }
            for (const f of failedMatches) await logAutoLinkFailed(supabaseAdmin, caseId, companyId, f.match, f.reason);
            for (const sn of extracted.standaloneNumbers) await logSuggestedLink(supabaseAdmin, caseId, companyId, sn);
            if (routingMethod !== "new_case") {
              await supabaseAdmin.from("case_items").insert({
                case_id: caseId, company_id: companyId, type: "system",
                subject: "routing_decision",
                body_preview: `E-post rutet via ${routingMethod}. Subject: "${msgSubject.substring(0, 80)}"`,
              });
            }
          } else {
            // Create new case
            const ai = autoTriageEnabled
              ? classifyMessage(msgSubject, bodyPreview)
              : { category: "general", urgency: "normal", recommended_next_action: "none" };
            const routing = applyRoutingRules(rules, msgSubject, bodyPreview, fromEmail, mb.address);

            let autoOwner = routing.owner_user_id || null;
            if (!autoOwner && autoAssignEnabled) {
              if (["quote_request", "order"].includes(ai.category) && autoAssignSalesUserId)
                autoOwner = autoAssignSalesUserId;
              else if (["technical", "urgent_support", "site_visit"].includes(ai.category) && autoAssignServiceUserId)
                autoOwner = autoAssignServiceUserId;
            }

            const hasLinks = Object.keys(linkedUpdates).length > 0;
            const threadId = msg.conversationId || msg.id;
            const newCase: any = {
              company_id: companyId, title: msgSubject,
              status: routing.status || (hasLinks ? "triage" : (autoTriageEnabled && ai.urgency !== "normal" ? "triage" : defaultStatus)),
              priority: routing.priority || (autoTriageEnabled ? (ai.urgency === "critical" ? "critical" : ai.urgency === "high" ? "high" : defaultPriority) : defaultPriority),
              next_action: routing.next_action || (autoTriageEnabled ? ai.recommended_next_action : "none") || "none",
              scope: routing.scope || defaultScope,
              mailbox_address: mb.address, thread_id: threadId,
              owner_user_id: autoOwner, ...linkedUpdates,
            };

            const { data: createdCase, error: caseErr } = await supabaseAdmin
              .from("cases").insert(newCase).select("id").single();
            if (caseErr) {
              console.error(`[inbox-sync] Case create error: ${caseErr.message}`);
              totalSkipped++;
              continue;
            }
            caseId = createdCase.id;
            totalNewCases++;
            if (hasLinks) totalLinked++;

            for (const link of resolvedLinks) await logAutoLinkSuccess(supabaseAdmin, caseId, companyId, link);
            for (const f of failedMatches) await logAutoLinkFailed(supabaseAdmin, caseId, companyId, f.match, f.reason);
            for (const sn of extracted.standaloneNumbers) await logSuggestedLink(supabaseAdmin, caseId, companyId, sn);
            if (routingMethod !== "new_case") {
              await supabaseAdmin.from("case_items").insert({
                case_id: caseId, company_id: companyId, type: "system",
                subject: "routing_decision",
                body_preview: `Ny sak opprettet og rutet via ${routingMethod}. Subject: "${msgSubject.substring(0, 80)}"`,
              });
            }
          }

          // ── MENTION PARSING ──
          const mentionText = bodyText || bodyPreview || "";
          const { mentionedEmails, mentionedUserIds } = await parseMentionsAndResolve(mentionText, companyId, supabaseAdmin);

          const { data: insertedCaseItem, error: itemErr } = await supabaseAdmin.from("case_items").insert({
            company_id: companyId, case_id: caseId, type: "email",
            external_id: msg.id, subject: msgSubject,
            subject_normalized: normalizedSubject,
            from_email: fromEmail || fromName || null,
            from_name: fromName || null,
            body_preview: bodyPreview, body_html: bodyHtml, body_text: bodyText,
            sent_at: sentAt, internet_message_id: internetMessageId,
            conversation_id: conversationId, in_reply_to: inReplyTo,
            references_header: referencesHeader,
            to_emails: toRecipients.length > 0 ? toRecipients : null,
            cc_emails: ccRecipients.length > 0 ? ccRecipients : null,
            received_at: msg.receivedDateTime || new Date().toISOString(),
            created_by: userId,
            mentioned_emails: mentionedEmails,
            mentioned_user_ids: mentionedUserIds,
            mention_parse_version: mentionedEmails.length > 0 || mentionedUserIds.length > 0 ? 1 : 0,
          }).select("id").single();

          if (mentionedUserIds.length > 0 && caseId) {
            const { data: currentCase } = await supabaseAdmin
              .from("cases").select("assigned_to_user_id, case_number").eq("id", caseId).single();
            const caseNumber = currentCase?.case_number || "";
            for (const mentionedUserId of mentionedUserIds) {
              if (currentCase?.assigned_to_user_id === mentionedUserId) continue;
              await supabaseAdmin.from("notifications").insert({
                user_id: mentionedUserId, company_id: companyId, type: "mention",
                title: "Du ble nevnt i en e-post",
                message: `Sak ${caseNumber || "ukjent"}. Fra: ${fromName || fromEmail || "ukjent"}`,
                entity_type: "case", entity_id: caseId, link_url: `/inbox`,
              });
            }
            dbg(`Created ${mentionedUserIds.length} mention notification(s) for case ${caseId}`);
          }

          if (itemErr) {
            console.error(`[inbox-sync] Item insert error: ${itemErr.message}`);
            totalSkipped++;
          } else {
            totalNewItems++;

            if (msg.hasAttachments && caseId) {
              const linkedJobId = linkedUpdates["linked_work_order_id"] || linkedUpdates["linked_project_id"] || null;
              const { meta: attMeta, documentIds: attDocIds } = await downloadAndStoreAttachments(
                msToken, mb.address, msg.id, caseId, companyId, supabaseAdmin, linkedJobId
              );
              if (attMeta.length > 0) {
                const { data: insertedItem } = await supabaseAdmin
                  .from("case_items").select("id").eq("external_id", msg.id).maybeSingle();
                if (insertedItem) {
                  await supabaseAdmin.from("case_items").update({ attachments_meta: attMeta }).eq("id", insertedItem.id);
                }
              }
              if (attDocIds.length > 0) allDocumentIds.push(...attDocIds);
            }
          }

          // Backwards compat: inbox_messages
          await supabaseAdmin.from("inbox_messages").upsert(
            {
              external_id: msg.id, subject: msgSubject,
              from_name: fromName || null, from_email: fromEmail || null,
              received_at: msg.receivedDateTime || new Date().toISOString(),
              body_preview: bodyPreview, body_full: bodyHtml,
              has_attachments: msg.hasAttachments || false,
              fetched_by: userId, status: "new",
              mailbox_address: mb.address, visibility: "team",
            },
            { onConflict: "external_id", ignoreDuplicates: true }
          );
        }
      } catch (syncErr: any) {
        mbError = syncErr.message || "Unknown sync error";
        console.error(`[inbox-sync] Error syncing ${mb.address}: ${mbError}`);
      }

      await supabaseAdmin.from("mailboxes").update({
        last_sync_at: new Date().toISOString(),
        last_sync_error: mbError,
        last_sync_count: mbCount,
      }).eq("id", mb.id);
    }

    if (enabledMailboxes.length === 0) console.log("[inbox-sync] No shared mailboxes configured.");

    if (allDocumentIds.length > 0) {
      await triggerClassification(allDocumentIds, Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    }

    const elapsed = Date.now() - runStart;
    console.log(`[inbox-sync][${runId}] ■ Done in ${elapsed}ms. Fetched: ${totalFetched}, New cases: ${totalNewCases}, New items: ${totalNewItems}, Conv matches: ${totalConversationMatches}, Linked: ${totalLinked}, Skipped: ${totalSkipped}, Dropped: ${totalDropped}`);
    if (Object.keys(dropReasons).length > 0) {
      dbg("Drop reasons:", JSON.stringify(dropReasons));
    }

    return respond({
      success: true, run_id: runId, elapsed_ms: elapsed,
      fetched: totalFetched, new_cases: totalNewCases, new_items: totalNewItems,
      conversation_matches: totalConversationMatches,
      linked: totalLinked, skipped: totalSkipped, dropped: totalDropped,
      drop_reasons: dropReasons,
      mailboxes_synced: enabledMailboxes.length || 1,
    });
  } catch (err) {
    console.error("[inbox-sync] Fatal error:", err);
    return respond({ error: String(err) }, 500);
  }
});
