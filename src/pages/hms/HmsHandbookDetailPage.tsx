import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { BookOpen, ChevronRight, FileCheck2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

interface Handbook {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  current_version_id: string | null;
  updated_at: string;
}
interface Version {
  id: string;
  version_number: number;
  status: string;
  published_at: string | null;
}
interface Section {
  id: string;
  heading: string;
  body: string | null;
  ordering: number;
}

export default function HmsHandbookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { activeCompanyId } = useCompanyContext();

  const { data: handbook, isLoading } = useQuery({
    queryKey: ["hms-handbook", id, activeCompanyId],
    enabled: !!id && !!activeCompanyId,
    queryFn: async () => {
      const sb = supabase as any;
      const { data, error } = await sb
        .from("hms_handbooks")
        .select("id, title, description, kind, current_version_id, updated_at")
        .eq("id", id)
        .eq("company_id", activeCompanyId)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return data as Handbook | null;
    },
  });

  const { data: versions = [] } = useQuery({
    queryKey: ["hms-handbook-versions", id],
    enabled: !!handbook,
    queryFn: async () => {
      const sb = supabase as any;
      const { data, error } = await sb
        .from("hms_handbook_versions")
        .select("id, version_number, status, published_at")
        .eq("handbook_id", id)
        .order("version_number", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Version[];
    },
  });

  const activeVersion = handbook?.current_version_id
    ? versions.find((v) => v.id === handbook.current_version_id) ?? versions[0]
    : versions[0];

  const { data: sections = [] } = useQuery({
    queryKey: ["hms-handbook-sections", activeVersion?.id],
    enabled: !!activeVersion,
    queryFn: async () => {
      const sb = supabase as any;
      const { data, error } = await sb
        .from("hms_handbook_sections")
        .select("id, heading, body, ordering")
        .eq("version_id", activeVersion!.id)
        .order("ordering", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Section[];
    },
  });

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!handbook) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-sm text-muted-foreground space-y-2">
            <BookOpen className="h-8 w-8 mx-auto text-muted-foreground/40" />
            <div className="font-medium text-foreground">Ikke funnet eller ingen tilgang</div>
            <p>Håndboken finnes ikke for valgt selskap, eller du har ikke tilgang.</p>
            <Link to="/hms/handbooks" className="text-primary text-xs underline">Tilbake til håndbøker</Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <nav className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link to="/hms" className="hover:text-foreground">HMS &amp; HR</Link>
        <ChevronRight className="h-3 w-3" />
        <Link to="/hms/handbooks" className="hover:text-foreground">Håndbøker</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground truncate">{handbook.title}</span>
      </nav>

      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-semibold tracking-tight">{handbook.title}</h1>
          <Badge variant="outline" className="text-[10px] uppercase">{handbook.kind}</Badge>
          {activeVersion && (
            <Badge variant={activeVersion.status === "published" ? "default" : "secondary"} className="text-[10px] uppercase">
              v{activeVersion.version_number} · {activeVersion.status}
            </Badge>
          )}
        </div>
        {handbook.description && (
          <p className="text-sm text-muted-foreground max-w-2xl">{handbook.description}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Sist oppdatert {format(new Date(handbook.updated_at), "d. MMM yyyy", { locale: nb })}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileCheck2 className="h-4 w-4" /> Innhold
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {sections.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ingen kapitler i aktiv versjon enda.</p>
          ) : (
            sections.map((s, i) => (
              <div key={s.id} className="border-l-2 border-border/60 pl-3">
                <h3 className="text-sm font-medium">
                  {i + 1}. {s.heading}
                </h3>
                {s.body && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{s.body}</p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {versions.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Versjoner</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {versions.map((v) => (
              <div key={v.id} className="flex items-center justify-between text-sm">
                <span>v{v.version_number}</span>
                <Badge variant="outline" className="text-[10px]">{v.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
