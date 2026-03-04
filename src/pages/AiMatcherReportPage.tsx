import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { ArrowLeft, Sparkles, TrendingUp, AlertTriangle, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from "react-router-dom";

interface MatchRun {
  id: string;
  schedule_block_id: string;
  event_subject: string | null;
  chosen_project_id: string | null;
  confidence: number;
  reason: string | null;
  extracted_signals: string[] | null;
  outcome: string;
  final_decision: string | null;
  guardrail_reason: string | null;
  latency_ms: number | null;
  created_at: string;
}

export default function AiMatcherReportPage() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<MatchRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, auto: 0, suggest: 0, none: 0, corrected: 0 });
  const [topTokens, setTopTokens] = useState<{ token: string; count: number }[]>([]);

  const fetchData = useCallback(async () => {
    // Fetch recent runs
    const { data: runsData } = await supabase
      .from("ai_match_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (runsData) {
      setRuns(runsData as MatchRun[]);

      // Compute stats
      const total = runsData.length;
      const auto = runsData.filter(r => r.final_decision === "auto" || r.outcome === "auto").length;
      const suggest = runsData.filter(r => r.final_decision === "suggest" || r.outcome === "suggestion").length;
      const none = total - auto - suggest;

      // Count corrections: auto-matched blocks that were later changed
      // (simplified: count blocks where outcome=auto but final_decision differs)
      const corrected = runsData.filter(r =>
        r.outcome === "auto" && r.final_decision && r.final_decision !== "auto"
      ).length;

      setStats({ total, auto, suggest, none, corrected });

      // Top tokens from extracted_signals
      const tokenCounts = new Map<string, number>();
      for (const run of runsData) {
        for (const sig of (run.extracted_signals || [])) {
          const lower = sig.toLowerCase();
          tokenCounts.set(lower, (tokenCounts.get(lower) || 0) + 1);
        }
      }
      const sorted = [...tokenCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([token, count]) => ({ token, count }));
      setTopTokens(sorted);
    }

    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const autoRate = stats.total > 0 ? ((stats.auto / stats.total) * 100).toFixed(1) : "0";
  const correctionRate = stats.auto > 0 ? ((stats.corrected / stats.auto) * 100).toFixed(1) : "0";

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-lg">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <Sparkles className="h-6 w-6 text-primary" />
            AI Matcher Rapport
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Oversikt over AI-matchingytelse og guardrails
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Laster...</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Totalt kjørt
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-2xl font-bold">{stats.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Auto-rate
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-2xl font-bold">{autoRate}%</p>
                <p className="text-xs text-muted-foreground">{stats.auto} auto-matchet</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  Forslag
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-2xl font-bold">{stats.suggest}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Korreksjonsrate
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-2xl font-bold">{correctionRate}%</p>
                <p className="text-xs text-muted-foreground">{stats.corrected} korrigert</p>
              </CardContent>
            </Card>
          </div>

          {/* Top tokens */}
          {topTokens.length > 0 && (
            <Card className="mb-6">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-semibold">Top signaler/tokens</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <div className="flex flex-wrap gap-1.5">
                  {topTokens.map(t => (
                    <Badge key={t.token} variant="secondary" className="text-xs">
                      {t.token} <span className="ml-1 text-muted-foreground">×{t.count}</span>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent runs table */}
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-semibold">Siste kjøringer</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Tidspunkt</TableHead>
                    <TableHead className="text-xs">Emne</TableHead>
                    <TableHead className="text-xs">Confidence</TableHead>
                    <TableHead className="text-xs">Beslutning</TableHead>
                    <TableHead className="text-xs">Guardrail</TableHead>
                    <TableHead className="text-xs">Latency</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.slice(0, 50).map(run => (
                    <TableRow key={run.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(run.created_at), "d. MMM HH:mm", { locale: nb })}
                      </TableCell>
                      <TableCell className="text-xs truncate max-w-[200px]">
                        {run.event_subject || "—"}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{run.confidence}%</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            (run.final_decision || run.outcome) === "auto" ? "default" :
                            (run.final_decision || run.outcome) === "suggest" || run.outcome === "suggestion" ? "secondary" :
                            "outline"
                          }
                          className="text-[10px]"
                        >
                          {run.final_decision || run.outcome}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[180px]">
                        {run.guardrail_reason || "—"}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {run.latency_ms ? `${run.latency_ms}ms` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
