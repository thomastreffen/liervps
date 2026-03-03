import { useState } from "react";
import { useProjectAccess, type ProjectMember } from "@/hooks/useProjectAccess";
import {
  Users,
  X,
  Loader2,
  UserPlus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface FolderAccessDrawerProps {
  folderId: string;
  folderName: string;
  projectId: string;
  hasOverride: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export function FolderAccessDrawer({
  folderId,
  folderName,
  projectId,
  hasOverride,
  onClose,
  onUpdated,
}: FolderAccessDrawerProps) {
  const { members: projectMembers, isAdmin } = useProjectAccess(projectId);
  const [override, setOverride] = useState(hasOverride);
  const [folderMembers, setFolderMembers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Load folder members
  useState(() => {
    (async () => {
      const { data } = await supabase
        .from("folder_members")
        .select("user_account_id")
        .eq("folder_id", folderId);
      setFolderMembers((data ?? []).map((d: any) => d.user_account_id));
      setLoading(false);
    })();
  });

  const toggleOverride = async (value: boolean) => {
    const { error } = await supabase
      .from("doc_folders")
      .update({ has_member_override: value })
      .eq("id", folderId);
    if (error) {
      toast.error("Kunne ikke oppdatere");
      return;
    }
    setOverride(value);
    onUpdated();
    toast.success(value ? "Egen tilgang aktivert" : "Arver fra rom");
  };

  const toggleMember = async (userAccountId: string) => {
    if (folderMembers.includes(userAccountId)) {
      const { error } = await supabase
        .from("folder_members")
        .delete()
        .eq("folder_id", folderId)
        .eq("user_account_id", userAccountId);
      if (!error) {
        setFolderMembers((prev) => prev.filter((id) => id !== userAccountId));
        toast.success("Fjernet fra mappe");
      }
    } else {
      const { error } = await supabase.from("folder_members").insert({
        folder_id: folderId,
        user_account_id: userAccountId,
      });
      if (!error) {
        setFolderMembers((prev) => [...prev, userAccountId]);
        toast.success("Lagt til i mappe");
      }
    }
    onUpdated();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">
          Tilgang: {folderName}
        </h2>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Override toggle */}
      {isAdmin && (
        <div className="flex items-center justify-between rounded-lg border border-border/40 bg-card p-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">Egne tilgangsregler</p>
            <p className="text-xs text-muted-foreground">
              {override
                ? "Kun valgte personer kan se denne mappen"
                : "Mappen arver tilgang fra Dokumenter-rommet"}
            </p>
          </div>
          <Switch checked={override} onCheckedChange={toggleOverride} />
        </div>
      )}

      {/* Member list */}
      {override && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Tilgang ({folderMembers.length} av {projectMembers.length})
          </h4>
          {projectMembers.map((pm) => {
            const isMember = folderMembers.includes(pm.user_account_id);
            const isOwnerOrManager = pm.role === "owner" || pm.role === "manager";

            return (
              <div
                key={pm.id}
                className="flex items-center gap-3 rounded-lg border border-border/40 bg-card px-3 py-2.5"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground shrink-0">
                  <Users className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {pm.person_name || "Ukjent"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{pm.email}</p>
                </div>
                {isOwnerOrManager ? (
                  <span className="text-xs text-muted-foreground">Alltid tilgang</span>
                ) : isAdmin ? (
                  <Switch
                    checked={isMember}
                    onCheckedChange={() => toggleMember(pm.user_account_id)}
                  />
                ) : (
                  <span className={cn("text-xs", isMember ? "text-[hsl(var(--success))]" : "text-muted-foreground")}>
                    {isMember ? "Tilgang" : "Ingen tilgang"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!override && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Alle med tilgang til Dokumenter-rommet kan se denne mappen.
        </p>
      )}
    </div>
  );
}
