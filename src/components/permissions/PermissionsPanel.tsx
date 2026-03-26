import { useState, useMemo, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Search, Shield, RotateCcw, Copy, Info, Loader2, X, AlertTriangle, Eye, Building, ChevronDown,
} from "lucide-react";
import { PERMISSION_CATEGORIES, SCOPE_OPTIONS, getPermLabel, getPermDescription } from "@/lib/permission-labels";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface EffectivePerm {
  key: string;
  allowed: boolean;
  source: "role" | "override" | "none";
  roleName?: string;
  overrideMode?: "allow" | "deny";
}

export interface RoleOption {
  id: string;
  name: string;
  description?: string | null;
}

export interface ScopeEntry {
  company_id: string;
  department_id: string | null;
}

export interface CompanyOption {
  id: string;
  name: string;
  departments: { id: string; name: string }[];
}

interface Props {
  userAccountId: string;
  roles: RoleOption[];
  assignedRoles: string[];
  onAssignedRolesChange: (roles: string[]) => void;
  rolePermissions: Record<string, boolean>;
  rolePermSourceMap: Record<string, string>;
  overrides: Record<string, "allow" | "deny">;
  onOverridesChange: (overrides: Record<string, "allow" | "deny">) => void;
  scopeOverride: string;
  onScopeOverrideChange: (v: string) => void;
  scopes: ScopeEntry[];
  onScopesChange: (s: ScopeEntry[]) => void;
  companies: CompanyOption[];
  allPeople?: { id: string; name: string }[];
  onCopyFrom?: (personId: string) => void;
  saving: boolean;
  onSave: () => void;
  showOnlyOverrides?: boolean;
  overrideCompanyId?: string | null;
  onOverrideCompanyChange?: (companyId: string) => void;
}

