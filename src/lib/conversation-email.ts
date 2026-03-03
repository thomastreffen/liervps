import { supabase } from "@/integrations/supabase/client";

/**
 * Centralized email trigger – calls backend edge function.
 * Frontend must NEVER call conversation-email-send directly.
 */
export async function triggerConversationEmailSend(
  threadId: string,
  reason: "new_post" | "participant_added" | "resend",
  opts?: { post_id?: string; recipient_email?: string }
): Promise<{ sent: boolean; error?: string; skipped?: boolean }> {
  try {
    const { data, error } = await supabase.functions.invoke("conversation-email-send", {
      body: {
        thread_id: threadId,
        reason,
        post_id: opts?.post_id || null,
        recipient_email: opts?.recipient_email || null,
      },
    });
    if (error) return { sent: false, error: error.message };
    if (data?.skipped) return { sent: false, skipped: true };
    if (data?.error) return { sent: false, error: data.error };
    return { sent: !!data?.sent };
  } catch (err: any) {
    console.error("triggerConversationEmailSend error", err);
    return { sent: false, error: err.message };
  }
}
