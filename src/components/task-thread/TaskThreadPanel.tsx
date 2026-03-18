import { useTaskThread } from "@/hooks/useTaskThread";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { TaskThreadFeed } from "./TaskThreadFeed";
import { TaskThreadComposer } from "./TaskThreadComposer";

interface Props {
  taskId: string;
  companyId: string;
}

/**
 * Main container for the per-task messaging thread.
 * Handles permissions, rendering feed + composer.
 */
export function TaskThreadPanel({ taskId, companyId }: Props) {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { messages, loading, sending, sendMessage } = useTaskThread(taskId, companyId);

  const canView = hasPermission("task_thread.view") || hasPermission("admin.manage_users");
  const canComment = hasPermission("task_thread.comment_internal") || hasPermission("admin.manage_users");
  const canUpload = hasPermission("task_thread.upload_attachments") || hasPermission("admin.manage_users");

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
          sending={sending}
          canUpload={canUpload}
        />
      )}
    </div>
  );
}
