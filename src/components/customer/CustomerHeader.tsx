import { Button } from "@/components/ui/button";
import { SourceMetadataBadge } from "@/components/SourceMetadataBadge";
import { ArrowLeft, Plus, Phone, Mail, MapPin, Building2, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface CustomerHeaderProps {
  customer: {
    id: string;
    name: string;
    org_number: string | null;
    main_email: string | null;
    main_phone: string | null;
    billing_city: string | null;
    external_tripletex_id: string | null;
  };
  companyName: string | null | undefined;
}

export function CustomerHeader({ customer, companyName }: CustomerHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="sticky top-0 z-30 border-b border-border/50 bg-card/95 backdrop-blur-xl">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate("/customers")} className="shrink-0 mt-0.5 rounded-xl h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 space-y-1">
              {/* Name + Org */}
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold tracking-tight truncate">{customer.name}</h1>
                {customer.org_number && (
                  <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    Org: {customer.org_number}
                  </span>
                )}
              </div>

              {/* Contact row */}
              <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                {customer.main_phone && (
                  <a href={`tel:${customer.main_phone}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
                    <Phone className="h-3 w-3" />{customer.main_phone}
                  </a>
                )}
                {customer.main_email && (
                  <a href={`mailto:${customer.main_email}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
                    <Mail className="h-3 w-3" />{customer.main_email}
                  </a>
                )}
                {customer.billing_city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />{customer.billing_city}
                  </span>
                )}
              </div>

              {/* Source badge */}
              <SourceMetadataBadge
                source={customer.external_tripletex_id ? "tripletex" : "local"}
                externalId={customer.external_tripletex_id}
                companyName={companyName}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="default" onClick={() => navigate(`/projects/new?customer=${customer.id}`)} className="gap-1.5 rounded-xl">
              <Plus className="h-3.5 w-3.5" /> Nytt prosjekt
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
