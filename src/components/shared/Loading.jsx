import { useEffect, useState } from 'react';
import styles from './Loading.module.css';





const STEPS = [
'Criando organização...',
'Configurando perfil de pesquisa...',
'Ativando Farol...',
'Conectando fontes acadêmicas...',
'Preparando Bancada...',
'Summa pronto.'];


export function Loading({ onFinish }) {
  const [doneCount, setDoneCount] = useState(0);

  useEffect(() => {
    const timers = [];

    STEPS.forEach((_, i) => {
      timers.push(setTimeout(() => setDoneCount(i + 1), 600 + i * 500));
    });

    timers.push(setTimeout(onFinish, 600 + STEPS.length * 500 + 400));

    return () => timers.forEach(clearTimeout);
  }, [onFinish]);

  return (
    <div className={styles.loading}>
      <img src="/logo-white.png" className={styles.logo} alt="集" />
      <ul className={styles.steps}>
        {STEPS.map((text, i) =>
        <li
          key={i}
          className={`${styles.step} ${i < doneCount ? styles.done : ''}`}
          style={{ animationDelay: `${0.2 + i * 0.15}s` }}>
          
            <span className={styles.check}>✓</span>
            {text}
          </li>
        )}
      </ul>
    </div>);

}