import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DocFolder {
  id: string;
  project_id: string;
  name: string;
  parent_folder_id: string | null;
  has_member_override: boolean;
  icon: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  file_count?: number;
  member_count?: number;
}

export interface DocFile {
  id: string;
  project_id: string;
  folder_id: string | null;
  title: string;
  description: string | null;
  source_type: string;
  source_meta: Record<string, any>;
  mime_type: string | null;
  file_size: number | null;
  created_by: string | null;
  created_at: string;
}

export function useDocsFiles(projectId: string) {
  const [folders, setFolders] = useState<DocFolder[]>([]);
  const [files, setFiles] = useState<DocFile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [foldersRes, filesRes] = await Promise.all([
      supabase
        .from("doc_folders")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("docs_files")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
    ]);

    const rawFolders = (foldersRes.data ?? []) as DocFolder[];

    // Enrich folders with file count
    const allFiles = (filesRes.data ?? []) as DocFile[];
    const countMap: Record<string, number> = {};
    allFiles.forEach((f) => {
      const key = f.folder_id ?? "__unsorted";
      countMap[key] = (countMap[key] || 0) + 1;
    });

    setFolders(
      rawFolders.map((f) => ({
        ...f,
        file_count: countMap[f.id] || 0,
      }))
    );
    setFiles(allFiles);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const createFolder = useCallback(
    async (name: string, parentId?: string) => {
      const { data: uaData } = await supabase
        .from("user_accounts")
        .select("id")
        .eq("auth_user_id", (await supabase.auth.getUser()).data.user?.id ?? "")
        .eq("is_active", true)
        .single();

      const { error } = await supabase.from("doc_folders").insert({
        project_id: projectId,
        name,
        parent_folder_id: parentId || null,
        created_by: uaData?.id || null,
      });
      if (error) throw error;
      await fetchAll();
    },
    [projectId, fetchAll]
  );

  const uploadFile = useCallback(
    async (file: File, folderId: string | null) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      const { data: uaData } = await supabase
        .from("user_accounts")
        .select("id")
        .eq("auth_user_id", userId ?? "")
        .eq("is_active", true)
        .single();

      const filePath = `${projectId}/${folderId || "unsorted"}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("job-attachments")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("job-attachments")
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase.from("docs_files").insert({
        project_id: projectId,
        folder_id: folderId,
        title: file.name,
        source_type: "internal",
        source_meta: {
          bucket: "job-attachments",
          file_path: filePath,
          public_url: urlData.publicUrl,
        },
        mime_type: file.type || null,
        file_size: file.size,
        created_by: uaData?.id || null,
      });
      if (dbError) throw dbError;
      await fetchAll();
    },
    [projectId, fetchAll]
  );

  const addSharePointFile = useCallback(
    async (
      folderId: string | null,
      title: string,
      meta: { drive_id: string; item_id: string; web_url: string; preview_url?: string }
    ) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data: uaData } = await supabase
        .from("user_accounts")
        .select("id")
        .eq("auth_user_id", userData.user?.id ?? "")
        .eq("is_active", true)
        .single();

      const { error } = await supabase.from("docs_files").insert({
        project_id: projectId,
        folder_id: folderId,
        title,
        source_type: "sharepoint",
        source_meta: meta,
        created_by: uaData?.id || null,
      });
      if (error) throw error;
      await fetchAll();
    },
    [projectId, fetchAll]
  );

  const deleteFile = useCallback(
    async (fileId: string) => {
      const { error } = await supabase.from("docs_files").delete().eq("id", fileId);
      if (error) throw error;
      await fetchAll();
    },
    [fetchAll]
  );

  const deleteFolder = useCallback(
    async (folderId: string) => {
      const { error } = await supabase.from("doc_folders").delete().eq("id", folderId);
      if (error) throw error;
      await fetchAll();
    },
    [fetchAll]
  );

  const moveFile = useCallback(
    async (fileId: string, newFolderId: string | null) => {
      // Optimistic update
      setFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, folder_id: newFolderId } : f))
      );
      const { error } = await supabase
        .from("docs_files")
        .update({ folder_id: newFolderId })
        .eq("id", fileId);
      if (error) {
        // Revert on error
        await fetchAll();
        throw error;
      }
    },
    [fetchAll]
  );

  const unsortedFiles = files.filter((f) => !f.folder_id);

  return {
    folders,
    files,
    unsortedFiles,
    loading,
    refresh: fetchAll,
    createFolder,
    uploadFile,
    addSharePointFile,
    deleteFile,
    deleteFolder,
    moveFile,
  };
}
