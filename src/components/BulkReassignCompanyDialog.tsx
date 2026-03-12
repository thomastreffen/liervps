import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, ArrowRightLeft, Building } from "lucide-react";

interface ProjectRow {
  id: string;
  title: string;
  company_id: string | null;
  company_name: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onComplete?: () => void;
}

export function BulkReassignCompanyDialog({ open, onOpenChange, onComplete }: Props) {
  const { companies } = useCompanyContext();
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetCompanyId, setTargetCompanyId] = useState<string>("");
  const [reassigning, setReassigning] = useState(false);
  const [filterCompanyId, setFilterCompanyId] = useState<string>("__all__");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("events")
        .select("id, title, company_id")
        .is("deleted_at", null)
        .order("title");

      const rows: ProjectRow[] = (data || []).map((e: any) => ({
        id: e.id,
        title: e.title,
        company_id: e.company_id,
        company_name: companies.find((c) => c.id === e.company_id)?.name || (e.company_id ? "Ukjent" : "Ikke satt"),
      }));
      setProjects(rows);
      setSelectedIds([]);
      setTargetCompanyId("");
      setLoading(false);
    })();
  }, [open, companies]);

  const filtered = filterCompanyId === "__all__"
    ? projects
    : filterCompanyId === "__null__"
      ? projects.filter((p) => !p.company_id)
      : projects.filter((p) => p.company_id === filterCompanyId);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((p) => p.id));
    }
  };

  const handleReassign = async () => {
    if (!targetCompanyId || selectedIds.length === 0) return;
    setReassigning(true);

    const { error } = await supabase
      .from("events")
      .update({ company_id: targetCompanyId } as any)
      .in("id", selectedIds);

    if (error) {
      toast.error("Kunne ikke flytte prosjekter", { description: error.message });
    } else {
      // Audit log
      await supabase.from("audit_log").insert(
        selectedIds.map((id) => ({
          action: "company_reassign",
          target_type: "event",
          target_id: id,
          actor_user_account_id: null,
          metadata: {
            new_company_id: targetCompanyId,
            new_company_name: companies.find((c) => c.id === targetCompanyId)?.name,
            reassigned_by: user?.id,
          },
        }))
      );

      toast.success(`${selectedIds.length} prosjekt(er) flyttet til ${companies.find((c) => c.id === targetCompanyId)?.name}`);
      onComplete?.();
      onOpenChange(false);
    }
    setReassigning(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Flytt prosjekter mellom selskaper
          </DialogTitle>
          <DialogDescription>
            Velg prosjekter og flytt dem til riktig selskap. Endringen logges i audit-loggen.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 py-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Filtrer kilde:</span>
          <Select value={filterCompanyId} onValueChange={setFilterCompanyId}>
            <SelectTrigger className="h-8 text-xs w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Alle selskaper</SelectItem>
              <SelectItem value="__null__">Ikke satt</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-xs text-muted-foreground whitespace-nowrap ml-auto">Flytt til:</span>
          <Select value={targetCompanyId} onValueChange={setTargetCompanyId}>
            <SelectTrigger className="h-8 text-xs w-[200px]">
              <Building className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Velg mål-selskap" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 overflow-y-auto border rounded-lg">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card border-b">
                <tr>
                  <th className="p-2 w-10">
                    <Checkbox
                      checked={filtered.length > 0 && selectedIds.length === filtered.length}
                      onCheckedChange={selectAll}
                    />
                  </th>
                  <th className="p-2 text-left text-xs font-medium text-muted-foreground">Prosjekt</th>
                  <th className="p-2 text-left text-xs font-medium text-muted-foreground">Nåværende selskap</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-border/30 hover:bg-secondary/30">
                    <td className="p-2">
                      <Checkbox
                        checked={selectedIds.includes(p.id)}
                        onCheckedChange={() => toggleSelect(p.id)}
                      />
                    </td>
                    <td className="p-2 text-sm">{p.title}</td>
                    <td className="p-2">
                      <Badge variant="outline" className="text-[10px]">
                        {p.company_name}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-muted-foreground text-sm">
                      Ingen prosjekter funnet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter className="pt-3">
          <div className="text-xs text-muted-foreground mr-auto">
            {selectedIds.length} valgt av {filtered.length}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button
            onClick={handleReassign}
            disabled={reassigning || selectedIds.length === 0 || !targetCompanyId}
            className="gap-1.5"
          >
            {reassigning && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Flytt {selectedIds.length} prosjekt(er)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
