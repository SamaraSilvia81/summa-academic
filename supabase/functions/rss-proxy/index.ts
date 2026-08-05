// supabase/functions/rss-proxy/index.ts
//
// Proxy server-side para feeds RSS/Atom genéricos.
// Dois modos de operação:
//   1. "discover" — recebe URL de um site, busca <link rel="alternate"> no HTML
//                   e retorna a(s) URL(s) de feed encontradas.
//   2. "fetch"    — recebe URL de feed RSS/Atom, valida que o conteúdo é XML
//                   de feed válido, e retorna o corpo.
//
// Separado do external-search pra não abrir o allowlist daquela função.
// A validação aqui é: o conteúdo retornado precisa ser XML com tags de
// RSS (<rss>, <channel>) ou Atom (<feed>). Se não for, retorna erro.
//
// Deploy:
//   supabase functions deploy rss-proxy --project-ref rmxxvpqkbeyorvyxydmn

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const USER_AGENT = 'summa-sh-farol/1.0 (mailto:samarasilvia.dev@gmail.com)';

// ── Helpers ──────────────────────────────────────────────────────

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

/** Extrai URLs de feeds a partir do HTML de uma página. */
function extractFeedUrls(html: string, baseUrl: string): Array<{ url: string; title: string }> {
  const feeds: Array<{ url: string; title: string }> = [];
  const base = new URL(baseUrl);

  // Regex pra <link rel="alternate" type="application/rss+xml" ...> e atom
  const linkPattern = /<link\s[^>]*rel=["']alternate["'][^>]*>/gi;
  const matches = html.match(linkPattern) || [];

  for (const tag of matches) {
    // Filtra só feeds (RSS ou Atom)
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
      // Resolve URLs relativas
      try {
        feedUrl = new URL(feedUrl, base).toString();
      } catch {
        continue;
      }
      feeds.push({
        url: feedUrl,
        title: titleMatch ? titleMatch[1] : feedUrl,
      });
    }
  }

  // Fallback: tenta caminhos comuns se não achou nenhum <link>
  if (feeds.length === 0) {
    const commonPaths = ['/feed', '/rss', '/feed.xml', '/rss.xml', '/atom.xml', '/index.xml'];
    for (const path of commonPaths) {
      feeds.push({
        url: new URL(path, base).toString(),
        title: `${base.hostname}${path}`,
      });
    }
  }

  return feeds;
}

// ── Main handler ─────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { mode, url } = await req.json();

    if (!url || typeof url !== 'string') {
      return jsonResponse({ error: 'campo url é obrigatório' }, 400);
    }

    // Validação mínima de URL
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return jsonResponse({ error: 'URL inválida' }, 400);
    }

    // Bloqueia URLs internas/privadas
    if (['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname) || parsed.hostname.endsWith('.local')) {
      return jsonResponse({ error: 'URLs locais não são permitidas' }, 403);
    }

    // ── MODO DISCOVER ──────────────────────────────────────────
    if (mode === 'discover') {
      const response = await fetch(parsed.toString(), {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,*/*',
        },
        redirect: 'follow',
      });

      if (!response.ok) {
        return jsonResponse({ error: `Site retornou ${response.status}` }, 502);
      }

      const html = await response.text();

      // Primeiro checa se a própria URL já é um feed
      if (looksLikeFeed(html)) {
        return jsonResponse({
          feeds: [{ url: parsed.toString(), title: 'Feed direto' }],
          isDirect: true,
        });
      }

      // Se não, procura <link rel="alternate"> no HTML
      const feeds = extractFeedUrls(html, parsed.toString());

      // Valida os feeds do fallback (common paths) tentando fetch rápido
      const validatedFeeds: Array<{ url: string; title: string }> = [];
      for (const feed of feeds) {
        // Se veio de <link>, confia que existe
        if (!feed.title.includes('/feed') && !feed.title.includes('/rss') && !feed.title.includes('/atom')) {
          validatedFeeds.push(feed);
          continue;
        }
        // Se é fallback de path comum, faz HEAD pra checar
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
          // ignora path que falhou
        }
      }

      return jsonResponse({ feeds: validatedFeeds, isDirect: false });
    }

    // ── MODO FETCH (default) ───────────────────────────────────
    const response = await fetch(parsed.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return jsonResponse({ error: `Feed retornou ${response.status}` }, 502);
    }

    const body = await response.text();

    // Valida que é realmente um feed e não HTML qualquer
    if (!looksLikeFeed(body)) {
      return jsonResponse(
        { error: 'O conteúdo retornado não parece ser um feed RSS ou Atom válido' },
        422
      );
    }

    return jsonResponse({ status: response.status, body });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : String(err) },
      500
    );
  }
});