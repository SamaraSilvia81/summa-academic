/**
 * Templates LaTeX para o Summa.sh
 * Cada template define: preâmbulo, seções padrão e metadados.
 */

export const TEMPLATES = {
  ieee: {
    id: 'ieee',
    name: 'IEEE Conference',
    description: 'Formato padrão para conferências IEEE (IEEEtran)',
    color: '#60A5FA',
    sections: [
      { level: 1, title: 'Abstract', required: true },
      { level: 1, title: 'Introduction', required: true },
      { level: 1, title: 'Related Work', required: true },
      { level: 1, title: 'Methodology', required: true },
      { level: 2, title: 'Research Questions', required: false },
      { level: 2, title: 'Data Collection', required: false },
      { level: 2, title: 'Analysis Procedure', required: false },
      { level: 1, title: 'Results', required: true },
      { level: 1, title: 'Discussion', required: false },
      { level: 1, title: 'Threats to Validity', required: false },
      { level: 1, title: 'Conclusion', required: true },
      { level: 1, title: 'References', required: true },
    ],
    preamble: `\\documentclass[conference]{IEEEtran}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath,amssymb,amsfonts}
\\usepackage{graphicx}
\\usepackage{textcomp}
\\usepackage{xcolor}
\\usepackage{cite}
\\usepackage{url}
\\usepackage{listings}
\\usepackage{booktabs}

\\lstset{
  basicstyle=\\ttfamily\\small,
  breaklines=true,
  frame=single,
  numbers=left,
  numberstyle=\\tiny\\color{gray}
}`,
    documentStart: `\\title{%%TITLE%%}
\\author{%%AUTHOR%%}
\\maketitle`,
  },

  acm: {
    id: 'acm',
    name: 'ACM Conference',
    description: 'Formato ACM (acmart) para SIGSOFT, ICSE, etc.',
    color: '#F472B6',
    sections: [
      { level: 1, title: 'Abstract', required: true },
      { level: 1, title: 'CCS Concepts', required: true },
      { level: 1, title: 'Keywords', required: true },
      { level: 1, title: 'Introduction', required: true },
      { level: 1, title: 'Background', required: false },
      { level: 1, title: 'Related Work', required: true },
      { level: 1, title: 'Approach', required: true },
      { level: 2, title: 'Study Design', required: false },
      { level: 2, title: 'Data Analysis', required: false },
      { level: 1, title: 'Evaluation', required: true },
      { level: 1, title: 'Discussion', required: false },
      { level: 1, title: 'Threats to Validity', required: false },
      { level: 1, title: 'Conclusion', required: true },
      { level: 1, title: 'Acknowledgments', required: false },
      { level: 1, title: 'References', required: true },
    ],
    preamble: `\\documentclass[sigconf,review]{acmart}
\\usepackage[utf8]{inputenc}
\\usepackage{booktabs}
\\usepackage{listings}
\\usepackage{graphicx}

\\lstset{
  basicstyle=\\ttfamily\\small,
  breaklines=true,
  frame=single
}`,
    documentStart: `\\title{%%TITLE%%}
\\author{%%AUTHOR%%}
\\maketitle`,
  },

  sbc: {
    id: 'sbc',
    name: 'SBC (Sociedade Brasileira de Computação)',
    description: 'Formato SBC para SBSC, SBES, CBSoft, etc.',
    color: '#4ADE80',
    sections: [
      { level: 1, title: 'Resumo', required: true },
      { level: 1, title: 'Abstract', required: true },
      { level: 1, title: 'Introdução', required: true },
      { level: 1, title: 'Fundamentação Teórica', required: true },
      { level: 1, title: 'Trabalhos Relacionados', required: true },
      { level: 1, title: 'Metodologia', required: true },
      { level: 2, title: 'Questões de Pesquisa', required: false },
      { level: 2, title: 'Coleta de Dados', required: false },
      { level: 1, title: 'Resultados', required: true },
      { level: 1, title: 'Discussão', required: false },
      { level: 1, title: 'Ameaças à Validade', required: false },
      { level: 1, title: 'Conclusão', required: true },
      { level: 1, title: 'Referências', required: true },
    ],
    preamble: `\\documentclass[12pt]{article}
\\usepackage{sbc-template}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[brazil]{babel}
\\usepackage{graphicx}
\\usepackage{url}
\\usepackage{listings}
\\usepackage{booktabs}

\\lstset{
  basicstyle=\\ttfamily\\small,
  breaklines=true,
  frame=single,
  language=Java
}`,
    documentStart: `\\title{%%TITLE%%}
\\author{%%AUTHOR%%}
\\address{%%INSTITUTION%%}
\\maketitle`,
  },

  free: {
    id: 'free',
    name: 'Livre',
    description: 'Sem template — estrutura livre, exporta como article básico',
    color: '#D4A030',
    sections: [],
    preamble: `\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[brazil]{babel}
\\usepackage{graphicx}
\\usepackage{url}
\\usepackage{listings}
\\usepackage{booktabs}
\\usepackage{amsmath}
\\usepackage{hyperref}

\\lstset{
  basicstyle=\\ttfamily\\small,
  breaklines=true,
  frame=single
}`,
    documentStart: `\\title{%%TITLE%%}
\\author{%%AUTHOR%%}
\\date{\\today}
\\maketitle`,
  },
};

