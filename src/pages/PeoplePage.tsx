import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Users, Archive, Search, Plus, UserPlus, CloudDownload, MoreHorizontal, Shield, Mail, Pencil } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { CreatePersonDialog } from "@/components/CreatePersonDialog";
import { useCompanyContext } from "@/hooks/useCompanyContext";

interface PersonRow {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  company_name: string | null;
  department_name: string | null;
  is_plannable_resource: boolean;
  archived_at: string | null;
  trade_certificate_type: string | null;
  role_names: string[];
  has_user_account: boolean;
  company_count: number;
}

export default function PeoplePage() {
  const navigate = useNavigate();
  const { activeCompanyId } = useCompanyContext();
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    fetchPeople();
  }, [showArchived, activeCompanyId]);

  const fetchPeople = async () => {
    setLoading(true);

    const [
      { data: peopleData },
      { data: profiles },
      { data: accounts },
      { data: userRoles },
      { data: roles },
      { data: companies },
      { data: departments },
    ] = await Promise.all([
      supabase.from("people").select("id, full_name, email, is_active, created_at").order("full_name"),
      supabase.from("employment_profiles").select("person_id, company_id, department_id, is_plannable_resource, archived_at, trade_certificate_type"),
      supabase.from("user_accounts").select("id, person_id, auth_user_id, is_active"),
      supabase.from("user_roles_v2").select("user_account_id, role_id"),
      supabase.from("roles").select("id, name"),
      supabase.from("internal_companies").select("id, name"),
      supabase.from("departments").select("id, name"),
    ]);

    const compMap = new Map((companies as any[] || []).map((c: any) => [c.id, c.name]));
    const deptMap = new Map((departments as any[] || []).map((d: any) => [d.id, d.name]));
    const roleMap = new Map((roles as any[] || []).map((r: any) => [r.id, r.name]));

    // Group profiles by person_id
    const profilesByPerson = new Map<string, any[]>();
    for (const ep of (profiles as any[] || [])) {
      const arr = profilesByPerson.get(ep.person_id) || [];
      arr.push(ep);
      profilesByPerson.set(ep.person_id, arr);
    }

    const accountMap = new Map<string, any>();
    for (const ua of (accounts as any[] || [])) {
      accountMap.set(ua.person_id, ua);
    }

    const rolesByAccount = new Map<string, string[]>();
    for (const ur of (userRoles as any[] || [])) {
      const arr = rolesByAccount.get(ur.user_account_id) || [];
      const name = roleMap.get(ur.role_id);
      if (name) arr.push(name);
      rolesByAccount.set(ur.user_account_id, arr);
    }

    const rows: PersonRow[] = (peopleData as any[] || []).map((p: any) => {
      const eps = profilesByPerson.get(p.id) || [];
      // Find the profile for active company, or fallback to first
      const ep = activeCompanyId
        ? eps.find((e: any) => e.company_id === activeCompanyId) || eps[0]
        : eps[0];
      const ua = accountMap.get(p.id);
      return {
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        is_active: p.is_active,
        company_name: ep ? compMap.get(ep.company_id) || null : null,
        department_name: ep?.department_id ? deptMap.get(ep.department_id) || null : null,
        is_plannable_resource: ep?.is_plannable_resource || false,
        archived_at: ep?.archived_at || null,
        trade_certificate_type: ep?.trade_certificate_type || null,
        role_names: ua ? (rolesByAccount.get(ua.id) || []) : [],
        has_user_account: !!ua,
        company_count: eps.length,
      };
    });

    // Filter to people who have a profile in active company (or show all if no active company)
    let filtered = rows;
    if (activeCompanyId) {
      const personIdsInCompany = new Set(
        (profiles as any[] || [])
          .filter((ep: any) => ep.company_id === activeCompanyId)
          .map((ep: any) => ep.person_id)
      );
      filtered = rows.filter((r) => personIdsInCompany.has(r.id));
    }

    filtered = showArchived ? filtered : filtered.filter((r) => !r.archived_at);
    setPeople(filtered);
    setLoading(false);
  };

  const displayed = search
    ? people.filter((p) =>
        p.full_name.toLowerCase().includes(search.toLowerCase()) ||
        p.email.toLowerCase().includes(search.toLowerCase())
      )
    : people;

  const getStatusBadge = (person: PersonRow) => {
    if (person.archived_at) return <Badge variant="destructive" className="text-[10px]">🔴 Arkivert</Badge>;
    if (!person.has_user_account) return <Badge variant="outline" className="text-[10px]">⚪ Kun ansatt</Badge>;
    if (!person.has_logged_in) return <Badge variant="outline" className="text-[10px] border-yellow-500/50 text-yellow-700">🟡 Invitert</Badge>;
    return <Badge variant="outline" className="text-[10px] border-green-500/50 text-green-700">🟢 Aktiv</Badge>;
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Personer</h1>
          <p className="text-sm text-muted-foreground">
            Samlet oversikt over ansatte og brukere
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Søk..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 w-[200px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Arkiverte</span>
            <Switch checked={showArchived} onCheckedChange={setShowArchived} />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Ny bruker
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                className="gap-2"
                onClick={() => setCreateDialogOpen(true)}
              >
                <UserPlus className="h-4 w-4" />
                Legg til manuelt
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2"
                onClick={() => navigate("/admin/personer/import")}
              >
                <CloudDownload className="h-4 w-4" />
                Importer fra Microsoft 365
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <Users className="h-10 w-10" />
          <p className="text-sm">Ingen personer funnet.</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Navn</TableHead>
                <TableHead className="hidden sm:table-cell">Rolle(r)</TableHead>
                <TableHead className="hidden md:table-cell">Firma</TableHead>
                <TableHead className="hidden lg:table-cell">Avdeling</TableHead>
                <TableHead className="text-center">Planleggbar</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayed.map((person) => (
                <TableRow
                  key={person.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/admin/personer/${person.id}`)}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{person.full_name}</p>
                      <p className="text-xs text-muted-foreground">{person.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {person.role_names.length > 0 ? (
                        person.role_names.map((r) => (
                          <Badge key={r} variant="secondary" className="text-[10px]">{r}</Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">–</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-muted-foreground">
                        {person.company_name || "–"}
                      </span>
                      {person.company_count > 1 && (
                        <Badge variant="outline" className="text-[9px]">+{person.company_count - 1}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <span className="text-sm text-muted-foreground">
                      {person.department_name || "–"}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {person.is_plannable_resource ? (
                      <Badge variant="success" className="text-[10px]">Ja</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Nei</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusBadge(person)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/admin/personer/${person.id}`); }}>
                          <Pencil className="h-3.5 w-3.5 mr-2" />
                          Rediger
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/admin/personer/${person.id}?tab=permissions`); }}>
                          <Shield className="h-3.5 w-3.5 mr-2" />
                          Tilganger
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/admin/personer/${person.id}`); }}>
                          <Archive className="h-3.5 w-3.5 mr-2" />
                          Arkiver
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <CreatePersonDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={fetchPeople}
      />
    </div>
  );
}
