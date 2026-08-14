/**
 * Local product image slots for the public product showcase.
 *
 * RULES
 * - Only rights-cleared images that Lier VPS has permission to use.
 * - Never hotlink supplier/manufacturer images, never scrape.
 * - When no local file exists the card falls back to our own illustration.
 *
 * WHERE TO PUT FILES
 *   src/assets/lier/products/mitsubishi/<file>
 *   src/assets/lier/products/panasonic/<file>
 *   src/assets/lier/products/toshiba/<file>
 *   src/assets/lier/products/<file>            (brand-independent solutions)
 *
 * The file *base name* must match the key in PRODUCT_IMAGE_KEY below.
 * Sub-folder is only for tidiness — lookup is by base name.
 * See src/assets/lier/products/README.md for naming and dimensions.
 */

const modules = import.meta.glob(
  "../../assets/lier/products/**/*.{png,jpg,jpeg,webp,svg}",
  { eager: true, query: "?url", import: "default" }
) as Record<string, string>;

const pointers = import.meta.glob("../../assets/lier/products/**/*.asset.json", {
  eager: true,
  import: "default",
}) as Record<string, { url: string }>;

function baseName(path: string) {
  return path
    .split("/")
    .pop()!
    .replace(/\.asset\.json$/, "")
    .replace(/\.[^.]+$/, "");
}

const IMAGES: Record<string, string> = {};
for (const [path, url] of Object.entries(modules)) IMAGES[baseName(path)] = url;
for (const [path, ptr] of Object.entries(pointers)) {
  if (ptr?.url) IMAGES[baseName(path)] = ptr.url;
}

/** Model/series name -> expected local file base name (without extension). */
export const PRODUCT_IMAGE_KEY: Record<string, string> = {
  "UWANO Pure": "mitsubishi-uwano-pure",
  Kaiteki: "mitsubishi-kaiteki",
  GUSSURI: "mitsubishi-gussuri",
  IGURU: "mitsubishi-iguru",
  Furo: "mitsubishi-furo",
  Zen: "mitsubishi-zen",
  "Duo-modellen": "mitsubishi-duo-modellen",
  "Nordic Multi": "mitsubishi-nordic-multi",
  "Panasonic HZ Flagship": "panasonic-hz-flagship",
  "Panasonic NZ": "panasonic-nz-etherea",
  "Panasonic NZ Etherea": "panasonic-nz-etherea",
  "Panasonic CZ": "panasonic-cz",
  "Panasonic LZ": "panasonic-lz-retro-fit",
  "Panasonic LZ Retro Fit": "panasonic-lz-retro-fit",
  "Panasonic Multisplitt": "panasonic-multisplitt",
  "Panasonic VZ Heatcharge": "panasonic-vz-heatcharge",
  "Panasonic Gulvmodell": "panasonic-gulvmodell",
  "Toshiba Signatur": "toshiba-signatur",
  "Toshiba Daiseikai 10 Kontur": "toshiba-daiseikai-10-kontur",
  "Toshiba Daiseikai 10 Ask": "toshiba-daiseikai-10-ask",
  "Toshiba Seiya": "toshiba-seiya-nordic",
  "Toshiba Multisplitt Nordic": "toshiba-multi-nordic",
  "Toshiba Polar": "toshiba-polar",
  "Toshiba Gulvmodell": "toshiba-gulvmodell",
};

/** Look up a locally stored image by its asset base name (imageKey). */
export function productImageForKey(key: string): string | null {
  return IMAGES[key] ?? null;
}

/** True when a locally stored, rights-cleared image exists for the key. */
export function hasProductImage(key: string): boolean {
  return Boolean(IMAGES[key]);
}

export function productImageFor(name: string): string | null {
  const key = PRODUCT_IMAGE_KEY[name];
  if (key && IMAGES[key]) return IMAGES[key];
  return null;
}

/** Internal helper: which slots are still empty (used by docs/QA, not rendered). */
export function missingProductImageKeys(): string[] {
  return Object.values(PRODUCT_IMAGE_KEY).filter((k) => !IMAGES[k]);
}

/* ------------------------------------------------------------------ *
 * Multi-image support
 * ------------------------------------------------------------------ */

export type ResolvedImage = {
  key: string;
  src: string;
  alt: string;
  type: "primary" | "indoor" | "outdoor" | "lifestyle" | "detail" | "variant";
};

type ImageSpec = {
  key: string;
  type: ResolvedImage["type"];
  alt: string;
  status: "local_approved" | "needs_approval" | "missing";
};

const TYPE_ORDER: Record<ResolvedImage["type"], number> = {
  primary: 0,
  indoor: 1,
  outdoor: 2,
  detail: 3,
  variant: 4,
  lifestyle: 5,
};

/**
 * Resolve a product's gallery to locally stored files only.
 *
 * Order of precedence:
 *  1. `images[]` entries that resolve to a local asset (primary first)
 *  2. legacy `imageKey`
 *  3. name lookup in PRODUCT_IMAGE_KEY
 *
 * Entries without a local file are dropped, so missing secondary images
 * never produce a broken image icon.
 */
export function resolveProductGallery(opts: {
  name: string;
  images?: ImageSpec[];
  imageKey?: string;
  imageAlt?: string;
  /** Pre-resolved src (e.g. a bundled illustration passed from the showcase item). */
  directSrc?: string | null;
}): ResolvedImage[] {
  const alt = opts.imageAlt ?? `${opts.name} varmepumpe`;
  const out: ResolvedImage[] = [];
  const seen = new Set<string>();

  const push = (img: ResolvedImage) => {
    if (seen.has(img.src)) return;
    seen.add(img.src);
    out.push(img);
  };

  for (const spec of opts.images ?? []) {
    const src = IMAGES[spec.key];
    if (!src) continue;
    push({ key: spec.key, src, alt: spec.alt || alt, type: spec.type });
  }

  out.sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type]);

  if (!out.length) {
    const fallbackKey = opts.imageKey ?? PRODUCT_IMAGE_KEY[opts.name];
    const src =
      (fallbackKey ? IMAGES[fallbackKey] : null) ?? opts.directSrc ?? null;
    if (src) push({ key: fallbackKey ?? opts.name, src, alt, type: "primary" });
  } else if (opts.directSrc) {
    // keep an explicitly provided image available in the gallery too
    push({ key: `${opts.name}-direct`, src: opts.directSrc, alt, type: "detail" });
  }

  return out;
}
