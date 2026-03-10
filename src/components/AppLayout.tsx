import { useState } from "react";
import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileTabBar } from "@/components/MobileTabBar";
import { NotificationDrawer } from "@/components/NotificationDrawer";
import { MsConnectionBanner } from "@/components/MsConnectionBanner";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Bell, LogOut } from "lucide-react";
import { CompanySelector } from "@/components/CompanySelector";

export function AppLayout() {
  const isMobile = useIsMobile();
  const { user, signOut } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        {!isMobile && <AppSidebar />}

        <div className="flex flex-1 flex-col min-w-0">
          {/* Minimal top bar */}
          <header className="flex items-center justify-between border-b border-border/40 bg-background px-4 py-2.5 sticky top-0 z-30">
            <div className="flex items-center gap-2">
              {!isMobile && <SidebarTrigger />}
              {!isMobile && <CompanySelector />}
            </div>

            <div className="flex items-center gap-1.5">
              {!isMobile && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDrawerOpen(true)}
                  className="relative h-8 w-8"
                >
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Button>
              )}

              {user && (
                <span className="hidden sm:inline text-xs text-muted-foreground mr-1">
                  {user.name}
                </span>
              )}

              <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5 h-8 text-xs text-muted-foreground">
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Logg ut</span>
              </Button>
            </div>
          </header>

          <MsConnectionBanner />

          <main className={`flex-1 overflow-y-auto ${isMobile ? "pb-16" : ""}`}>
            <Outlet />
          </main>
        </div>

        {isMobile && <MobileTabBar />}
      </div>

      <NotificationDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        notifications={notifications}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
      />
    </SidebarProvider>
  );
}