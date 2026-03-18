/**
 * task-thread-email-inbound
 * 
 * Called by graph-webhook-inbound when an inbound email matches a task thread
 * via the task-thread+{token}@domain pattern or X-MCS-Task-Thread-Token header.
 * 
 * This is NOT a standalone webhook – it's an internal function invoked by
 * graph-webhook-inbound after it identifies the email belongs to a task thread.
 * 
 * Matching strategies (in priority order):
 * 1. X-MCS-Task-Thread-Token header → task_threads.thread_token
 * 2. Reply-To / To: task-thread+{token}@domain → task_threads.thread_token
 * 3. In-Reply-To / References → task_messages.external_message_id
 * 
 * If none match, the email falls through to conversation thread matching
 * in graph-webhook-inbound, or ends up in dead-letter.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TASK_THREAD_PATTERN = /task-thread\+([a-f0-9-]+)@/i;

interface TaskThreadMatchResult {
  matched: boolean;
  thread_id?: string;
  task_id?: string;
  company_id?: string;
  thread_token?: string;
  match_strategy?: string;
}

/**
 * Attempt to match an inbound email to a task thread.
 * Returns { matched: false } if no task thread match found.
 * Called from graph-webhook-inbound before conversation matching.
 */
export async function tryMatchTaskThread(
  message: any,
  supabase: any,
): Promise<TaskThreadMatchResult> {
  // Strategy 1: X-MCS-Task-Thread-Token header
  for (const h of message.internetMessageHeaders || []) {
    if (h.name === "X-MCS-Task-Thread-Token" && h.value) {
      const { data } = await supabase
        .from("task_threads")
        .select("id, task_id, company_id, thread_token")
        .eq("thread_token", h.value)
        .maybeSingle();
      if (data) {
        return { matched: true, ...data, match_strategy: "x-header" };
      }
    }
  }

  // Strategy 2: reply-to / to address with task-thread+{token}
  const replyTo = message.replyTo?.[0]?.emailAddress?.address || "";
  const toAddrs = (message.toRecipients || []).map((r: any) => r.emailAddress?.address || "");
  const ccAddrs = (message.ccRecipients || []).map((r: any) => r.emailAddress?.address || "");
  const allAddrs = [replyTo, ...toAddrs, ...ccAddrs].join(" ");
  
  const tokenMatch = allAddrs.match(TASK_THREAD_PATTERN);
  if (tokenMatch) {
    const token = tokenMatch[1];
    const { data } = await supabase
      .from("task_threads")
      .select("id, task_id, company_id, thread_token")
      .eq("thread_token", token)
      .maybeSingle();
    if (data) {
      return { matched: true, ...data, match_strategy: "reply-to-token" };
    }
  }

  // Strategy 3: In-Reply-To / References → task_messages.external_message_id
  for (const h of message.internetMessageHeaders || []) {
    if ((h.name === "In-Reply-To" || h.name === "References") && h.value) {
      // Extract message IDs from header value
      const msgIds = h.value.match(/<[^>]+>/g) || [h.value];
      for (const msgId of msgIds) {
        const cleanId = msgId.replace(/[<>]/g, "").trim();
        if (!cleanId) continue;
        const { data: existing } = await supabase
          .from("task_messages")
          .select("thread_id, task_id, company_id")
          .eq("external_message_id", cleanId)
          .limit(1)
          .maybeSingle();
        if (existing) {
          const { data: thread } = await supabase
            .from("task_threads")
            .select("thread_token")
            .eq("id", existing.thread_id)
            .maybeSingle();
          return {
            matched: true,
            thread_id: existing.thread_id,
            task_id: existing.task_id,
            company_id: existing.company_id,
            thread_token: thread?.thread_token,
            match_strategy: "in-reply-to",
          };
        }
      }
    }
  }

  return { matched: false };
}

/**
 * Process an inbound email that matched a task thread.
 * Creates a task_message and handles attachments.
 */
