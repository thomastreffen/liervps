import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Eye, FolderOpen, Download, Trash2, ExternalLink } from "lucide-react";
import type { DocFolder } from "@/hooks/useDocsFiles";

interface FileContextMenuProps {
  children: React.ReactNode;
  folders: DocFolder[];
  currentFolderId: string | null;
  canDelete: boolean;
  onPreview: () => void;
  onOpen: () => void;
  onDownload: () => void;
  onDelete?: () => void;
  onMoveToFolder: (folderId: string | null) => void;
}

export function FileContextMenu({
  children,
  folders,
  currentFolderId,
  canDelete,
  onPreview,
  onOpen,
  onDownload,
  onDelete,
  onMoveToFolder,
}: FileContextMenuProps) {
  const moveTargets = [
    { id: null, name: "Usortert" },
    ...folders.filter((f) => f.id !== currentFolderId).map((f) => ({ id: f.id, name: f.name })),
  ].filter((t) => t.id !== currentFolderId);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem onClick={onPreview} className="gap-2">
          <Eye className="h-4 w-4" /> Forhåndsvis
        </ContextMenuItem>
        <ContextMenuItem onClick={onOpen} className="gap-2">
          <ExternalLink className="h-4 w-4" /> Åpne
        </ContextMenuItem>
        <ContextMenuItem onClick={onDownload} className="gap-2">
          <Download className="h-4 w-4" /> Last ned
        </ContextMenuItem>
        {moveTargets.length > 0 && (
          <>
            <ContextMenuSeparator />
            <ContextMenuSub>
              <ContextMenuSubTrigger className="gap-2">
                <FolderOpen className="h-4 w-4" /> Flytt til…
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-48">
                {moveTargets.map((t) => (
                  <ContextMenuItem key={t.id ?? "__unsorted"} onClick={() => onMoveToFolder(t.id)}>
                    {t.name}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
          </>
        )}
        {canDelete && onDelete && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={onDelete} className="gap-2 text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4" /> Slett
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
