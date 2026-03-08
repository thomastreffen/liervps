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
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
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

const mainNav = [
  { title: "Hjem", url: "/overview", icon: Home, moduleKey: "overview" },
  { title: "Prosjekter", url: "/projects", icon: FolderKanban, moduleKey: "projects" },
  { title: "Ressursplan", url: "/projects/plan", icon: CalendarDays, moduleKey: "resource_plan" },
  { title: "Fakturagrunnlag", url: "/invoice-basis", icon: Receipt, moduleKey: "invoice_basis" },
];

const adminItems = [
  { title: "Firma", url: "/admin/company", requireSuperAdmin: true, moduleKey: "admin_company" },
  { title: "Organisasjon", url: "/admin/organisasjon", requireSuperAdmin: true, moduleKey: "admin_org" },
  { title: "Personer", url: "/admin/personer", moduleKey: "admin_people" },
  { title: "Roller", url: "/admin/roller", requireSuperAdmin: true, moduleKey: "admin_roles" },
  { title: "Postkontoret", url: "/admin/superoffice", requirePostkontorAdmin: true, moduleKey: "admin_postkontor" },
  { title: "Skjema & maler", url: "/admin/forms", moduleKey: "admin_forms" },
  { title: "Integrasjoner", url: "/settings/integrations", moduleKey: "admin_integrations" },
  { title: "Integrasjonshelse", url: "/admin/integration-health", moduleKey: "admin_integration_health" },
  { title: "Systemhelse", url: "/admin/system-health", moduleKey: "admin_system_health" },
  { title: "Dataintegritet", url: "/admin/data-integrity", moduleKey: "admin_data_integrity" },
  { title: "Kontraktvarsler", url: "/admin/contract-cron", moduleKey: "admin_contract_cron" },
  { title: "Microsoft", url: "/admin/microsoft", requireSuperAdmin: true, moduleKey: "admin_microsoft" },
  { title: "Innstillinger", url: "/admin/settings", moduleKey: "admin_settings" },
  { title: "Papirkurv", url: "/admin/trash", moduleKey: "admin_trash" },
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
  const { isAdmin, isSuperAdmin, user } = useAuth();
  const { hasPermission } = usePermissions();
  const { isModuleVisible } = useModuleVisibility();
  const location = useLocation();

  const [projectCount, setProjectCount] = useState<number>(0);
  const [inboxCount, setInboxCount] = useState<number>(0);

  useEffect(() => {
    if (!user) return;
    // Fetch active project count
    supabase.from("events")
      .select("id", { count: "exact", head: true })
      .in("status", ["requested", "approved", "scheduled", "in_progress", "time_change_proposed"])
      .is("deleted_at", null)
      .then(({ count }) => setProjectCount(count || 0));

    // Fetch unread inbox count
    supabase.from("cases")
      .select("id", { count: "exact", head: true })
      .in("status", ["new", "triage"])
      .then(({ count }) => setInboxCount(count || 0));
  }, [user]);

  const isActive = (url: string) =>
    url === "/overview" ? location.pathname === "/overview" : location.pathname.startsWith(url);

  const hasPostkontor = isAdmin || hasPermission("postkontor.view");
  const hasPostkontorAdmin = isAdmin || hasPermission("postkontor.admin");

  const visibleMainNav = mainNav.filter((item) => isModuleVisible(item.moduleKey));

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
              {hasPostkontor && isModuleVisible("inbox") && (
                <NavItem
                  item={{ title: "Postkontoret", url: "/inbox", icon: Inbox }}
                  isActive={isActive}
                  collapsed={collapsed}
                  badge={inboxCount > 0 ? inboxCount : undefined}
                />
              )}
               {isAdmin && isModuleVisible("sales") && (
                 <NavItem item={{ title: "Salg", url: "/sales", icon: TrendingUp }} isActive={isActive} collapsed={collapsed} />
               )}
               {isAdmin && (
                 <NavItem item={{ title: "Lederoversikt", url: "/management", icon: Gauge }} isActive={isActive} collapsed={collapsed} />
               )}
               {isModuleVisible("customers") && (
                <NavItem item={{ title: "Kunder", url: "/customers", icon: Users }} isActive={isActive} collapsed={collapsed} />
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
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
