import { useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileUp, Upload } from "lucide-react";

interface TripletexUploadZoneProps {
  onFile: (file: File) => void;
  label: string;
  accept?: string;
}

export function TripletexUploadZone({ onFile, label, accept = ".csv,.xls,.xlsx" }: TripletexUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }, [onFile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  };

  return (
    <Card
      className="border-2 border-dashed border-muted-foreground/20 hover:border-primary/40 transition-colors cursor-pointer"
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="rounded-full bg-primary/10 p-4">
          <Upload className="h-8 w-8 text-primary" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Dra og slipp eller klikk for å velge fil. Støtter .csv, .xls, .xlsx
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5">
          <FileUp className="h-4 w-4" />
          Velg fil
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleChange}
        />
      </CardContent>
    </Card>
  );
}
