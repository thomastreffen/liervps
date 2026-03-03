import { useState, useEffect } from "react";
import { useProjectAccess, type ProjectMember, type SearchablePerson } from "@/hooks/useProjectAccess";
import {
  Users,
  Shield,
  Eye,
  Crown,
  UserPlus,
  Trash2,
  Loader2,
  X,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* ── Labels ── */

const ROLE_LABELS: Record<string, string> = {
  owner: "Eier",
  manager: "Prosjektleder",
  member: "Deltaker",
  follower: "Følger",
};

const ROLE_ICONS: Record<string, React.ReactNode> = {
  owner: <Crown className="h-3.5 w-3.5 text-amber-500" />,
  manager: <Shield className="h-3.5 w-3.5 text-primary" />,
  member: <Users className="h-3.5 w-3.5 text-muted-foreground" />,
  follower: <Eye className="h-3.5 w-3.5 text-muted-foreground" />,
};

const SPACE_LABELS: Record<string, string> = {
  samtaler: "Samtaler",
  oppgaver: "Oppgaver",
  dokumenter: "Dokumenter",
  tidsplan: "Tidsplan",
};

/* ── Main Drawer Content ── */

interface ProjectAccessDrawerProps {
  projectId: string;
  onClose: () => void;
  initialTab?: "members" | "spaces";
}

export function ProjectAccessDrawer({
  projectId,
  onClose,
  initialTab = "members",
}: ProjectAccessDrawerProps) {
  const {
    members,
    spaces,
    loading,
    isAdmin,
    searchPeople,
    addMember,
    removeMember,
    updateMemberRole,
    toggleSpace,
    ensureSpaces,
  } = useProjectAccess(projectId);

  const [tab, setTab] = useState<"members" | "spaces">(initialTab);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">
          {tab === "members" ? "Prosjekttilgang" : "Administrer rom"}
        </h2>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Explanation */}
      <p className="text-xs text-muted-foreground leading-relaxed">
        Interne medlemmer ser automatisk alle aktive rom. Eksterne må legges til eksplisitt per rom.
      </p>

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        <button
          onClick={() => setTab("members")}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            tab === "members"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Users className="h-3.5 w-3.5 inline mr-1.5" />
          Medlemmer ({members.length})
        </button>
        <button
          onClick={() => {
            setTab("spaces");
            if (spaces.length === 0) ensureSpaces();
          }}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            tab === "spaces"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Rom ({spaces.length})
        </button>
      </div>

      {/* Content */}
      {tab === "members" ? (
        <MembersTab
          members={members}
          isAdmin={isAdmin}
          onRemove={removeMember}
          onUpdateRole={updateMemberRole}
          onSearch={searchPeople}
          onAdd={addMember}
        />
      ) : (
        <SpacesTab spaces={spaces} isAdmin={isAdmin} onToggle={toggleSpace} />
      )}
    </div>
  );
}

/* ── Members Tab ── */

