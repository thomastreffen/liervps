import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { PUBLIC_SITE_LIVE } from "@/lib/feature-flags";
import { useAuth } from "@/hooks/useAuth";

/**
 * Port for den offentlige nettsiden.
 *
 * Innloggede brukere skal ALLTID se den offentlige forsiden – de skal aldri
 * automatisk sendes til /overview fra rot-pathen.
 *
 * Når PUBLIC_SITE_LIVE er false (pre-launch): kun innloggede ansatte ser
 * nettsiden, besøkende sendes til påloggingssiden.
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
    return <Outlet />;
  }

  return <Navigate to="/login" replace />;
}