export async function processTaskThreadInbound(
  message: any,
  match: TaskThreadMatchResult,
  supabase: any,
  graphToken: string,
  resourceUrl: string,
): Promise<{ message_id: string }> {
  const senderEmail = message.from?.emailAddress?.address?.toLowerCase() || "";
  const senderName = message.from?.emailAddress?.name || senderEmail;

  // Strip quoted content from body (basic quote stripping)
  let bodyText = message.bodyPreview || "";
  let bodyHtml = message.body?.content || "";

  // Create inbound message
  const { data: msg, error: msgErr } = await supabase
    .from("task_messages")
    .insert({
      thread_id: match.thread_id,
      task_id: match.task_id,
      company_id: match.company_id,
      message_type: "external_email",
      direction: "inbound",
      body: bodyText,
      body_html: bodyHtml,
      subject: message.subject || null,
      author_name: senderName,
      author_email: senderEmail,
      external_message_id: message.internetMessageId || null,
      external_in_reply_to: extractHeader(message, "In-Reply-To"),
      external_references: extractReferences(message),
      email_status: "received",
      inbound_received_at: new Date().toISOString(),
      recipients: (message.toRecipients || []).map((r: any) => ({
        name: r.emailAddress?.name,
        email: r.emailAddress?.address,
      })),
      raw_headers: (message.internetMessageHeaders || []).slice(0, 20),
      metadata: {
        match_strategy: match.match_strategy,
        outlook_message_id: message.id,
        conversation_id: message.conversationId,
      },
    })
    .select("id")
    .single();

  if (msgErr) {
    console.error("TASK_THREAD_INBOUND_INSERT_ERROR", msgErr);
    throw new Error("Failed to insert inbound message: " + msgErr.message);
  }

  // Handle attachments
  if (message.hasAttachments) {
    try {
      const attResp = await fetch(
        `https://graph.microsoft.com/v1.0/${resourceUrl}/attachments`,
        { headers: { Authorization: `Bearer ${graphToken}` } },
      );
      if (attResp.ok) {
        const attData = await attResp.json();
        for (const att of attData.value || []) {
          if (att["@odata.type"] === "#microsoft.graph.fileAttachment" && att.contentBytes) {
            const bytes = Uint8Array.from(atob(att.contentBytes), c => c.charCodeAt(0));
            const filePath = `${match.company_id}/${match.task_id}/${msg!.id}/${Date.now()}_${att.name}`;
            const { error: upErr } = await supabase.storage
              .from("task-thread-files")
              .upload(filePath, bytes, { contentType: att.contentType });
            if (!upErr) {
              await supabase.from("task_message_attachments").insert({
                company_id: match.company_id,
                message_id: msg!.id,
                file_name: att.name,
                file_path: filePath,
                file_size: att.size || bytes.length,
                mime_type: att.contentType || null,
              });
            } else {
              console.error("TASK_THREAD_INBOUND_UPLOAD_ERROR", upErr);
            }
          }
        }
      } else {
        await attResp.text();
      }
    } catch (attErr) {
      console.error("TASK_THREAD_INBOUND_ATTACHMENT_ERROR", attErr);
    }
  }

  // Update thread last_message_at
  await supabase
    .from("task_threads")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", match.thread_id);

  console.log("TASK_THREAD_INBOUND_PROCESSED", {
    thread_id: match.thread_id,
    task_id: match.task_id,
    message_id: msg!.id,
    sender: senderEmail,
    match_strategy: match.match_strategy,
  });

  return { message_id: msg!.id };
}

function extractHeader(message: any, headerName: string): string | null {
  for (const h of message.internetMessageHeaders || []) {
    if (h.name === headerName) return h.value;
  }
  return null;
}

function extractReferences(message: any): string[] | null {
  const refs = extractHeader(message, "References");
  if (!refs) return null;
  const matches = refs.match(/<[^>]+>/g);
  return matches ? matches.map(m => m.replace(/[<>]/g, "")) : null;
}
