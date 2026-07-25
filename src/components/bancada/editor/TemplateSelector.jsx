import { getTemplateList } from '../../../services/latex-templates';
import styles from './TemplateSelector.module.css';

export function TemplateSelector({ selected, onSelect }) {
  const templates = getTemplateList();

  return (
    <div className={styles.grid}>
      {templates.map(tpl => (
        <button
          key={tpl.id}
          className={`${styles.card} ${selected === tpl.id ? styles.active : ''}`}
          onClick={() => onSelect(tpl.id)}
          style={{ '--tpl-color': tpl.color }}
        >
          <div className={styles.indicator} style={{ background: tpl.color }} />
          <div className={styles.name}>{tpl.name}</div>
          <div className={styles.desc}>{tpl.description}</div>
          <div className={styles.meta}>
            {tpl.sectionCount > 0
              ? `${tpl.sectionCount} seções obrigatórias`
              : 'estrutura livre'
            }
          </div>
        </button>
      ))}
    </div>
  );
}