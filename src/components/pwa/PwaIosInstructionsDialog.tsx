import { Share, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PwaIosInstructionsDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Legg MCS til på Hjem-skjerm</DialogTitle>
          <DialogDescription>Slik installerer du MCS på iPhone og iPad.</DialogDescription>
        </DialogHeader>
        <ol className="space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              1
            </span>
            <span>
              Trykk på <Share className="inline h-4 w-4 -mt-0.5" /> Del-knappen nederst i Safari.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              2
            </span>
            <span>
              Velg <span className="font-medium">«Legg til på Hjem-skjerm»</span>{" "}
              <Plus className="inline h-4 w-4 -mt-0.5" />.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              3
            </span>
            <span>Trykk «Legg til» øverst til høyre. MCS dukker opp som en app på Hjem-skjermen.</span>
          </li>
        </ol>
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          Tips: Åpne denne siden i Safari hvis du bruker en annen nettleser — kun Safari kan installere
          apper på iPhone.
        </p>
      </DialogContent>
    </Dialog>
  );
}
