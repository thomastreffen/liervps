import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle, XCircle, CalendarOff } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import {
  useAbsenceRequests,
  ABSENCE_TYPE_LABELS,
  ABSENCE_TYPE_COLORS,
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

export function AbsenceApprovalList() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<AbsenceStatus | "all">("pending");
  const { requests, loading, refetch } = useAbsenceRequests(statusFilter);
  const [acting, setActing] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const handleApprove = useCallback(async (id: string) => {
    setActing(id);
    const { error } = await supabase
      .from("absence_requests")
      .update({
        status: "approved",
        approved_by: user?.id || null,
        approved_at: new Date().toISOString(),
      })
      .eq("id", id);
    setActing(null);
    if (error) {
      toast.error("Feil ved godkjenning");
    } else {
      toast.success("Forespørsel godkjent");
      refetch();
    }
  }, [user, refetch]);

  const handleReject = useCallback(async () => {
    if (!rejectDialog) return;
    setActing(rejectDialog.id);
    const { error } = await supabase
      .from("absence_requests")
      .update({
        status: "rejected",
        approved_by: user?.id || null,
        approved_at: new Date().toISOString(),
        rejection_reason: rejectReason || null,
      })
      .eq("id", rejectDialog.id);
    setActing(null);
    setRejectDialog(null);
    setRejectReason("");
    if (error) {
      toast.error("Feil ved avslag");
    } else {
      toast.success("Forespørsel avslått");
      refetch();
    }
  }, [user, rejectDialog, rejectReason, refetch]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as AbsenceStatus | "all")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrer status..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="pending">Venter</SelectItem>
            <SelectItem value="approved">Godkjent</SelectItem>
            <SelectItem value="rejected">Avslått</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <CalendarOff className="h-10 w-10" />
          <p className="text-sm">Ingen forespørsler å vise.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="rounded-lg border p-4 flex items-start justify-between gap-4">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">{r.person_name}</p>
                  <Badge className={`text-[10px] ${ABSENCE_TYPE_COLORS[r.absence_type]}`}>
                    {ABSENCE_TYPE_LABELS[r.absence_type]}
                  </Badge>
                  {r.status === "pending" && <Badge variant="outline" className="text-[10px]">Venter</Badge>}
                  {r.status === "approved" && <Badge variant="success" className="text-[10px]">Godkjent</Badge>}
                  {r.status === "rejected" && <Badge variant="destructive" className="text-[10px]">Avslått</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(r.start_date), "d. MMM yyyy", { locale: nb })}
                  {r.start_date !== r.end_date && (
                    <> – {format(new Date(r.end_date), "d. MMM yyyy", { locale: nb })}</>
                  )}
                  {!r.is_full_day && r.start_time && r.end_time && (
                    <span className="ml-2">{r.start_time.slice(0, 5)} – {r.end_time.slice(0, 5)}</span>
                  )}
                </p>
                {r.comment && <p className="text-xs text-muted-foreground">{r.comment}</p>}
                {r.company_name && (
                  <p className="text-[11px] text-muted-foreground">{r.company_name}</p>
                )}
              </div>

              {r.status === "pending" && (
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleApprove(r.id)}
                    disabled={acting === r.id}
                    className="text-green-700 border-green-500/30 hover:bg-green-500/10"
                  >
                    {acting === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5 mr-1" />}
                    Godkjenn
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRejectDialog({ id: r.id })}
                    disabled={acting === r.id}
                    className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1" />
                    Avslå
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!rejectDialog} onOpenChange={(o) => !o && setRejectDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Avslå forespørsel</AlertDialogTitle>
            <AlertDialogDescription>
              Oppgi eventuell grunn for avslaget.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Valgfri grunn..."
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Avslå
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
