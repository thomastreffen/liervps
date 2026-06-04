import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CalendarOff, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import {
  ABSENCE_TYPE_LABELS,
  ABSENCE_TYPE_COLORS,
  type AbsenceType,
  type AbsenceStatus,
} from "@/hooks/useAbsenceRequests";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AbsenceEditDialog, type AbsenceEditData } from "./AbsenceEditDialog";

interface MyRequest {
  id: string;
  absence_type: AbsenceType;
  start_date: string;
  end_date: string;
  is_full_day: boolean;
  start_time: string | null;
  end_time: string | null;
  status: AbsenceStatus;
  comment: string | null;
  created_at: string;
  rejection_reason: string | null;
}

const STATUS_BADGE: Record<AbsenceStatus, { label: string; variant: "outline" | "success" | "destructive" }> = {
  pending: { label: "Venter", variant: "outline" },
  approved: { label: "Godkjent", variant: "success" },
  rejected: { label: "Avslått", variant: "destructive" },
};

export function AbsenceMyRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<MyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [editAbsence, setEditAbsence] = useState<AbsenceEditData | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ id: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchMine = useCallback(async () => {
    if (!user) return;

    const { data: ua } = await supabase
      .from("user_accounts")
      .select("person_id")
      .eq("auth_user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!ua?.person_id) { setLoading(false); return; }

    const { data } = await supabase
      .from("absence_requests")
      .select("id, absence_type, start_date, end_date, is_full_day, start_time, end_time, status, comment, created_at, rejection_reason")
      .eq("person_id", ua.person_id)
      .order("start_date", { ascending: false });

    setRequests((data as any[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchMine();
  }, [fetchMine]);

  const handleDelete = useCallback(async () => {
    if (!deleteDialog) return;
    setDeleting(true);
    const { error, count } = await supabase
      .from("absence_requests")
      .delete({ count: "exact" })
      .eq("id", deleteDialog.id);
    setDeleting(false);
    setDeleteDialog(null);
    if (error) {
      toast.error("Feil ved sletting", { description: error.message });
    } else if (!count) {
      toast.error("Kunne ikke slette", { description: "Du har ikke tilgang til å slette dette fraværet." });
    } else {
      toast.success("Fraværet er slettet");
      fetchMine();
    }
  }, [deleteDialog, fetchMine]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        <CalendarOff className="h-10 w-10" />
        <p className="text-sm">Ingen fraværsforespørsler ennå.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {requests.map((r) => {
          const sb = STATUS_BADGE[r.status];
          return (
            <div key={r.id} className="rounded-lg border p-4 flex items-start justify-between gap-4">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <Badge className={`text-[10px] ${ABSENCE_TYPE_COLORS[r.absence_type]}`}>
                    {ABSENCE_TYPE_LABELS[r.absence_type]}
                  </Badge>
                  <Badge variant={sb.variant} className="text-[10px]">{sb.label}</Badge>
                </div>
                <p className="text-sm font-medium">
                  {format(new Date(r.start_date), "d. MMM yyyy", { locale: nb })}
                  {r.start_date !== r.end_date && (
                    <> – {format(new Date(r.end_date), "d. MMM yyyy", { locale: nb })}</>
                  )}
                  {!r.is_full_day && r.start_time && r.end_time && (
                    <span className="text-muted-foreground ml-2">
                      {r.start_time.slice(0, 5)} – {r.end_time.slice(0, 5)}
                    </span>
                  )}
                </p>
                {r.comment && <p className="text-xs text-muted-foreground">{r.comment}</p>}
                {r.rejection_reason && (
                  <p className="text-xs text-destructive">Grunn: {r.rejection_reason}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditAbsence({
                    id: r.id,
                    absence_type: r.absence_type,
                    start_date: r.start_date,
                    end_date: r.end_date,
                    start_time: r.start_time,
                    end_time: r.end_time,
                    is_full_day: r.is_full_day,
                    comment: r.comment,
                    status: r.status,
                  })}
                  className="h-8 w-8 p-0"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeleteDialog({ id: r.id })}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <p className="text-[11px] text-muted-foreground whitespace-nowrap ml-2">
                  {format(new Date(r.created_at), "d. MMM", { locale: nb })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(o) => !o && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slett fravær</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på at du vil slette denne fraværsforespørselen? Dette kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Slett
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit dialog */}
      <AbsenceEditDialog
        open={!!editAbsence}
        onOpenChange={(o) => !o && setEditAbsence(null)}
        absence={editAbsence}
        onSaved={fetchMine}
      />
    </>
  );
}
