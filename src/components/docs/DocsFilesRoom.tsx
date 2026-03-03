import { useState, useRef } from "react";
import { useDocsFiles, type DocFolder, type DocFile } from "@/hooks/useDocsFiles";
import { useAuth } from "@/hooks/useAuth";
import {
  FolderOpen,
  Plus,
  Upload,
  FileText,
  Image,
  File,
  Loader2,
  ChevronRight,
  ArrowLeft,
  Trash2,
  ExternalLink,
  Users,
  FolderPlus,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SharePointPicker } from "@/components/docs/SharePointPicker";

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
    return <Image className="h-5 w-5 text-green-600 shrink-0" />;
  if (mime.includes("pdf") || ext === "pdf")
    return <FileText className="h-5 w-5 text-red-500 shrink-0" />;
  if (mime.includes("word") || ["doc", "docx"].includes(ext))
    return <FileText className="h-5 w-5 text-blue-600 shrink-0" />;
  if (mime.includes("excel") || mime.includes("spreadsheet") || ["xls", "xlsx"].includes(ext))
    return <FileText className="h-5 w-5 text-green-700 shrink-0" />;
  if (file.source_type === "sharepoint")
    return <Link2 className="h-5 w-5 text-primary shrink-0" />;
  return <File className="h-5 w-5 text-muted-foreground shrink-0" />;
}

/* ── Props ── */

interface DocsFilesRoomProps {
  projectId: string;
  jobId: string;
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
  } = useDocsFiles(projectId);

  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showSharePoint, setShowSharePoint] = useState(false);
  const [uploading, setUploading] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  const activeFolder = folders.find((f) => f.id === activeFolderId);
  const folderFiles = activeFolderId
    ? files.filter((f) => f.folder_id === activeFolderId)
    : unsortedFiles;

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

  const handleSharePointSelect = async (
    title: string,
    meta: { drive_id: string; item_id: string; web_url: string; preview_url?: string }
  ) => {
    try {
      await addSharePointFile(activeFolderId, title, meta);
      setShowSharePoint(false);
      toast.success("SharePoint-fil koblet");
    } catch (err: any) {
      toast.error("Kunne ikke koble fil", { description: err.message });
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

  const openFile = (file: DocFile) => {
    if (file.source_type === "sharepoint") {
      const url = (file.source_meta as any)?.web_url;
      if (url) window.open(url, "_blank");
    } else {
      const url = (file.source_meta as any)?.public_url;
      if (url) window.open(url, "_blank");
    }
  };

  /* ── Loading state ── */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  /* ── SharePoint picker overlay ── */

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
        <SharePointPicker jobId={jobId} onSelect={handleSharePointSelect} />
      </div>
    );
  }

  /* ── Inside a folder ── */

  if (activeFolderId) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setActiveFolderId(null)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Alle mapper
          </button>

          <div className="flex items-center gap-2">
            <NewDropdown
              onUpload={() => uploadRef.current?.click()}
              onSharePoint={() => setShowSharePoint(true)}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <FolderOpen className="h-6 w-6 text-primary" />
          <div>
            <h3 className="text-lg font-bold text-foreground">{activeFolder?.name}</h3>
            <p className="text-xs text-muted-foreground">
              {folderFiles.length} {folderFiles.length === 1 ? "fil" : "filer"}
              {activeFolder?.has_member_override && (
                <span className="ml-2 inline-flex items-center gap-1">
                  <Users className="h-3 w-3" /> Begrenset tilgang
                </span>
              )}
            </p>
          </div>
        </div>

        <FileList files={folderFiles} onOpen={openFile} onDelete={isAdmin ? handleDelete : undefined} />

        <input ref={uploadRef} type="file" multiple onChange={handleUpload} className="hidden" />
        {uploading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Laster opp…
          </div>
        )}
      </div>
    );
  }

  /* ── Main view: Folders grid + unsorted ── */

  const isEmpty = folders.length === 0 && unsortedFiles.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Dokumenter & Filer</h2>
        <NewDropdown
          onNewFolder={() => setShowNewFolder(true)}
          onUpload={() => uploadRef.current?.click()}
          onSharePoint={() => setShowSharePoint(true)}
        />
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
          <Button size="sm" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
            Opprett
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setShowNewFolder(false); setNewFolderName(""); }}>
            Avbryt
          </Button>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && !showNewFolder && (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/8 text-primary">
            <FolderOpen className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-foreground">Ingen dokumenter ennå</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Opprett en mappe, last opp filer eller koble til SharePoint for å komme i gang.
            </p>
          </div>
          <NewDropdown
            onNewFolder={() => setShowNewFolder(true)}
            onUpload={() => uploadRef.current?.click()}
            onSharePoint={() => setShowSharePoint(true)}
            asCta
          />
        </div>
      )}

      {/* Folder tiles */}
      {folders.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {folders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => setActiveFolderId(folder.id)}
              className={cn(
                "flex items-center gap-4 rounded-xl border border-border/40 bg-card p-5",
                "text-left transition-all duration-200",
                "hover:shadow-md hover:shadow-foreground/[0.04] hover:border-border/70 hover:scale-[1.01]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/8 text-primary shrink-0">
                <FolderOpen className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-semibold text-foreground truncate">{folder.name}</h4>
                <p className="text-xs text-muted-foreground">
                  {folder.file_count || 0} {(folder.file_count || 0) === 1 ? "fil" : "filer"}
                  {folder.has_member_override && (
                    <span className="ml-1.5 inline-flex items-center gap-0.5">
                      · <Users className="h-3 w-3" /> Begrenset
                    </span>
                  )}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* Unsorted files */}
      {unsortedFiles.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Usorterte filer</h3>
          <FileList files={unsortedFiles} onOpen={openFile} onDelete={isAdmin ? handleDelete : undefined} />
        </div>
      )}

      <input ref={uploadRef} type="file" multiple onChange={handleUpload} className="hidden" />
      {uploading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Laster opp…
        </div>
      )}
    </div>
  );
}

/* ── New... Dropdown ── */

function NewDropdown({
  onNewFolder,
  onUpload,
  onSharePoint,
  asCta,
}: {
  onNewFolder?: () => void;
  onUpload: () => void;
  onSharePoint: () => void;
  asCta?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={asCta ? "default" : "outline"} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Ny…
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {onNewFolder && (
          <DropdownMenuItem onClick={onNewFolder} className="gap-2">
            <FolderPlus className="h-4 w-4" />
            Opprett mappe
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onUpload} className="gap-2">
          <Upload className="h-4 w-4" />
          Last opp filer
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSharePoint} className="gap-2">
          <Link2 className="h-4 w-4" />
          Koble fra SharePoint
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── File List ── */

function FileList({
  files,
  onOpen,
  onDelete,
}: {
  files: DocFile[];
  onOpen: (f: DocFile) => void;
  onDelete?: (f: DocFile) => void;
}) {
  if (files.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">Ingen filer i denne mappen.</p>
    );
  }

  return (
    <div className="space-y-1">
      {files.map((file) => (
        <div
          key={file.id}
          className="flex items-center gap-3 rounded-lg border border-border/40 bg-card px-4 py-3 hover:border-border/70 transition-colors group"
        >
          {getFileIcon(file)}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{file.title}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {file.source_type === "sharepoint" && <span className="text-primary">SharePoint</span>}
              {file.file_size ? <span>{formatSize(file.file_size)}</span> : null}
              <span>{new Date(file.created_at).toLocaleDateString("nb-NO")}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onOpen(file)}
              title="Åpne"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(file)}
                title="Slett"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
