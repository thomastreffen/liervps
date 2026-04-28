import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Calculator, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

interface Row {
  id: string;
  project_title: string;
  customer_name: string;
  status: string;
  total_price: number;
  created_at: string;
  package: { name: string; slug: string } | null;
}

export default function CalcEngineListPage() {
  const navigate = useNavigate();
  const { activeCompanyId, allowedCompanyIds } = useCompanyContext();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase
        .from("calculations")
        .select("id, project_title, customer_name, status, total_price, created_at, calc_packages(name, slug)")
        .not("package_id", "is", null)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (activeCompanyId) q = q.eq("company_id", activeCompanyId);
      else if (allowedCompanyIds.length) q = q.in("company_id", allowedCompanyIds);
      const { data, error } = await q;
      if (error) console.error(error);
      else setRows((data ?? []).map((r: any) => ({
        ...r, package: r.calc_packages,
      })));
      setLoading(false);
    })();
  }, [activeCompanyId]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" /> Kalkylemotor
          </h1>
          <p className="text-sm text-muted-foreground">
            Pakke-baserte kalkyler med normtid, justeringer og pris.
          </p>
        </div>
        <Button onClick={() => navigate("/sales/calc-engine/new")} className="gap-1.5 rounded-xl self-start">
          <Plus className="h-4 w-4" /> Ny kalkyle
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card className="rounded-2xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prosjekt</TableHead>
                <TableHead>Kunde</TableHead>
                <TableHead>Pakke</TableHead>
                <TableHead>Dato</TableHead>
                <TableHead className="text-right">Pris</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                    <Calculator className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    Ingen kalkyler enda.
                  </TableCell>
                </TableRow>
              ) : rows.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/sales/calc-engine/${r.id}`)}>
                  <TableCell className="font-medium">{r.project_title}</TableCell>
                  <TableCell className="text-sm">{r.customer_name}</TableCell>
                  <TableCell>
                    {r.package && <Badge variant="outline" className="rounded-lg text-xs">{r.package.name}</Badge>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(r.created_at), "d. MMM yyyy", { locale: nb })}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    kr {Number(r.total_price).toLocaleString("nb-NO", { maximumFractionDigits: 0 })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
