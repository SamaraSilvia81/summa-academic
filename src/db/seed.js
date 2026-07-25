import { db } from './schema';





export async function seedDatabase() {
  const count = await db.profiles.count();
  if (count > 0) return; // already seeded

  const now = new Date();
  const daysAgo = (n) => new Date(Date.now() - n * 86400000);

  // ── Profile ──
  const profileId = await db.profiles.add({
    name: 'Sams',
    institution: 'CIn/UFPE',
    program: 'mestrado',
    advisor: 'Prof. Dr. Vinicius Cardoso Garcia',
    areas: ['Microfrontends', 'Dívida Técnica', 'Engenharia de Software'],
    keywords: ['SATD', 'microfrontend', 'technical debt', 'module federation', 'MFE', 'architectural debt', 'self-admitted technical debt', 'frontend architecture'],
    ignoredTerms: ['financial debt', 'national debt', 'student debt'],
    languages: ['pt', 'en'],
    sources: ['semantic_scholar', 'arxiv', 'ieee', 'acm', 'twitter'],
    currentProduction: 'dissertacao',
    mainDeadline: '2027-03-01',
    createdAt: now,
    updatedAt: now
  });

  // ── Settings ──
  await db.settings.add({
    profileId,
    theme: 'dark',
    grain: true,
    scanlines: true,
    accentColor: '#D4A030',
    language: 'pt',
    radarFrequency: 'daily',
    informeDay: 'monday',
    aiModel: null,
    aiApiKey: null
  });

  // ── Tags ──
  const tagData = [
  { profileId, name: 'SATD', color: '#D4A030', category: 'area' },
  { profileId, name: 'MFE', color: '#E8C060', category: 'area' },
  { profileId, name: 'MSR', color: '#B8862A', category: 'method' },
  { profileId, name: 'GQM', color: '#8A7A50', category: 'method' },
  { profileId, name: 'Seminal', color: '#4ADE80', category: 'status' },
  { profileId, name: 'Referência-chave', color: '#F87171', category: 'priority' },
  { profileId, name: 'Metodologia', color: '#60A5FA', category: 'area' },
  { profileId, name: 'Posicionamento', color: '#A78BFA', category: 'custom' }];

  await db.tags.bulkAdd(tagData);

  // ── Sources ──
  const sourceData = [
  { profileId, name: 'Semantic Scholar', type: 'api', url: 'https://api.semanticscholar.org', isActive: true, lastFetchedAt: daysAgo(1), fetchIntervalMinutes: 1440 },
  { profileId, name: 'arXiv', type: 'api', url: 'https://export.arxiv.org/api', isActive: true, lastFetchedAt: daysAgo(1), fetchIntervalMinutes: 1440 },
  { profileId, name: 'Twitter / X', type: 'scraper', url: null, isActive: true, lastFetchedAt: daysAgo(2), fetchIntervalMinutes: 720 },
  { profileId, name: 'ACM Digital Library', type: 'api', url: null, isActive: true, lastFetchedAt: daysAgo(3), fetchIntervalMinutes: 4320 },
  { profileId, name: 'IEEE Xplore', type: 'api', url: null, isActive: true, lastFetchedAt: daysAgo(3), fetchIntervalMinutes: 4320 }];

  await db.sources.bulkAdd(sourceData);

  // ── Radar Items ──
  const radarData = [
  {
    profileId, title: 'Self-admitted technical debt in micro-frontend architectures: a mining study',
    type: 'paper', source: 'semantic_scholar', sourceUrl: 'https://arxiv.org/abs/2026.xxxxx',
    authors: 'Chen, W., López, R., & Tanaka, M.',
    summary: 'Estudo empírico que minera SATD em 312 repositórios MFE, identificando padrões de auto-admissão de dívida técnica em comentários de código e PRs.',
    relevanceScore: 94, relevanceReason: 'Diretamente alinhado com sua pesquisa: SATD + MFE + MSR. Metodologia similar ao seu pipeline.',
    matchedKeywords: ['SATD', 'microfrontend', 'mining'], language: 'en',
    deadline: null, isRead: false, isSaved: false, isDismissed: false,
    fetchedAt: daysAgo(2), publishedAt: daysAgo(5)
  },
  {
    profileId, title: 'Architectural erosion patterns in module federation-based systems',
    type: 'paper', source: 'acm', sourceUrl: null,
    authors: "d'Aragona, D., Ferrucio, F., et al.",
    summary: 'Identifica 7 padrões de erosão arquitetural em sistemas que usam Module Federation, com estudo de caso em 3 empresas europeias.',
    relevanceScore: 91, relevanceReason: 'Referência-chave do seu framework. Mesmo grupo de pesquisa italiano.',
    matchedKeywords: ['module federation', 'architectural debt', 'MFE'], language: 'en',
    deadline: null, isRead: false, isSaved: true, isDismissed: false,
    fetchedAt: daysAgo(3), publishedAt: daysAgo(10)
  },
  {
    profileId, title: 'GQM-based evaluation framework for component-level debt in distributed frontends',
    type: 'paper', source: 'ieee', sourceUrl: null,
    authors: 'Peruma, A., Newman, C., et al.',
    summary: 'Propõe um framework GQM para avaliar dívida técnica em nível de componente em arquiteturas distribuídas de frontend.',
    relevanceScore: 78, relevanceReason: 'Usa GQM como você — pode ser referência metodológica complementar.',
    matchedKeywords: ['GQM', 'technical debt', 'frontend'], language: 'en',
    deadline: null, isRead: false, isSaved: false, isDismissed: false,
    fetchedAt: daysAgo(5), publishedAt: daysAgo(15)
  },
  {
    profileId, title: 'Desafios reais de orquestração em MFE com single-spa e Module Federation',
    type: 'thread', source: 'twitter', sourceUrl: 'https://x.com/nicolo_rivetti/status/xxx',
    authors: '@nicolo_rivetti',
    summary: 'Thread técnica detalhando problemas de orquestração encontrados em produção. 23 respostas com casos reais.',
    relevanceScore: 72, relevanceReason: 'Relatos práticos que podem validar sua categoria "Síndrome da Rejeição de Orquestração".',
    matchedKeywords: ['MFE', 'module federation', 'orquestração'], language: 'en',
    deadline: null, isRead: false, isSaved: false, isDismissed: false,
    fetchedAt: daysAgo(6), publishedAt: daysAgo(8)
  },
  {
    profileId, title: 'MSR 2027 — Mining Software Repositories',
    type: 'cfp', source: 'manual', sourceUrl: 'https://conf.researchr.org/home/msr-2027',
    authors: null,
    summary: 'Conferência top-tier em MSR. Qualis A1. Ideal para seu artigo sobre SATD em MFE.',
    relevanceScore: 96, relevanceReason: 'Conferência exata para o seu paper. Deadline em 2 meses.',
    matchedKeywords: ['MSR', 'mining'], language: 'en',
    deadline: '2026-08-15', isRead: false, isSaved: true, isDismissed: false,
    fetchedAt: daysAgo(1), publishedAt: null
  },
  {
    profileId, title: 'ICSE 2027 — Workshop on Technical Debt',
    type: 'cfp', source: 'manual', sourceUrl: null,
    authors: null,
    summary: 'Workshop específico sobre dívida técnica no ICSE. Qualis A1.',
    relevanceScore: 89, relevanceReason: 'Workshop dedicado ao tema central da sua pesquisa.',
    matchedKeywords: ['technical debt'], language: 'en',
    deadline: '2026-09-30', isRead: false, isSaved: false, isDismissed: false,
    fetchedAt: daysAgo(1), publishedAt: null
  },
  {
    profileId, title: 'Micro-frontends: a reality check after 5 years of adoption',
    type: 'post', source: 'manual', sourceUrl: null,
    authors: 'Martin Fowler (blog)',
    summary: 'Reflexão sobre o estado atual de MFE em produção, com dados de adoção e problemas recorrentes.',
    relevanceScore: 68, relevanceReason: 'Visão panorâmica que pode contextualizar sua introdução.',
    matchedKeywords: ['microfrontend'], language: 'en',
    deadline: null, isRead: true, isSaved: false, isDismissed: false,
    fetchedAt: daysAgo(10), publishedAt: daysAgo(20)
  }];

  await db.radarItems.bulkAdd(radarData);

  // ── References (Acervo) ──
  const refData = [
  {
    profileId, title: 'Self-Admitted Technical Debt in Open-Source Software',
    authors: 'Potdar, A., & Shihab, E.', venue: 'ICSME', year: 2014,
    doi: '10.1109/ICSME.2014.31', url: null, type: 'paper_read', qualis: 'A1',
    tags: ['SATD', 'MSR', 'Seminal'], personalNote: 'Definição original de SATD — base para minha taxonomia expandida.',
    rating: 5, isRead: true, isFavorite: true, createdAt: daysAgo(120)
  },
  {
    profileId, title: 'Dívida técnica como lente diagnóstica em MFE: uma proposta de framework',
    authors: 'Sabino, S.S.', venue: 'Em progresso', year: 2026,
    doi: null, url: null, type: 'my_article', qualis: null,
    tags: ['MFE', 'SATD', 'GQM'], personalNote: 'Artigo principal do mestrado — cap. 4 em andamento.',
    rating: null, isRead: true, isFavorite: true, createdAt: daysAgo(60)
  },
  {
    profileId, title: 'Mining Software Repositories for Technical Debt',
    authors: 'Peruma, A., Newman, C., et al.', venue: 'MSR', year: 2022,
    doi: null, url: null, type: 'paper_read', qualis: 'A1',
    tags: ['MSR', 'Metodologia'], personalNote: 'Referência metodológica principal.',
    rating: 4, isRead: true, isFavorite: false, createdAt: daysAgo(90)
  },
  {
    profileId, title: 'Architectural Technical Debt in Micro-Frontends',
    authors: "d'Aragona, D., et al.", venue: 'MSR', year: 2024,
    doi: null, url: null, type: 'paper_read', qualis: 'A1',
    tags: ['MFE', 'Referência-chave'], personalNote: 'Estudo mais próximo do meu. Escola italiana.',
    rating: 5, isRead: true, isFavorite: true, createdAt: daysAgo(80)
  }];

  await db.references.bulkAdd(refData);

  // ── Document (artigo em progresso) ──
  await db.documents.add({
    profileId, title: 'Dívida Técnica como Lente Diagnóstica para Desafios Arquiteturais em Sistemas de Microfrontend',
    type: 'article', status: 'writing',
    content: '<h2>4. Resultados Preliminares</h2><p>A análise do dataset MFE-OSS (n=455) revela padrões significativos de auto-admissão de dívida técnica em repositórios com arquiteturas de microfrontend.</p>',
    currentSection: '4. Resultados Preliminares',
    wordCount: 4250, tags: ['MFE', 'SATD', 'GQM'],
    createdAt: daysAgo(45), updatedAt: daysAgo(1)
  });

  // ── Notes (NP) ──
  const noteData = [
  {
    profileId, documentId: 1, type: 'np',
    content: 'A relação entre SATD e complexidade modular em sistemas MFE sugere que a dívida de interface alotrópica pode ser um indicador precoce de erosão arquitetural.',
    source: 'bancada/artigo_mfe_satd.tex', isPinned: true, createdAt: new Date()
  },
  {
    profileId, documentId: 1, type: 'np',
    content: 'Projetos com 20+ módulos MFE apresentam 5× mais PRs e 9× mais issues abertas — confirma hipótese de que granularidade excessiva amplifica overhead de manutenção.',
    source: 'dataset/análise exploratória', isPinned: false, createdAt: daysAgo(1)
  },
  {
    profileId, documentId: null, type: 'postit',
    content: 'Comparar escola escandinava (qualitativa) vs italiana/holandesa (quantitativa) na fundamentação.',
    source: null, isPinned: true, createdAt: daysAgo(3)
  }];

  await db.notes.bulkAdd(noteData);

  // ── Tasks ──
  const taskData = [
  { profileId, documentId: 1, title: 'Finalizar seção 4.2 — Taxonomia Emergente', description: null, status: 'doing', priority: 'high', deadline: daysAgo(-7), tags: ['escrita'], createdAt: daysAgo(5), completedAt: null },
  { profileId, documentId: 1, title: 'Rodar análise de regressão no dataset MFE-OSS', description: null, status: 'todo', priority: 'high', deadline: daysAgo(-14), tags: ['análise'], createdAt: daysAgo(3), completedAt: null },
  { profileId, documentId: null, title: 'Revisar paper de d\'Aragona (MSR 2024)', description: null, status: 'done', priority: 'medium', deadline: null, tags: ['leitura'], createdAt: daysAgo(10), completedAt: daysAgo(2) },
  { profileId, documentId: null, title: 'Preparar submissão MSR 2027', description: 'Deadline: 15 ago 2026', status: 'backlog', priority: 'urgent', deadline: new Date('2026-08-15'), tags: ['submissão'], createdAt: daysAgo(1), completedAt: null }];

  await db.tasks.bulkAdd(taskData);

  console.log('[summa.sh] ✦ database seeded successfully');
}