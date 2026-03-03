import { useState, useRef, useEffect, useCallback } from "react";
import { useDocsFiles, type DocFolder, type DocFile } from "@/hooks/useDocsFiles";
import { useAuth } from "@/hooks/useAuth";
import { FolderAccessDrawer } from "@/components/docs/FolderAccessDrawer";
import { FilePreviewPanel, type PreviewItem } from "@/components/docs/FilePreviewPanel";
import { supabase } from "@/integrations/supabase/client";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  FolderOpen,
  Plus,
  Upload,
  FileText,
  Image,
  File,
  Loader2,
  ArrowLeft,
  Trash2,
  ExternalLink,
  Users,
  FolderPlus,
  Link2,
  Paperclip,
  Download,
  CloudOff,
  GripVertical,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SharePointExplorer } from "@/components/SharePointExplorer";
import type { Attachment } from "@/lib/mock-data";

/* ── Helpers ── */

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(file: DocFile) {
  const mime = file.mime_type || "";
  const ext = file.title.split(".").pop()?.toLowerCase() || "";
  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext))
    return <Image className="h-5 w-5 text-[hsl(var(--success))] shrink-0" />;
  if (mime.includes("pdf") || ext === "pdf")
    return <FileText className="h-5 w-5 text-destructive shrink-0" />;
  if (mime.includes("word") || ["doc", "docx"].includes(ext))
    return <FileText className="h-5 w-5 text-primary shrink-0" />;
  if (mime.includes("excel") || mime.includes("spreadsheet") || ["xls", "xlsx"].includes(ext))
    return <FileText className="h-5 w-5 text-[hsl(var(--success))] shrink-0" />;
  if (file.source_type === "sharepoint")
    return <Link2 className="h-5 w-5 text-primary shrink-0" />;
  return <File className="h-5 w-5 text-muted-foreground shrink-0" />;
}

/* ── Props ── */

interface DocsFilesRoomProps {
  projectId: string;
  jobId: string;
}

/* ── Draggable file row ── */

function DraggableFileRow({
  file,
  onOpen,
  onPreview,
  onDelete,
}: {
  file: DocFile;
  onOpen: (f: DocFile) => void;
  onPreview: (f: DocFile) => void;
  onDelete?: (f: DocFile) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `doc-${file.id}`,
    data: { type: "doc", file },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border/40 bg-card px-4 py-3 hover:border-border/70 transition-colors group",
        isDragging && "opacity-40 shadow-lg ring-2 ring-primary/30"
      )}
    >
      <button {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground/50 hover:text-muted-foreground transition-colors">
        <GripVertical className="h-4 w-4" />
      </button>
      {getFileIcon(file)}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onPreview(file)}>
        <p className="text-sm font-medium text-foreground truncate">{file.title}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {file.source_type === "sharepoint" && <span className="text-primary">SharePoint</span>}
          {file.file_size ? <span>{formatSize(file.file_size)}</span> : null}
          <span>{new Date(file.created_at).toLocaleDateString("nb-NO")}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onPreview(file)} title="Forhåndsvisning">
          <Eye className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpen(file)} title="Åpne">
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
        {onDelete && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onDelete(file)} title="Slett">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

/* ── Draggable attachment row ── */

