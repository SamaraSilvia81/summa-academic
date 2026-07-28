import {
  ArrowLeft, FloppyDisk, FileText,
  TextB, TextItalic, TextStrikethrough,
  TextHOne, TextHTwo, TextHThree,
  ListBullets, Code, Quotes, Eye, EyeSlash
} from '@phosphor-icons/react';
import styles from './EditorToolbar.module.css';

export function EditorToolbar({ editor, doc, saveStatus, onBack, onSave, onExportLatex, previewOpen, onTogglePreview }) {
  if (!editor) return null;

  const wordCount = editor.getText().split(/\s+/).filter(Boolean).length;

  const STATUS_COLORS = {
    draft: '#60A5FA', writing: '#A78BFA', review: '#F472B6',
    submitted: '#D4A030', published: '#D4A030',
  };
  const STATUS_LABELS = {
    draft: 'novo', writing: 'escrevendo', review: 'revisão',
    submitted: 'enviado', published: 'publicado',
  };

  const statusColor = STATUS_COLORS[doc?.status] || '#60A5FA';
  const statusLabel = STATUS_LABELS[doc?.status] || 'novo';

  return (
    <div className={styles.toolbar}>
      {/* Voltar */}
      <button className={styles.backBtn} onClick={onBack}>
        <ArrowLeft size={14} />
        <span>voltar</span>
      </button>

      {/* Nome do documento */}
      <span className={styles.docTitle} title={doc?.title}>{doc?.title || 'sem título'}</span>

      <div className={styles.sep} />

      {/* Formatação */}
      <div className={styles.group}>
        <ToolBtn icon={<TextB size={16} />} active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} />
        <ToolBtn icon={<TextItalic size={16} />} active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <ToolBtn icon={<TextStrikethrough size={16} />} active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} />
      </div>

      <div className={styles.sep} />

      {/* Headings */}
      <div className={styles.group}>
        <ToolBtn label="H1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} />
        <ToolBtn label="H2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
        <ToolBtn label="H3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
      </div>

      <div className={styles.sep} />

      {/* Blocos */}
      <div className={styles.group}>
        <ToolBtn icon={<ListBullets size={16} />} active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <ToolBtn icon={<Code size={16} />} active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} />
        <ToolBtn icon={<Quotes size={16} />} active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
      </div>

      {/* Lado direito */}
      <div className={styles.right}>
        <span className={styles.wordCount}>{wordCount} palavras</span>

        <span className={styles.saveStatus} style={{ color: saveStatus.includes('✓') ? '#60A5FA' : saveStatus.includes('erro') ? '#F87171' : 'var(--tx3)' }}>
          {saveStatus}
        </span>

        <span className={styles.statusBadge} style={{ color: statusColor, background: `${statusColor}15` }}>
          {statusLabel}
        </span>

        <button
          className={`${styles.previewBtn} ${previewOpen ? styles.previewBtnActive : ''}`}
          onClick={onTogglePreview}
          title={previewOpen ? 'fechar preview' : 'preview do template'}
        >
          {previewOpen ? <EyeSlash size={14} /> : <Eye size={14} />}
          preview
        </button>

        <button className={styles.saveBtn} onClick={onSave}>
          <FloppyDisk size={14} />salvar
        </button>

        <button className={styles.exportBtn} onClick={onExportLatex}>
          <FileText size={14} />.tex
        </button>
      </div>
    </div>
  );
}

function ToolBtn({ icon, label, onClick, active }) {
  return (
    <button onClick={onClick} className={`${styles.toolBtn} ${active ? styles.toolBtnActive : ''}`}>
      {icon || label}
    </button>
  );
}