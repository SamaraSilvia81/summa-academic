import { BookOpen, Lightning } from '@phosphor-icons/react';
import styles from './RefsSidebar.module.css';

export function RefsSidebar({ refs = [], aiSuggestions = [] }) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <BookOpen size={14} color="#A78BFA" />
        <span className={styles.headerTitle}>refs recentes · Acervo</span>
        <span className={styles.headerCount}>{refs.length}</span>
      </div>

      <div className={styles.list}>
        {refs.length > 0 ? (
          refs.map((ref, i) => (
            <div key={i} className={styles.refCard} style={{ borderLeftColor: ref.read ? '#A78BFA' : 'var(--brd2)' }}>
              <div className={styles.refTitle}>{ref.title}</div>
              <div className={styles.refMeta}>{ref.meta}</div>
            </div>
          ))
        ) : (
          <div className={styles.emptyState}>
            nenhuma referência no Acervo ainda. Adicione fontes lá para elas aparecerem aqui conforme o documento avança.
          </div>
        )}
      </div>

      {aiSuggestions.length > 0 ? (
        aiSuggestions.map(s => (
          <div className={styles.aiCard} key={s.id}>
            <div className={styles.aiHeader}>
              <Lightning size={12} color="#A78BFA" weight="fill" />
              <span className={styles.aiLabel}>IA · sugestão</span>
            </div>
            <div className={styles.aiText}>{s.text}</div>
          </div>
        ))
      ) : (
        <div className={styles.aiCard}>
          <div className={styles.aiHeader}>
            <Lightning size={12} color="var(--tx3)" />
            <span className={styles.aiLabel} style={{ color: 'var(--tx3)' }}>IA · sem sugestões agora</span>
          </div>
          <div className={styles.aiText} style={{ color: 'var(--tx3)' }}>
            à medida que o texto e o Farol/Acervo conectados a este documento avançarem, sugestões aparecerão aqui.
          </div>
        </div>
      )}
    </aside>
  );
}
