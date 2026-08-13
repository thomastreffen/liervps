export function useBrandLogos(): Record<string, string | null> {
  const modules = import.meta.glob<string>("../../assets/lier/brands/*.{png,svg,jpg,jpeg,webp}", {
    eager: true,
    import: "default",
  });

  const logos: Record<string, string | null> = {
    "Mitsubishi Electric": null,
    Panasonic: null,
    Toshiba: null,
  };

  Object.entries(modules).forEach(([path, url]) => {
    const filename = path.split("/").pop() ?? "";
    const base = filename.replace(/\.[^.]+$/, "").toLowerCase();

    if (base.includes("mitsubishi")) {
      logos["Mitsubishi Electric"] = url;
    } else if (base.includes("panasonic")) {
      logos.Panasonic = url;
    } else if (base.includes("toshiba")) {
      logos.Toshiba = url;
    }
  });

  return logos;
}
