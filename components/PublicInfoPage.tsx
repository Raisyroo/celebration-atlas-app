import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './PublicInfoPage.module.css';

type PublicInfoPageProps = {
  title: string;
  summary: string;
  children: ReactNode;
};

export default function PublicInfoPage({
  title,
  summary,
  children,
}: PublicInfoPageProps) {
  return (
    <main className={styles.page}>
      <div className={styles.glow} aria-hidden="true" />
      <article className={styles.card}>
        <Link className={styles.backLink} href="/">
          Michigan Atlas home
        </Link>

        <p className={styles.kicker}>Celebration Atlas</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.summary}>{summary}</p>

        <div className={styles.content}>{children}</div>

        <footer className={styles.footer}>
          <Link className={styles.returnLink} href="/">
            Return to Michigan celebrations
          </Link>
        </footer>
      </article>
    </main>
  );
}
