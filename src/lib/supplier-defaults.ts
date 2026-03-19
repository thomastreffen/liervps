/**
 * Standard FTP/sFTP connection defaults for known Norwegian wholesalers.
 * These are suggestions only – users can override everything.
 */

export interface SupplierDefaults {
  protocol: "ftp" | "ftps" | "sftp";
  host: string;
  port: number;
  remote_base_path: string;
  catalog_file_pattern?: string;
  price_file_pattern?: string;
  discount_file_pattern?: string;
}

export const SUPPLIER_DEFAULTS: Record<string, SupplierDefaults> = {
  ONNINEN: {
    protocol: "ftp",
    host: "ftp.onninen.no",
    port: 21,
    remote_base_path: "/",
    catalog_file_pattern: "*.csv",
    price_file_pattern: "*pris*.csv",
    discount_file_pattern: "*rabatt*.csv",
  },
  SOLAR: {
    protocol: "sftp",
    host: "b2bs.solar.eu",
    port: 22,
    remote_base_path: "/",
    catalog_file_pattern: "*.csv",
    price_file_pattern: "*price*.csv",
    discount_file_pattern: "*discount*.csv",
  },
  AHLSELL: {
    protocol: "sftp",
    host: "sftp.ahlsell.no",
    port: 22,
    remote_base_path: "/",
    catalog_file_pattern: "*.csv",
    price_file_pattern: "*pris*.csv",
    discount_file_pattern: "*rabatt*.csv",
  },
  SONEPAR: {
    protocol: "sftp",
    host: "sftp.sonepar.no",
    port: 22,
    remote_base_path: "/",
    catalog_file_pattern: "*.csv",
    price_file_pattern: "*pris*.csv",
    discount_file_pattern: "*rabatt*.csv",
  },
};

export function getSupplierDefaults(code: string): SupplierDefaults | null {
  return SUPPLIER_DEFAULTS[code.toUpperCase()] ?? null;
}
