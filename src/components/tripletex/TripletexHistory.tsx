import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { History, Eye, Loader2 } from "lucide-react";

interface ImportLog {
  id: string;
  import_type: string;
  file_name: string;
  imported_by: string;
  imported_at: string;
  total_rows: number;
  created_count: number;
  updated_count: number;
  ignored_count: number;
  failed_count: number;
  status: string;
}

interface ImportResult {
  id: string;
  external_key: string;
  entity_type: string;
  action_taken: string;
  status: string;
  message: string;
}

export function TripletexHistory() {
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<ImportLog | null>(null);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("import_logs" as any)
      .select("*")
      .order("imported_at", { ascending: false })
      .limit(50);
    setLogs((data as any) || []);
    setLoading(false);
  };

  const openDetail = async (log: ImportLog) => {
    setSelectedLog(log);
    setLoadingResults(true);
    const { data } = await supabase
      .from("import_results" as any)
      .select("*")
      .eq("import_log_id", log.id)
      .order("created_at", { ascending: true });
    setResults((data as any) || []);
    setLoadingResults(false);
  };

  const statusBadge = (status: string) => {
    if (status === "completed") return <Badge variant="default">Fullført</Badge>;
    if (status === "partial") return <Badge variant="outline" className="border-yellow-500 text-yellow-700">Delvis</Badge>;
    if (status === "failed") return <Badge variant="destructive">Feilet</Badge>;
    return <Badge variant="secondary">Venter</Badge>;
  };

  const typeBadge = (type: string) => {
    if (type === "project") return <Badge variant="secondary">Prosjekt</Badge>;
    if (type === "quote") return <Badge variant="secondary">Tilbud</Badge>;
    return <Badge variant="outline">{type}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <History className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Ingen importhistorikk ennå</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dato</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Fil</TableHead>
                <TableHead className="text-right">Rader</TableHead>
                <TableHead className="text-right">Opprettet</TableHead>
                <TableHead className="text-right">Oppdatert</TableHead>
                <TableHead className="text-right">Ignorert</TableHead>
                <TableHead className="text-right">Feilet</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs">
                    {format(new Date(log.imported_at), "dd. MMM yyyy HH:mm", { locale: nb })}
                  </TableCell>
                  <TableCell>{typeBadge(log.import_type)}</TableCell>
                  <TableCell className="text-xs max-w-[160px] truncate">{log.file_name}</TableCell>
                  <TableCell className="text-right text-xs">{log.total_rows}</TableCell>
                  <TableCell className="text-right text-xs text-green-600">{log.created_count}</TableCell>
                  <TableCell className="text-right text-xs text-blue-600">{log.updated_count}</TableCell>
                  <TableCell className="text-right text-xs">{log.ignored_count}</TableCell>
                  <TableCell className="text-right text-xs text-destructive">{log.failed_count}</TableCell>
                  <TableCell>{statusBadge(log.status)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDetail(log)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Importdetaljer</SheetTitle>
            <SheetDescription>
              {selectedLog?.file_name} · {selectedLog?.import_type === "project" ? "Prosjekt" : "Tilbud"}
            </SheetDescription>
          </SheetHeader>

          {loadingResults ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2 mt-4">
              {results.map(r => (
                <div key={r.id} className="flex items-center justify-between p-2 rounded-lg border text-xs">
                  <div className="min-w-0">
                    <span className="font-mono">{r.external_key}</span>
                    <span className="text-muted-foreground ml-2">{r.message}</span>
                  </div>
                  <Badge
                    variant={r.action_taken === "created" ? "default" : r.action_taken === "failed" ? "destructive" : "outline"}
                    className="text-[10px] shrink-0"
                  >
                    {r.action_taken === "created" ? "Opprettet" : r.action_taken === "updated" ? "Oppdatert" : r.action_taken === "failed" ? "Feilet" : "Ignorert"}
                  </Badge>
                </div>
              ))}
              {results.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Ingen detaljer</p>}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
