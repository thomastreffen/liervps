/**
 * Local product image slots.
 *
 * Drop rights-cleared product photos into `src/assets/lier/products/`
 * (e.g. `mitsubishi-uwano-pure.png`) and they are picked up automatically.
 * No external hotlinking, no AI-generated fake product photos — when a file
 * is missing the card falls back to the heat pump illustration.
 */
const modules = import.meta.glob(
  "../../assets/lier/products/*.{png,jpg,jpeg,webp,svg}",
  { eager: true, query: "?url", import: "default" }
) as Record<string, string>;

const pointers = import.meta.glob(
  "../../assets/lier/products/*.asset.json",
  { eager: true, import: "default" }
) as Record<string, { url: string }>;

function baseName(path: string) {
  return path.split("/").pop()!.replace(/\.asset\.json$/, "").replace(/\.[^.]+$/, "");
}

const IMAGES: Record<string, string> = {};
for (const [path, url] of Object.entries(modules)) IMAGES[baseName(path)] = url;
for (const [path, ptr] of Object.entries(pointers)) {
  if (ptr?.url) IMAGES[baseName(path)] = ptr.url;
}

/** Model/series name -> expected local file base name. */
export const PRODUCT_IMAGE_KEY: Record<string, string> = {
  "UWANO Pure": "mitsubishi-uwano-pure",
  Kaiteki: "mitsubishi-kaiteki",
  GUSSURI: "mitsubishi-gussuri",
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

export function productImageFor(name: string): string | null {
  const key = PRODUCT_IMAGE_KEY[name];
  if (key && IMAGES[key]) return IMAGES[key];
  return null;
}
