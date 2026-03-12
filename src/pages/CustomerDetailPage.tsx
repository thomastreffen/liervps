import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FolderKanban, UserPlus, Building2, Inbox, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { type JobStatus } from "@/lib/job-status";
import { CustomerHeader } from "@/components/customer/CustomerHeader";
import { CustomerProjectsList } from "@/components/customer/CustomerProjectsList";
import { CustomerContactsTab } from "@/components/customer/CustomerContactsTab";
import { CustomerCasesSection } from "@/components/customer/CustomerCasesSection";
import { CustomerInfoTab } from "@/components/customer/CustomerInfoTab";

interface Customer {
  id: string;
  name: string;
  org_number: string | null;
  main_email: string | null;
  main_phone: string | null;
  billing_address: string | null;
  billing_zip: string | null;
  billing_city: string | null;
  notes: string | null;
  created_at: string;
  external_tripletex_id: string | null;
  company_id: string | null;
}

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
}

interface ProjectRow {
  id: string;
  title: string;
  status: JobStatus;
  start_time: string;
  internal_number: string | null;
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin } = useAuth();
  const { activeCompany } = useCompanyContext();

  const activeTab = searchParams.get("tab") || "projects";
  const setActiveTab = (tab: string) => {
    setSearchParams(tab === "projects" ? {} : { tab }, { replace: true });
  };

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);

  const fetchCustomer = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("id", id)
      .single();
    if (data) setCustomer(data as any);
    setLoading(false);
  }, [id]);

  const fetchProjects = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("events")
      .select("id, title, status, start_time, internal_number")
      .eq("customer_id", id)
      .is("deleted_at", null)
      .order("start_time", { ascending: false });
    if (data) setProjects(data as any);
  }, [id]);

  const fetchContacts = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("customer_contacts")
      .select("*")
      .eq("customer_id", id)
      .order("created_at", { ascending: true });
    if (data) setContacts(data as any);
  }, [id]);

  useEffect(() => {
    fetchCustomer();
    fetchProjects();
    fetchContacts();
  }, [fetchCustomer, fetchProjects, fetchContacts]);

  const handleSaveInfo = async (data: {
    name: string;
    org_number: string;
    main_email: string;
    main_phone: string;
    billing_address: string;
    billing_zip: string;
    billing_city: string;
  }) => {
    if (!customer) return;
    const { error } = await supabase
      .from("customers")
      .update({
        name: data.name,
        org_number: data.org_number || null,
        main_email: data.main_email || null,
        main_phone: data.main_phone || null,
        billing_address: data.billing_address || null,
        billing_zip: data.billing_zip || null,
        billing_city: data.billing_city || null,
      } as any)
      .eq("id", customer.id);
    if (error) toast.error("Kunne ikke lagre", { description: error.message });
    else { toast.success("Kunde oppdatert"); fetchCustomer(); }
  };

  const handleAddContact = async (contact: { name: string; email: string; phone: string; role: string }) => {
    if (!id) return;
    const { error } = await supabase.from("customer_contacts").insert({
      customer_id: id,
      name: contact.name,
      email: contact.email || null,
      phone: contact.phone || null,
      role: contact.role || null,
    } as any);
    if (error) toast.error("Kunne ikke legge til kontakt");
    else { toast.success("Kontakt lagt til"); fetchContacts(); }
  };

  const handleDeleteContact = async (contactId: string) => {
    const { error } = await supabase.from("customer_contacts").delete().eq("id", contactId);
    if (error) toast.error("Kunne ikke slette kontakt");
    else { toast.success("Kontakt slettet"); fetchContacts(); }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-20"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;
  }

  if (!customer) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="text-center space-y-3">
          <p className="text-lg font-semibold">Kunde ikke funnet</p>
          <Button variant="outline" onClick={() => navigate("/customers")}>Tilbake til kunder</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <CustomerHeader customer={customer} companyName={activeCompany?.name} />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="rounded-xl">
            <TabsTrigger value="projects" className="rounded-lg gap-1.5">
              <FolderKanban className="h-3.5 w-3.5" /> Prosjekter ({projects.length})
            </TabsTrigger>
            <TabsTrigger value="contacts" className="rounded-lg gap-1.5">
              <UserPlus className="h-3.5 w-3.5" /> Kontakter ({contacts.length})
            </TabsTrigger>
            <TabsTrigger value="cases" className="rounded-lg gap-1.5">
              <Inbox className="h-3.5 w-3.5" /> Saker
            </TabsTrigger>
            <TabsTrigger value="info" className="rounded-lg gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> Info
            </TabsTrigger>
          </TabsList>

          <TabsContent value="projects">
            <CustomerProjectsList projects={projects} customerId={customer.id} />
          </TabsContent>

          <TabsContent value="contacts">
            <CustomerContactsTab
              contacts={contacts}
              isAdmin={isAdmin}
              onAdd={handleAddContact}
              onDelete={handleDeleteContact}
            />
          </TabsContent>

          <TabsContent value="cases">
            <CustomerCasesSection customerId={customer.id} />
          </TabsContent>

          <TabsContent value="info">
            <CustomerInfoTab
              customer={customer}
              isAdmin={isAdmin}
              companyName={activeCompany?.name}
              onSave={handleSaveInfo}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
