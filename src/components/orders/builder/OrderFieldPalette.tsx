import { useState } from "react";
import {
  Type, AlignLeft, Hash, Calendar, Clock, Mail, Phone, MapPin, Building2,
  ChevronDown, CircleDot, CheckSquare, ListChecks, Upload, Image, Search,
  Users, FolderSearch, UserSearch, Info, Heading, Timer, Package, FileCheck,
  Blocks,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { OrderFormFieldType } from "@/types/order-forms";

const FIELD_ICONS: Record<OrderFormFieldType, React.ElementType> = {
  short_text: Type,
  long_text: AlignLeft,
  number: Hash,
  date: Calendar,
  time: Clock,
  time_window: Timer,
  email: Mail,
  phone: Phone,
  address: MapPin,
  org_number: Building2,
  dropdown: ChevronDown,
  multi_select: ListChecks,
  yes_no: CheckSquare,
  checkbox_list: ListChecks,
  radio: CircleDot,
  file_upload: Upload,
  image_upload: Image,
  customer_lookup: UserSearch,
  project_lookup: FolderSearch,
  user_lookup: Users,
  info_box: Info,
  section_header: Heading,
};

interface FieldCategory {
  label: string;
  types: { type: OrderFormFieldType; label: string; description: string }[];
}

const CATEGORIES: FieldCategory[] = [
  {
    label: "Basisfelt",
    types: [
      { type: "short_text", label: "Kort tekst", description: "Enkel tekstlinje" },
      { type: "long_text", label: "Lang tekst", description: "Flerlinjefelt" },
      { type: "number", label: "Tall", description: "Numerisk verdi" },
      { type: "date", label: "Dato", description: "Datovelger" },
      { type: "time", label: "Klokkeslett", description: "Tidspunkt" },
      { type: "time_window", label: "Tidsvindu", description: "Fra-til tidspunkt" },
    ],
  },
  {
    label: "Kontaktinfo",
    types: [
      { type: "email", label: "E-post", description: "E-postadresse" },
      { type: "phone", label: "Telefon", description: "Telefonnummer" },
      { type: "address", label: "Adresse", description: "Gateadresse" },
      { type: "org_number", label: "Org.nr", description: "Organisasjonsnummer" },
    ],
  },
  {
    label: "Valgfelt",
    types: [
      { type: "dropdown", label: "Nedtrekksliste", description: "Velg ett alternativ" },
      { type: "radio", label: "Radioknapper", description: "Velg ett av flere" },
      { type: "yes_no", label: "Ja / Nei", description: "Boolsk valg" },
      { type: "checkbox_list", label: "Sjekkliste", description: "Velg flere" },
      { type: "multi_select", label: "Flervalg", description: "Velg flere fra liste" },
    ],
  },
  {
    label: "Vedlegg",
    types: [
      { type: "file_upload", label: "Filopplasting", description: "PDF, XLSX, DOCX m.m." },
      { type: "image_upload", label: "Bildeopplasting", description: "JPG, PNG bilder" },
    ],
  },
  {
    label: "Oppslag",
    types: [
      { type: "customer_lookup", label: "Kundeoppslag", description: "Velg eksisterende kunde fra systemet" },
      { type: "project_lookup", label: "Prosjektoppslag", description: "Koble til prosjekt" },
      { type: "user_lookup", label: "Brukeroppslag", description: "Velg intern bruker" },
    ],
  },
  {
    label: "Layout",
    types: [
      { type: "section_header", label: "Seksjonsoverskrift", description: "Visuell gruppering" },
      { type: "info_box", label: "Infoboks", description: "Hjelpetekst eller informasjon" },
    ],
  },
];

export interface FieldBlock {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
  fields: { label: string; type: OrderFormFieldType; field_key: string; is_required?: boolean; options?: string[] }[];
}

const FIELD_BLOCKS: FieldBlock[] = [
  {
    id: "customer_info",
    label: "Kundeinformasjon",
    icon: UserSearch,
    description: "Kundenavn, org.nr, kontakt, telefon, e-post",
    fields: [
      { label: "Kundenavn", type: "short_text", field_key: "kundenavn", is_required: true },
      { label: "Org.nr", type: "org_number", field_key: "org_nr" },
      { label: "Kontaktperson hos kunde", type: "short_text", field_key: "kontaktperson_kunde" },
      { label: "Telefon kunde", type: "phone", field_key: "telefon_kunde" },
      { label: "E-post kunde", type: "email", field_key: "epost_kunde" },
    ],
  },
  {
    id: "order_location",
    label: "Oppdragssted",
    icon: MapPin,
    description: "Anleggsadresse og fakturaadresse",
    fields: [
      { label: "Oppdragssted", type: "short_text", field_key: "oppdragssted", is_required: true },
      { label: "Anleggsadresse", type: "address", field_key: "anleggsadresse", is_required: true },
      { label: "Fakturaadresse", type: "address", field_key: "fakturaadresse" },
      { label: "Fakturamerking", type: "short_text", field_key: "fakturamerking" },
    ],
  },
  {
    id: "material_responsibility",
    label: "Materialansvar",
    icon: Package,
    description: "Hvem skaffer materiell",
    fields: [
      { label: "Hvem skaffer materiell?", type: "radio", field_key: "materialansvar", is_required: true, options: ["MCS Service skaffer alt", "Bestiller / kunde leverer alt", "Deles mellom partene"] },
      { label: "Hva leverer bestiller / kunde?", type: "long_text", field_key: "hva_leverer_bestiller" },
      { label: "Hva må service skaffe?", type: "long_text", field_key: "hva_skaffer_service" },
    ],
  },
  {
    id: "attachments_pack",
    label: "Vedleggspakke",
    icon: Upload,
    description: "Tegninger, bilder, materialliste, FDV",
    fields: [
      { label: "Tegninger", type: "file_upload", field_key: "vedlegg_tegninger" },
      { label: "Bilder", type: "image_upload", field_key: "vedlegg_bilder" },
      { label: "Materialliste", type: "file_upload", field_key: "vedlegg_materialliste" },
      { label: "FDV-dokumentasjon", type: "file_upload", field_key: "vedlegg_fdv" },
    ],
  },
  {
    id: "intern_kontroll",
    label: "Intern kontroll",
    icon: FileCheck,
    description: "Sjekkliste for interne bestillinger",
    fields: [
      { label: "Kundeinfo er kontrollert", type: "yes_no", field_key: "kundeinfo_kontrollert" },
      { label: "Anleggsadresse er kontrollert", type: "yes_no", field_key: "anleggsadresse_kontrollert" },
      { label: "Tegninger er vedlagt eller vurdert", type: "yes_no", field_key: "tegninger_vurdert" },
      { label: "Materialbehov er avklart", type: "yes_no", field_key: "materialbehov_avklart" },
      { label: "PO / referanse er avklart", type: "yes_no", field_key: "po_avklart" },
      { label: "Bestillingen er klar for planlegging", type: "yes_no", field_key: "klar_for_planlegging" },
    ],
  },
];

interface OrderFieldPaletteProps {
  onAddField: (type: OrderFormFieldType, sectionId: string) => void;
  onAddBlock: (block: FieldBlock, sectionId: string) => void;
  activeSectionId: string | null;
}

export function OrderFieldPalette({ onAddField, onAddBlock, activeSectionId }: OrderFieldPaletteProps) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"fields" | "blocks">("fields");
  const q = search.toLowerCase();

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-border space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Feltbibliotek</h3>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Søk felt..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setTab("fields")}
            className={`flex-1 px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
              tab === "fields" ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            Felt
          </button>
          <button
            onClick={() => setTab("blocks")}
            className={`flex-1 px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
              tab === "blocks" ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            <Blocks className="h-3 w-3 inline mr-0.5" />
            Blokker
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {tab === "fields" ? (
          CATEGORIES.map((cat) => {
            const filtered = cat.types.filter(
              (t) => !q || t.label.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
            );
            if (filtered.length === 0) return null;
            return (
              <div key={cat.label}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  {cat.label}
                </p>
                <div className="space-y-1">
                  {filtered.map((ft) => {
                    const Icon = FIELD_ICONS[ft.type];
                    return (
                      <button
                        key={ft.type}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("order-field-type", ft.type);
                          e.dataTransfer.effectAllowed = "copy";
                        }}
                        onClick={() => activeSectionId && onAddField(ft.type, activeSectionId)}
                        disabled={!activeSectionId}
                        className="w-full flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all cursor-grab active:cursor-grabbing active:scale-[0.98] select-none disabled:opacity-40 disabled:cursor-not-allowed"
                        title={ft.description}
                      >
                        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div className="flex-1 text-left min-w-0">
                          <span className="truncate block">{ft.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        ) : (
          <div className="space-y-2">
            {FIELD_BLOCKS.filter(
              (b) => !q || b.label.toLowerCase().includes(q) || b.description.toLowerCase().includes(q)
            ).map((block) => {
              const Icon = block.icon;
              return (
                <button
                  key={block.id}
                  onClick={() => activeSectionId && onAddBlock(block, activeSectionId)}
                  disabled={!activeSectionId}
                  className="w-full flex items-start gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-left hover:border-primary/30 hover:bg-primary/5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold">{block.label}</span>
                      <Badge variant="outline" className="text-[9px]">{block.fields.length} felt</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{block.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!activeSectionId && (
        <div className="p-3 border-t border-border">
          <p className="text-[10px] text-muted-foreground text-center">
            Velg en seksjon i skjemaet for å legge til felt
          </p>
        </div>
      )}
    </div>
  );
}

export { FIELD_ICONS, FIELD_BLOCKS };