function DraggableAttachmentRow({
  att,
  jobId,
  isAdmin,
  onPreview,
  onRemove,
}: {
  att: Attachment;
  jobId: string;
  isAdmin: boolean;
  onPreview: (att: Attachment) => void;
  onRemove: (name: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `att-${att.name}`,
    data: { type: "attachment", attachment: att },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border/40 bg-card px-4 py-3 hover:border-border/70 transition-colors group",
        isDragging && "opacity-40 shadow-lg ring-2 ring-primary/30"
      )}
    >
      <button {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground/50 hover:text-muted-foreground transition-colors">
        <GripVertical className="h-4 w-4" />
      </button>
      <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onPreview(att)}>
        <p className="text-sm font-medium text-foreground truncate">{att.name}</p>
        {att.size && <p className="text-xs text-muted-foreground">{formatSize(att.size)}</p>}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onPreview(att)} title="Forhåndsvis">
          <Eye className="h-3.5 w-3.5" />
        </Button>
        <a
          href={att.url}
          download={att.name}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <Download className="h-3.5 w-3.5" />
        </a>
        {isAdmin && (
          <button
            onClick={() => onRemove(att.name)}
            className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-destructive hover:bg-accent transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Droppable folder tile ── */

function DroppableFolderTile({ folder, onClick }: { folder: DocFolder; onClick: () => void }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `folder-${folder.id}`,
    data: { type: "folder", folderId: folder.id },
  });

  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-start rounded-xl border bg-card",
        "w-[200px] min-h-[180px] p-5",
        "text-left transition-all duration-200",
        "hover:shadow-lg hover:shadow-foreground/[0.06] hover:border-border hover:-translate-y-0.5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isOver
          ? "border-primary bg-primary/5 ring-2 ring-primary/30 scale-[1.02]"
          : "border-border/50",
      )}
    >
      <div className="absolute top-3 right-8 left-8 h-1.5 rounded-full bg-muted-foreground/15" />
      <div className="mt-6 space-y-1">
        <h4 className="text-base font-bold text-foreground">{folder.name}</h4>
        <p className="text-xs text-muted-foreground">
          {folder.file_count || 0} {(folder.file_count || 0) === 1 ? "fil" : "filer"}
        </p>
      </div>
      {folder.has_member_override && (
        <div className="mt-auto pt-3 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Users className="h-3 w-3" /> Begrenset
        </div>
      )}
      {isOver && (
        <div className="absolute inset-0 rounded-xl bg-primary/10 flex items-center justify-center pointer-events-none">
          <span className="text-sm font-semibold text-primary">Slipp her</span>
        </div>
      )}
    </button>
  );
}

/* ── Droppable unsorted zone ── */

function DroppableUnsortedZone({ children }: { children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({
    id: "unsorted-zone",
    data: { type: "folder", folderId: null },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "space-y-3 pt-2 rounded-xl transition-colors p-3 -m-3",
        isOver && "bg-primary/5 ring-2 ring-primary/20 ring-inset"
      )}
    >
      {children}
    </div>
  );
}

/* ── Main Component ── */

