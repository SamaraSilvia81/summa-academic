// supabase/functions/external-search/index.ts
//
// Proxy server-side para as APIs externas do Farol.
// Existe porque as APIs externas não devolvem `Access-Control-Allow-Origin`,
// então o navegador bloqueia o fetch direto — rodando no servidor (Deno,
// sem CORS de browser) isso não é um problema.
//
// Deploy:
//   supabase functions deploy external-search --project-ref rmxxvpqkbeyorvyxydmn

const ALLOWED_HOSTS = [
  // Papers acadêmicos
  'export.arxiv.org',
  'api.semanticscholar.org',
  // Comunidades / notícias tech
  'hn.algolia.com',              // Hacker News (via Algolia)
  'dev.to',                      // Dev.to
  'medium.com',                  // Medium (feed RSS por tag)
  'rss.medium.com',              // Medium RSS alternativo
  'public.api.bsky.app',         // Bluesky (API pública, sem auth)
];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'missing url' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const parsed = new URL(url);
    if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
      return new Response(JSON.stringify({ error: `host não permitido: ${parsed.hostname}` }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const upstream = await fetch(parsed.toString(), {
      headers: {
        'User-Agent': 'summa-sh-farol/1.0 (mailto:samarasilvia.dev@gmail.com)',
        // Dev.to precisa de Accept: application/json
        'Accept': parsed.hostname === 'dev.to'
          ? 'application/json'
          : 'text/html,application/xhtml+xml,application/xml,application/json,*/*',
      },
    });
    const body = await upstream.text();

    return new Response(JSON.stringify({ status: upstream.status, body }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
