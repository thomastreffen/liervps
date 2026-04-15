import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Home,
  FolderKanban,
  Users,
  TrendingUp,
  Inbox,
  CalendarDays,
  ChevronDown,
  Settings,
  LayoutGrid,
  Receipt,
  Gauge,
  BarChart3,
  FileText,
  Target,
  BookOpen,
  CalendarOff,
  ClipboardList,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { usePreviewMode } from "@/hooks/usePreviewMode";
import { usePermissions } from "@/hooks/usePermissions";
import { useModuleVisibility } from "@/hooks/useModuleVisibility";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/**
 * TWO-LAYER MODULE ACCESS:
 *   1. module_settings (global toggle) – is the module enabled for the tenant?
 *   2. module.* permission (user/role) – does this user have access to the module?
 *
 * Both must be true for the module to show in the sidebar.
 */

const mainNav = [
  { title: "Hjem", url: "/overview", icon: Home, moduleKey: "overview", modulePermission: "module.overview" },
  { title: "Prosjekter", url: "/projects", icon: FolderKanban, moduleKey: "projects", modulePermission: "module.projects", requiredPermission: "jobs.view" },
  { title: "Ressursplan", url: "/projects/plan", icon: CalendarDays, moduleKey: "resource_plan", modulePermission: "module.resource_plan", requiredPermission: "resourceplan.view" },
  { title: "Fravær", url: "/absence", icon: CalendarOff, moduleKey: "absence", modulePermission: "module.absence" },
  { title: "Fakturagrunnlag", url: "/invoice-basis", icon: Receipt, moduleKey: "invoice_basis", modulePermission: "module.invoice_basis", requiredPermission: "jobs.view_pricing" },
  { title: "Bestillinger", url: "/orders", icon: ClipboardList, moduleKey: "orders", modulePermission: "module.orders" },
  { title: "Fagstøtte", url: "/fag", icon: BookOpen, moduleKey: "fag", modulePermission: "module.fag", requiredPermission: "regulation.review" },
];

const adminItems = [
  { title: "Firma", url: "/admin/company", requireSuperAdmin: true, moduleKey: "admin_company" },
  { title: "Organisasjon", url: "/admin/organisasjon", requireSuperAdmin: true, moduleKey: "admin_org" },
  { title: "Personer", url: "/admin/personer", moduleKey: "admin_people" },
  { title: "Roller", url: "/admin/roller", requireSuperAdmin: true, moduleKey: "admin_roles" },
  { title: "Postkontoret", url: "/admin/superoffice", requirePostkontorAdmin: true, moduleKey: "admin_postkontor" },
  { title: "Skjema & maler", url: "/admin/forms", moduleKey: "admin_forms" },
  { title: "Bestillingsmaler", url: "/admin/order-forms", moduleKey: "admin_order_forms" },
  { title: "Integrasjoner", url: "/settings/integrations", moduleKey: "admin_integrations" },
  { title: "Integrasjonshelse", url: "/admin/integration-health", moduleKey: "admin_integration_health" },
  { title: "Systemhelse", url: "/admin/system-health", moduleKey: "admin_system_health" },
  { title: "Dataintegritet", url: "/admin/data-integrity", moduleKey: "admin_data_integrity" },
  { title: "Kontraktvarsler", url: "/admin/contract-cron", moduleKey: "admin_contract_cron" },
  { title: "Microsoft", url: "/admin/microsoft", requireSuperAdmin: true, moduleKey: "admin_microsoft" },
  { title: "Innstillinger", url: "/admin/settings", moduleKey: "admin_settings" },
  { title: "Papirkurv", url: "/admin/trash", moduleKey: "admin_trash" },
  { title: "Tripletex import", url: "/admin/tripletex", moduleKey: "admin_tripletex" },
  
  { title: "Selskapsmigrering", url: "/admin/company-migration", requireSuperAdmin: true, moduleKey: "admin_company_migration" },
];