/**
 * Retorna as seções padrão de um template como conteúdo TipTap JSON
 * pra preencher o editor quando o pesquisador seleciona um template novo.
 */
export function getTemplateSkeleton(templateId) {
  const tpl = TEMPLATES[templateId];
  if (!tpl || tpl.sections.length === 0) return null;

  const content = tpl.sections
    .filter(s => s.required)
    .map(s => ({
      type: 'heading',
      attrs: { level: s.level === 1 ? 2 : 3 },
      content: [{ type: 'text', text: s.title }],
    }))
    .flatMap(heading => [
      heading,
      { type: 'paragraph', content: [{ type: 'text', text: '' }] },
    ]);

  return { type: 'doc', content };
}

export function getTemplateList() {
  return Object.values(TEMPLATES).map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    color: t.color,
    sectionCount: t.sections.filter(s => s.required).length,
  }));
}

/**
 * Catálogo de modelos de referência (Overleaf) usado na tela de
 * "novo documento" pra deixar o pesquisador escolher a variante exata
 * antes de começar a escrever. Cada entrada aponta pra família de
 * engine (ieee | acm | sbc | free) que já existe em TEMPLATES acima —
 * isso decide o preâmbulo/seções usadas de fato no editor e na
 * exportação .tex. O campo `overleafUrl` é só uma referência externa
 * pro pesquisador conferir o layout original antes de decidir.
 */
