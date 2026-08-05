// supabase/functions/rss-proxy/index.ts
// Proxy server-side para feeds RSS/Atom.
// Modificado para nunca retornar erro HTTP (só status 200), sempre retornando JSON.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const USER_AGENT = 'summa-sh-farol/1.0 (mailto:samarasilvia.dev@gmail.com)';

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Verifica se o conteúdo parece ser um feed RSS ou Atom válido. */
function looksLikeFeed(text: string): boolean {
  const trimmed = text.trimStart().slice(0, 500).toLowerCase();
  return (
    trimmed.includes('<rss') ||
    trimmed.includes('<feed') ||
    trimmed.includes('<channel') ||
    trimmed.includes('xmlns:atom') ||
    trimmed.includes('xmlns="http://www.w3.org/2005/atom"')
  );
}

function extractFeedUrls(html: string, baseUrl: string): Array<{ url: string; title: string }> {
  const feeds: Array<{ url: string; title: string }> = [];
  const base = new URL(baseUrl);
  const linkPattern = /<link\s[^>]*rel=["']alternate["'][^>]*>/gi;
  const matches = html.match(linkPattern) || [];

  for (const tag of matches) {
    if (
      !tag.includes('application/rss+xml') &&
      !tag.includes('application/atom+xml') &&
      !tag.includes('application/rss') &&
      !tag.includes('application/atom')
    ) {
      continue;
    }

    const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
    const titleMatch = tag.match(/title=["']([^"']+)["']/i);

    if (hrefMatch) {
      let feedUrl = hrefMatch[1];
      try {
        feedUrl = new URL(feedUrl, base).toString();
      } catch {
        continue;
      }
      feeds.push({ url: feedUrl, title: titleMatch ? titleMatch[1] : feedUrl });
    }
  }

  if (feeds.length === 0) {
    const commonPaths = ['/feed', '/rss', '/feed.xml', '/rss.xml', '/atom.xml', '/index.xml'];
    for (const path of commonPaths) {
      feeds.push({ url: new URL(path, base).toString(), title: `${base.hostname}${path}` });
    }
  }

  return feeds;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { mode, url } = await req.json();

    if (!url || typeof url !== 'string') {
      return jsonResponse({ error: 'campo url é obrigatório' }, 200);
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return jsonResponse({ error: 'URL inválida' }, 200);
    }

    if (['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname) || parsed.hostname.endsWith('.local')) {
      return jsonResponse({ error: 'URLs locais não são permitidas' }, 200);
    }

    // ── MODO DISCOVER ──────────────────────────────────────────
    if (mode === 'discover') {
      let html = '';
      try {
        const response = await fetch(parsed.toString(), {
          headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml,*/*' },
          redirect: 'follow',
        });
        if (!response.ok) {
          return jsonResponse({ feeds: [], error: `Site não retornou conteúdo (${response.status})` }, 200);
        }
        html = await response.text();
      } catch (err) {
        return jsonResponse({ feeds: [], error: `Erro ao acessar site: ${err.message}` }, 200);
      }

      if (looksLikeFeed(html)) {
        return jsonResponse({ feeds: [{ url: parsed.toString(), title: 'Feed direto' }], isDirect: true }, 200);
      }

      const feeds = extractFeedUrls(html, parsed.toString());
      const validatedFeeds: Array<{ url: string; title: string }> = [];

      for (const feed of feeds) {
        // Tenta confirmar se o feed existe
        try {
          const check = await fetch(feed.url, {
            method: 'HEAD',
            headers: { 'User-Agent': USER_AGENT },
            redirect: 'follow',
          });
          if (check.ok) {
            const ct = check.headers.get('content-type') || '';
            if (ct.includes('xml') || ct.includes('rss') || ct.includes('atom')) {
              validatedFeeds.push(feed);
            }
          }
        } catch {
           // ignora erro de validação, ainda adiciona se estiver na lista padrão
           validatedFeeds.push(feed);
        }
      }
      // Se não achou nenhum, retorna lista vazia (em vez de erro)
      return jsonResponse({ feeds: validatedFeeds, isDirect: false }, 200);
    }

    // ── MODO FETCH ─────────────────────────────────────────────
    const response = await fetch(parsed.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return jsonResponse({ error: `Feed retornou ${response.status}`, body: null }, 200);
    }

    const body = await response.text();

    if (!looksLikeFeed(body)) {
      return jsonResponse({ error: 'O conteúdo retornado não parece ser um feed válido', body: null }, 200);
    }

    return jsonResponse({ status: response.status, body }, 200);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 200);
  }
});