import { cn } from "@/lib/utils";
import {
  CALCULATION_STATUS_CONFIG,
  PIPELINE_STATUSES,
  type CalculationStatus,
} from "@/lib/calculation-status";
import { Check } from "lucide-react";

interface SalesPipelineBarProps {
  currentStatus: CalculationStatus;
  onStatusChange?: (status: CalculationStatus) => void;
  disabled?: boolean;
}

export function SalesPipelineBar({ currentStatus, onStatusChange, disabled }: SalesPipelineBarProps) {
  const currentOrder = CALCULATION_STATUS_CONFIG[currentStatus]?.pipelineOrder ?? 0;
  const isTerminal = currentStatus === "rejected" || currentStatus === "converted";

  return (
    <div className="flex items-center gap-1 w-full">
      {PIPELINE_STATUSES.map((status, idx) => {
        const config = CALCULATION_STATUS_CONFIG[status];
        const order = config.pipelineOrder;
        const isActive = status === currentStatus;
        const isPast = order < currentOrder && !isTerminal;
        const isFuture = order > currentOrder || isTerminal;

        return (
          <button
            key={status}
            disabled={disabled}
            onClick={() => onStatusChange?.(status)}
            className={cn(
              "flex-1 relative flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-lg transition-all",
              "border",
              isActive && "bg-primary text-primary-foreground border-primary shadow-sm",
              isPast && "bg-primary/10 text-primary border-primary/30",
              isFuture && "bg-muted/50 text-muted-foreground border-border/50",
              !disabled && "cursor-pointer hover:opacity-80",
              disabled && "cursor-default",
            )}
          >
            {isPast && <Check className="h-3 w-3" />}
            {config.label}
          </button>
        );
      })}

      {/* Terminal states shown separately */}
      {isTerminal && (
        <div className={cn(
          "flex items-center justify-center gap-1.5 py-2 px-4 text-xs font-semibold rounded-lg border",
          CALCULATION_STATUS_CONFIG[currentStatus].className,
        )}>
          {CALCULATION_STATUS_CONFIG[currentStatus].label}
        </div>
      )}
    </div>
  );
}