export const TEMPLATE_CATALOG = {
  ieee: {
    label: 'IEEE',
    color: '#60A5FA',
    engine: 'ieee',
    items: [
      {
        id: 'ieee-conference',
        previewImg: '/templates/ieee-conference.png',
        name: 'IEEE Conference Template',
        description: 'Modelo padrão two-column pra artigos de conferência IEEE.',
        overleafUrl: 'https://www.overleaf.com/latex/templates/ieee-conference-template/grfzhhncsfqn',
      },
      {
        id: 'ieee-computer-society',
        previewImg: '/templates/ieee-computer-society.png',
        name: 'IEEE Computer Society (Demo)',
        description: 'Variante do IEEEtran pra conferências ligadas à IEEE Computer Society.',
        overleafUrl: 'https://www.overleaf.com/latex/templates/ieee-demo-template-for-computer-society-conferences/hzzszpqfkqky',
      },
      {
        id: 'ieee-photonics-journal',
        previewImg: '/templates/ieee-photonics-journal.png',
        name: 'IEEE Photonics Journal',
        description: 'Exemplo de submissão pro periódico IEEE Photonics Journal.',
        overleafUrl: 'https://www.overleaf.com/latex/examples/ieee-photonics-journal-paper-template-example-submission/bsfjjfkdsjds',
      },
      {
        id: 'ieee-journal-bibtex',
        previewImg: '/templates/ieee-journal-bibtex.png',
        name: 'IEEE Journals (com BibTeX)',
        description: 'Modelo IEEEtran pra periódicos, já com exemplo de referências via BibTeX.',
        overleafUrl: 'https://www.overleaf.com/latex/templates/ieee-for-journals-template-with-bibtex-example-files-included/hjbyjvncdmpx',
      },
    ],
  },
  sbc: {
    label: 'SBC',
    color: '#4ADE80',
    engine: 'sbc',
    items: [
      {
        id: 'sbc-book-chapter',
        name: 'SBC Book Chapters',
        description: 'Instruções e modelo pra capítulos de livro publicados pela SBC.',
        overleafUrl: 'https://www.overleaf.com/latex/templates/instructions-for-authors-of-sbc-book-chapters/yyfwffnhzzkg',
      },
      {
        id: 'sbc-sbrc-2017',
        name: 'SBC / SBRC 2017',
        description: 'Modelo sbc.sty usado em edições do SBRC.',
        overleafUrl: 'https://www.overleaf.com/latex/templates/modelo-sbc-slash-sirc-2017/mfgmqqgpdnzw',
      },
      {
        id: 'sbc-sbgames',
        name: 'SBGames (SBC)',
        description: 'Template SBC adaptado pros anais do SBGames.',
        overleafUrl: 'https://www.overleaf.com/latex/templates/template-artigos-sbgames-sol-sbc/fxzgpzwkvmxy',
      },
      {
        id: 'sbc-reviews-2025',
        name: 'SBC Reviews 2025',
        description: 'Modelo atualizado (2025) pra artigos de revisão SBC.',
        overleafUrl: 'https://www.overleaf.com/latex/templates/template-sbc-reviews-2025/qvbgfsxjsksb',
      },
      {
        id: 'sbcm-2019',
        name: 'SBCM 2019',
        description: 'Template do Simpósio Brasileiro de Computação Musical.',
        overleafUrl: 'https://www.overleaf.com/latex/templates/sbcm-2019-template/cwfhkndcwwcp',
      },
      {
        id: 'sbc-conferences-updated',
        name: 'SBC Conferences (sbc.sty v2017)',
        description: 'Versão atualizada do template genérico de conferências SBC.',
        overleafUrl: 'https://www.overleaf.com/latex/templates/sbc-conferences-template-updated-sbc-template-dot-sty-v2017/pyhttxftxjqn',
      },
      {
        id: 'jbcs',
        name: 'JBCS (Journal of the Brazilian Computer Society)',
        description: 'Template oficial do periódico JBCS.',
        overleafUrl: 'https://www.overleaf.com/latex/templates/journal-of-the-brazilian-computer-society-jbcs-template/btxkntxmhtbr',
      },
    ],
  },
  acm: {
    label: 'ACM',
    color: '#F472B6',
    engine: 'acm',
    items: [
      {
        id: 'acm-sigplan',
        name: 'ACM SIGPLAN Proceedings',
        description: 'Template acmart pra anais SIGPLAN.',
        overleafUrl: 'https://www.overleaf.com/latex/templates/association-for-computing-machinery-acm-sigplan-proceedings-template/rfvsrhgmghtc',
      },
      {
        id: 'acm-hypertext',
        name: 'ACM Hypertext Conference',
        description: 'Template acmart usado na conferência ACM Hypertext.',
        overleafUrl: 'https://www.overleaf.com/latex/templates/acm-hypertext-conference-template/pchbkqfnmxgr',
      },
    ],
  },
  poster: {
    label: 'Pôster',
    color: '#D4A030',
    engine: 'free',
    items: [
      {
        id: 'poster-ut-austin',
        name: 'UT Austin Poster',
        description: 'Template não-oficial de pôster acadêmico da UT Austin.',
        overleafUrl: 'https://www.overleaf.com/latex/templates/unofficial-poster-template-for-ut-austin/xkbhsgxbwyxv',
      },
      {
        id: 'poster-uzh',
        name: 'UZH Poster',
        description: 'Template de pôster da Universidade de Zurique.',
        overleafUrl: 'https://www.overleaf.com/latex/templates/uzh-poster-template/ypwsnptqzmfy',
      },
      {
        id: 'poster-nottingham',
        name: 'Nottingham Geomechanics',
        description: 'Template de pôster do Nottingham Centre for Geomechanics.',
        overleafUrl: 'https://www.overleaf.com/latex/templates/poster-template-for-nottingham-centre-for-geomechanics/tmpkbjdnxwrr',
      },
      {
        id: 'poster-hylangtech',
        name: 'HyLangTech Poster',
        description: 'Template de pôster usado pelo grupo HyLangTech.',
        overleafUrl: 'https://www.overleaf.com/latex/templates/hylangtech-postertemplate/hnrppvmhxnwm',
      },
      {
        id: 'poster-minimalist',
        name: 'Minimalist Poster',
        description: 'Template de pôster minimalista, layout limpo em blocos.',
        overleafUrl: 'https://www.overleaf.com/latex/templates/minimalist-poster/cnkpgqgwkkwf',
      },
    ],
  },
};

export function getTemplateCatalog() {
  return TEMPLATE_CATALOG;
}