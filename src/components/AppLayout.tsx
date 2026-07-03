import { useState } from "react";
import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileTabBar } from "@/components/MobileTabBar";
import { NotificationDrawer } from "@/components/NotificationDrawer";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePreviewMode } from "@/hooks/usePreviewMode";
import { Button } from "@/components/ui/button";
import { Bell, LogOut, Eye } from "lucide-react";
import { CompanySelector } from "@/components/CompanySelector";
import { PreviewModeDialog } from "@/components/admin/PreviewModeDialog";
import { PreviewModeBanner } from "@/components/admin/PreviewModeBanner";

export function AppLayout() {
  const isMobile = useIsMobile();
  const { user, signOut, isSuperAdmin } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const { active: previewActive, realIsSuperAdmin } = usePreviewMode();

  // Show preview trigger only for real superadmins (not in preview mode context)
  const showPreviewButton = realIsSuperAdmin || (isSuperAdmin && !previewActive);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        {!isMobile && <AppSidebar />}

        <div className="flex flex-1 flex-col min-w-0">
          {/* Preview mode banner */}
          <PreviewModeBanner />

          {/* Minimal top bar */}
          <header className="flex items-center justify-between border-b border-border/40 bg-background px-4 py-2.5 sticky top-0 z-30">
            <div className="flex items-center gap-2">
              {!isMobile && <SidebarTrigger />}
              <CompanySelector />
            </div>

            <div className="flex items-center gap-1.5">
              {/* Preview mode button - superadmin only */}
              {showPreviewButton && !isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreviewDialogOpen(true)}
                  className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span className="hidden lg:inline">Vis system som</span>
                </Button>
              )}

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

      <PreviewModeDialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen} />
    </SidebarProvider>
  );
}