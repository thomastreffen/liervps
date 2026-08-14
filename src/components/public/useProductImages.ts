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
  "Panasonic HZ Flagship": "panasonic-hz",
  "Panasonic NZ": "panasonic-nz",
  "Panasonic VZ Heatcharge": "panasonic-vz",
  "Panasonic Gulvmodell": "panasonic-gulvmodell",
  "Toshiba Signatur": "toshiba-signatur",
  "Toshiba Daiseikai 10 Kontur": "toshiba-daiseikai-kontur",
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
