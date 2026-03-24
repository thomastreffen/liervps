import { useState } from "react";
import {
  Type, AlignLeft, Hash, Calendar, Clock, Mail, Phone, MapPin, Building2,
  ChevronDown, CircleDot, CheckSquare, ListChecks, Upload, Image, Search,
  Users, FolderSearch, UserSearch, Info, Heading, Timer, Package, FileCheck,
  Blocks, User, FileText, Briefcase, Receipt, Wrench, ClipboardList,
  Star, ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { OrderFormFieldType } from "@/types/order-forms";

export const FIELD_ICONS: Record<OrderFormFieldType, React.ElementType> = {
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

// ── Business Presets ──

export interface BusinessPreset {
  id: string;
  label: string;
  icon: React.ElementType;
  fieldType: OrderFormFieldType;
  fieldKey: string;
  helpText?: string;
  options?: string[];
  isRequired?: boolean;
}

const BUSINESS_PRESETS: BusinessPreset[] = [
  { id: "firmanavn", label: "Firmanavn", icon: Building2, fieldType: "short_text", fieldKey: "firmanavn", helpText: "Navn på firma / kunde" },
  { id: "kontaktperson", label: "Kontaktperson", icon: User, fieldType: "short_text", fieldKey: "kontaktperson", helpText: "Navn på kontaktperson hos kunde" },
  { id: "epost_kunde", label: "E-post kunde", icon: Mail, fieldType: "email", fieldKey: "epost_kunde", helpText: "E-postadresse til kontaktperson" },
  { id: "telefon_kunde", label: "Telefon kunde", icon: Phone, fieldType: "phone", fieldKey: "telefon_kunde", helpText: "Telefonnummer til kontaktperson" },
  { id: "fakturamottaker", label: "Fakturamottaker", icon: Receipt, fieldType: "short_text", fieldKey: "fakturamottaker", helpText: "Hvem skal motta faktura?" },
  { id: "fakturaadresse", label: "Fakturaadresse", icon: MapPin, fieldType: "address", fieldKey: "fakturaadresse", helpText: "Adresse for fakturering" },
  { id: "fakturamerking", label: "Fakturamerking / PO", icon: FileText, fieldType: "short_text", fieldKey: "fakturamerking", helpText: "PO-nummer, referanse eller annen fakturamerking" },
  { id: "oppdragssted", label: "Oppdragssted", icon: MapPin, fieldType: "short_text", fieldKey: "oppdragssted", helpText: "Navn på anlegg eller oppdragssted", isRequired: true },
  { id: "anleggsadresse", label: "Anleggsadresse", icon: MapPin, fieldType: "address", fieldKey: "anleggsadresse", helpText: "Adresse der arbeidet skal utføres", isRequired: true },
  { id: "referanse_po", label: "Referanse / PO", icon: FileText, fieldType: "short_text", fieldKey: "referanse_po", helpText: "Innkjøpsordrenummer, prosjektreferanse eller intern referanse" },
  { id: "arbeidsbeskrivelse", label: "Arbeidsbeskrivelse", icon: ClipboardList, fieldType: "long_text", fieldKey: "arbeidsbeskrivelse", helpText: "Beskriv hva som skal utføres så detaljert som mulig", isRequired: true },
  { id: "materialansvar", label: "Materialansvar", icon: Package, fieldType: "radio", fieldKey: "materialansvar", helpText: "Angi hvem som skaffer materiell", options: ["Service skaffer alt", "Bestiller leverer alt", "Deles mellom partene"], isRequired: true },
  { id: "oensket_dato", label: "Ønsket utført dato", icon: Calendar, fieldType: "date", fieldKey: "oensket_dato", helpText: "Når ønsker du at arbeidet skal utføres?" },
];

/** Look up a preset by id – used by canvas on drop */
export function getPresetById(presetId: string): BusinessPreset | undefined {
  return BUSINESS_PRESETS.find(p => p.id === presetId);
}

// ── Field Blocks ──

export interface FieldBlock {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
  fields: { label: string; type: OrderFormFieldType; field_key: string; is_required?: boolean; help_text?: string; options?: string[]; field_width?: string }[];
}

const FIELD_BLOCKS: FieldBlock[] = [
  {
    id: "customer_info",
    label: "Kundeinformasjon",
    icon: UserSearch,
    description: "Firmanavn, org.nr, kontaktperson, telefon, e-post",
    fields: [
      { label: "Firmanavn", type: "short_text", field_key: "firmanavn", is_required: true, help_text: "Navn på firma / kunde", field_width: "half" },
      { label: "Org.nr", type: "org_number", field_key: "org_nr", help_text: "Organisasjonsnummer", field_width: "half" },
      { label: "Kontaktperson", type: "short_text", field_key: "kontaktperson_kunde", help_text: "Navn på kontaktperson hos kunde", field_width: "half" },
      { label: "E-post kunde", type: "email", field_key: "epost_kunde", help_text: "E-postadresse til kontaktperson", field_width: "half" },
      { label: "Telefon kunde", type: "phone", field_key: "telefon_kunde", help_text: "Telefonnummer til kontaktperson", field_width: "half" },
    ],
  },
  {
    id: "faktura_info",
    label: "Fakturainformasjon",
    icon: Receipt,
    description: "Fakturamottaker, fakturaadresse, PO/referanse",
    fields: [
      { label: "Fakturamottaker", type: "short_text", field_key: "fakturamottaker", help_text: "Hvem skal motta faktura?", field_width: "half" },
      { label: "Fakturamerking / PO", type: "short_text", field_key: "fakturamerking", help_text: "PO-nummer, referanse eller annen merking", field_width: "half" },
      { label: "Fakturaadresse", type: "address", field_key: "fakturaadresse", help_text: "Adresse for fakturering" },
    ],
  },
  {
    id: "order_location",
    label: "Oppdragssted",
    icon: MapPin,
    description: "Oppdragssted og anleggsadresse",
    fields: [
      { label: "Oppdragssted", type: "short_text", field_key: "oppdragssted", is_required: true, help_text: "Navn på anlegg eller oppdragssted" },
      { label: "Anleggsadresse", type: "address", field_key: "anleggsadresse", is_required: true, help_text: "Adresse der arbeidet skal utføres" },
    ],
  },
  {
    id: "kontaktperson_blokk",
    label: "Kontaktperson",
    icon: User,
    description: "Kontaktperson med telefon og e-post",
    fields: [
      { label: "Kontaktperson", type: "short_text", field_key: "kontaktperson", is_required: true, help_text: "Navn på kontaktperson", field_width: "half" },
      { label: "Telefon", type: "phone", field_key: "kontakt_telefon", help_text: "Telefonnummer", field_width: "half" },
      { label: "E-post", type: "email", field_key: "kontakt_epost", help_text: "E-postadresse" },
    ],
  },
  {
    id: "referanse_po_blokk",
    label: "Referanse og PO",
    icon: FileText,
    description: "PO-nummer, midlertidig referanse og intern referanse",
    fields: [
      { label: "PO / Innkjøpsordre", type: "short_text", field_key: "po_nummer", help_text: "Innkjøpsordrenummer fra kunde" },
      { label: "Midlertidig referanse", type: "short_text", field_key: "midlertidig_referanse", help_text: "Bruk dette dersom PO ikke er klar ennå" },
      { label: "Intern referanse", type: "short_text", field_key: "intern_referanse", help_text: "Eventuell intern referanse" },
    ],
  },
  {
    id: "material_responsibility",
    label: "Material og ansvar",
    icon: Package,
    description: "Hvem skaffer materiell og hva som trengs",
    fields: [
      { label: "Hvem skaffer materiell?", type: "radio", field_key: "materialansvar", is_required: true, options: ["Service skaffer alt", "Bestiller leverer alt", "Deles mellom partene"], help_text: "Angi tydelig materialansvar" },
      { label: "Hva leverer bestiller / kunde?", type: "long_text", field_key: "hva_leverer_bestiller", help_text: "Beskriv hva bestiller/kunde leverer av materiell" },
      { label: "Hva må service skaffe?", type: "long_text", field_key: "hva_skaffer_service", help_text: "Beskriv hva service må skaffe" },
    ],
  },
  {
    id: "attachments_pack",
    label: "Vedleggspakke",
    icon: Upload,
    description: "Tegninger, bilder, materialliste, FDV",
    fields: [
      { label: "Tegninger", type: "file_upload", field_key: "vedlegg_tegninger", help_text: "Last opp reviderte tegninger" },
      { label: "Bilder", type: "image_upload", field_key: "vedlegg_bilder", help_text: "Last opp relevante bilder fra anlegget" },
      { label: "Materialliste", type: "file_upload", field_key: "vedlegg_materialliste", help_text: "Last opp materialliste hvis tilgjengelig" },
      { label: "FDV-dokumentasjon", type: "file_upload", field_key: "vedlegg_fdv", help_text: "Last opp FDV-dokumentasjon" },
    ],
  },
  {
    id: "intern_kontroll",
    label: "Intern kontroll",
    icon: FileCheck,
    description: "Sjekkliste for kvalitetskontroll av bestillingen",
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

// ── Generic field categories (shown under "Avansert") ──

interface FieldCategory {
  label: string;
  types: { type: OrderFormFieldType; label: string; description: string }[];
}

const ADVANCED_CATEGORIES: FieldCategory[] = [
  {
    label: "Tekstfelt",
    types: [
      { type: "short_text", label: "Kort tekst", description: "Brukes til firmanavn, kontaktperson, referanse osv." },
      { type: "long_text", label: "Lang tekst", description: "Brukes til arbeidsbeskrivelse, merknader osv." },
      { type: "number", label: "Tall", description: "Numerisk verdi" },
    ],
  },
  {
    label: "Dato og tid",
    types: [
      { type: "date", label: "Dato", description: "Datovelger" },
      { type: "time", label: "Klokkeslett", description: "Tidspunkt" },
      { type: "time_window", label: "Tidsvindu", description: "Fra–til tidspunkt" },
    ],
  },
  {
    label: "Kontaktinfo",
    types: [
      { type: "email", label: "E-post", description: "E-postadresse" },
      { type: "phone", label: "Telefon", description: "Telefonnummer" },
      { type: "address", label: "Adresse", description: "Brukes til anleggsadresse, fakturaadresse osv." },
      { type: "org_number", label: "Org.nr", description: "Organisasjonsnummer" },
    ],
  },
  {
    label: "Valgfelt",
    types: [
      { type: "dropdown", label: "Nedtrekksliste", description: "Velg ett alternativ fra liste" },
      { type: "radio", label: "Radioknapper", description: "Velg ett av flere synlige valg" },
      { type: "yes_no", label: "Ja / Nei", description: "Enkelt ja/nei-valg" },
      { type: "checkbox_list", label: "Sjekkliste", description: "Huk av flere alternativer" },
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
    label: "Systemoppslag",
    types: [
      { type: "customer_lookup", label: "Velg kunde fra systemet", description: "Søk og velg eksisterende kunde. Kan autofylle navn, adresse, org.nr." },
      { type: "project_lookup", label: "Velg prosjekt fra systemet", description: "Koble bestillingen til et eksisterende prosjekt" },
      { type: "user_lookup", label: "Velg bruker / ansatt", description: "Velg intern bruker, f.eks. prosjektleder eller ansvarlig" },
    ],
  },
  {
    label: "Layout",
    types: [
      { type: "section_header", label: "Seksjonsoverskrift", description: "Visuell gruppering av felt" },
      { type: "info_box", label: "Infoboks", description: "Hjelpetekst eller informasjon til utfyller" },
    ],
  },
];

// ── Component ──

export interface OrderFieldPaletteProps {
  onAddField: (type: OrderFormFieldType, sectionId: string, preset?: { label: string; fieldKey: string; helpText?: string; options?: string[]; isRequired?: boolean }) => void;
  onAddBlock: (block: FieldBlock, sectionId: string) => void;
  activeSectionId: string | null;
}

export function OrderFieldPalette({ onAddField, onAddBlock, activeSectionId }: OrderFieldPaletteProps) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"business" | "advanced" | "blocks">("business");
  const [advancedOpen, setAdvancedOpen] = useState<Record<string, boolean>>({});
  const q = search.toLowerCase();

  const filteredPresets = BUSINESS_PRESETS.filter(
    p => !q || p.label.toLowerCase().includes(q) || (p.helpText?.toLowerCase().includes(q))
  );

  const handlePresetClick = (preset: BusinessPreset) => {
    if (!activeSectionId) return;
    onAddField(preset.fieldType, activeSectionId, {
      label: preset.label,
      fieldKey: preset.fieldKey,
      helpText: preset.helpText,
      options: preset.options,
      isRequired: preset.isRequired,
    });
  };

  const handleAdvancedClick = (type: OrderFormFieldType) => {
    if (!activeSectionId) return;
    onAddField(type, activeSectionId);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
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
            onClick={() => setTab("business")}
            className={`flex-1 px-2 py-1.5 text-[10px] font-medium rounded-md transition-colors ${
              tab === "business" ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            <Star className="h-3 w-3 inline mr-0.5 -mt-px" />
            Bestillingsfelt
          </button>
          <button
            onClick={() => setTab("blocks")}
            className={`flex-1 px-2 py-1.5 text-[10px] font-medium rounded-md transition-colors ${
              tab === "blocks" ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            <Blocks className="h-3 w-3 inline mr-0.5 -mt-px" />
            Blokker
          </button>
          <button
            onClick={() => setTab("advanced")}
            className={`flex-1 px-2 py-1.5 text-[10px] font-medium rounded-md transition-colors ${
              tab === "advanced" ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            Avansert
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">

        {/* ── Business presets tab ── */}
        {tab === "business" && (
          <>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Vanlige bestillingsfelt
            </p>
            <p className="text-[10px] text-muted-foreground mb-2">
              Dra eller klikk for å legge til. Hvert felt har ferdig label og hjelpetekst.
            </p>
            <div className="space-y-1">
              {filteredPresets.map((preset) => {
                const Icon = preset.icon;
                return (
                  <button
                    key={preset.id}
                    draggable
                    onDragStart={(e) => {
                      // Store full preset data so canvas can pass it back
                      e.dataTransfer.setData("order-field-type", preset.fieldType);
                      e.dataTransfer.setData("order-preset-data", JSON.stringify({
                        label: preset.label,
                        fieldKey: preset.fieldKey,
                        helpText: preset.helpText,
                        options: preset.options,
                        isRequired: preset.isRequired,
                      }));
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => handlePresetClick(preset)}
                    disabled={!activeSectionId}
                    className="w-full flex items-center gap-2.5 rounded-lg border border-border bg-card px-2.5 py-2 text-left hover:border-primary/30 hover:bg-primary/5 transition-all cursor-grab active:cursor-grabbing active:scale-[0.98] select-none disabled:opacity-40 disabled:cursor-not-allowed"
                    title={preset.helpText}
                  >
                    <Icon className="h-4 w-4 text-primary/70 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium block truncate">{preset.label}</span>
                      {preset.helpText && (
                        <span className="text-[10px] text-muted-foreground block truncate">{preset.helpText}</span>
                      )}
                    </div>
                    {preset.isRequired && (
                      <Badge variant="outline" className="text-[8px] px-1 py-0 shrink-0 border-orange-300 text-orange-600">Påkrevd</Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* ── Blocks tab ── */}
        {tab === "blocks" && (
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground mb-1">
              Legg til en ferdig sammensatt gruppe med flere felt.
            </p>
            {FIELD_BLOCKS.filter(
              (b) => !q || b.label.toLowerCase().includes(q) || b.description.toLowerCase().includes(q)
            ).map((block) => {
              const Icon = block.icon;
              return (
                <button
                  key={block.id}
                  onClick={() => activeSectionId && onAddBlock(block, activeSectionId)}
                  disabled={!activeSectionId}
                  className="w-full flex items-start gap-2.5 rounded-lg border border-border bg-card px-2.5 py-2.5 text-left hover:border-primary/30 hover:bg-primary/5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Icon className="h-4 w-4 text-primary/70 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium block">{block.label}</span>
                    <span className="text-[10px] text-muted-foreground block">{block.description}</span>
                    <span className="text-[9px] text-muted-foreground/60 mt-0.5 block">{block.fields.length} felt</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Advanced tab ── */}
        {tab === "advanced" && (
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground mb-1">
              Generiske felttyper for avansert bruk. Dra eller klikk for å legge til.
            </p>
            {ADVANCED_CATEGORIES.map((cat) => {
              const filtered = cat.types.filter(
                (t) => !q || t.label.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
              );
              if (filtered.length === 0) return null;
              const isOpen = advancedOpen[cat.label] !== false;
              return (
                <Collapsible key={cat.label} open={isOpen} onOpenChange={(v) => setAdvancedOpen((p) => ({ ...p, [cat.label]: v }))}>
                  <CollapsibleTrigger className="flex items-center gap-1.5 w-full text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-1 hover:text-foreground transition-colors">
                    {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    {cat.label}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-0.5 mt-1">
                    {filtered.map((ft) => {
                      const Icon = FIELD_ICONS[ft.type] || Type;
                      return (
                        <button
                          key={ft.type}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("order-field-type", ft.type);
                            e.dataTransfer.effectAllowed = "copy";
                          }}
                          onClick={() => handleAdvancedClick(ft.type)}
                          disabled={!activeSectionId}
                          className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/60 transition-colors cursor-grab active:cursor-grabbing select-none disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-[11px] font-medium block truncate">{ft.label}</span>
                            <span className="text-[9px] text-muted-foreground block truncate">{ft.description}</span>
                          </div>
                        </button>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
