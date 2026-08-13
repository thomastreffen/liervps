import mitsubishiLogo from "../../assets/lier/brands/mitsubishi-electric-logo.png.asset.json";
import panasonicLogo from "../../assets/lier/brands/panasonic-logo.png.asset.json";
import toshibaLogo from "../../assets/lier/brands/toshiba-logo.png.asset.json";

export function useBrandLogos(): Record<string, string | null> {
  return {
    "Mitsubishi Electric": mitsubishiLogo.url,
    Panasonic: panasonicLogo.url,
    Toshiba: toshibaLogo.url,
  };
}

/** Per-brand sizing so no logo visually dominates. */
export const BRAND_LOGO_CLASS: Record<string, string> = {
  "Mitsubishi Electric": "max-h-10 max-w-[170px]",
  Panasonic: "max-h-11 max-w-[175px]",
  Toshiba: "max-h-6 max-w-[140px]",
};

export const BRAND_STRIP_LOGO_CLASS: Record<string, string> = {
  "Mitsubishi Electric": "h-6 max-w-[110px]",
  Panasonic: "h-7 max-w-[120px]",
  Toshiba: "h-auto max-w-[95px]",
};
