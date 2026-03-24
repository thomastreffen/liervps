import { AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import type { QualityResult } from "@/lib/order-quality";
import { QUALITY_LABELS } from "@/lib/order-quality";

interface QualityIssuesPanelProps {
  result: QualityResult;
}

export function QualityIssuesPanel({ result }: QualityIssuesPanelProps) {
  if (result.score === "green" && result.issues.length === 0) {
    return (
      <div className="rounded-lg bg-green-50 border border-green-200 p-3 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
        <span className="text-sm text-green-800 font-medium">Bestillingen er komplett og klar for behandling</span>
      </div>
    );
  }

  const isRed = result.score === "red";
  const bgColor = isRed ? "bg-orange-50 border-orange-200" : "bg-amber-50 border-amber-200";
  const headerColor = isRed ? "text-orange-800" : "text-amber-800";

  return (
    <div className={`rounded-lg border p-3 ${bgColor}`}>
      <div className="flex items-center gap-2 mb-2">
        <Info className={`h-4 w-4 ${headerColor} shrink-0`} />
        <span className={`text-sm font-medium ${headerColor}`}>
          {QUALITY_LABELS[result.score].label} – intern oppfølging
        </span>
      </div>
      <ul className="space-y-1">
        {result.issues.map((issue, i) => (
          <li key={i} className="flex items-start gap-2 text-xs">
            {issue.severity === "error" ? (
              <AlertTriangle className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
            ) : (
              <Info className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
            )}
            <span className={issue.severity === "error" ? "text-orange-700" : "text-amber-700"}>
              {issue.message}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
