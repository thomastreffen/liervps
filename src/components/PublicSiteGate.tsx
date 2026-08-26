import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { PUBLIC_SITE_LIVE } from "@/lib/feature-flags";
import { useAuth } from "@/hooks/useAuth";

/**
 * Pre-launch port for den offentlige nettsiden.
 *
 * Når PUBLIC_SITE_LIVE er false:
 *  - Ikke innlogget → viser påloggingssiden
 *  - Innlogget → sendes rett til dashboardet (/overview)
 *
 * Når PUBLIC_SITE_LIVE er true: nettsiden vises som bygget.
 */
export function PublicSiteGate() {
  const { session, loading } = useAuth();

  if (PUBLIC_SITE_LIVE) {
    return <Outlet />;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (session) {
    return <Navigate to="/overview" replace />;
  }

  return <Navigate to="/login" replace />;
}
