import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusLegend } from "@/components/StatusLegend";
import { SlidersHorizontal, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileFilterSheetProps {
  externalBlocksCapacity: boolean;
  onExternalBlocksCapacityChange: (v: boolean) => void;
  hideExternalEvents: boolean;
  onHideExternalEventsChange: (v: boolean) => void;
  isSuperAdmin: boolean;
  minFreeMinutes: number | null;
  onMinFreeMinutesChange: (v: number | null) => void;
}

export function MobileFilterSheet({
  externalBlocksCapacity,
  onExternalBlocksCapacityChange,
  hideExternalEvents,
  onHideExternalEventsChange,
  isSuperAdmin,
  minFreeMinutes,
  onMinFreeMinutesChange,
}: MobileFilterSheetProps) {
  const [open, setOpen] = useState(false);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg shrink-0">
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-base">Filtre og visning</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-6 space-y-5">
          {/* Min free minutes */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Minimum ledig tid</label>
            <Select
              value={minFreeMinutes?.toString() || "none"}
              onValueChange={(v) => onMinFreeMinutesChange(v === "none" ? null : Number(v))}
            >
              <SelectTrigger className="h-9 rounded-lg">
                <Clock className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Alle (ingen min.)</SelectItem>
                <SelectItem value="30">Ledig 30+ min</SelectItem>
                <SelectItem value="60">Ledig 60+ min</SelectItem>
                <SelectItem value="90">Ledig 90+ min</SelectItem>
                <SelectItem value="120">Ledig 120+ min</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Ekstern blokkerer kapasitet</span>
              <Switch checked={externalBlocksCapacity} onCheckedChange={onExternalBlocksCapacityChange} />
            </div>
            {isSuperAdmin && (
              <div className="flex items-center justify-between">
                <span className="text-sm">Skjul eksterne avtaler</span>
                <Switch checked={hideExternalEvents} onCheckedChange={onHideExternalEventsChange} />
              </div>
            )}
          </div>

          {/* Status legend */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Statusforklaring</label>
            <div className="bg-muted/50 rounded-lg p-3">
              <StatusLegend />
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
