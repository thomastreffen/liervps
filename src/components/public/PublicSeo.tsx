import { Helmet } from "react-helmet-async";

export const SITE_URL = "https://liervps.no";
export const SITE_NAME = "Lier Varmepumpeservice AS";

interface Props {
  title: string;
  description: string;
  path: string;
  jsonLd?: object | object[];
}

export function PublicSeo({ title, description, path, jsonLd }: Props) {
  const fullUrl = `${SITE_URL}${path}`;
  const fullTitle = title.includes("Lier") ? title : `${title} | Lier VPS`;
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
