import { Helmet } from "react-helmet-async";

export const SITE_URL = "https://mcsservice.no";
export const SITE_NAME = "MCS Service";

interface Props {
  title: string;
  description: string;
  path: string;
  jsonLd?: object | object[];
}

export function PublicSeo({ title, description, path, jsonLd }: Props) {
  const fullUrl = `${SITE_URL}${path}`;
  const fullTitle = title.includes("MCS Service") ? title : `${title} | MCS Service`;
  const schemas = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];
  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={fullUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={fullUrl} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(s)}</script>
      ))}
    </Helmet>
  );
}

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}${it.path}`,
    })),
  };
}

export function serviceSchema(name: string, description: string, path: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name,
    description,
    provider: {
      "@type": "LocalBusiness",
      name: "MCS Service",
      url: SITE_URL,
      telephone: "+47 45 70 70 73",
      email: "post@mcsservice.no",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Orkidèhøgda 2A",
        postalCode: "3050",
        addressLocality: "Mjøndalen",
        addressCountry: "NO",
      },
    },
    areaServed: "Norway",
    url: `${SITE_URL}${path}`,
  };
}
