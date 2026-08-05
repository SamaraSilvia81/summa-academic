// supabase/functions/external-search/index.ts
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  // Responde requisições CORS (Pre-flight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    
    if (!url || typeof url !== 'string') {
      // Retorna 200 mesmo se vier URL inválida, para não quebrar o cliente
      return new Response(JSON.stringify({ error: 'URL inválida' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`🔄 external-search acessando: ${url}`);

    const response = await fetch(url, {
      headers: { 'User-Agent': 'summa-sh-farol/1.0' },
      // Adiciona timeout de 15 segundos para não travar se a API externa demorar
      signal: AbortSignal.timeout(15000),
    });

    const body = await response.text();
    
    // ⭐ Retorna SEMPRE status 200, colocando o status real da API dentro do JSON!
    return new Response(JSON.stringify({ status: response.status, body }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('❌ Erro interno do proxy:', err.message);
    
    // Mesmo em erro interno, retorna 200 para o Node não quebrar
    return new Response(JSON.stringify({ error: err.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});