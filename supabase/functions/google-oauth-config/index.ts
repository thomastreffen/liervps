import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

function maskClientId(clientId: string) {
  if (!clientId) return '<empty>';
  if (clientId.length <= 18) return `${clientId.slice(0, 4)}…${clientId.slice(-4)}`;
  return `${clientId.slice(0, 8)}…${clientId.slice(-24)}`;
}

Deno.serve((req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID') ?? '';

  console.info('[google-oauth-config] returning config', {
    configured: !!clientId,
    client_id: maskClientId(clientId),
  });

  return new Response(
    JSON.stringify({ client_id: clientId, configured: !!clientId }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    },
  );
});
