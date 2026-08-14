import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { EmployeeImport } from "@/components/EmployeeImport";
import { MICROSOFT_UI_ENABLED } from "@/lib/feature-flags";

export default function EmployeeImportPage() {
  const navigate = useNavigate();

  // Microsoft 365-import er deaktivert i Lier VPS.
  if (!MICROSOFT_UI_ENABLED) return <Navigate to="/admin/personer" replace />;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/personer")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Importer fra Microsoft 365</h1>
          <p className="text-sm text-muted-foreground">
            Søk opp og importer ansatte fra Microsoft Entra ID
          </p>
        </div>
      </div>

      <EmployeeImport />
    </div>
  );
}
