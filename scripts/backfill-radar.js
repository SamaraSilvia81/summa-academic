// backfill-radar.js (Versão com DOMParser correto para Node.js)
import { createClient } from '@supabase/supabase-js';
import { DOMParser } from '@xmldom/xmldom'; // ⭐ Substitui o DOMParser do navegador

// ⚙️ Configure suas credenciais do Supabase aqui
const SUPABASE_URL = 'https://rmxxvpqkbeyorvyxydmn.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'SUA_SERVICE_ROLE_KEY_AQUI'; 
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const KEYWORDS = ['microfrontend'];

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function fetchViaProxy(url) {
  console.log(`🔄 Proxy buscando: ${url}`);
  const { data, error } = await supabase.functions.invoke('external-search', { body: { url } });
  if (error) throw new Error(`Proxy retornou erro: ${error.message || error}`);
  if (data?.status >= 400) throw new Error(`Proxy retornou ${data.status}`);
  return data.body;
}

async function mineArxiv() {
  console.log('🚀 Iniciando mineração do ArXiv...');
  let start = 0;
  const limit = 100;
  let totalFetched = 0;

  while (true) {
    const query = KEYWORDS.map(k => `all:"${k}"`).join(' OR ');
    const url = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&sortBy=submittedDate&sortOrder=descending&start=${start}&max_results=${limit}`;
    
    try {
      const xml = await fetchViaProxy(url);
      // ⭐ Usando o DOMParser do pacote @xmldom/xmldom
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      const entries = doc.querySelectorAll('entry');

      if (entries.length === 0) {
        console.log(`✅ ArXiv finalizado. Total minerado: ${totalFetched}`);
        break;
      }

      const batch = Array.from(entries).map(entry => ({
        title: entry.querySelector('title')?.textContent?.trim() || 'Sem título',
        sourceUrl: entry.querySelector('id')?.textContent?.trim() || null,
        authors: Array.from(entry.querySelectorAll('author > name')).map(n => n.textContent).filter(Boolean).join(', '),
        summary: entry.querySelector('summary')?.textContent?.trim() || '',
        type: 'paper',
        source: 'arxiv',
        publishedAt: entry.querySelector('published')?.textContent?.trim() ? new Date(entry.querySelector('published').textContent) : null,
        relevanceScore: 70,
        relevanceReason: 'Minerado via script de backfill histórico',
        language: 'en',
        isRead: false,
        isSaved: false,
        isDismissed: false,
        profileId: 'SEU_PROFILE_ID_AQUI', 
        fetchedAt: new Date()
      }));

      const { error } = await supabase.from('radar_items').upsert(batch, { onConflict: 'sourceUrl', ignoreDuplicates: true });
      if (error) console.error('Erro ao inserir no Supabase:', error);
      else {
        totalFetched += batch.length;
        console.log(`✅ Lote ${start/limit + 1}: ${batch.length} inseridos. Total: ${totalFetched}`);
      }

      start += limit;
      await sleep(1500);
    } catch (err) {
      console.error('❌ Erro no ArXiv:', err.message);
      break;
    }
  }
}

async function mineSemanticScholar() {
  console.log('🚀 Iniciando mineração do Semantic Scholar...');
  let offset = 0;
  const limit = 100;
  let totalFetched = 0;

  while (true) {
    const query = KEYWORDS.join(' ');
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&fields=title,abstract,authors,url,publicationDate&limit=${limit}&offset=${offset}`;
    
    try {
      const raw = await fetchViaProxy(url);
      const data = JSON.parse(raw);

      if (!data.data || data.data.length === 0) {
        console.log(`✅ Semantic Scholar finalizado. Total minerado: ${totalFetched}`);
        break;
      }

      const batch = data.data.map(paper => ({
        title: paper.title || 'Sem título',
        sourceUrl: paper.url || null,
        authors: (paper.authors || []).map(a => a.name).join(', ') || null,
        summary: paper.abstract || '',
        type: 'paper',
        source: 'semantic_scholar',
        publishedAt: paper.publicationDate ? new Date(paper.publicationDate) : null,
        relevanceScore: 70,
        relevanceReason: 'Minerado via script de backfill histórico',
        language: 'en',
        isRead: false,
        isSaved: false,
        isDismissed: false,
        profileId: 'SEU_PROFILE_ID_AQUI', 
        fetchedAt: new Date()
      }));

      const { error } = await supabase.from('radar_items').upsert(batch, { onConflict: 'sourceUrl', ignoreDuplicates: true });
      if (error) console.error('Erro ao inserir no Supabase:', error);
      else {
        totalFetched += batch.length;
        console.log(`✅ Lote ${offset/limit + 1}: ${batch.length} inseridos. Total: ${totalFetched}`);
      }

      offset += limit;
      await sleep(1500);
    } catch (err) {
      console.error('❌ Erro no Semantic Scholar:', err.message);
      break;
    }
  }
}

(async () => {
  console.log('🛠️ Iniciando Backfill Histórico (2010-2026)...');
  await mineArxiv();
  await mineSemanticScholar();
  console.log('✨ Backfill concluído! Agora abra o Farol, vá em Filtros > Data > Qualquer para ver seu acervo!');
})();