import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useCalcPackageBundle } from "@/hooks/useCalcPackages";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sparkles, Upload, X, Loader2, FileText, Image as ImageIcon, FileType2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface PendingFile {
  id: string;
  file: File;
}

function fileIcon(mime: string) {
  if (mime.startsWith("image/")) return <ImageIcon className="h-4 w-4" />;
  if (mime === "application/pdf") return <FileType2 className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

export default function CalcAiStartPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const packageId = params.get("package");
  const { user } = useAuth();
  const { activeCompanyId } = useCompanyContext();
  const { pkg, loading } = useCalcPackageBundle(packageId);

  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fl = e.target.files;
    if (!fl) return;
    const next: PendingFile[] = [];
    for (let i = 0; i < fl.length; i++) {
      const f = fl[i];
      if (f.size > 20 * 1024 * 1024) {
        toast({ title: "Filen er for stor", description: `${f.name} er over 20 MB.`, variant: "destructive" });
        continue;
      }
      next.push({ id: crypto.randomUUID(), file: f });
    }
    setFiles((prev) => [...prev, ...next]);
    e.target.value = "";
  };

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));

  const handleStart = async () => {
    if (!user || !packageId) return;
    if (files.length === 0 && !description.trim()) {
      toast({
        title: "Trenger underlag",
        description: "Last opp minst én fil eller skriv en kort beskrivelse.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      // 1) Opprett draft først for å få id
      const { data: draft, error: draftErr } = await supabase
        .from("calc_ai_drafts")
        .insert({
          company_id: activeCompanyId,
          user_id: user.id,
          package_id: packageId,
          status: "draft",
          initial_description: description.trim() || null,
          attachments: [],
        })
        .select("id")
        .single();
      if (draftErr) throw draftErr;

      // 2) Last opp filer til calc-ai-drafts/<userId>/<draftId>/<filename>
      const uploaded: any[] = [];
      for (const pf of files) {
        const safeName = pf.file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${user.id}/${draft.id}/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("calc-ai-drafts")
          .upload(path, pf.file, { contentType: pf.file.type, upsert: false });
        if (upErr) {
          console.error("Upload failed", upErr);
          toast({ title: "Opplasting feilet", description: pf.file.name, variant: "destructive" });
          continue;
        }
        uploaded.push({
          path,
          name: pf.file.name,
          mime_type: pf.file.type || "application/octet-stream",
          size: pf.file.size,
          bucket: "calc-ai-drafts",
        });
      }

      if (uploaded.length) {
        await supabase.from("calc_ai_drafts")
          .update({ attachments: uploaded })
          .eq("id", draft.id);
      }

      // 3) Naviger til review-side, som starter første analyse
      navigate(`/sales/calc-engine/ai-review/${draft.id}?autorun=1`);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Klarte ikke å starte AI-utkast", description: e.message ?? String(e), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !pkg) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/sales/calc-engine/new")} className="rounded-xl">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" /> AI-assistert oppstart
          </h1>
          <p className="text-sm text-muted-foreground">
            Pakke: <span className="font-medium text-foreground">{pkg.name}</span>. AI lager et førsteutkast — du beholder kontrollen.
          </p>
        </div>
      </div>

      <Card className="p-5 rounded-2xl space-y-4">
        <div className="space-y-2">
          <Label>Kort beskrivelse <span className="text-muted-foreground font-normal">(valgfri men anbefalt)</span></Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="F.eks. 'Ny strømskinne i Hall 4. Ca 80m totalt, 4000A, hovedsakelig vannrett, ett vertikalt strekk på 6m. Eaton xEnergy ønskes.'"
            rows={5}
            className="rounded-xl resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Skriv det du allerede vet. AI kombinerer dette med tegninger og bilder du laster opp.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Underlag <span className="text-muted-foreground font-normal">(tegning, PDF, bilde)</span></Label>
          <label className="flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-8 cursor-pointer hover:border-primary/40 hover:bg-primary-soft/20 transition-colors">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Klikk for å laste opp filer (PDF, JPG, PNG — maks 20 MB per fil)</span>
            <Input
              type="file"
              multiple
              accept="image/*,application/pdf"
              onChange={onPickFiles}
              className="hidden"
            />
          </label>

          {files.length > 0 && (
            <div className="space-y-1.5 mt-3">
              {files.map((pf) => (
                <div key={pf.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-card">
                  <div className="text-muted-foreground">{fileIcon(pf.file.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{pf.file.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {(pf.file.size / 1024).toFixed(0)} kB · {pf.file.type || "ukjent"}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeFile(pf.id)} className="rounded-lg h-8 w-8">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <Badge variant="outline" className="rounded-lg text-[10px] gap-1">
            <Sparkles className="h-3 w-3" /> Bruker Lovable AI (multimodal)
          </Badge>
          <Button onClick={handleStart} disabled={submitting} className="rounded-xl gap-1.5">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Start AI-analyse
          </Button>
        </div>
      </Card>
    </div>
  );
}
