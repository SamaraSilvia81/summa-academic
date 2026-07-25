import { useEffect, useState } from 'react';
import styles from './Splash.module.css';

const MESSAGES = [
'inicializando módulos...',
'carregando design system...',
'conectando IndexedDB...',
'ativando radar acadêmico...',];

export function Splash({ onFinish }) {
  const [msgIndex, setMsgIndex] = useState(0);
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
    const msgInterval = setInterval(() => {
      setMsgIndex((prev) => {
        if (prev < MESSAGES.length - 1) return prev + 1;
        return prev;
      });
    }, 600);

    const hideTimer = setTimeout(() => {
      clearInterval(msgInterval);
      setHiding(true);
      setTimeout(onFinish, 800);
    }, 3800);

    return () => {
      clearInterval(msgInterval);
      clearTimeout(hideTimer);
    };
  }, [onFinish]);

  return (
    <div className={`${styles.splash} ${hiding ? styles.hide : ''}`}>
      <img src="/logo-white.png" className={styles.logo} alt="集" />
      <div className={styles.name}>
        <b>Summa</b>.sh
      </div>
      <div className={styles.tagline}>
        academic research workbench
      </div>
      <div className={styles.barWrap}>
        <div className={styles.bar} />
      </div>
      <div className={styles.status}>{MESSAGES[msgIndex]}</div>
    </div>);

}