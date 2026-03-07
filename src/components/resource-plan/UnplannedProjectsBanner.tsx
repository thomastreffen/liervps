import { memo } from "react";
import { AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface UnplannedProjectsBannerProps {
  count: number;
  onClick?: () => void;
}

export const UnplannedProjectsBanner = memo(function UnplannedProjectsBanner({
  count,
  onClick,
}: UnplannedProjectsBannerProps) {
  const navigate = useNavigate();

  if (count <= 0) return null;

  return (
    <div className="mb-3 flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/5 px-4 py-2.5">
      <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
      <span className="text-sm font-medium text-foreground">
        <span className="font-bold">{count}</span> prosjekt{count > 1 ? "er" : ""} mangler planlegging
      </span>
      <Button
        variant="outline"
        size="sm"
        className="ml-auto h-7 text-xs rounded-lg border-warning/30 text-warning hover:bg-warning/10"
        onClick={onClick || (() => navigate("/jobs?filter=unplanned"))}
      >
        Vis
      </Button>
    </div>
  );
});