export function DocsFilesRoom({ projectId, jobId }: DocsFilesRoomProps) {
  const { isAdmin } = useAuth();
  const {
    folders,
    files,
    unsortedFiles,
    loading,
    refresh,
    createFolder,
    uploadFile,
    addSharePointFile,
    deleteFile,
    moveFile,
  } = useDocsFiles(projectId);

  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showSharePoint, setShowSharePoint] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [accessFolderId, setAccessFolderId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<PreviewItem | null>(null);
  const [draggedItem, setDraggedItem] = useState<{ id: string; title: string } | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  // Project attachments from events table
  const [projectAttachments, setProjectAttachments] = useState<Attachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(true);

  // SharePoint connection state
  const [spConnection, setSpConnection] = useState<{
    projectCode: string | null;
    siteId: string | null;
    driveId: string | null;
    folderId: string | null;
    folderWebUrl: string | null;
    connectedAt: string | null;
  }>({
    projectCode: null, siteId: null, driveId: null, folderId: null, folderWebUrl: null, connectedAt: null,
  });
  const [spCompanyId, setSpCompanyId] = useState<string | null>(null);

  const fetchAttachments = useCallback(async () => {
    setAttachmentsLoading(true);
    const { data } = await supabase
      .from("events")
      .select("attachments, company_id, sharepoint_project_code, sharepoint_site_id, sharepoint_drive_id, sharepoint_folder_id, sharepoint_folder_web_url, sharepoint_connected_at")
      .eq("id", jobId)
      .single();
    const atts = Array.isArray(data?.attachments) ? (data.attachments as unknown as Attachment[]) : [];
    setProjectAttachments(atts);
    if (data) {
      setSpCompanyId((data as any).company_id || null);
      setSpConnection({
        projectCode: (data as any).sharepoint_project_code || null,
        siteId: (data as any).sharepoint_site_id || null,
        driveId: (data as any).sharepoint_drive_id || null,
        folderId: (data as any).sharepoint_folder_id || null,
        folderWebUrl: (data as any).sharepoint_folder_web_url || null,
        connectedAt: (data as any).sharepoint_connected_at || null,
      });
    }
    setAttachmentsLoading(false);
  }, [jobId]);

  useEffect(() => { fetchAttachments(); }, [fetchAttachments]);

  const spIsConnected = !!spConnection.folderId;
  const sharePointFiles = files.filter((f) => f.source_type === "sharepoint");
  const hasSharePointFiles = sharePointFiles.length > 0;

  const activeFolder = folders.find((f) => f.id === activeFolderId);
  const folderFiles = activeFolderId
    ? files.filter((f) => f.folder_id === activeFolderId)
    : unsortedFiles;

  /* ── DnD ── */

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.type === "doc") {
      setDraggedItem({ id: event.active.id as string, title: data.file.title });
    } else if (data?.type === "attachment") {
      setDraggedItem({ id: event.active.id as string, title: data.attachment.name });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setDraggedItem(null);
    const { active, over } = event;
    if (!over) return;

    const overData = over.data.current;
    const activeData = active.data.current;
    const targetFolderId: string | null = overData?.folderId ?? null;

    if (activeData?.type === "doc") {
      const file = activeData.file as DocFile;
      if (file.folder_id === targetFolderId) return;
      try {
        await moveFile(file.id, targetFolderId);
        toast.success(`"${file.title}" flyttet`);
      } catch {
        toast.error("Kunne ikke flytte fil");
      }
    } else if (activeData?.type === "attachment") {
      const att = activeData.attachment as Attachment;
      if (targetFolderId === null) return; // already in unsorted
      try {
        // Convert attachment to docs_files entry and remove from attachments
        await convertAttachmentToDocFile(att, targetFolderId);
        toast.success(`"${att.name}" flyttet til mappe`);
      } catch {
        toast.error("Kunne ikke flytte vedlegg");
      }
    }
  };

  const convertAttachmentToDocFile = async (att: Attachment, folderId: string | null) => {
    const { data: userData } = await supabase.auth.getUser();
    const { data: uaData } = await supabase
      .from("user_accounts")
      .select("id")
      .eq("auth_user_id", userData.user?.id ?? "")
      .eq("is_active", true)
      .single();

    // Insert into docs_files
    const ext = att.name.split(".").pop()?.toLowerCase() || "";
    let mimeType: string | null = null;
    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) mimeType = `image/${ext === "jpg" ? "jpeg" : ext}`;
    else if (ext === "pdf") mimeType = "application/pdf";

    const { error: insertErr } = await supabase.from("docs_files").insert({
      project_id: projectId,
      folder_id: folderId,
      title: att.name,
      source_type: "internal",
      source_meta: { public_url: att.url },
      mime_type: mimeType,
      file_size: att.size || null,
      created_by: uaData?.id || null,
    });
    if (insertErr) throw insertErr;

    // Remove from events.attachments
    const updated = projectAttachments.filter((a) => a.name !== att.name);
    const { error: updateErr } = await supabase
      .from("events")
      .update({ attachments: updated as any })
      .eq("id", jobId);
    if (updateErr) throw updateErr;

    setProjectAttachments(updated);
    await refresh();
  };

  /* ── Handlers ── */

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await createFolder(newFolderName.trim());
      setNewFolderName("");
      setShowNewFolder(false);
      toast.success("Mappe opprettet");
    } catch (err: any) {
      toast.error("Kunne ikke opprette mappe", { description: err.message });
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []);
    if (!fileList.length) return;
    setUploading(true);
    try {
      for (const f of fileList) {
        await uploadFile(f, activeFolderId);
      }
      toast.success(`${fileList.length} ${fileList.length === 1 ? "fil" : "filer"} lastet opp`);
    } catch (err: any) {
      toast.error("Opplasting feilet", { description: err.message });
    } finally {
      setUploading(false);
      if (uploadRef.current) uploadRef.current.value = "";
    }
  };

  const handleDelete = async (file: DocFile) => {
    try {
      await deleteFile(file.id);
      toast.success("Fil slettet");
    } catch (err: any) {
      toast.error("Kunne ikke slette", { description: err.message });
    }
  };

  const handleRemoveAttachment = async (name: string) => {
    const updated = projectAttachments.filter((a) => a.name !== name);
    const { error } = await supabase
      .from("events")
      .update({ attachments: updated as any })
      .eq("id", jobId);
    if (!error) {
      setProjectAttachments(updated);
      toast.success("Vedlegg fjernet");
    } else {
      toast.error("Kunne ikke fjerne vedlegg");
    }
  };

  const openFile = (file: DocFile) => {
    if (file.source_type === "sharepoint") {
      const url = (file.source_meta as any)?.web_url;
      if (url) window.open(url, "_blank");
    } else {
      const url = (file.source_meta as any)?.public_url;
      if (url) window.open(url, "_blank");
    }
  };

  const handlePreviewMoveToFolder = async (folderId: string | null) => {
    if (!previewItem) return;
    if (previewItem.kind === "doc") {
      try {
        await moveFile(previewItem.file.id, folderId);
        toast.success("Fil flyttet");
        setPreviewItem(null);
      } catch {
        toast.error("Kunne ikke flytte fil");
      }
    } else {
      try {
        await convertAttachmentToDocFile(previewItem.attachment, folderId);
        toast.success("Vedlegg flyttet til mappe");
        setPreviewItem(null);
      } catch {
        toast.error("Kunne ikke flytte vedlegg");
      }
    }
  };

  /* ── Loading state ── */

  if (loading || attachmentsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  /* ── SharePoint explorer overlay ── */

  if (showSharePoint) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setShowSharePoint(false)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Tilbake til dokumenter
        </button>
        <SharePointExplorer
          jobId={jobId}
          companyId={spCompanyId}
          connection={spConnection}
          onConnectionChange={() => fetchAttachments()}
        />
      </div>
    );
  }

  /* ── Inside a folder ── */

  if (activeFolderId) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => setActiveFolderId(null)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Dokumenter
          </button>
          <NewButton onUpload={() => uploadRef.current?.click()} onSharePoint={() => setShowSharePoint(true)} />
        </div>

        <div className="flex items-center gap-3 pb-2 border-b border-border/40">
          <FolderOpen className="h-6 w-6 text-primary" />
          <div className="flex-1">
            <h3 className="text-lg font-bold text-foreground">{activeFolder?.name}</h3>
            <p className="text-xs text-muted-foreground">
              {folderFiles.length} {folderFiles.length === 1 ? "fil" : "filer"}
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setAccessFolderId(activeFolderId)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md border border-border/40 px-2.5 py-1.5"
            >
              <Users className="h-3.5 w-3.5" />
              {activeFolder?.has_member_override ? "Begrenset tilgang" : "Tilgang"}
            </button>
          )}
        </div>

        <div className="space-y-1">
          {folderFiles.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Ingen filer i denne mappen.</p>
          ) : (
            folderFiles.map((file) => (
              <DraggableFileRow
                key={file.id}
                file={file}
                onOpen={openFile}
                onPreview={(f) => setPreviewItem({ kind: "doc", file: f })}
                onDelete={isAdmin ? handleDelete : undefined}
              />
            ))
          )}
        </div>

        <input ref={uploadRef} type="file" multiple onChange={handleUpload} className="hidden" />
        {uploading && <UploadingIndicator />}

        {accessFolderId && activeFolder && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={() => setAccessFolderId(null)} />
            <div className="relative w-full max-w-md bg-background border-l border-border shadow-xl overflow-y-auto p-6">
              <FolderAccessDrawer
                folderId={accessFolderId}
                folderName={activeFolder.name}
                projectId={projectId}
                hasOverride={activeFolder.has_member_override}
                onClose={() => setAccessFolderId(null)}
                onUpdated={refresh}
              />
            </div>
          </div>
        )}

        {previewItem && (
          <FilePreviewPanel
            item={previewItem}
            folders={folders}
            onClose={() => setPreviewItem(null)}
            onMoveToFolder={handlePreviewMoveToFolder}
          />
        )}
      </div>
    );
  }

  /* ── Main unified view with DnD ── */

  const totalFiles = files.length + projectAttachments.length;
  const isEmpty = folders.length === 0 && totalFiles === 0;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-8">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-4">
          <NewButton
            onNewFolder={() => setShowNewFolder(true)}
            onUpload={() => uploadRef.current?.click()}
            onSharePoint={() => setShowSharePoint(true)}
          />
          <h2 className="text-2xl font-extrabold text-foreground tracking-tight text-center flex-1">
            Dokumenter
          </h2>
          <div className="w-[88px]" />
        </div>

        {/* New folder inline */}
        {showNewFolder && (
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card p-3">
            <FolderPlus className="h-5 w-5 text-primary shrink-0" />
            <Input
              placeholder="Mappenavn"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              autoFocus
              className="max-w-xs"
            />
            <Button size="sm" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>Opprett</Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowNewFolder(false); setNewFolderName(""); }}>Avbryt</Button>
          </div>
        )}

        {/* Empty state */}
        {isEmpty && !showNewFolder && (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FolderOpen className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground">Ingen dokumenter ennå</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Opprett en mappe, last opp filer eller koble til SharePoint for å komme i gang.
              </p>
            </div>
          </div>
        )}

        {/* ── Section 1: Prosjektvedlegg (ukategorisert) ── */}
        {projectAttachments.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                Ukategorisert
              </h3>
              <span className="text-xs text-muted-foreground">({projectAttachments.length})</span>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">
              Dra filer til en mappe for å kategorisere dem.
            </p>
            <div className="space-y-1">
              {projectAttachments.map((att) => (
                <DraggableAttachmentRow
                  key={att.name}
                  att={att}
                  jobId={jobId}
                  isAdmin={isAdmin}
                  onPreview={(a) => setPreviewItem({ kind: "attachment", attachment: a, jobId })}
                  onRemove={handleRemoveAttachment}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Section 2: Folder tiles + unsorted docs ── */}
        {(folders.length > 0 || unsortedFiles.length > 0) && (
          <section className="space-y-4">
            {folders.length > 0 && (
              <div className="flex flex-wrap gap-5 justify-center">
                {folders.map((folder) => (
                  <DroppableFolderTile
                    key={folder.id}
                    folder={folder}
                    onClick={() => setActiveFolderId(folder.id)}
                  />
                ))}
              </div>
            )}

            {unsortedFiles.length > 0 && (
              <DroppableUnsortedZone>
                <h3 className="text-sm font-medium text-muted-foreground">Usorterte filer</h3>
                <div className="space-y-1">
                  {unsortedFiles.map((file) => (
                    <DraggableFileRow
                      key={file.id}
                      file={file}
                      onOpen={openFile}
                      onPreview={(f) => setPreviewItem({ kind: "doc", file: f })}
                      onDelete={isAdmin ? handleDelete : undefined}
                    />
                  ))}
                </div>
              </DroppableUnsortedZone>
            )}
          </section>
        )}

        {/* ── Section 3: SharePoint ── */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              SharePoint
            </h3>
            {spIsConnected ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] px-2 py-0.5 text-[10px] font-medium">
                Koblet
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-medium">
                <CloudOff className="h-3 w-3" />
                Ikke koblet
              </span>
            )}
          </div>

          {spIsConnected ? (
            <>
              {hasSharePointFiles && (
                <div className="space-y-1">
                  {sharePointFiles.map((file) => (
                    <DraggableFileRow
                      key={file.id}
                      file={file}
                      onOpen={openFile}
                      onPreview={(f) => setPreviewItem({ kind: "doc", file: f })}
                      onDelete={isAdmin ? handleDelete : undefined}
                    />
                  ))}
                </div>
              )}
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowSharePoint(true)}>
                <FolderOpen className="h-3.5 w-3.5" />
                Åpne SharePoint-utforsker
              </Button>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 p-6 space-y-3">
              <p className="text-sm text-muted-foreground">
                Koble denne jobben til en prosjektmappe i SharePoint for å synkronisere dokumenter.
              </p>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowSharePoint(true)}>
                <Link2 className="h-3.5 w-3.5" />
                Koble til SharePoint
              </Button>
            </div>
          )}
        </section>

        <input ref={uploadRef} type="file" multiple onChange={handleUpload} className="hidden" />
        {uploading && <UploadingIndicator />}
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {draggedItem && (
          <div className="flex items-center gap-2 rounded-lg border border-primary bg-card px-4 py-3 shadow-xl">
            <GripVertical className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground truncate max-w-[200px]">{draggedItem.title}</span>
          </div>
        )}
      </DragOverlay>

      {/* Preview panel */}
      {previewItem && (
        <FilePreviewPanel
          item={previewItem}
          folders={folders}
          onClose={() => setPreviewItem(null)}
          onMoveToFolder={handlePreviewMoveToFolder}
        />
      )}
    </DndContext>
  );
}

/* ── New... Button ── */

function NewButton({
  onNewFolder,
  onUpload,
  onSharePoint,
}: {
  onNewFolder?: () => void;
  onUpload: () => void;
  onSharePoint: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          className="gap-1.5 rounded-full bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] hover:bg-[hsl(var(--success))]/90 font-semibold px-4 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          New…
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {onNewFolder && (
          <DropdownMenuItem onClick={onNewFolder} className="gap-2.5 py-2">
            <FolderPlus className="h-4 w-4 text-muted-foreground" />
            Opprett mappe
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onUpload} className="gap-2.5 py-2">
          <Upload className="h-4 w-4 text-muted-foreground" />
          Last opp filer
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal px-2">
          Koble fra ekstern kilde…
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={onSharePoint} className="gap-2.5 py-2">
          <Link2 className="h-4 w-4 text-primary" />
          SharePoint
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── Uploading indicator ── */

function UploadingIndicator() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Laster opp…
    </div>
  );
}
