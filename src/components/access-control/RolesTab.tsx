import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, ChevronRight, Copy, Trash2, Users, Info, Search } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PERMISSION_CATEGORIES, SCOPE_OPTIONS, getPermLabel, getPermDescription } from "@/lib/permission-labels";
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

interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system_role: boolean;
  permissions: Record<string, boolean>;
  user_count: number;
}

export function RolesTab() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [form, setForm] = useState({ name: "", description: "", permissions: {} as Record<string, boolean> });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [permSearch, setPermSearch] = useState("");

  const fetchRoles = async () => {
    setLoading(true);
    const [{ data: rolesData }, { data: permsData }, { data: userRoles }] = await Promise.all([
      supabase.from("roles").select("*").order("name"),
      supabase.from("role_permissions").select("*"),
      supabase.from("user_roles_v2").select("role_id"),
    ]);

    const permsByRole: Record<string, Record<string, boolean>> = {};
    for (const p of (permsData as any[]) || []) {
      if (!permsByRole[p.role_id]) permsByRole[p.role_id] = {};
      permsByRole[p.role_id][p.permission_key] = p.allowed;
    }

    const countByRole: Record<string, number> = {};
    for (const ur of (userRoles as any[]) || []) {
      countByRole[ur.role_id] = (countByRole[ur.role_id] || 0) + 1;
    }

    setRoles(
      (rolesData as any[] || []).map((r: any) => ({
        ...r,
        permissions: permsByRole[r.id] || {},
        user_count: countByRole[r.id] || 0,
      }))
    );
    setLoading(false);
  };

  useEffect(() => { fetchRoles(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "", permissions: {} });
    setPermSearch("");
    setDialogOpen(true);
  };

  const openEdit = (r: Role) => {
    setEditing(r);
    setForm({ name: r.name, description: r.description || "", permissions: { ...r.permissions } });
    setPermSearch("");
    setDialogOpen(true);
  };

  const openDuplicate = (r: Role, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(null);
    setForm({ name: `${r.name} (kopi)`, description: r.description || "", permissions: { ...r.permissions } });
    setPermSearch("");
    setDialogOpen(true);
  };

  const togglePerm = (key: string) => {
    setForm((f) => ({
      ...f,
      permissions: { ...f.permissions, [key]: !f.permissions[key] },
    }));
  };

  const getActiveScope = (): string => {
    if (form.permissions["scope.view.all"]) return "scope.view.all";
    if (form.permissions["scope.view.company"]) return "scope.view.company";
    return "scope.view.own";
  };

  const setScope = (scopeKey: string) => {
    setForm((f) => ({
      ...f,
      permissions: {
        ...f.permissions,
        "scope.view.own": scopeKey === "scope.view.own",
        "scope.view.company": scopeKey === "scope.view.company",
        "scope.view.all": scopeKey === "scope.view.all",
      },
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Rollenavn er påkrevd");
      return;
    }
    setSaving(true);
    try {
      let roleId = editing?.id;
      if (editing) {
        await supabase.from("roles").update({ name: form.name, description: form.description || null }).eq("id", editing.id);
      } else {
        const { data, error } = await supabase.from("roles").insert({ name: form.name, description: form.description || null }).select("id").single();
        if (error) throw error;
        roleId = (data as any).id;
      }
      await supabase.from("role_permissions").delete().eq("role_id", roleId!);
      const permRows = Object.entries(form.permissions)
        .filter(([, v]) => v)
        .map(([key]) => ({ role_id: roleId!, permission_key: key, allowed: true }));
      if (permRows.length > 0) {
        await supabase.from("role_permissions").insert(permRows);
      }
      toast.success(editing ? "Rolle oppdatert" : "Rolle opprettet");
      setDialogOpen(false);
      fetchRoles();
    } catch (err: any) {
      toast.error("Feil", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await supabase.from("role_permissions").delete().eq("role_id", deleteTarget.id);
      await supabase.from("user_roles_v2").delete().eq("role_id", deleteTarget.id);
      await supabase.from("user_role_assignments").delete().eq("role_id", deleteTarget.id);
      await supabase.from("roles").delete().eq("id", deleteTarget.id);
      toast.success("Rolle slettet");
      setDeleteTarget(null);
      fetchRoles();
    } catch (err: any) {
      toast.error("Feil", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const getScopeLabel = (r: Role) => {
    if (r.permissions["scope.view.all"]) return "Alle selskaper";
    if (r.permissions["scope.view.company"]) return "Eget selskap";
    return "Egne prosjekter";
  };

  const getPermCount = (r: Role) => Object.values(r.permissions).filter(Boolean).length;

  const activePermCount = Object.values(form.permissions).filter(Boolean).length;

  const filteredPermCategories = PERMISSION_CATEGORIES.map((cat) => ({
    ...cat,
    keys: cat.keys.filter((key) => {
      if (!permSearch) return true;
      const q = permSearch.toLowerCase();
      return getPermLabel(key).toLowerCase().includes(q) || key.toLowerCase().includes(q);
    }),
  })).filter((cat) => cat.keys.length > 0);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <TooltipProvider>
      <div className="mt-4 space-y-4">
        {/* Info box */}
        <div className="rounded-lg border border-border bg-muted/30 p-3 flex gap-2">
          <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            <strong>Roller</strong> er standardpakker med rettigheter. Tildel roller til brukere for å gi dem en samlet tilgangsprofil.
            For individuelle avvik, bruk overstyringer på brukerens Rettigheter-fane.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Roller ({roles.length})</h3>
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" /> Ny rolle
          </Button>
        </div>

        {roles.map((r) => (
          <Card key={r.id} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => openEdit(r)}>
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{r.name}</span>
                  {r.is_system_role ? (
                    <Badge variant="secondary" className="text-[10px]">Systemrolle</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">Egendefinert</Badge>
                  )}
                </div>
                {r.description && <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>}
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                  <span>{getScopeLabel(r)}</span>
                  <span>·</span>
                  <span>{getPermCount(r)} rettigheter</span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {r.user_count} bruker{r.user_count !== 1 ? "e" : ""}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => openDuplicate(r, e)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Dupliser rolle</TooltipContent>
                </Tooltip>
                {!r.is_system_role && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(r);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Slett rolle</TooltipContent>
                  </Tooltip>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[85vh]">
            <DialogHeader>
              <DialogTitle>{editing ? `Rediger: ${editing.name}` : "Ny rolle"}</DialogTitle>
              {editing?.is_system_role && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Dette er en systemrolle. Vurder å duplisere den før du gjør endringer.
                </p>
              )}
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Rollenavn</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Beskrivelse</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Kort beskrivelse av hva denne rollen innebærer…" />
              </div>

              {/* Scope dropdown */}
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Omfang – Hvem kan brukeren se?</Label>
                <Select value={getActiveScope()} onValueChange={setScope}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Permission search + count */}
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Rettigheter ({activePermCount} valgt)
                </Label>
                <div className="relative w-[180px]">
                  <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Søk…"
                    value={permSearch}
                    onChange={(e) => setPermSearch(e.target.value)}
                    className="pl-7 h-8 text-xs"
                  />
                </div>
              </div>

              <ScrollArea className="h-[320px] pr-4">
                <div className="space-y-5">
                  {filteredPermCategories.map((group) => (
                    <div key={group.category}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group.category}</p>
                      <p className="text-[11px] text-muted-foreground mb-2">{group.description}</p>
                      <div className="space-y-1.5">
                        {group.keys.map((key) => {
                          const desc = getPermDescription(key);
                          return (
                            <label key={key} className="flex items-center gap-2 cursor-pointer text-sm">
                              <Checkbox
                                checked={form.permissions[key] || false}
                                onCheckedChange={() => togglePerm(key)}
                              />
                              <span>{getPermLabel(key)}</span>
                              {desc && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-[250px] text-xs">{desc}</TooltipContent>
                                </Tooltip>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {filteredPermCategories.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Ingen rettigheter matcher søket.</p>
                  )}
                </div>
              </ScrollArea>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Avbryt</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lagre"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Slett rolle «{deleteTarget?.name}»?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget && deleteTarget.user_count > 0
                  ? `Denne rollen er tildelt ${deleteTarget.user_count} bruker(e). De vil miste rettighetene fra denne rollen.`
                  : "Rollen har ingen brukere tilknyttet. Handlingen kan ikke angres."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Avbryt</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Slett
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
