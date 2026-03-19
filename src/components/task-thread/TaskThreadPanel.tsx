import { useEffect, useState, useCallback } from "react";
import { useTaskThread, type TaskMessage } from "@/hooks/useTaskThread";
import { useTaskThreadReads } from "@/hooks/useTaskThreadReads";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { TaskThreadFeed } from "./TaskThreadFeed";
import { TaskThreadComposer } from "./TaskThreadComposer";
import { CreateActionFromMessageSheet } from "./CreateActionFromMessageSheet";
import type { SendMessageOptions } from "@/hooks/useTaskThread";
import type { ActionType } from "./MessageActionMenu";

interface Props {
  taskId: string;
  companyId: string;
}

export function TaskThreadPanel({ taskId, companyId }: Props) {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { messages, loading, sending, sendMessage, createSystemEvent } = useTaskThread(taskId, companyId);
  const { markAsRead, lastReadAt } = useTaskThreadReads(taskId);
  const [replyTo, setReplyTo] = useState<TaskMessage | null>(null);

  // Action from message state
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [actionType, setActionType] = useState<ActionType | null>(null);
  const [actionSourceMessage, setActionSourceMessage] = useState<TaskMessage | null>(null);

  const canView = hasPermission("task_thread.view") || hasPermission("admin.manage_users");
  const canComment = hasPermission("task_thread.comment_internal") || hasPermission("admin.manage_users");
  const canUpload = hasPermission("task_thread.upload_attachments") || hasPermission("admin.manage_users");
  const canEmail = hasPermission("task_thread.email_external") || hasPermission("admin.manage_users");

  useEffect(() => {
    if (messages.length > 0) {
      markAsRead();
    }
  }, [messages.length, markAsRead]);

  const handleReply = useCallback((msg: TaskMessage) => {
    setReplyTo(msg);
  }, []);

  const handleSend = useCallback(async (body: string, options: SendMessageOptions) => {
    await sendMessage(body, options);
  }, [sendMessage]);

  const handleCreateAction = useCallback((type: ActionType, message: TaskMessage) => {
    setActionType(type);
    setActionSourceMessage(message);
    setActionSheetOpen(true);
  }, []);

  const handleActionCreated = useCallback(async (type: ActionType, title: string, createdId: string) => {
    // Map action type to event type
    const eventTypeMap: Record<ActionType, string> = {
      deviation: "wp_deviation_created",
      additional_work: "wp_additional_work_created",
      internal_task: "wp_internal_task_created",
      offer: "offer_created",
    };
    const labelMap: Record<ActionType, string> = {
      deviation: "Avvik opprettet",
      additional_work: "Tillegg opprettet",
      internal_task: "Oppgave opprettet",
      offer: "Tilbud opprettet",
    };

    await createSystemEvent(eventTypeMap[type], {
      details: title,
      title,
      created_id: createdId,
      source_message_id: actionSourceMessage?.id,
      created_by_name: user?.email,
    });

    setActionSheetOpen(false);
    setActionType(null);
    setActionSourceMessage(null);
  }, [createSystemEvent, actionSourceMessage, user]);

  if (!canView) return null;

  return (
    <div className="flex flex-col h-full">
      <TaskThreadFeed
        messages={messages}
        loading={loading}
        currentUserId={user?.id || null}
        lastReadAt={lastReadAt}
        onReply={canComment ? handleReply : undefined}
        onCreateAction={canComment ? handleCreateAction : undefined}
      />
      {canComment && (
        <TaskThreadComposer
          onSend={handleSend}
          sending={sending}
          canUpload={canUpload}
          canEmail={canEmail}
          taskId={taskId}
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
        />
      )}

      <CreateActionFromMessageSheet
        open={actionSheetOpen}
        onOpenChange={setActionSheetOpen}
        actionType={actionType}
        sourceMessage={actionSourceMessage}
        taskId={taskId}
        companyId={companyId}
        onCreated={handleActionCreated}
      />
    </div>
  );
}