export function PermissionsPanel({
  roles,
  assignedRoles,
  onAssignedRolesChange,
  rolePermissions,
  rolePermSourceMap,
  overrides,
  onOverridesChange,
  scopeOverride,
  onScopeOverrideChange,
  scopes,
  onScopesChange,
  companies,
  allPeople,
  onCopyFrom,
  saving,
  onSave,
  overrideCompanyId,
  onOverrideCompanyChange,
}: Props) {
  const [search, setSearch] = useState("");
  const [onlyOverrides, setOnlyOverrides] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);

  const getEffective = useCallback(
    (key: string): EffectivePerm => {
      const ov = overrides[key];
      if (ov === "allow") return { key, allowed: true, source: "override", overrideMode: "allow" };
      if (ov === "deny") return { key, allowed: false, source: "override", overrideMode: "deny" };
      if (rolePermissions[key]) {
        return { key, allowed: true, source: "role", roleName: rolePermSourceMap[key] || "Rolle" };
      }
      return { key, allowed: false, source: "none" };
    },
    [overrides, rolePermissions, rolePermSourceMap]
  );

  const handleCheckboxClick = useCallback(
    (key: string) => {
      const eff = getEffective(key);
      const newOverrides = { ...overrides };
      if (eff.source === "override") {
        if (eff.overrideMode === "allow") {
          delete newOverrides[key];
        } else {
          delete newOverrides[key];
        }
      } else if (eff.source === "role") {
        newOverrides[key] = "deny";
      } else {
        newOverrides[key] = "allow";
      }
      onOverridesChange(newOverrides);
    },
    [getEffective, overrides, rolePermissions, onOverridesChange]
  );

  const handleResetOverride = useCallback(
    (key: string) => {
      const newOverrides = { ...overrides };
      delete newOverrides[key];
      onOverridesChange(newOverrides);
    },
    [overrides, onOverridesChange]
  );

  const handleResetAll = useCallback(() => {
    onOverridesChange({});
    onScopeOverrideChange("inherit");
  }, [onOverridesChange, onScopeOverrideChange]);

  const toggleRole = useCallback(
    (roleId: string) => {
      onAssignedRolesChange(
        assignedRoles.includes(roleId)
          ? assignedRoles.filter((r) => r !== roleId)
          : [...assignedRoles, roleId]
      );
    },
    [assignedRoles, onAssignedRolesChange]
  );

  const toggleScope = useCallback(
    (companyId: string, deptId: string | null) => {
      const exists = scopes.some(
        (s) => s.company_id === companyId && s.department_id === deptId
      );
      onScopesChange(
        exists
          ? scopes.filter(
              (s) => !(s.company_id === companyId && s.department_id === deptId)
            )
          : [...scopes, { company_id: companyId, department_id: deptId }]
      );
    },
    [scopes, onScopesChange]
  );

  const filteredCategories = useMemo(() => {
    const q = search.toLowerCase();
    return PERMISSION_CATEGORIES.map((cat) => ({
      ...cat,
      keys: cat.keys.filter((key) => {
        if (onlyOverrides && !overrides[key]) return false;
        if (!q) return true;
        return (
          getPermLabel(key).toLowerCase().includes(q) ||
          key.toLowerCase().includes(q) ||
          cat.category.toLowerCase().includes(q)
        );
      }),
    })).filter((cat) => cat.keys.length > 0);
  }, [search, onlyOverrides, overrides]);

  const overrideCount = Object.keys(overrides).length + (scopeOverride !== "inherit" ? 1 : 0);

  const scopeDisplay = useMemo(() => {
    if (scopes.length === 0) return "Ingen tilgang konfigurert";
    return scopes
      .map((s) => {
        const comp = companies.find((c) => c.id === s.company_id);
        if (!comp) return "Ukjent";
        if (!s.department_id) return comp.name;
        const dept = comp.departments.find((d) => d.id === s.department_id);
        return `${comp.name} → ${dept?.name || "Ukjent avd."}`;
      })
      .join(", ");
  }, [scopes, companies]);

  // Summary data
  const roleNames = assignedRoles
    .map((rid) => roles.find((r) => r.id === rid)?.name)
    .filter(Boolean)
    .join(", ") || "Ingen roller";

  const accessType = overrideCount > 0 ? "Arvet fra rolle + overstyringer" : "Arvet fra rolle";

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* ─── Summary card ─────────────────────────────────── */}
        <div className="rounded-lg border bg-muted/30 p-4 sm:p-5 space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Eye className="h-4 w-4 text-muted-foreground" />
            Tilgangsoppsummering
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            <div className="flex gap-2">
              <span className="text-muted-foreground">Rolle(r):</span>
              <span className="font-medium">{roleNames}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground">Omfang:</span>
              <span className="font-medium">{scopeDisplay}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground">Tilgangstype:</span>
              <span className="font-medium">{accessType}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground">Overstyringer:</span>
              <span className="font-medium">
                {overrideCount > 0 ? `${overrideCount} manuell${overrideCount > 1 ? "e" : ""} avvik` : "Ingen"}
              </span>
            </div>
          </div>
        </div>

        {/* ─── Mode toggle ────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              <strong>Rolle</strong> gir standardrettigheter. <strong>Omfang</strong> bestemmer hva brukeren ser. <strong>Rettigheter</strong> er detaljert tilgangskontroll.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Label htmlFor="advanced-mode" className="text-xs cursor-pointer text-muted-foreground">Avansert</Label>
            <Switch
              id="advanced-mode"
              checked={advancedMode}
              onCheckedChange={setAdvancedMode}
            />
          </div>
        </div>

        {/* ─── Section A: Roller ──────────────────────────────── */}
        <section className="rounded-lg border p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Roller</h3>
          </div>
          <p className="text-[11px] text-muted-foreground -mt-2">
            Roller gir standardrettigheter. Velg én eller flere.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {roles.map((r) => (
              <label
                key={r.id}
                className="flex items-start gap-2.5 cursor-pointer rounded-md border p-3 hover:bg-accent/40 transition-colors"
              >
                <Checkbox
                  checked={assignedRoles.includes(r.id)}
                  onCheckedChange={() => toggleRole(r.id)}
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <span className="text-sm font-medium">{r.name}</span>
                  {r.description && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                      {r.description}
                    </p>
                  )}
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* ─── Section: Omfang ───────────────────────── */}
        <section className="rounded-lg border p-4 sm:p-5 space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Omfang</h3>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Bestemmer hvilke selskaper og avdelinger brukeren kan se data i.
            </p>
            <p className="text-xs mt-1 text-muted-foreground">
              Gjelder: <span className="text-foreground font-medium">{scopeDisplay}</span>
            </p>
          </div>

          {advancedMode && (
            <div className="flex items-center gap-3 flex-wrap">
              <Label className="text-xs shrink-0">Synlighetsomfang:</Label>
              <Select value={scopeOverride} onValueChange={onScopeOverrideChange}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inherit">Arv fra rolle</SelectItem>
                  {SCOPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.key} value={opt.key}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-3">
            {companies.map((c) => (
              <div key={c.id}>
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                  <Checkbox
                    checked={scopes.some(
                      (s) => s.company_id === c.id && s.department_id === null
                    )}
                    onCheckedChange={() => toggleScope(c.id, null)}
                  />
                  {c.name}{" "}
                  <span className="text-xs text-muted-foreground font-normal">
                    (hele selskapet)
                  </span>
                </label>
                {c.departments.map((d) => (
                  <label
                    key={d.id}
                    className="flex items-center gap-2 cursor-pointer text-sm ml-6 mt-1"
                  >
                    <Checkbox
                      checked={scopes.some(
                        (s) => s.company_id === c.id && s.department_id === d.id
                      )}
                      onCheckedChange={() => toggleScope(c.id, d.id)}
                    />
                    {d.name}
                  </label>
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* ─── Section B: Rettigheter (advanced only) ─────────── */}
        {advancedMode && (
          <section className="rounded-lg border p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-semibold">Rettigheter</h3>
              <div className="flex items-center gap-2 flex-wrap">
                {overrideCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs gap-1 text-destructive hover:text-destructive"
                    onClick={handleResetAll}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Tilbakestill alle ({overrideCount})
                  </Button>
                )}
                {allPeople && onCopyFrom && (
                  <CopyFromSelector people={allPeople} onSelect={onCopyFrom} />
                )}
              </div>
            </div>

            {/* Override hint */}
            {overrideCount >= 5 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-3 flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Denne brukeren har mange manuelle avvik ({overrideCount}). Vurder å lage eller bruke en mer passende rolle for å forenkle tilgangsstyringen.
                </p>
              </div>
            )}

            {/* Search + filter */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Søk i rettigheter…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="only-overrides"
                  checked={onlyOverrides}
                  onCheckedChange={setOnlyOverrides}
                />
                <Label htmlFor="only-overrides" className="text-xs cursor-pointer">
                  Vis bare avvik fra rolle
                </Label>
              </div>
            </div>

            {/* Module accordions */}
            <Accordion type="multiple" defaultValue={PERMISSION_CATEGORIES.map((c) => c.category)}>
              {filteredCategories.map((cat) => (
                <AccordionItem key={cat.category} value={cat.category}>
                  <AccordionTrigger className="py-2.5 text-sm hover:no-underline">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{cat.category}</span>
                      <span className="text-[10px] text-muted-foreground font-normal">
                        {cat.description}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-1">
                    <div className="space-y-0.5">
                      {cat.keys.map((key) => {
                        const eff = getEffective(key);
                        const desc = getPermDescription(key);
                        return (
                          <PermissionRow
                            key={key}
                            permKey={key}
                            effective={eff}
                            description={desc}
                            onToggle={() => handleCheckboxClick(key)}
                            onReset={
                              eff.source === "override"
                                ? () => handleResetOverride(key)
                                : undefined
                            }
                          />
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            {filteredCategories.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Ingen rettigheter matcher søket.
              </p>
            )}
          </section>
        )}

        {/* Non-advanced: show read-only effective summary */}
        {!advancedMode && overrideCount > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Denne brukeren har {overrideCount} manuell{overrideCount > 1 ? "e" : ""} overstyring{overrideCount > 1 ? "er" : ""}. Slå på «Avansert» for å se og endre dem.
              </p>
            </div>
          </div>
        )}

        {/* ─── Sticky save bar ────────────────────────────────── */}
        <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t py-3 -mx-4 px-4 sm:-mx-5 sm:px-5 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {overrideCount > 0
              ? `${overrideCount} overstyring${overrideCount > 1 ? "er" : ""} aktiv`
              : "Ingen overstyringer"}
          </p>
          <Button onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
            Lagre
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}

/* ------------------------------------------------------------------ */
/*  PermissionRow                                                      */
/* ------------------------------------------------------------------ */

function PermissionRow({
  permKey,
  effective,
  description,
  onToggle,
  onReset,
}: {
  permKey: string;
  effective: EffectivePerm;
  description?: string;
  onToggle: () => void;
  onReset?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5 px-1 rounded hover:bg-accent/30 transition-colors group">
      <Checkbox
        checked={effective.allowed}
        onCheckedChange={onToggle}
        className="shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{getPermLabel(permKey)}</span>
          {description && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[260px] text-xs">
                {description}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {effective.source === "override" ? (
          <Badge
            variant="outline"
            className={`text-[10px] ${
              effective.overrideMode === "allow"
                ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
                : "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800"
            }`}
          >
            {effective.overrideMode === "allow" ? "✎ Manuelt gitt" : "✎ Manuelt fjernet"}
          </Badge>
        ) : effective.allowed ? (
          <Badge
            variant="outline"
            className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
          >
            Via rolle
          </Badge>
        ) : (
          <span className="text-[10px] text-muted-foreground">Ingen tilgang</span>
        )}

        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
          {effective.source === "role" && effective.roleName}
        </span>

        {onReset && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReset();
            }}
            className="text-[10px] text-primary hover:underline opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
          >
            Tilbakestill
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CopyFromSelector                                                   */
/* ------------------------------------------------------------------ */

function CopyFromSelector({
  people,
  onSelect,
}: {
  people: { id: string; name: string }[];
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => setOpen(true)}>
        <Copy className="h-3 w-3" />
        Kopier fra…
      </Button>
    );
  }

  const filtered = people.filter((p) =>
    p.name.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="flex items-center gap-1.5">
      <Input
        placeholder="Søk person…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="h-8 w-[180px] text-xs"
        autoFocus
      />
      <div className="max-h-[200px] overflow-y-auto absolute top-full right-0 mt-1 bg-popover border rounded-md shadow-md z-50 w-[220px]">
        {filtered.slice(0, 10).map((p) => (
          <button
            key={p.id}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
            onClick={() => {
              onSelect(p.id);
              setOpen(false);
              setQ("");
            }}
          >
            {p.name}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="px-3 py-2 text-xs text-muted-foreground">Ingen treff</p>
        )}
      </div>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
