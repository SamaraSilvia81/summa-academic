import {
  ArrowLeft, FloppyDisk, FileText, FileMd,
  TextB, TextItalic, TextStrikethrough,
  ListBullets, ListNumbers, Code, Quotes,
  Table, Link, Eye, EyeSlash,
  MarkdownLogo,
} from '@phosphor-icons/react';
import styles from './EditorToolbar.module.css';

// ── Phosphor doesn't have a dedicated .tex icon — we use a text label ──

export function EditorToolbar({
  editor,
  doc,
  saveStatus,
  onBack,
  onSave,
  onExportLatex,
  previewOpen,
  onTogglePreview,
  editorMode = 'md',
  onModeToggle,
  wordCount = 0,
  mdMode = false,
}) {
  const STATUS_COLORS = {
    draft: '#60A5FA', writing: '#A78BFA', review: '#F472B6',
    submitted: '#D4A030', published: '#D4A030',
  };
  const STATUS_LABELS = {
    draft: 'draft', writing: 'writing', review: 'revisão',
    submitted: 'enviado', published: 'publicado',
  };

  const statusColor = STATUS_COLORS[doc?.status] || '#60A5FA';
  const statusLabel = STATUS_LABELS[doc?.status] || 'draft';

  // ── Insert table (tex mode only) ─────────────────────────────────
  function insertTable() {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }

  return (
    <div className={styles.toolbar}>
      {/* ── Back ── */}
      <button className={styles.backBtn} onClick={onBack} title="voltar para a bancada">
        <ArrowLeft size={14} />
        <span>bancada</span>
      </button>

      {/* ── Doc title ── */}
      <span className={styles.docTitle} title={doc?.title}>{doc?.title || 'sem título'}</span>

      {/* ── Mode toggle (md / tex) ── */}
      <div className={styles.modeToggle}>
        <button
          className={`${styles.modeBtn} ${editorMode === 'md' ? styles.modeBtnActive : ''}`}
          onClick={() => onModeToggle('md')}
          title="modo markdown — editor de texto puro com preview ao vivo"
        >
          <MarkdownLogo size={14} weight={editorMode === 'md' ? 'fill' : 'regular'} />
          .md
        </button>
        <button
          className={`${styles.modeBtn} ${editorMode === 'tex' ? styles.modeBtnActive : ''}`}
          onClick={() => onModeToggle('tex')}
          title="modo LaTeX — editor WYSIWYG com templates IEEE / ACM / SBC"
        >
          <span className={styles.texIcon}>TeX</span>
        </button>
      </div>

      <div className={styles.sep} />

      {/* ── Formatting tools (tex mode only, editor available) ── */}
      {editorMode === 'tex' && editor && (
        <>
          <div className={styles.group}>
            <ToolBtn
              icon={<TextB size={15} weight="bold" />}
              active={editor.isActive('bold')}
              onClick={() => editor.chain().focus().toggleBold().run()}
              title="negrito"
            />
            <ToolBtn
              icon={<TextItalic size={15} />}
              active={editor.isActive('italic')}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              title="itálico"
            />
            <ToolBtn
              icon={<TextStrikethrough size={15} />}
              active={editor.isActive('strike')}
              onClick={() => editor.chain().focus().toggleStrike().run()}
              title="tachado"
            />
          </div>

          <div className={styles.sep} />

          <div className={styles.group}>
            <ToolBtn
              label="H1"
              active={editor.isActive('heading', { level: 1 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            />
            <ToolBtn
              label="H2"
              active={editor.isActive('heading', { level: 2 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            />
            <ToolBtn
              label="H3"
              active={editor.isActive('heading', { level: 3 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            />
          </div>

          <div className={styles.sep} />

          <div className={styles.group}>
            <ToolBtn
              icon={<ListBullets size={15} />}
              active={editor.isActive('bulletList')}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              title="lista de marcadores"
            />
            <ToolBtn
              icon={<ListNumbers size={15} />}
              active={editor.isActive('orderedList')}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              title="lista numerada"
            />
            <ToolBtn
              icon={<Code size={15} />}
              active={editor.isActive('codeBlock')}
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              title="bloco de código"
            />
            <ToolBtn
              icon={<Quotes size={15} />}
              active={editor.isActive('blockquote')}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              title="citação"
            />
          </div>

          <div className={styles.sep} />

          {/* Table insertion */}
          <div className={styles.group}>
            <ToolBtn
              icon={<Table size={15} />}
              onClick={insertTable}
              title="inserir tabela 3×3"
            />
            {/* Table controls when cursor is inside a table */}
            {editor.isActive('table') && (
              <>
                <ToolBtn label="+ col" onClick={() => editor.chain().focus().addColumnAfter().run()} title="adicionar coluna" />
                <ToolBtn label="+ lin" onClick={() => editor.chain().focus().addRowAfter().run()} title="adicionar linha" />
                <ToolBtn label="− col" onClick={() => editor.chain().focus().deleteColumn().run()} title="remover coluna" />
                <ToolBtn label="− lin" onClick={() => editor.chain().focus().deleteRow().run()} title="remover linha" />
                <ToolBtn label="✕ tab" onClick={() => editor.chain().focus().deleteTable().run()} title="excluir tabela" danger />
              </>
            )}
          </div>
        </>
      )}

      {/* ── Markdown hints (md mode) ── */}
      {editorMode === 'md' && (
        <div className={styles.mdHints}>
          <span className={styles.hint}><code>**negrito**</code></span>
          <span className={styles.hint}><code>*itálico*</code></span>
          <span className={styles.hint}><code># H1</code></span>
          <span className={styles.hint}><code>| col | col |</code> tabela</span>
          <span className={styles.hint}><code>`código`</code></span>
        </div>
      )}

      {/* ── Right side ── */}
      <div className={styles.right}>
        <span className={styles.wordCount}>{wordCount} palavras</span>

        <span
          className={styles.saveStatus}
          style={{
            color: saveStatus.includes('✓')
              ? '#60A5FA'
              : saveStatus.includes('erro') ? '#F87171' : 'var(--tx3)',
          }}
        >
          {saveStatus}
        </span>

        <span className={styles.statusBadge} style={{ color: statusColor, background: `${statusColor}15` }}>
          {statusLabel}
        </span>

        {/* Preview toggle — só no modo tex */}
        {editorMode === 'tex' && (
          <button
            className={`${styles.previewBtn} ${previewOpen ? styles.previewBtnActive : ''}`}
            onClick={onTogglePreview}
            title={previewOpen ? 'fechar preview de template' : 'preview de template'}
          >
            {previewOpen ? <EyeSlash size={14} /> : <Eye size={14} />}
            preview
          </button>
        )}

        <button className={styles.saveBtn} onClick={onSave} title="salvar (Ctrl+S)">
          <FloppyDisk size={14} /> salvar
        </button>

        <button
          className={styles.exportBtn}
          onClick={onExportLatex}
          title={editorMode === 'md' ? 'exportar como .md' : 'exportar como .tex'}
        >
          {editorMode === 'md'
            ? <><FileMd size={14} /> .md</>
            : <><FileText size={14} /> .tex</>
          }
        </button>
      </div>
    </div>
  );
}

// ── Tool button util ─────────────────────────────────────────────

function ToolBtn({ icon, label, onClick, active, title, danger }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`${styles.toolBtn} ${active ? styles.toolBtnActive : ''} ${danger ? styles.toolBtnDanger : ''}`}
    >
      {icon || <span className={styles.toolLabel}>{label}</span>}
    </button>
  );
}