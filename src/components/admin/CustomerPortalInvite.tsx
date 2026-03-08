import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Send, CheckCircle, Copy } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCompanyId?: string;
  defaultCustomerId?: string;
  defaultProjectIds?: string[];
  defaultEmail?: string;
  defaultAccountId?: string;
}

export function CustomerPortalInvite({
  open, onOpenChange, defaultCompanyId, defaultCustomerId,
  defaultProjectIds, defaultEmail, defaultAccountId,
}: Props) {
  const [email, setEmail] = useState(defaultEmail || "");
  const [fullName, setFullName] = useState("");
  const [portalRole, setPortalRole] = useState("customer_user");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; link?: string } | null>(null);

  const handleInvite = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("customer-portal-invite", {
        body: {
          email: email.trim(),
          full_name: fullName.trim() || null,
          company_id: defaultCompanyId || null,
          customer_id: defaultCustomerId || null,
          project_ids: defaultProjectIds || [],
          account_id: defaultAccountId || null,
          portal_role: portalRole,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResult({ success: true, link: data.action_link });
      toast.success("Invitasjon opprettet");
    } catch (err: any) {
      toast.error(err.message || "Kunne ikke sende invitasjon");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    if (result?.link) {
      navigator.clipboard.writeText(result.link);
      toast.success("Lenke kopiert");
    }
  };

  const handleClose = () => {
    setEmail(defaultEmail || "");
    setFullName("");
    setPortalRole("customer_user");
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Inviter kunde til portalen</DialogTitle>
          <DialogDescription>
            Kunden mottar en sikker innloggingslenke per e-post. Ingen passord nødvendig.
          </DialogDescription>
        </DialogHeader>

        {result?.success ? (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle className="h-6 w-6 text-primary" />
              </div>
              <p className="font-medium">Invitasjon opprettet!</p>
              <p className="text-sm text-muted-foreground">
                Kunden kan nå logge inn via kundeportalen med sin e-postadresse.
              </p>
            </div>
            {result.link && (
              <div className="space-y-2">
                <Label>Aktiveringslenke</Label>
                <div className="flex gap-2">
                  <Input value={result.link} readOnly className="text-xs" />
                  <Button variant="outline" size="icon" onClick={copyLink}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>E-post *</Label>
              <Input
                type="email"
                placeholder="kunde@firma.no"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label>Navn</Label>
              <Input
                placeholder="Ola Nordmann"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label>Rolle</Label>
              <Select value={portalRole} onValueChange={setPortalRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer_user">Bruker</SelectItem>
                  <SelectItem value="customer_admin">Administrator</SelectItem>
                  <SelectItem value="customer_finance">Økonomi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          {result?.success ? (
            <Button onClick={handleClose}>Lukk</Button>
          ) : (
            <Button onClick={handleInvite} disabled={loading || !email.trim()}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send invitasjon
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
