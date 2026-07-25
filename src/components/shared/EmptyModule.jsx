import { Kanban, Eye, ChartLineUp } from '@phosphor-icons/react';

const ICONS = {
  Kanban, Eye, Graph: ChartLineUp
};








export function EmptyModule({ name, jp, icon, description }) {
  const Icon = ICONS[icon] || Kanban;

  return (
    <div className="animate-fade-in" style={{
      textAlign: 'center', padding: '56px 32px'
    }}>
      <Icon size={28} color="var(--tx3)" style={{ marginBottom: 8 }} />
      <div style={{
        fontFamily: 'var(--font-mono)', fontWeight: 700,
        fontSize: 17, color: 'var(--acc)', marginBottom: 2
      }}>
        {name}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 14,
        color: 'var(--tx3)', marginBottom: 8
      }}>
        {jp}
      </div>
      <div style={{
        color: 'var(--tx2)', fontSize: 15, lineHeight: 1.6,
        maxWidth: 340, margin: '0 auto'
      }}>
        {description}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', color: 'var(--tx3)',
        fontSize: 13, marginTop: 14
      }}>
        [ em desenvolvimento ]
      </div>
    </div>);

}