function MembersTab({
  members,
  isAdmin,
  onRemove,
  onUpdateRole,
  onSearch,
  onAdd,
}: {
  members: ProjectMember[];
  isAdmin: boolean;
  onRemove: (id: string) => Promise<void>;
  onUpdateRole: (id: string, role: string) => Promise<void>;
  onSearch: (q: string) => Promise<SearchablePerson[]>;
  onAdd: (uaId: string, type: string, role: string) => Promise<void>;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchablePerson[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingRole, setAddingRole] = useState("member");
  const [addingType, setAddingType] = useState("internal");

  const internals = members.filter((m) => m.member_type === "internal");
  const externals = members.filter((m) => m.member_type === "external");

  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      const r = await onSearch(searchQuery);
      setResults(r);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, onSearch]);

  const handleRemove = async (m: ProjectMember) => {
    try {
      await onRemove(m.id);
      toast.success("Medlem fjernet");
    } catch (err: any) {
      toast.error("Kunne ikke fjerne", { description: err.message });
    }
  };

  const handleRoleChange = async (m: ProjectMember, role: string) => {
    try {
      await onUpdateRole(m.id, role);
      toast.success("Rolle oppdatert");
    } catch (err: any) {
      toast.error("Kunne ikke oppdatere", { description: err.message });
    }
  };

  const handleAdd = async (person: SearchablePerson) => {
    try {
      await onAdd(person.user_account_id, addingType, addingRole);
      toast.success(`${person.name} lagt til`);
      setSearchQuery("");
      setResults([]);
    } catch (err: any) {
      toast.error("Kunne ikke legge til", { description: err.message });
    }
  };

  return (
    <div className="space-y-4">
      {/* Add member */}
      {isAdmin && (
        <>
          {!showAdd ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => setShowAdd(true)}
            >
              <UserPlus className="h-4 w-4" />
              Legg til medlem
            </Button>
          ) : (
            <div className="space-y-3 rounded-xl border border-border/60 bg-card p-3">
              <div className="flex items-center gap-2">
                <Select value={addingType} onValueChange={setAddingType}>
                  <SelectTrigger className="w-[100px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Intern</SelectItem>
                    <SelectItem value="external">Ekstern</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={addingRole} onValueChange={setAddingRole}>
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">Prosjektleder</SelectItem>
                    <SelectItem value="member">Deltaker</SelectItem>
                    <SelectItem value="follower">Følger</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-xs"
                  onClick={() => { setShowAdd(false); setSearchQuery(""); setResults([]); }}
                >
                  Avbryt
                </Button>
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Søk etter navn eller e-post…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9 text-sm"
                  autoFocus
                />
              </div>

              {searching && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Søker…
                </div>
              )}

              {results.length > 0 && (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {results.map((p) => (
                    <button
                      key={p.user_account_id}
                      onClick={() => handleAdd(p)}
                      className="flex items-center gap-2 w-full rounded-md px-2 py-2 text-left hover:bg-muted transition-colors"
                    >
                      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        {p.email && <p className="text-xs text-muted-foreground truncate">{p.email}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {searchQuery.length >= 2 && !searching && results.length === 0 && (
                <p className="text-xs text-muted-foreground py-1">Ingen treff</p>
              )}
            </div>
          )}
        </>
      )}

      {members.length === 0 && (
        <div className="text-center py-8 space-y-2">
          <Users className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Ingen medlemmer lagt til ennå.</p>
        </div>
      )}

      {internals.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Interne ({internals.length})
          </h4>
          {internals.map((m) => (
            <MemberRow key={m.id} member={m} isAdmin={isAdmin} onRemove={handleRemove} onRoleChange={handleRoleChange} />
          ))}
        </div>
      )}

      {externals.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Eksterne ({externals.length})
          </h4>
          {externals.map((m) => (
            <MemberRow key={m.id} member={m} isAdmin={isAdmin} onRemove={handleRemove} onRoleChange={handleRoleChange} />
          ))}
        </div>
      )}
    </div>
  );
}

function MemberRow({
  member,
  isAdmin,
  onRemove,
  onRoleChange,
}: {
  member: ProjectMember;
  isAdmin: boolean;
  onRemove: (m: ProjectMember) => void;
  onRoleChange: (m: ProjectMember, role: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/40 bg-card px-3 py-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground shrink-0">
        {ROLE_ICONS[member.role] || <Users className="h-3.5 w-3.5" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {member.person_name || "Ukjent bruker"}
        </p>
        <p className="text-xs text-muted-foreground truncate">{member.email || ""}</p>
      </div>

      {isAdmin && member.role !== "owner" ? (
        <Select
          value={member.role}
          onValueChange={(v) => onRoleChange(member, v)}
        >
          <SelectTrigger className="w-[120px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manager">Prosjektleder</SelectItem>
            <SelectItem value="member">Deltaker</SelectItem>
            <SelectItem value="follower">Følger</SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <span className="text-xs text-muted-foreground">{ROLE_LABELS[member.role]}</span>
      )}

      {isAdmin && member.role !== "owner" && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
          onClick={() => onRemove(member)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

/* ── Spaces Tab ── */

function SpacesTab({
  spaces,
  isAdmin,
  onToggle,
}: {
  spaces: { space_id: string; space_key: string; is_enabled: boolean }[];
  isAdmin: boolean;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
}) {
  const handleToggle = async (spaceId: string, enabled: boolean) => {
    try {
      await onToggle(spaceId, enabled);
      toast.success(enabled ? "Rom aktivert" : "Rom deaktivert");
    } catch (err: any) {
      toast.error("Kunne ikke oppdatere", { description: err.message });
    }
  };

  if (spaces.length === 0) {
    return (
      <div className="text-center py-8 space-y-2">
        <p className="text-sm text-muted-foreground">Ingen rom konfigurert.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground mb-2">
        Aktiver eller deaktiver rom. Deaktiverte rom er skjult for alle brukere.
      </p>
      {spaces.map((s) => (
        <div
          key={s.space_id}
          className="flex items-center justify-between rounded-lg border border-border/40 bg-card px-4 py-3"
        >
          <span className="text-sm font-medium text-foreground">
            {SPACE_LABELS[s.space_key] || s.space_key}
          </span>
          {isAdmin ? (
            <Switch
              checked={s.is_enabled}
              onCheckedChange={(v) => handleToggle(s.space_id, v)}
            />
          ) : (
            <span className={cn("text-xs", s.is_enabled ? "text-[hsl(var(--success))]" : "text-muted-foreground")}>
              {s.is_enabled ? "Aktiv" : "Deaktivert"}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
