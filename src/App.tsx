import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";

// Redirect helpers for parameterized routes
function RedirectJobToProject() {
  const { id } = useParams();
  return <Navigate to={`/projects/${id}`} replace />;
}
function RedirectContractToProject() {
  const { id } = useParams();
  return <Navigate to={`/projects/contracts/${id}`} replace />;
}
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import OverviewPage from "./pages/OverviewPage";
import KpiDashboard from "./pages/KpiDashboard";
import JobsPage from "./pages/JobsPage";
import ResourcePlan from "./pages/ResourcePlan";
import JobDetail from "./pages/JobDetail";
import AdminUsers from "./pages/AdminUsers";
import OrganisationPage from "./pages/OrganisationPage";
import PeoplePage from "./pages/PeoplePage";
import PersonDetailPage from "./pages/PersonDetailPage";
import RolesPage from "./pages/RolesPage";
import AdminSettings from "./pages/AdminSettings";
import NotificationsPage from "./pages/NotificationsPage";
import CalculationsPage from "./pages/CalculationsPage";
import CalculationDetail from "./pages/CalculationDetail";
import NewCalculation from "./pages/NewCalculation";
import CalcEngineListPage from "./pages/CalcEngineListPage";
import CalcPackagePickerPage from "./pages/CalcPackagePickerPage";
import CalcEngineNewRouter from "./pages/CalcEngineNewRouter";
import CalcEngineEditorPage from "./pages/CalcEngineEditorPage";
import CalcEngineDetailPage from "./pages/CalcEngineDetailPage";
import CalcCaseDetailPage from "./pages/CalcCaseDetailPage";
import CalcAiStartPage from "./pages/CalcAiStartPage";
import CalcAiReviewPage from "./pages/CalcAiReviewPage";
import CalcOfferFromCalcPage from "./pages/CalcOfferFromCalcPage";
import SalesCasesListPage from "./pages/SalesCasesListPage";
import SalesCaseDetailPage from "./pages/SalesCaseDetailPage";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import NotFound from "./pages/NotFound";
import ApprovalPage from "./pages/ApprovalPage";
import OffersPage from "./pages/OffersPage";
import NewOfferWizard from "./pages/NewOfferWizard";
import OfferEditorPage from "./pages/OfferEditorPage";
import LeadsPage from "./pages/LeadsPage";
import NewLeadPage from "./pages/NewLeadPage";
import LeadDetail from "./pages/LeadDetail";
import PipelinePage from "./pages/PipelinePage";
import SalesDashboard from "./pages/SalesDashboard";
import OfferAcceptPage from "./pages/OfferAcceptPage";
import ApproveChangeOrderPage from "./pages/ApproveChangeOrderPage";
import CompanySettings from "./pages/CompanySettings";
import TrashPage from "./pages/TrashPage";
import AccessControlPage from "./pages/AccessControlPage";
import IntegrationsDebug from "./pages/IntegrationsDebug";
import IntegrationHealthPage from "./pages/IntegrationHealthPage";
import RegulationPage from "./pages/RegulationPage";
import FagInsightsPage from "./pages/FagInsightsPage";
import SystemHealthPage from "./pages/SystemHealthPage";
import DataIntegrityPage from "./pages/DataIntegrityPage";
import ContractsPage from "./pages/ContractsPage";
import ContractDetail from "./pages/ContractDetail";
import ContractCronPage from "./pages/ContractCronPage";
import EmployeesPage from "./pages/EmployeesPage";
import EmployeeImportPage from "./pages/EmployeeImportPage";
import PersonnelDetailPage from "./pages/PersonnelDetailPage";
import CustomersPage from "./pages/CustomersPage";
import CustomerNewPage from "./pages/CustomerNewPage";
import CustomerDetailPage from "./pages/CustomerDetailPage";
import CustomerImportPage from "./pages/CustomerImportPage";
import ProjectNewPage from "./pages/ProjectNewPage";
import ProjectSettingsPage from "./pages/ProjectSettingsPage";
import ConversationNewPage from "./pages/ConversationNewPage";
import ConversationDetailPage from "./pages/ConversationDetailPage";
import InboxPage from "./pages/InboxPage";
import FormBuilderPage from "./pages/FormBuilderPage";
import FormFillPage from "./pages/FormFillPage";
import SuperofficeSettingsPage from "./pages/SuperofficeSettingsPage";
import MicrosoftAdminPage from "./pages/MicrosoftAdminPage";
import ThreadInviteAcceptPage from "./pages/ThreadInviteAcceptPage";
import ConfirmationsPage from "./pages/ConfirmationsPage";
import AiMatcherReportPage from "./pages/AiMatcherReportPage";
import InvoiceBasisPage from "./pages/InvoiceBasisPage";
import ModuleManagementPage from "./pages/ModuleManagementPage";
import TripletexImportPage from "./pages/TripletexImportPage";
import ProjectDuplicatesPage from "./pages/ProjectDuplicatesPage";
import ManagementPage from "./pages/ManagementPage";
import AbsencePage from "./pages/AbsencePage";
import MyDayPage from "./pages/MyDayPage";
import CompanyMigrationPage from "./pages/CompanyMigrationPage";
import HelpCenterPage from "./pages/HelpCenterPage";
import OrderFormsPage from "./pages/OrderFormsPage";
import OrderFormDetailPage from "./pages/OrderFormDetailPage";
import OrderFormSubmitPage from "./pages/OrderFormSubmitPage";
import OrderFormTemplatesPage from "./pages/OrderFormTemplatesPage";
import OrderConvertPage from "./pages/OrderConvertPage";
import OrderFormBuilderPage from "./pages/OrderFormBuilderPage";
import OrderFormPublicPage from "./pages/OrderFormPublicPage";
import OrderFormsCatalogPage from "./pages/OrderFormsCatalogPage";
import OrderTrackingPage from "./pages/OrderTrackingPage";
import { CompanyProvider, useCompanyContext } from "@/hooks/useCompanyContext";
import { ActiveCompanyForPermissions } from "@/hooks/usePermissions";
import { PreviewModeProvider } from "@/hooks/usePreviewMode";
import PortalLogin from "./pages/portal/PortalLogin";
import PortalActivate from "./pages/portal/PortalActivate";
import ActivatePage from "./pages/ActivatePage";
import PortalLayout from "./pages/portal/PortalLayout";
import PortalDashboard from "./pages/portal/PortalDashboard";
import PortalProjects from "./pages/portal/PortalProjects";
import PortalProject from "./pages/portal/PortalProject";
import PortalDeliveries from "./pages/portal/PortalDeliveries";
import PortalMessages from "./pages/portal/PortalMessages";
import PortalTeam from "./pages/portal/PortalTeam";
import PortalNotificationSettings from "./pages/portal/PortalNotificationSettings";
import PortalNotificationsPage from "./pages/portal/PortalNotificationsPage";
import { PortalProvider } from "@/hooks/usePortal";

