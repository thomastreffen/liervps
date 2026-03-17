import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface SoftDeleteButtonProps {
  /** Display label for the entity type, e.g. "Tilbud" */
  entityLabel: string;
  /** Optional entity name for the dialog, e.g. "Tilbud #123" */
  entityName?: string;
  /** Called when user confirms deletion */
  onConfirm: () => void | Promise<void>;
  /** Whether the delete is in progress */
  isDeleting?: boolean;
  /** Variant: icon-only for lists, or with text for headers */
  variant?: "icon" | "icon-text";
  /** Additional className */
  className?: string;
  /** Size of the icon button */
  size?: "sm" | "default";
  /** Disable the button */
  disabled?: boolean;
}

export function SoftDeleteButton({
  entityLabel,
  entityName,
  onConfirm,
  isDeleting = false,
  variant = "icon",
  className,
  size = "sm",
  disabled = false,
}: SoftDeleteButtonProps) {
  const [open, setOpen] = useState(false);

  const handleConfirm = async () => {
    await onConfirm();
    setOpen(false);
  };

  return (
    <>
      <Button
        variant="ghost"
        size={size === "sm" ? "icon" : "default"}
        className={cn(
          "text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors",
          size === "sm" && "h-8 w-8",
          className
        )}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        disabled={disabled || isDeleting}
        title={`Slett ${entityLabel.toLowerCase()}`}
      >
        <Trash2 className={cn("shrink-0", size === "sm" ? "h-4 w-4" : "h-4 w-4")} />
        {variant === "icon-text" && <span className="ml-1.5">Slett</span>}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Slett {entityName ?? entityLabel.toLowerCase()}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Dette fjerner elementet fra aktive lister. Kan gjenopprettes fra papirkurven.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Sletter…" : "Slett"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
