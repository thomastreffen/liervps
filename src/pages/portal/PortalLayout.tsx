import { Outlet, Link, useLocation, Navigate } from "react-router-dom";
import { usePortal } from "@/hooks/usePortal";
import { usePortalNotifications } from "@/hooks/usePortalNotifications";
import { Loader2, Wrench, LayoutDashboard, FolderOpen, FileText, MessageSquare, LogOut, Users, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NotificationBell } from "@/components/portal/NotificationBell";

const navItems = [
  { path: "/portal", label: "Oversikt", icon: LayoutDashboard, end: true },
  { path: "/portal/projects", label: "Oppdrag", icon: FolderOpen },
  { path: "/portal/deliveries", label: "Rapporter", icon: FileText },
  { path: "/portal/messages", label: "Meldinger", icon: MessageSquare },
];

export default function PortalLayout() {
  const { user, loading, isCustomerAdmin, signOut } = usePortal();
  const location = useLocation();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = usePortalNotifications();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/portal/login" replace />;
  }

  const roleLabel = (r: string) => {
    switch (r) {
      case "customer_admin": return "Administrator";
      case "customer_finance": return "Økonomi";
      default: return "Kontakt";
    }
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b bg-card">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Wrench className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-card-foreground tracking-tight">
                  Kundeportal
                </h1>
                <p className="text-xs text-muted-foreground">
                  {user.accountName ? `Samarbeid med ${user.accountName}` : "Lier VPS"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Contact project leader */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
                    <a href="mailto:post@mcsservice.no">
                      <Phone className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Kontakt prosjektleder</span>
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Kontakt din prosjektleder</TooltipContent>
              </Tooltip>

              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-medium text-card-foreground">{user.fullName}</span>
                <Badge variant="secondary" className="text-[10px]">
                  {roleLabel(user.portalRole)}
                </Badge>
              </div>
              {isCustomerAdmin && (
                <Button variant="ghost" size="icon" asChild>
                  <Link to="/portal/team">
                    <Users className="h-4 w-4" />
                  </Link>
                </Button>
              )}
              <NotificationBell
                notifications={notifications}
                unreadCount={unreadCount}
                onMarkAsRead={markAsRead}
                onMarkAllAsRead={markAllAsRead}
              />
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut className="mr-1 h-4 w-4" />
                <span className="hidden sm:inline">Logg ut</span>
              </Button>
            </div>
          </div>

          {/* Nav */}
          <div className="mx-auto max-w-5xl px-4">
            <nav className="flex gap-1 -mb-px overflow-x-auto">
              {navItems.map((item) => {
                const active = item.end
                  ? location.pathname === item.path
                  : location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                      active
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>

        {/* Content */}
        <main className="mx-auto max-w-5xl px-4 py-6">
          <Outlet />
        </main>
      </div>
    </TooltipProvider>
  );
}
