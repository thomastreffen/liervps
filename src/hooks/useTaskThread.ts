import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/* ── Types ── */

export interface TaskMessage {
  id: string;
  thread_id: string;
  task_id: string;
  company_id: string;
  message_type: "internal_message" | "external_email" | "system_event";
  direction: "inbound" | "outbound" | "internal" | "system" | null;
  body: string | null;
  body_html: string | null;
  subject: string | null;
  author_user_id: string | null;
  author_name: string | null;
  author_email: string | null;
  external_message_id: string | null;
  external_in_reply_to: string | null;
  external_references: string[] | null;
  recipients: Array<{ name: string; email: string }> | null;
  email_status: string | null;
  metadata: Record<string, any>;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  attachments: TaskMessageAttachment[];
}

export interface TaskMessageAttachment {
  id: string;
  message_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

export interface UseTaskThreadReturn {
  messages: TaskMessage[];
  loading: boolean;
  sending: boolean;
  threadId: string | null;
  sendMessage: (body: string, files?: File[], replyToMessageId?: string) => Promise<void>;
  sendEmailMessage: (body: string, files?: File[]) => Promise<void>;
  createSystemEvent: (eventType: string, metadata?: Record<string, any>) => Promise<void>;
  refetch: () => void;
}

export function useTaskThread(taskId: string | null | undefined, companyId: string | null | undefined): UseTaskThreadReturn {
  const { user } = useAuth();
  const [messages, setMessages] = useState<TaskMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const channelRef = useRef<any>(null);

  const fetchMessages = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const { data: thread } = await supabase
        .from("task_threads")
        .select("id")
        .eq("task_id", taskId)
        .maybeSingle();

      if (!thread) {
        setThreadId(null);
        setMessages([]);
        setLoading(false);
        return;
      }

      setThreadId(thread.id);

      const { data: msgs } = await supabase
        .from("task_messages")
        .select("*")
        .eq("thread_id", thread.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      if (!msgs || msgs.length === 0) {
        setMessages([]);
        setLoading(false);
        return;
      }

      const messageIds = msgs.map((m: any) => m.id);
      const { data: attachments } = await supabase
        .from("task_message_attachments")
        .select("*")
        .in("message_id", messageIds);

      const attachmentMap = new Map<string, TaskMessageAttachment[]>();
      for (const att of (attachments || []) as any[]) {
        const list = attachmentMap.get(att.message_id) || [];
        list.push(att as TaskMessageAttachment);
        attachmentMap.set(att.message_id, list);
      }

      const enriched: TaskMessage[] = (msgs as any[]).map((m) => ({
        ...m,
        attachments: attachmentMap.get(m.id) || [],
      }));

      setMessages(enriched);
    } catch (err) {
      console.error("[useTaskThread] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // Realtime
  useEffect(() => {
    if (!taskId) return;
    const channel = supabase
      .channel(`task-messages-${taskId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "task_messages",
        filter: `task_id=eq.${taskId}`,
      }, () => { fetchMessages(); })
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [taskId, fetchMessages]);

  const ensureThread = useCallback(async (): Promise<string> => {
    if (threadId) return threadId;
    if (!taskId || !companyId || !user) throw new Error("Missing context");

    const { data: existing } = await supabase
      .from("task_threads")
      .select("id")
      .eq("task_id", taskId)
      .maybeSingle();
    if (existing) { setThreadId(existing.id); return existing.id; }

    const { data: newThread, error } = await supabase
      .from("task_threads")
      .insert({ task_id: taskId, company_id: companyId, created_by: user.id } as any)
      .select("id")
      .single();
    if (error) throw error;
    setThreadId((newThread as any).id);
    return (newThread as any).id;
  }, [threadId, taskId, companyId, user]);

  const getAuthorName = useCallback(async (): Promise<string> => {
    if (!user) return "Ukjent";
    const { data } = await supabase
      .from("user_accounts")
      .select("people(full_name)")
      .eq("auth_user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    return (data as any)?.people?.full_name || user.email || "Ukjent";
  }, [user]);

  // Send internal message
  const sendMessage = useCallback(async (body: string, files?: File[], replyToMessageId?: string) => {
    if (!taskId || !companyId || !user) return;
    if (!body.trim() && (!files || files.length === 0)) return;
    setSending(true);
    try {
      const tid = await ensureThread();
      const authorName = await getAuthorName();

      const insertPayload: any = {
        thread_id: tid, task_id: taskId, company_id: companyId,
        message_type: "internal_message", direction: "internal",
        body: body.trim() || null,
        author_user_id: user.id, author_name: authorName, author_email: user.email,
      };
      if (replyToMessageId) insertPayload.reply_to_message_id = replyToMessageId;

      const { data: msg, error: msgError } = await supabase
        .from("task_messages")
        .insert(insertPayload)
        .select("id")
        .single();
      if (msgError) throw msgError;

      if (files && files.length > 0) {
        for (const file of files) {
          const filePath = `${companyId}/${taskId}/${(msg as any).id}/${crypto.randomUUID()}_${file.name}`;
          const { error: uploadErr } = await supabase.storage
            .from("task-thread-files")
            .upload(filePath, file);
          if (uploadErr) { console.error("[useTaskThread] upload error:", uploadErr); continue; }

          await supabase.from("task_message_attachments").insert({
            company_id: companyId, message_id: (msg as any).id,
            file_name: file.name, file_path: filePath,
            file_size: file.size, mime_type: file.type || null, uploaded_by: user.id,
          } as any);
        }
      }
    } catch (err: any) {
      console.error("[useTaskThread] send error:", err);
      toast.error("Kunne ikke sende melding", { description: err?.message });
    } finally {
      setSending(false);
    }
  }, [taskId, companyId, user, ensureThread, getAuthorName]);

  // Send email to technicians via edge function
  const sendEmailMessage = useCallback(async (body: string, files?: File[]) => {
    if (!taskId || !companyId || !user) return;
    if (!body.trim() && (!files || files.length === 0)) return;
    setSending(true);
    try {
      // Upload files first if any
      const attachmentPaths: Array<{ file_path: string; file_name: string; mime_type: string; file_size: number }> = [];
      if (files && files.length > 0) {
        const tid = await ensureThread();
        for (const file of files) {
          const filePath = `${companyId}/${taskId}/email-${Date.now()}/${crypto.randomUUID()}_${file.name}`;
          const { error: uploadErr } = await supabase.storage
            .from("task-thread-files")
            .upload(filePath, file);
          if (uploadErr) {
            console.error("[useTaskThread] email upload error:", uploadErr);
            continue;
          }
          attachmentPaths.push({
            file_path: filePath,
            file_name: file.name,
            mime_type: file.type || "application/octet-stream",
            file_size: file.size,
          });
        }
      }

      const { data, error } = await supabase.functions.invoke("task-thread-email-send", {
        body: {
          task_id: taskId,
          body_text: body.trim(),
          attachment_paths: attachmentPaths.length > 0 ? attachmentPaths : undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const recipientCount = data?.recipients?.length || 0;
      toast.success(`E-post sendt til ${recipientCount} montør${recipientCount !== 1 ? "er" : ""}`);
    } catch (err: any) {
      console.error("[useTaskThread] email send error:", err);
      toast.error("Kunne ikke sende e-post", { description: err?.message });
    } finally {
      setSending(false);
    }
  }, [taskId, companyId, user, ensureThread]);

  // Create system event
  const createSystemEvent = useCallback(async (eventType: string, metadata?: Record<string, any>) => {
    if (!taskId || !companyId) return;
    try {
      const tid = await ensureThread();
      await supabase.from("task_messages").insert({
        thread_id: tid, task_id: taskId, company_id: companyId,
        message_type: "system_event", direction: "system",
        body: null, metadata: { event_type: eventType, ...metadata },
      } as any);
    } catch (err) {
      console.error("[useTaskThread] system event error:", err);
    }
  }, [taskId, companyId, ensureThread]);

  return {
    messages, loading, sending, threadId,
    sendMessage, sendEmailMessage, createSystemEvent,
    refetch: fetchMessages,
  };
}
