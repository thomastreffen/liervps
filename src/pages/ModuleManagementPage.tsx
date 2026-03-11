import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Eye, EyeOff, Globe, User, Info, Shield } from "lucide-react";

interface ModuleSetting {
  module_key: string;
  label: string;
  is_enabled: boolean;
  sort_order: number;
}

interface UserAccount {
  id: string;
  person_id: string | null;
  people?: { full_name: string } | null;
}

interface UserOverride {
  id: string;
  module_key: string;
  user_account_id: string;
  is_hidden: boolean;
}

export default function ModuleManagementPage() {
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const { data: modules = [] } = useQuery<ModuleSetting[]>({
    queryKey: ["module-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("module_settings")
        .select("module_key, label, is_enabled, sort_order")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: users = [] } = useQuery<UserAccount[]>({
    queryKey: ["module-mgmt-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_accounts")
        .select("id, person_id, people(full_name)")
        .eq("is_active", true)
        .order("person_id");
      if (error) throw error;
      return (data ?? []) as unknown as UserAccount[];
    },
  });

  const { data: overrides = [] } = useQuery<UserOverride[]>({
    queryKey: ["module-overrides-all", selectedUser],
    enabled: !!selectedUser,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("module_user_overrides")
        .select("id, module_key, user_account_id, is_hidden")
        .eq("user_account_id", selectedUser!);
      if (error) throw error;
      return (data ?? []) as UserOverride[];
    },
  });

  // Fetch selected user's roles for summary
  const { data: selectedUserRoles = [] } = useQuery<string[]>({
    queryKey: ["module-mgmt-user-roles", selectedUser],
    enabled: !!selectedUser,
    queryFn: async () => {
      const { data: urData } = await supabase
        .from("user_roles_v2")
        .select("role_id")
        .eq("user_account_id", selectedUser!);
      if (!urData || urData.length === 0) return [];
      const roleIds = (urData as any[]).map((r: any) => r.role_id);
      const { data: rolesData } = await supabase
        .from("roles")
        .select("name")
        .in("id", roleIds);
      return (rolesData as any[] || []).map((r: any) => r.name);
    },
  });

  const toggleGlobal = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("module_settings")
        .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
        .eq("module_key", key);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["module-settings"] });
      toast.success("Modulinnstilling oppdatert");
    },
  });

  const upsertOverride = useMutation({
    mutationFn: async ({ key, userId, hidden }: { key: string; userId: string; hidden: boolean }) => {
      const { error } = await supabase
        .from("module_user_overrides")
        .upsert(
          { module_key: key, user_account_id: userId, is_hidden: hidden },
          { onConflict: "module_key,user_account_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["module-overrides-all"] });
      toast.success("Brukeroverstyring oppdatert");
    },
  });

  const mainModules = modules.filter((m) => m.sort_order < 10);
  const adminModules = modules.filter((m) => m.sort_order >= 10);

  const isOverrideHidden = (key: string) =>
    overrides.find((o) => o.module_key === key)?.is_hidden ?? false;

  const hiddenCount = overrides.filter((o) => o.is_hidden).length;

  return (
    <div className="p-4 sm:p-6 space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Modulsynlighet</h1>
        <p className="text-sm text-muted-foreground">
          Styr hvilke moduler som er synlige globalt og per bruker. Superadmin ser alltid alt.
        </p>
      </div>

      {/* Info banner */}
      <div className="rounded-lg border border-border bg-muted/30 p-3 flex gap-2">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          <strong>Modulsynlighet</strong> styrer kun hva som vises i meny og grensesnitt.
          Faktisk tilgang styres av <strong>roller</strong>, <strong>omfang</strong> og <strong>rettigheter</strong>.
          Å skjule en modul fjerner ikke brukerens underliggende tilgang.
        </p>
      </div>

      {/* Global settings */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Globale innstillinger</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Deaktiverte moduler er skjult for alle brukere unntatt superadmin.
        </p>

        <div className="rounded-lg border divide-y">
          <ModuleGroupHeader label="Hovedmeny" />
          {mainModules.map((mod) => (
            <ModuleRow
              key={mod.module_key}
              label={mod.label}
              enabled={mod.is_enabled}
              onToggle={(val) => toggleGlobal.mutate({ key: mod.module_key, enabled: val })}
            />
          ))}
          <ModuleGroupHeader label="Admin" />
          {adminModules.map((mod) => (
            <ModuleRow
              key={mod.module_key}
              label={mod.label}
              enabled={mod.is_enabled}
              onToggle={(val) => toggleGlobal.mutate({ key: mod.module_key, enabled: val })}
            />
          ))}
        </div>
      </section>

      <Separator />

      {/* Per-user overrides */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Per bruker</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Skjul moduler for en spesifikk bruker, selv om modulen er globalt aktivert.
        </p>

        <Select value={selectedUser ?? ""} onValueChange={(v) => setSelectedUser(v || null)}>
          <SelectTrigger className="max-w-xs">
            <SelectValue placeholder="Velg bruker…" />
          </SelectTrigger>
          <SelectContent>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.people?.full_name ?? u.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedUser && (
          <>
            {/* User summary */}
            <div className="rounded-md border bg-muted/30 p-3 space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Roller:</span>
                <span className="font-medium">
                  {selectedUserRoles.length > 0 ? selectedUserRoles.join(", ") : "Ingen"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Skjulte moduler:</span>
                <span className="font-medium">{hiddenCount}</span>
              </div>
            </div>

            <div className="rounded-lg border divide-y">
              <ModuleGroupHeader label="Hovedmeny" />
              {mainModules.map((mod) => (
                <UserOverrideRow
                  key={mod.module_key}
                  label={mod.label}
                  globalEnabled={mod.is_enabled}
                  isHidden={isOverrideHidden(mod.module_key)}
                  onToggle={(hidden) =>
                    upsertOverride.mutate({ key: mod.module_key, userId: selectedUser, hidden })
                  }
                />
              ))}
              <ModuleGroupHeader label="Admin" />
              {adminModules.map((mod) => (
                <UserOverrideRow
                  key={mod.module_key}
                  label={mod.label}
                  globalEnabled={mod.is_enabled}
                  isHidden={isOverrideHidden(mod.module_key)}
                  onToggle={(hidden) =>
                    upsertOverride.mutate({ key: mod.module_key, userId: selectedUser, hidden })
                  }
                />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ModuleGroupHeader({ label }: { label: string }) {
  return (
    <div className="px-4 py-2 bg-muted/50">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  );
}

function ModuleRow({
  label,
  enabled,
  onToggle,
}: {
  label: string;
  enabled: boolean;
  onToggle: (val: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-sm">{label}</span>
        {!enabled && <Badge variant="secondary" className="text-[10px]">Deaktivert</Badge>}
      </div>
      <Switch checked={enabled} onCheckedChange={onToggle} />
    </div>
  );
}

function UserOverrideRow({
  label,
  globalEnabled,
  isHidden,
  onToggle,
}: {
  label: string;
  globalEnabled: boolean;
  isHidden: boolean;
  onToggle: (hidden: boolean) => void;
}) {
  const effectivelyHidden = !globalEnabled || isHidden;
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2">
        {effectivelyHidden ? (
          <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <Eye className="h-3.5 w-3.5 text-primary" />
        )}
        <span className="text-sm">{label}</span>
        {!globalEnabled && (
          <Badge variant="outline" className="text-[10px]">Globalt av</Badge>
        )}
      </div>
      <Switch
        checked={!isHidden}
        onCheckedChange={(val) => onToggle(!val)}
        disabled={!globalEnabled}
      />
    </div>
  );
}
