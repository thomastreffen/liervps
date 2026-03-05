import { useLocation } from "react-router-dom";
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
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useModuleVisibility } from "@/hooks/useModuleVisibility";
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

const mainNav = [
  { title: "Hjem", url: "/overview", icon: Home, moduleKey: "overview" },
  { title: "Prosjekter", url: "/projects", icon: FolderKanban, moduleKey: "projects" },
  { title: "Ressursplan", url: "/projects/plan", icon: CalendarDays, moduleKey: "resource_plan" },
];

const adminItems = [
  { title: "Firma", url: "/admin/company", requireSuperAdmin: true, moduleKey: "admin_company" },
  { title: "Organisasjon", url: "/admin/organisasjon", requireSuperAdmin: true, moduleKey: "admin_org" },
  { title: "Personer", url: "/admin/personer", moduleKey: "admin_people" },
  { title: "Roller", url: "/admin/roller", requireSuperAdmin: true, moduleKey: "admin_roles" },
  { title: "Postkontoret", url: "/admin/superoffice", requirePostkontorAdmin: true, moduleKey: "admin_postkontor" },
  { title: "Skjemamaler", url: "/admin/forms", moduleKey: "admin_forms" },
  { title: "Integrasjoner", url: "/settings/integrations", moduleKey: "admin_integrations" },
  { title: "Integrasjonshelse", url: "/admin/integration-health", moduleKey: "admin_integration_health" },
  { title: "Systemhelse", url: "/admin/system-health", moduleKey: "admin_system_health" },
  { title: "Dataintegritet", url: "/admin/data-integrity", moduleKey: "admin_data_integrity" },
  { title: "Kontraktvarsler", url: "/admin/contract-cron", moduleKey: "admin_contract_cron" },
  { title: "Microsoft", url: "/admin/microsoft", requireSuperAdmin: true, moduleKey: "admin_microsoft" },
  { title: "Innstillinger", url: "/admin/settings", moduleKey: "admin_settings" },
  { title: "Papirkurv", url: "/admin/trash", moduleKey: "admin_trash" },
];

function NavItem({ item, isActive, collapsed }: {
  item: { title: string; url: string; icon?: React.ElementType };
  isActive: (url: string) => boolean;
  collapsed: boolean;
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
          "rounded-lg h-9 transition-colors",
          active
            ? "bg-primary/10 text-primary font-medium"
            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        )}
      >
        <NavLink to={item.url} end={item.url === "/overview"}>
          {Icon && <Icon className="h-[18px] w-[18px]" />}
          {!Icon && <div className="h-[18px] w-[18px]" />}
          <span className="text-[13px]">{item.title}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { isAdmin, isSuperAdmin } = useAuth();
  const { hasPermission } = usePermissions();
  const { isModuleVisible } = useModuleVisibility();
  const location = useLocation();

  const isActive = (url: string) =>
    url === "/overview" ? location.pathname === "/overview" : location.pathname.startsWith(url);

  const hasPostkontor = isAdmin || hasPermission("postkontor.view");
  const hasPostkontorAdmin = isAdmin || hasPermission("postkontor.admin");

  // Filter main nav by module visibility
  const visibleMainNav = mainNav.filter((item) => isModuleVisible(item.moduleKey));

  const filteredAdmin = adminItems.filter((item) => {
    // First check module visibility
    if (!isModuleVisible(item.moduleKey)) return false;
    // Then check role requirements
    if ('requireSuperAdmin' in item && item.requireSuperAdmin) return isSuperAdmin;
    if ('requirePostkontorAdmin' in item && (item as any).requirePostkontorAdmin) return hasPostkontorAdmin;
    return true;
  });

  const adminActive = filteredAdmin.some((item) => isActive(item.url));

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

      <SidebarContent className="px-2">
        {/* Hovedmeny */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {visibleMainNav.map((item) => (
                <NavItem key={item.url} item={item} isActive={isActive} collapsed={collapsed} />
              ))}
              {hasPostkontor && isModuleVisible("inbox") && (
                <NavItem item={{ title: "Postkontoret", url: "/inbox", icon: Inbox }} isActive={isActive} collapsed={collapsed} />
              )}
              {isAdmin && isModuleVisible("sales") && (
                <NavItem item={{ title: "Salg", url: "/sales", icon: TrendingUp }} isActive={isActive} collapsed={collapsed} />
              )}
              {isModuleVisible("customers") && (
                <NavItem item={{ title: "Kunder", url: "/customers", icon: Users }} isActive={isActive} collapsed={collapsed} />
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin – collapsible */}
        {isAdmin && (
          <SidebarGroup className="mt-4">
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
                  <SidebarMenu className="space-y-0.5 mt-1">
                    {filteredAdmin.map((item) => (
                      <NavItem key={item.url} item={item} isActive={isActive} collapsed={collapsed} />
                    ))}
                    {/* Module management - superadmin only */}
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
