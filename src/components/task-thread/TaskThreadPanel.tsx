import { useEffect } from "react";
import { useTaskThread } from "@/hooks/useTaskThread";
import { useTaskThreadReads } from "@/hooks/useTaskThreadReads";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { TaskThreadFeed } from "./TaskThreadFeed";
import { TaskThreadComposer } from "./TaskThreadComposer";

interface Props {
  taskId: string;
  companyId: string;
}

export function TaskThreadPanel({ taskId, companyId }: Props) {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { messages, loading, sending, sendMessage, sendEmailMessage } = useTaskThread(taskId, companyId);
  const { markAsRead } = useTaskThreadReads(taskId);

  const canView = hasPermission("task_thread.view") || hasPermission("admin.manage_users");
  const canComment = hasPermission("task_thread.comment_internal") || hasPermission("admin.manage_users");
  const canUpload = hasPermission("task_thread.upload_attachments") || hasPermission("admin.manage_users");
  const canEmail = hasPermission("task_thread.email_external") || hasPermission("admin.manage_users");

  // Auto-mark as read when thread panel is visible and messages change
  useEffect(() => {
    if (messages.length > 0) {
      markAsRead();
    }
  }, [messages.length, markAsRead]);

  if (!canView) return null;

  return (
    <div className="flex flex-col h-full">
      <TaskThreadFeed
        messages={messages}
        loading={loading}
        currentUserId={user?.id || null}
      />
      {canComment && (
        <TaskThreadComposer
          onSend={sendMessage}
          onSendEmail={canEmail ? sendEmailMessage : undefined}
          sending={sending}
          canUpload={canUpload}
          canEmail={canEmail}
          taskId={taskId}
        />
      )}
    </div>
  );
}
