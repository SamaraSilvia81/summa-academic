import { useMemo } from 'react';
import styles from './TemplatePreview.module.css';

/**
 * TemplatePreview
 * Renderiza o conteúdo do TipTap num layout CSS que simula
 * o template acadêmico selecionado (IEEE two-column, ACM, SBC, Livre).
 * Não compila LaTeX — usa CSS pra aproximar o visual do PDF final.
 */
export function TemplatePreview({ json, template = 'free', docTitle = '', author = '' }) {
  const rendered = useMemo(() => renderNodes(json?.content ?? [], template), [json, template]);

  const layoutClass = LAYOUT_MAP[template] ?? styles.layoutFree;

  return (
    <div className={styles.previewContainer}>
      <div className={styles.previewLabel}>
        <span className={styles.labelDot} style={{ background: TEMPLATE_COLORS[template] }} />
        preview · {TEMPLATE_NAMES[template] ?? 'livre'}
      </div>

      <div className={styles.pageScroller}>
        <div className={`${styles.page} ${layoutClass}`}>
          {/* Header do paper */}
          <div className={styles.paperHeader}>
            {template === 'ieee' && (
              <div className={styles.ieeeConferenceTag}>
                2026 IEEE/ACM International Conference
              </div>
            )}
            {template === 'acm' && (
              <div className={styles.acmConferenceTag}>
                ACM Conference Proceedings
              </div>
            )}
          </div>

          {/* Título */}
          <h1 className={styles.paperTitle}>
            {docTitle || 'Sem título'}
          </h1>

          {/* Autor */}
          <div className={styles.paperAuthor}>
            {author || 'Autor(a)'}
            {(template === 'ieee' || template === 'acm' || template === 'sbc') && (
              <div className={styles.paperInstitution}>CIn/UFPE — Recife, PE, Brasil</div>
            )}
          </div>

          {/* Conteúdo renderizado */}
          <div className={styles.paperBody}>
            {rendered.length > 0 ? rendered : (
              <p className={styles.emptyHint}>
                comece a escrever no editor para visualizar o layout do template aqui.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Constants ──

const TEMPLATE_COLORS = {
  ieee: '#60A5FA',
  acm: '#F472B6',
  sbc: '#4ADE80',
  free: '#D4A030',
};

const TEMPLATE_NAMES = {
  ieee: 'IEEE Conference',
  acm: 'ACM Conference',
  sbc: 'SBC',
  free: 'livre',
};

const LAYOUT_MAP = {};
// Preenchido após import do CSS module — veja abaixo

// ── Renderer: TipTap JSON → React elements ──

let sectionCounter = 0;
let subsectionCounter = 0;

function renderNodes(nodes, template) {
  sectionCounter = 0;
  subsectionCounter = 0;
  return (nodes || []).map((node, i) => renderNode(node, i, template));
}

function renderNode(node, key, template) {
  if (!node) return null;

  switch (node.type) {
    case 'heading': {
      const level = node.attrs?.level ?? 2;
      const text = extractText(node);
      if (!text.trim()) return null;

      if (level <= 2) {
        sectionCounter++;
        subsectionCounter = 0;
        const num = template === 'ieee'
          ? toRoman(sectionCounter) + '.'
          : template === 'acm' || template === 'sbc'
            ? sectionCounter + '.'
            : '';

        return (
          <h2 key={key} className={styles.sectionHeading} data-template={template}>
            {num && <span className={styles.sectionNum}>{num} </span>}
            {text}
          </h2>
        );
      }

      // subsection
      subsectionCounter++;
      const subNum = template === 'ieee'
        ? `${toRoman(sectionCounter)}-${String.fromCharCode(64 + subsectionCounter)}.`
        : template === 'acm' || template === 'sbc'
          ? `${sectionCounter}.${subsectionCounter}`
          : '';

      return (
        <h3 key={key} className={styles.subsectionHeading} data-template={template}>
          {subNum && <span className={styles.sectionNum}>{subNum} </span>}
          {text}
        </h3>
      );
    }

    case 'paragraph': {
      const text = extractText(node);
      if (!text.trim()) return <div key={key} className={styles.emptyPara} />;
      return <p key={key} className={styles.bodyPara}>{renderInline(node)}</p>;
    }

    case 'bulletList':
      return (
        <ul key={key} className={styles.list}>
          {(node.content || []).map((li, j) => (
            <li key={j}>{renderInline(li.content?.[0])}</li>
          ))}
        </ul>
      );

    case 'orderedList':
      return (
        <ol key={key} className={styles.list}>
          {(node.content || []).map((li, j) => (
            <li key={j}>{renderInline(li.content?.[0])}</li>
          ))}
        </ol>
      );

    case 'codeBlock':
      return (
        <pre key={key} className={styles.codeBlock}>
          <code>{extractText(node)}</code>
        </pre>
      );

    case 'blockquote':
      return (
        <blockquote key={key} className={styles.blockquote}>
          {(node.content || []).map((child, j) => renderNode(child, j, template))}
        </blockquote>
      );

    case 'horizontalRule':
      return <hr key={key} className={styles.hr} />;

    default:
      return null;
  }
}

function renderInline(node) {
  if (!node?.content) return null;
  return node.content.map((child, i) => {
    if (child.type === 'text') {
      let el = child.text;
      const marks = child.marks || [];
      for (const mark of marks) {
        if (mark.type === 'bold') el = <strong key={i}>{el}</strong>;
        if (mark.type === 'italic') el = <em key={i}>{el}</em>;
        if (mark.type === 'code') el = <code key={i} className={styles.inlineCode}>{el}</code>;
        if (mark.type === 'strike') el = <s key={i}>{el}</s>;
      }
      return <span key={i}>{el}</span>;
    }
    return null;
  });
}

function extractText(node) {
  if (!node) return '';
  if (node.type === 'text') return node.text || '';
  return (node.content || []).map(extractText).join('');
}

function toRoman(n) {
  const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const syms = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
  let result = '';
  for (let i = 0; i < vals.length; i++) {
    while (n >= vals[i]) { result += syms[i]; n -= vals[i]; }
  }
  return result;
}

// Assign layout classes after module import
LAYOUT_MAP.ieee = styles.layoutIeee;
LAYOUT_MAP.acm = styles.layoutAcm;
LAYOUT_MAP.sbc = styles.layoutSbc;
LAYOUT_MAP.free = styles.layoutFree;
