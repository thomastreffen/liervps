import { useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Settings,
  Wrench,
  TrendingUp,
  Inbox,
  ChevronDown,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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

/* ─── Simplified nav structure ─── */

const homeNav = [
  { title: "Oversikt", url: "/overview", icon: LayoutDashboard },
];

const postkontoretNav = { title: "Postkontoret", url: "/inbox", icon: Inbox };

const projectNav = [
  { title: "Prosjekter", url: "/projects", icon: FolderKanban },
];

const salesNav = [
  { title: "Salg", url: "/sales", icon: TrendingUp },
];

const customerNav = [
  { title: "Kunder", url: "/customers", icon: Users },
];

const adminItems = [
  { title: "Firma", url: "/admin/company", requireSuperAdmin: true },
  { title: "Organisasjon", url: "/admin/organisasjon", requireSuperAdmin: true },
  { title: "Personer", url: "/admin/personer" },
  { title: "Roller", url: "/admin/roller", requireSuperAdmin: true },
  { title: "Postkontoret", url: "/admin/superoffice", requirePostkontorAdmin: true },
  { title: "Skjemamaler", url: "/admin/forms" },
  { title: "Integrasjoner", url: "/settings/integrations" },
  { title: "Integrasjonshelse", url: "/admin/integration-health" },
  { title: "Systemhelse", url: "/admin/system-health" },
  { title: "Dataintegritet", url: "/admin/data-integrity" },
  { title: "Kontraktvarsler", url: "/admin/contract-cron" },
  { title: "Innstillinger", url: "/admin/settings" },
  { title: "Papirkurv", url: "/admin/trash" },
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
        className={active ? "border-l-[3px] border-l-accent rounded-l-none bg-sidebar-accent/60" : ""}
      >
        <NavLink to={item.url} end={item.url === "/overview" || item.url === "/sales"}>
          {Icon && <Icon className="h-4 w-4" />}
          {!Icon && <div className="h-4 w-4" />}
          <span>{item.title}</span>
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
  const location = useLocation();

  const isActive = (url: string) =>
    url === "/overview" ? location.pathname === "/overview" : location.pathname.startsWith(url);

  const hasPostkontor = isAdmin || hasPermission("postkontor.view");
  const hasPostkontorAdmin = isAdmin || hasPermission("postkontor.admin");

  const filteredAdmin = adminItems.filter((item) => {
    if ('requireSuperAdmin' in item && item.requireSuperAdmin) return isSuperAdmin;
    if ('requirePostkontorAdmin' in item && (item as any).requirePostkontorAdmin) return hasPostkontorAdmin;
    return true;
  });

  const adminActive = filteredAdmin.some((item) => isActive(item.url));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <Wrench className="h-4.5 w-4.5 text-white" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-sm font-bold leading-tight text-white tracking-tight">MCS Service</h1>
              <p className="text-[10px] text-white/50 mt-0.5">Salg & Prosjekt</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-1">
        {/* Hjem */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {homeNav.map((item) => (
                <NavItem key={item.url} item={item} isActive={isActive} collapsed={collapsed} />
              ))}
              {hasPostkontor && (
                <NavItem item={postkontoretNav} isActive={isActive} collapsed={collapsed} />
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Prosjekter */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {projectNav.map((item) => (
                <NavItem key={item.url} item={item} isActive={isActive} collapsed={collapsed} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Salg */}
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {salesNav.map((item) => (
                  <NavItem key={item.url} item={item} isActive={isActive} collapsed={collapsed} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Kunder */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {customerNav.map((item) => (
                <NavItem key={item.url} item={item} isActive={isActive} collapsed={collapsed} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin – collapsible */}
        {isAdmin && (
          <SidebarGroup>
            <Collapsible defaultOpen={adminActive}>
              <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-1.5 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/60 hover:text-sidebar-foreground/80 transition-colors">
                <span>Administrasjon</span>
                {!collapsed && <ChevronDown className="h-3 w-3 transition-transform duration-200 group-data-[state=open]:rotate-180" />}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {filteredAdmin.map((item) => (
                      <NavItem key={item.url} item={item} isActive={isActive} collapsed={collapsed} />
                    ))}
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