function NavItem({ item, isActive, collapsed, badge }: {
  item: { title: string; url: string; icon?: React.ElementType };
  isActive: (url: string) => boolean;
  collapsed: boolean;
  badge?: number;
}) {
  const active = isActive(item.url);
  const Icon = item.icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={item.title}
        className={cn(
          "rounded-xl h-10 transition-all duration-150",
          active
            ? "bg-primary/10 text-primary font-semibold shadow-sm"
            : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        )}
      >
        <NavLink to={item.url} end={item.url === "/overview"}>
          {Icon && <Icon className="h-[19px] w-[19px]" />}
          {!Icon && <div className="h-[19px] w-[19px]" />}
          <span className="text-[13px] flex-1">{item.title}</span>
          {!collapsed && badge !== undefined && badge > 0 && (
            <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 h-4 ml-auto bg-primary/10 text-primary border-0">
              {badge}
            </Badge>
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { isAdmin: realIsAdmin, isSuperAdmin: realIsSuperAdmin, user } = useAuth();
  const { hasPermission } = usePermissions();
  const { isModuleVisible } = useModuleVisibility();
  const { active: previewActive, effectiveRole } = usePreviewMode();
  const location = useLocation();

  // In preview mode, derive isAdmin/isSuperAdmin from effective role
  const isAdmin = previewActive
    ? (effectiveRole === "admin" || effectiveRole === "super_admin")
    : realIsAdmin;
  const isSuperAdmin = previewActive
    ? effectiveRole === "super_admin"
    : realIsSuperAdmin;

  const [projectCount, setProjectCount] = useState<number>(0);
  const [inboxCount, setInboxCount] = useState<number>(0);
  const [offerCount, setOfferCount] = useState<number>(0);

  useEffect(() => {
    if (!user) return;
    supabase.from("events")
      .select("id", { count: "exact", head: true })
      .in("status", ["requested", "approved", "scheduled", "in_progress", "time_change_proposed"])
      .is("deleted_at", null)
      .then(({ count }) => setProjectCount(count || 0));

    supabase.from("cases")
      .select("id", { count: "exact", head: true })
      .in("status", ["new", "triage"])
      .then(({ count }) => setInboxCount(count || 0));

    supabase.from("calculations")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .in("status", ["draft", "generated", "sent"] as any)
      .then(({ count }) => setOfferCount(count || 0));
  }, [user]);

  const isActive = (url: string) =>
    url === "/overview" ? location.pathname === "/overview" : location.pathname.startsWith(url);

  /**
   * Two-layer check:
   *   1. isModuleVisible(moduleKey) – global tenant toggle (module_settings)
   *   2. hasPermission(modulePermission) – user/role level (module.* permission)
   */
  const canAccessModule = (moduleKey: string, modulePermission?: string) => {
    // Layer 1: global toggle
    if (!isModuleVisible(moduleKey)) return false;
    // Layer 2: user permission (if defined). Admins bypass this check.
    if (modulePermission && !isAdmin && !hasPermission(modulePermission)) return false;
    return true;
  };

  const hasPostkontor = hasPermission("postkontor.view") || isAdmin;
  const hasPostkontorAdmin = hasPermission("postkontor.admin") || isAdmin;

  const visibleMainNav = mainNav.filter((item) => {
    if (!canAccessModule(item.moduleKey, item.modulePermission)) return false;
    // Additional action-level permission check
    if (item.requiredPermission && !isAdmin && !hasPermission(item.requiredPermission)) return false;
    return true;
  });

  const filteredAdmin = adminItems.filter((item) => {
    if (!isModuleVisible(item.moduleKey)) return false;
    if ('requireSuperAdmin' in item && item.requireSuperAdmin) return isSuperAdmin;
    if ('requirePostkontorAdmin' in item && (item as any).requirePostkontorAdmin) return hasPostkontorAdmin;
    return true;
  });

  const adminActive = filteredAdmin.some((item) => isActive(item.url));

  const getBadge = (url: string): number | undefined => {
    if (url === "/projects") return projectCount > 0 ? projectCount : undefined;
    return undefined;
  };

  // Show admin section only for super_admin users
  const showAdmin = isSuperAdmin;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4 pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
            M
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-sm font-semibold leading-tight text-sidebar-foreground tracking-tight">MCS Service</h1>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {visibleMainNav.map((item) => (
                <NavItem key={item.url} item={item} isActive={isActive} collapsed={collapsed} badge={getBadge(item.url)} />
              ))}
              {hasPostkontor && canAccessModule("inbox", "module.inbox") && (
                <NavItem
                  item={{ title: "Postkontoret", url: "/inbox", icon: Inbox }}
                  isActive={isActive}
                  collapsed={collapsed}
                  badge={inboxCount > 0 ? inboxCount : undefined}
                />
              )}
               {canAccessModule("sales", "module.sales") && (
                 <>
                   <SidebarMenuItem>
                     <Collapsible defaultOpen={isActive("/sales")}>
                       <CollapsibleTrigger asChild>
                         <SidebarMenuButton
                           tooltip="Salg"
                           className={cn(
                             "rounded-xl h-10 transition-all duration-150",
                             isActive("/sales")
                               ? "bg-primary/10 text-primary font-semibold shadow-sm"
                               : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                           )}
                         >
                           <TrendingUp className="h-[19px] w-[19px]" />
                           <span className="text-[13px] flex-1">Salg</span>
                           {!collapsed && <ChevronDown className="h-3 w-3 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />}
                         </SidebarMenuButton>
                       </CollapsibleTrigger>
                       <CollapsibleContent>
                         <SidebarMenu className="ml-5 mt-1 space-y-0.5 border-l border-sidebar-border/40 pl-2">
                           <NavItem item={{ title: "Oversikt", url: "/sales", icon: BarChart3 }} isActive={(url) => location.pathname === "/sales"} collapsed={collapsed} />
                           <NavItem item={{ title: "Leads", url: "/sales/leads", icon: Target }} isActive={isActive} collapsed={collapsed} />
                           <NavItem item={{ title: "Tilbud", url: "/sales/offers", icon: FileText }} isActive={isActive} collapsed={collapsed} badge={offerCount > 0 ? offerCount : undefined} />
                         </SidebarMenu>
                       </CollapsibleContent>
                     </Collapsible>
                   </SidebarMenuItem>
                 </>
               )}
               {canAccessModule("management" /* no moduleKey in module_settings yet */, "module.management") && (
                 <NavItem item={{ title: "Lederoversikt", url: "/management", icon: Gauge }} isActive={isActive} collapsed={collapsed} />
               )}
               {canAccessModule("customers", "module.customers") && (hasPermission("jobs.view") || isAdmin) && (
                <NavItem item={{ title: "Kunder", url: "/customers", icon: Users }} isActive={isActive} collapsed={collapsed} />
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showAdmin && (
          <SidebarGroup className="mt-6 pt-4 border-t border-sidebar-border/60">
            <Collapsible defaultOpen={adminActive}>
              <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/40 hover:text-sidebar-foreground/60 transition-colors">
                <span className="flex items-center gap-1.5">
                  <Settings className="h-3 w-3" />
                  Admin
                </span>
                {!collapsed && <ChevronDown className="h-3 w-3 transition-transform duration-200 group-data-[state=open]:rotate-180" />}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu className="space-y-1 mt-2">
                    {filteredAdmin.map((item) => (
                      <NavItem key={item.url} item={item} isActive={isActive} collapsed={collapsed} />
                    ))}
                    {isSuperAdmin && (
                      <NavItem
                        item={{ title: "Moduler", url: "/admin/modules", icon: LayoutGrid }}
                        isActive={isActive}
                        collapsed={collapsed}
                      />
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