const queryClient = new QueryClient();

/** Bridge: provides activeCompanyId to the permissions system */
function PermissionCompanyBridge({ children }: { children: React.ReactNode }) {
  const { activeCompanyId } = useCompanyContext();
  return (
    <ActiveCompanyForPermissions value={activeCompanyId}>
      {children}
    </ActiveCompanyForPermissions>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CompanyProvider>
          <PermissionCompanyBridge>
          <PreviewModeProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/approval/:token" element={<ApprovalPage />} />
            <Route path="/offer/accept/:token" element={<OfferAcceptPage />} />
            <Route path="/approve-change-order" element={<ApproveChangeOrderPage />} />
            <Route path="/invite/thread/:token" element={<ThreadInviteAcceptPage />} />
            <Route path="/activate" element={<ActivatePage />} />
            <Route path="/bestilling" element={<OrderFormsCatalogPage />} />
            <Route path="/bestilling/:slug" element={<OrderFormPublicPage />} />
            <Route path="/bestilling/status/:token" element={<OrderTrackingPage />} />

            {/* Customer Portal */}
            <Route path="/portal/login" element={<PortalLogin />} />
            <Route path="/portal/activate" element={<PortalActivate />} />
            <Route element={<PortalProvider><PortalLayout /></PortalProvider>}>
              <Route path="/portal" element={<PortalDashboard />} />
              <Route path="/portal/projects" element={<PortalProjects />} />
              <Route path="/portal/projects/:id" element={<PortalProject />} />
              <Route path="/portal/deliveries" element={<PortalDeliveries />} />
              <Route path="/portal/messages" element={<PortalMessages />} />
              <Route path="/portal/team" element={<PortalTeam />} />
              <Route path="/portal/settings" element={<PortalNotificationSettings />} />
              <Route path="/portal/notifications" element={<PortalNotificationsPage />} />
            </Route>

            {/* App layout with sidebar */}
            <Route
              element={
                <ProtectedRoute requiredRoles={["admin", "super_admin", "montør"]}>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Navigate to="/overview" replace />} />
              <Route path="/overview" element={<OverviewPage />} />
              <Route path="/my-day" element={<MyDayPage />} />
              <Route path="/inbox" element={
                <ProtectedRoute requiredPermission="postkontor.view">
                  <InboxPage />
                </ProtectedRoute>
              } />
              <Route path="/dashboard" element={<Navigate to="/overview" replace />} />
              <Route path="/tasks" element={<Navigate to="/overview" replace />} />
              <Route path="/projects" element={<JobsPage />} />
              <Route path="/projects/new" element={<ProjectNewPage />} />
              <Route path="/projects/:id" element={<JobDetail />} />
              <Route path="/projects/:id/settings" element={<ProjectSettingsPage />} />
              <Route path="/projects/:id/conversations/new" element={<ConversationNewPage />} />
              <Route path="/projects/:id/conversations/:threadId" element={<ConversationDetailPage />} />
              <Route path="/projects/plan" element={<ResourcePlan />} />
              <Route path="/calendar/confirmations" element={<ConfirmationsPage />} />
              <Route path="/absence" element={<AbsencePage />} />
              <Route path="/admin/ai-matcher" element={
                <ProtectedRoute requiredRoles={["super_admin"]}>
                  <AiMatcherReportPage />
                </ProtectedRoute>
              } />
              <Route path="/projects/contracts" element={<ContractsPage />} />
              <Route path="/projects/contracts/:id" element={<ContractDetail />} />
              <Route path="/invoice-basis" element={<InvoiceBasisPage />} />
              <Route path="/management" element={
                <ProtectedRoute requiredRoles={["super_admin"]}>
                  <ManagementPage />
                </ProtectedRoute>
              } />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/customers/new" element={<CustomerNewPage />} />
              <Route path="/customers/import" element={<CustomerImportPage />} />
              <Route path="/customers/:id" element={<CustomerDetailPage />} />
              {/* Legacy redirects */}
              <Route path="/jobs" element={<Navigate to="/projects" replace />} />
              <Route path="/jobs/:id" element={<RedirectJobToProject />} />
              <Route path="/resource-plan" element={<Navigate to="/projects/plan" replace />} />
              <Route path="/contracts" element={<Navigate to="/projects/contracts" replace />} />
              <Route path="/contracts/:id" element={<RedirectContractToProject />} />
              <Route path="/sales/dashboard" element={<Navigate to="/sales" replace />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/fag" element={<RegulationPage />} />
              <Route path="/help" element={<HelpCenterPage />} />
              <Route path="/forms/:id" element={<FormFillPage />} />
              <Route
                path="/admin/forms"
                element={
                  <ProtectedRoute requiredRoles={["super_admin"]}>
                    <FormBuilderPage />
                  </ProtectedRoute>
                }
              />

              {/* Sales module - admin only */}
              <Route
                path="/sales"
                element={
                  <ProtectedRoute requiredRoles={["admin", "super_admin"]}>
                    <SalesDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sales/pipeline"
                element={
                  <ProtectedRoute requiredRoles={["admin", "super_admin"]}>
                    <PipelinePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sales/leads"
                element={
                  <ProtectedRoute requiredRoles={["admin", "super_admin"]}>
                    <LeadsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sales/leads/:id"
                element={
                  <ProtectedRoute requiredRoles={["admin", "super_admin"]}>
                    <LeadDetail />
                  </ProtectedRoute>
                }
              />
              {/* Tilbud is the primary module — calculations redirect here */}
              <Route
                path="/sales/offers"
                element={
                  <ProtectedRoute requiredRoles={["admin", "super_admin"]}>
                    <OffersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sales/offers/new"
                element={
                  <ProtectedRoute requiredRoles={["admin", "super_admin"]}>
                    <OfferEditorPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sales/offers/wizard"
                element={
                  <ProtectedRoute requiredRoles={["admin", "super_admin"]}>
                    <NewCalculation />
                  </ProtectedRoute>
                }
              />
              <Route path="/sales/offers/:id" element={<CalculationDetail />} />
              {/* Legacy calculation routes → redirect to offers */}
              <Route path="/sales/calculations" element={<Navigate to="/sales/offers" replace />} />
              <Route path="/sales/calculations/new" element={<Navigate to="/sales/offers/new" replace />} />
              <Route path="/sales/calculations/:id" element={<CalculationDetail />} />

              {/* Kalkylemotor (pakke-basert) */}
              <Route path="/sales/calc-engine" element={<ProtectedRoute><CalcEngineListPage /></ProtectedRoute>} />
              <Route path="/sales/calc-engine/new" element={<ProtectedRoute><CalcEngineNewRouter /></ProtectedRoute>} />
              <Route path="/sales/calc-engine/new/editor" element={<ProtectedRoute><CalcEngineNewRouter /></ProtectedRoute>} />
              <Route path="/sales/calc-engine/ai-start" element={<ProtectedRoute><CalcAiStartPage /></ProtectedRoute>} />
              <Route path="/sales/calc-engine/ai-review/:id" element={<ProtectedRoute><CalcAiReviewPage /></ProtectedRoute>} />
              <Route path="/sales/calc-engine/offer-from-calc" element={<ProtectedRoute><CalcOfferFromCalcPage /></ProtectedRoute>} />
             <Route path="/sales/calc-engine/case/:id" element={<ProtectedRoute><CalcCaseDetailPage /></ProtectedRoute>} />
             <Route path="/sales/calc-engine/:id" element={<ProtectedRoute><CalcEngineDetailPage /></ProtectedRoute>} />

              {/* Commercial Cases (CRM-hjerte) */}
              <Route path="/sales/cases" element={<ProtectedRoute requiredRoles={["admin", "super_admin"]}><SalesCasesListPage /></ProtectedRoute>} />
              <Route path="/sales/cases/:id" element={<ProtectedRoute requiredRoles={["admin", "super_admin"]}><SalesCaseDetailPage /></ProtectedRoute>} />


              {/* Legacy calculation routes redirect */}
              <Route path="/calculations" element={<Navigate to="/sales/offers" replace />} />
              <Route path="/calculations/new" element={<Navigate to="/sales/offers/new" replace />} />
              <Route path="/calculations/:id" element={<CalculationDetail />} />

              <Route
                path="/admin/company"
                element={<Navigate to="/admin/organisasjon" replace />}
              />
              {/* Legacy redirects for old admin pages */}
              <Route path="/admin/users" element={<Navigate to="/admin/personer" replace />} />
              <Route path="/admin/access" element={<Navigate to="/admin/organisasjon" replace />} />
              <Route path="/admin/ansatte" element={<Navigate to="/admin/personer" replace />} />
              <Route path="/admin/ansatte/:id" element={<Navigate to="/admin/personer" replace />} />
              <Route path="/admin/employees/import" element={<Navigate to="/admin/personer/import" replace />} />

              {/* New admin pages */}
              <Route
                path="/admin/organisasjon"
                element={
                  <ProtectedRoute requiredRoles={["super_admin"]}>
                    <OrganisationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/personer"
                element={
                  <ProtectedRoute requiredRoles={["super_admin"]}>
                    <PeoplePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/personer/import"
                element={
                  <ProtectedRoute requiredRoles={["super_admin"]}>
                    <EmployeeImportPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/personer/:id"
                element={
                  <ProtectedRoute requiredRoles={["super_admin"]}>
                    <PersonDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/roller"
                element={
                  <ProtectedRoute requiredRoles={["super_admin"]}>
                    <RolesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <ProtectedRoute requiredRoles={["super_admin"]}>
                    <AdminSettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/trash"
                element={
                  <ProtectedRoute requiredRoles={["super_admin"]}>
                    <TrashPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/settings/integrations" element={<IntegrationsDebug />} />
              <Route
                path="/admin/integration-health"
                element={
                  <ProtectedRoute requiredRoles={["super_admin"]}>
                    <IntegrationHealthPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/fag-insights"
                element={
                  <ProtectedRoute requiredRoles={["super_admin"]}>
                    <FagInsightsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/system-health"
                element={
                  <ProtectedRoute requiredRoles={["super_admin"]}>
                    <SystemHealthPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/data-integrity"
                element={
                  <ProtectedRoute requiredRoles={["super_admin"]}>
                    <DataIntegrityPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/contract-cron"
                element={
                  <ProtectedRoute requiredRoles={["super_admin"]}>
                    <ContractCronPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/superoffice"
                element={
                  <ProtectedRoute requiredPermission="postkontor.admin">
                    <SuperofficeSettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/microsoft"
                element={
                  <ProtectedRoute requiredRoles={["super_admin"]}>
                    <MicrosoftAdminPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/modules"
                element={
                  <ProtectedRoute requiredRoles={["super_admin"]}>
                    <ModuleManagementPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/tripletex"
                element={
                  <ProtectedRoute requiredRoles={["super_admin"]}>
                    <TripletexImportPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/project-duplicates"
                element={
                  <ProtectedRoute requiredRoles={["super_admin"]}>
                    <ProjectDuplicatesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/company-migration"
                element={
                  <ProtectedRoute requiredRoles={["super_admin"]}>
                    <CompanyMigrationPage />
                  </ProtectedRoute>
                }
               />

              {/* Order Forms module */}
              <Route path="/orders" element={<OrderFormsPage />} />
              <Route path="/orders/:id" element={<OrderFormDetailPage />} />
              <Route path="/orders/:id/convert" element={<OrderConvertPage />} />
              <Route path="/orders/new/:slug" element={<OrderFormSubmitPage />} />
              <Route
                path="/admin/order-forms"
                element={
                  <ProtectedRoute requiredRoles={["super_admin"]}>
                    <OrderFormTemplatesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/order-forms/:id"
                element={
                  <ProtectedRoute requiredRoles={["super_admin"]}>
                    <OrderFormBuilderPage />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
          </PreviewModeProvider>
          </PermissionCompanyBridge>
          </CompanyProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
