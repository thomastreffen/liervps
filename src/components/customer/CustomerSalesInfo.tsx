import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ShoppingCart, Star, Tags } from "lucide-react";
import { CustomerTagBadges } from "./CustomerTagBadges";
import { CustomerValueSelector } from "./CustomerValueBadge";
import type { CustomerTag } from "@/hooks/useCustomerTags";
import type { CustomerValueLevel } from "@/hooks/useCustomerValueLevels";
import { Badge } from "@/components/ui/badge";

const PRODUCT_OPTIONS = [
  "Strømskinne",
  "Service",
  "Tavle",
  "Automasjon",
  "Belysning",
  "Energi",
  "Tele/data",
  "Brannalarm",
];

interface Props {
  assignedTags: CustomerTag[];
  allTags: CustomerTag[];
  onAddTag: (tagId: string) => void;
  onRemoveTag: (tagId: string) => void;
  onCreateTag: (name: string, color: string) => void;
  customerValue: string | null;
  valueLevels: CustomerValueLevel[];
  onValueChange: (code: string | null) => void;
  productsOfInterest: string[];
  onProductToggle: (product: string) => void;
}

export function CustomerSalesInfo({
  assignedTags, allTags, onAddTag, onRemoveTag, onCreateTag,
  customerValue, valueLevels, onValueChange,
  productsOfInterest, onProductToggle,
}: Props) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Star className="h-4 w-4 text-primary" /> Salgsinfo
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">
        {/* Customer value */}
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5"><Star className="h-3 w-3" /> Kundeverdi</Label>
          <CustomerValueSelector value={customerValue} levels={valueLevels} onChange={onValueChange} />
        </div>

        {/* Tags */}
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5"><Tags className="h-3 w-3" /> Tags</Label>
          <CustomerTagBadges
            assignedTags={assignedTags}
            allTags={allTags}
            onAdd={onAddTag}
            onRemove={onRemoveTag}
            onCreate={onCreateTag}
          />
        </div>

        {/* Products of interest */}
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5"><ShoppingCart className="h-3 w-3" /> Produkter av interesse</Label>
          <div className="flex flex-wrap gap-1.5">
            {PRODUCT_OPTIONS.map((p) => {
              const active = productsOfInterest.includes(p);
              return (
                <button
                  key={p}
                  onClick={() => onProductToggle(p)}
                  className="transition-all"
                >
                  <Badge
                    variant={active ? "default" : "outline"}
                    className={`text-[10px] rounded-lg cursor-pointer ${active ? "" : "opacity-50 hover:opacity-80"}`}
                  >
                    {p}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
