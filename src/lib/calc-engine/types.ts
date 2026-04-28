// Felles typer for kalkylemotoren

export type FieldType =
  | "text" | "number" | "percent" | "date" | "boolean"
  | "select" | "multiselect" | "lookup" | "derived";

export interface PackageFieldOption {
  value: string;
  label: string;
}

export interface PackageField {
  id: string;
  package_id: string;
  field_key: string;
  label: string;
  field_type: FieldType;
  unit: string | null;
  is_required: boolean;
  default_value: any;
  options: PackageFieldOption[];
  section_key: string;
  help_text: string | null;
  sort_order: number;
}

export interface CalcPackage {
  id: string;
  company_id: string | null;
  slug: string;
  name: string;
  category: string;
  description: string | null;
  version: number;
  is_active: boolean;
  default_sections: { key: string; label: string; sort: number }[];
}

export interface RateRow {
  rate_key: string;
  label: string | null;
  value: number;
  unit: string | null;
  context: Record<string, any>;
}

export interface RateTable {
  id: string;
  name: string;
  version: number;
  rows: RateRow[];
}

export interface NormRow {
  element_key: string;
  label: string | null;
  hours: number;
  unit: string;
  context: Record<string, any>;
}

export interface NormTable {
  id: string;
  name: string;
  version: number;
  rows: NormRow[];
}

export type LineSource = "rule" | "component" | "manual" | "adjustment";

export interface CalcLine {
  line_key?: string;
  source_type: LineSource;
  source_ref?: string;
  description: string;
  qty: number;
  unit?: string;
  norm_hours: number;       // ujusterte timer
  adjusted_hours: number;   // etter faktorer
  cost_amount: number;
  sales_amount: number;
  is_internal_only: boolean;
  metadata?: Record<string, any>;
  sort_order: number;
}

export interface CalcTotals {
  total_norm_hours: number;
  total_adjusted_hours: number;
  total_cost: number;
  total_sales: number;
  margin_amount: number;
  margin_pct: number;
  applied_factors: { key: string; label: string; value: number }[];
}

export interface CalcResult {
  lines: CalcLine[];
  totals: CalcTotals;
}

export type CalcInput = Record<string, any>;

export interface CalcContext {
  input: CalcInput;
  rateTable: RateTable;
  normTable: NormTable;
}

export type CalcEvaluator = (ctx: CalcContext) => CalcResult;
