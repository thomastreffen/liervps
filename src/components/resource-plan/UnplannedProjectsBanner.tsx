import { memo } from "react";
import { AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
    <button
      type="button"
      onClick={onClick || (() => navigate("/jobs?filter=unplanned"))}
      className="mb-1 flex items-center gap-2 rounded-md px-2.5 py-1 text-[11px] font-medium text-warning hover:bg-warning/10 transition-colors w-fit"
    >
      <AlertTriangle className="h-3 w-3 shrink-0" />
      <span>
        <span className="font-bold">{count}</span> prosjekt{count > 1 ? "er" : ""} mangler planlegging
      </span>
      <span className="text-[10px] underline ml-1">Vis</span>
    </button>
  );
});
