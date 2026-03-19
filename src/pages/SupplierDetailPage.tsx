import { useParams, useNavigate } from "react-router-dom";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useSupplierIntegration } from "@/hooks/useSupplierIntegration";
import { useProductImportJobs } from "@/hooks/useProductImportJobs";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Loader2, Package, Settings2, History, ShieldAlert,
} from "lucide-react";
import { SupplierIntegrationForm } from "@/components/suppliers/SupplierIntegrationForm";
import { ImportJobHistory } from "@/components/suppliers/ImportJobHistory";
import { SupplierStatusBanner } from "@/components/suppliers/SupplierStatusBanner";

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { hasPermission } = usePermissions();
  const canManageIntegrations = isAdmin || hasPermission("purchasing.manage_integrations");
  const { suppliers, loading: suppLoading } = useSuppliers();
  const supplier = suppliers.find((s) => s.id === id);
  const { integration, loading: intLoading, upsertIntegration } = useSupplierIntegration(id);
  const { jobs, loading: jobsLoading } = useProductImportJobs(id);

  if (suppLoading || intLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Leverandør ikke funnet</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate("/admin/suppliers")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Tilbake
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/suppliers")} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground tracking-tight truncate">{supplier.name}</h1>
            <Badge variant="outline" className="font-mono text-xs shrink-0">{supplier.code}</Badge>
            {supplier.is_active ? (
              <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">Aktiv</Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px]">Inaktiv</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Integrasjonstype: {supplier.integration_type.toUpperCase()}
          </p>
        </div>
      </div>

      {/* Status banner */}
      <SupplierStatusBanner integration={integration} />

      {/* Tabs */}
      <Tabs defaultValue="integration" className="space-y-4">
        <TabsList>
          <TabsTrigger value="integration" className="gap-1.5">
            <Settings2 className="h-3.5 w-3.5" />
            Grossistintegrasjon
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-3.5 w-3.5" />
            Importlogg
            {jobs.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">{jobs.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="integration">
          {canManageIntegrations ? (
            <SupplierIntegrationForm
              supplier={supplier}
              integration={integration}
              onSave={(values) => upsertIntegration.mutateAsync(values)}
              saving={upsertIntegration.isPending}
            />
          ) : (
            <Card>
              <CardContent className="py-10 text-center">
                <ShieldAlert className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Du har ikke tilgang til å administrere grossistintegrasjoner.
                  <br />
                  Kontakt en administrator for å få rettigheten <code className="text-xs bg-muted px-1 py-0.5 rounded">purchasing.manage_integrations</code>.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history">
          <ImportJobHistory jobs={jobs} loading={jobsLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
