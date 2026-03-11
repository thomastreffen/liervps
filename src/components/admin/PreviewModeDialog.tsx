import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { usePreviewMode, type PreviewTarget } from "@/hooks/usePreviewMode";
import { Loader2, User, ShieldCheck, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface PreviewModeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UserOption {
  authUserId: string;
  fullName: string;
  email: string;
  roleName: string;
}

interface RoleOption {
  id: string;
  name: string;
  permissionCount: number;
}

export function PreviewModeDialog({ open, onOpenChange }: PreviewModeDialogProps) {
  const { activate, loading } = usePreviewMode();
  const [tab, setTab] = useState<"user" | "role">("user");
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // Fetch users
  useEffect(() => {
    if (!open) return;
    setLoadingList(true);
    (async () => {
      const { data: accounts } = await supabase
        .from("user_accounts")
        .select("auth_user_id, person_id")
        .eq("is_active", true)
        .limit(200);

      if (!accounts?.length) { setLoadingList(false); return; }

      const personIds = accounts.map((a: any) => a.person_id);
      const { data: people } = await supabase
        .from("people")
        .select("id, full_name, email")
        .in("id", personIds);

      const personMap = new Map((people || []).map((p: any) => [p.id, p]));

      // Get legacy roles
      const authIds = accounts.map((a: any) => a.auth_user_id);
      const { data: legacyRoles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", authIds);
      const roleMap = new Map((legacyRoles || []).map((r: any) => [r.user_id, r.role]));

      const mapped: UserOption[] = accounts.map((a: any) => {
        const person = personMap.get(a.person_id);
        return {
          authUserId: a.auth_user_id,
          fullName: person?.full_name || "Ukjent",
          email: person?.email || "",
          roleName: roleMap.get(a.auth_user_id) || "montør",
        };
      }).sort((a, b) => a.fullName.localeCompare(b.fullName));

      setUsers(mapped);

      // Fetch roles
      const { data: rolesData } = await supabase
        .from("roles")
        .select("id, name")
        .order("name");

      const rolesList: RoleOption[] = [];
      for (const r of rolesData || []) {
        const { count } = await supabase
          .from("role_permissions")
          .select("id", { count: "exact", head: true })
          .eq("role_id", (r as any).id)
          .eq("allowed", true);
        rolesList.push({
          id: (r as any).id,
          name: (r as any).name,
          permissionCount: count || 0,
        });
      }
      setRoles(rolesList);
      setLoadingList(false);
    })();
  }, [open]);

  const filteredUsers = users.filter(u =>
    !search ||
    u.fullName.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const filteredRoles = roles.filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = async (target: PreviewTarget) => {
    await activate(target);
    onOpenChange(false);
    setSearch("");
  };

  const roleLabel = (role: string) => {
    switch (role) {
      case "super_admin": return "Superadmin";
      case "admin": return "Admin";
      case "montør": return "Montør";
      default: return role;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Vis system som
          </DialogTitle>
          <DialogDescription>
            Forhåndsvis systemet med en annen brukers eller rolles tilgangsnivå. Endringer kan ikke utføres i preview-modus.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => { setTab(v as "user" | "role"); setSearch(""); }}>
          <TabsList className="w-full">
            <TabsTrigger value="user" className="flex-1 gap-1.5">
              <User className="h-3.5 w-3.5" />
              Bruker
            </TabsTrigger>
            <TabsTrigger value="role" className="flex-1 gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Rolle
            </TabsTrigger>
          </TabsList>

          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={tab === "user" ? "Søk etter navn eller e-post..." : "Søk etter rolle..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <TabsContent value="user" className="mt-3 overflow-y-auto max-h-[400px] space-y-1">
            {loadingList ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Ingen brukere funnet</p>
            ) : (
              filteredUsers.map((u) => (
                <button
                  key={u.authUserId}
                  onClick={() => handleSelect({
                    type: "user",
                    id: u.authUserId,
                    label: u.fullName,
                    appRole: u.roleName as any,
                  })}
                  disabled={loading}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                    "hover:bg-accent/50 focus:bg-accent/50 focus:outline-none",
                    "disabled:opacity-50"
                  )}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-medium">
                    {u.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.fullName}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {roleLabel(u.roleName)}
                  </span>
                </button>
              ))
            )}
          </TabsContent>

          <TabsContent value="role" className="mt-3 overflow-y-auto max-h-[400px] space-y-1">
            {loadingList ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredRoles.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Ingen roller funnet</p>
            ) : (
              filteredRoles.map((r) => (
                <button
                  key={r.id}
                  onClick={() => handleSelect({ type: "role", id: r.id, label: r.name })}
                  disabled={loading}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                    "hover:bg-accent/50 focus:bg-accent/50 focus:outline-none",
                    "disabled:opacity-50"
                  )}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.permissionCount} rettigheter</p>
                  </div>
                </button>
              ))
            )}
          </TabsContent>
        </Tabs>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Laster tilgangsnivå...
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
