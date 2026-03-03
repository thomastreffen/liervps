import { FileText, Image, File, FileSpreadsheet, FileCode, FileArchive, Presentation, Film, Music, Link2 } from "lucide-react";

/** Returns a coloured icon component based on mime type and file extension. */
export function getFileTypeIcon(mimeType: string | null, fileName: string, sourceType?: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const mime = mimeType || "";

  // Images
  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg", "ico", "bmp", "tiff"].includes(ext))
    return <Image className="h-5 w-5 text-[hsl(var(--success))] shrink-0" />;

  // PDF
  if (mime.includes("pdf") || ext === "pdf")
    return <FileText className="h-5 w-5 text-destructive shrink-0" />;

  // Word
  if (mime.includes("word") || mime.includes("opendocument.text") || ["doc", "docx", "odt", "rtf"].includes(ext))
    return <FileText className="h-5 w-5 text-primary shrink-0" />;

  // Excel / Spreadsheet
  if (mime.includes("excel") || mime.includes("spreadsheet") || ["xls", "xlsx", "csv", "ods"].includes(ext))
    return <FileSpreadsheet className="h-5 w-5 text-[hsl(var(--success))] shrink-0" />;

  // PowerPoint / Presentation
  if (mime.includes("presentation") || mime.includes("powerpoint") || ["ppt", "pptx", "odp"].includes(ext))
    return <Presentation className="h-5 w-5 text-[hsl(var(--warning,40_96%_40%))] shrink-0" />;

  // Video
  if (mime.startsWith("video/") || ["mp4", "mov", "avi", "mkv", "webm"].includes(ext))
    return <Film className="h-5 w-5 text-primary shrink-0" />;

  // Audio
  if (mime.startsWith("audio/") || ["mp3", "wav", "ogg", "flac", "aac"].includes(ext))
    return <Music className="h-5 w-5 text-primary shrink-0" />;

  // Archive
  if (mime.includes("zip") || mime.includes("tar") || mime.includes("compressed") || ["zip", "rar", "7z", "tar", "gz"].includes(ext))
    return <FileArchive className="h-5 w-5 text-muted-foreground shrink-0" />;

  // Code
  if (mime.includes("json") || mime.includes("xml") || mime.includes("javascript") || mime.includes("html") || ["js", "ts", "tsx", "jsx", "json", "xml", "html", "css", "py", "java", "rb", "go", "rs"].includes(ext))
    return <FileCode className="h-5 w-5 text-muted-foreground shrink-0" />;

  // SharePoint
  if (sourceType === "sharepoint")
    return <Link2 className="h-5 w-5 text-primary shrink-0" />;

  // Default
  return <File className="h-5 w-5 text-muted-foreground shrink-0" />;
}

/** Infer MIME type from file name extension */
export function inferMimeType(name: string): string | null {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
    webp: "image/webp", svg: "image/svg+xml", pdf: "application/pdf",
    doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    zip: "application/zip", rar: "application/x-rar-compressed",
    mp4: "video/mp4", mp3: "audio/mpeg", wav: "audio/wav",
    json: "application/json", xml: "application/xml", html: "text/html", css: "text/css",
    txt: "text/plain", csv: "text/csv",
  };
  return map[ext] || null;
}
