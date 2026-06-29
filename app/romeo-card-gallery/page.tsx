import type { CSSProperties } from 'react';
import Image from 'next/image';
import './romeo-card-gallery.css';
import { getEventFlyer } from '../../data/eventFlyers';

const romeoFlyer = getEventFlyer('romeo-peach');

type CardTreatment = 'artifact' | 'atmospheric' | 'ticket';

type RomeoCardSample = {
  label: string;
  support?: string;
  icon: string;
  treatment: CardTreatment;
  favorite?: boolean;
};

const cardSamples: RomeoCardSample[] = [
  {
    label: 'Event Card',
    support: 'Favorite',
    icon: '🍑',
    treatment: 'artifact',
    favorite: true,
  },
  {
    label: 'Festival Schedule',
    support: 'By day',
    icon: '📅',
    treatment: 'artifact',
  },
  {
    label: 'Music Schedule',
    support: 'Lineup',
    icon: '♪',
    treatment: 'atmospheric',
  },
  {
    label: 'Watch Live',
    support: 'Stream',
    icon: '▶',
    treatment: 'atmospheric',
  },
  {
    label: 'Participate',
    support: 'Join in',
    icon: '🏆',
    treatment: 'ticket',
  },
  {
    label: 'Tickets & Info',
    support: 'Details',
    icon: '🎟',
    treatment: 'ticket',
  },
];

export default function RomeoCardGalleryPage() {
  return (
    <main style={styles.shell}>
      <div style={styles.atmosphere} aria-hidden="true" />
      <section style={styles.content} aria-label="Romeo Peach Festival card explorations">
        <header style={styles.header}>
          <p style={styles.kicker}>Unlinked live gallery</p>
          <h1 style={styles.title}>Romeo Peach Festival tools</h1>
        </header>

        <aside style={styles.flyerReference} aria-label="Romeo flyer thumbnail reference">
          {romeoFlyer ? (
            <Image
              src={romeoFlyer.src}
              alt="Romeo Peach Festival flyer reference"
              width={48}
              height={62}
              sizes="48px"
              style={styles.flyerImage}
            />
          ) : (
            <div style={styles.flyerFallback}>Romeo flyer reference</div>
          )}
          <div style={styles.flyerCopy}>
            <span style={styles.flyerEyebrow}>Romeo reference</span>
            <strong style={styles.flyerTitle}>Six-card tool dock</strong>
          </div>
        </aside>

        <div style={styles.grid}>
          {cardSamples.map((sample) => (
            <button
              key={sample.label}
              type="button"
              className="romeo-gallery-card"
              style={{
                ...styles.card,
                ...treatmentStyles[sample.treatment],
                ...(sample.favorite ? styles.favoriteCard : undefined),
              }}
              aria-label={sample.support ? `${sample.label}: ${sample.support}` : sample.label}
            >
              <span style={styles.cardGlow} aria-hidden="true" />
              <span style={styles.cardTopline}>
                <span style={sample.favorite ? styles.favoritePip : styles.pip} aria-hidden="true" />
                <span style={styles.chevron} aria-hidden="true">›</span>
              </span>
              <span style={sample.favorite ? styles.favoriteIconWell : iconWellStyles[sample.treatment]} aria-hidden="true">
                {sample.icon}
              </span>
              <span style={styles.cardText}>
                <span style={styles.tileTitle}>{sample.label}</span>
                {sample.support ? <span style={styles.support}>{sample.support}</span> : null}
              </span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: {
    position: 'relative',
    minHeight: '100dvh',
    overflowY: 'auto',
    touchAction: 'auto',
    WebkitOverflowScrolling: 'touch',
    background: '#03050b',
    color: '#fff2c9',
    fontFamily: 'Arial, Helvetica, sans-serif',
  },
  atmosphere: {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    background: 'radial-gradient(circle at 18% 8%, rgba(255, 184, 77, 0.24), transparent 28%), radial-gradient(circle at 82% 22%, rgba(244, 109, 68, 0.16), transparent 26%), linear-gradient(180deg, #08101f 0%, #03050b 58%, #010207 100%)',
  },
  content: { position: 'relative', zIndex: 1, width: 'min(100%, 520px)', margin: '0 auto', padding: '18px 10px 28px' },
  header: { padding: '8px 2px 8px' },
  kicker: { margin: 0, color: 'rgba(255, 226, 168, 0.68)', fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' },
  title: { margin: '6px 0 0', fontFamily: 'Georgia, Times New Roman, serif', fontSize: 'clamp(1.35rem, 6vw, 2.05rem)', lineHeight: 1.04, letterSpacing: '-0.035em' },
  flyerReference: { display: 'grid', gridTemplateColumns: '48px 1fr', gap: 10, alignItems: 'center', margin: '6px 0 12px', padding: 8, border: '1px solid rgba(245, 183, 75, 0.22)', borderRadius: 18, background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.025))', boxShadow: '0 14px 34px rgba(0,0,0,0.28)' },
  flyerImage: { width: 48, height: 62, objectFit: 'cover', borderRadius: 11, border: '1px solid rgba(255, 222, 152, 0.34)', boxShadow: '0 0 20px rgba(239, 164, 57, 0.16)' },
  flyerFallback: { width: 48, height: 62, display: 'grid', placeItems: 'center', borderRadius: 11, fontSize: 10, textAlign: 'center', background: 'rgba(255,255,255,0.08)' },
  flyerCopy: { display: 'grid', gap: 4 },
  flyerEyebrow: { color: 'rgba(255, 226, 168, 0.62)', fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' },
  flyerTitle: { fontFamily: 'Georgia, Times New Roman, serif', fontSize: 16, color: '#fff4d4' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, alignItems: 'stretch' },
  card: { position: 'relative', minHeight: 116, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 7, padding: 9, borderRadius: 18, color: '#fff5dc', textAlign: 'left', cursor: 'pointer', WebkitTapHighlightColor: 'transparent', boxShadow: '0 14px 34px rgba(0,0,0,0.34)', transition: 'transform 160ms ease, filter 160ms ease, box-shadow 160ms ease' },
  favoriteCard: { border: '1px solid rgba(255, 213, 112, 0.86)', background: 'radial-gradient(circle at 50% 22%, rgba(255, 207, 89, 0.34), transparent 34%), linear-gradient(145deg, rgba(62, 34, 12, 0.92), rgba(8, 11, 20, 0.95))', boxShadow: '0 0 0 1px rgba(255, 223, 130, 0.24), 0 18px 44px rgba(226, 149, 45, 0.26), inset 0 0 18px rgba(255, 215, 118, 0.08)' },
  cardGlow: { position: 'absolute', inset: 'auto -35% -42% -35%', height: '68%', background: 'radial-gradient(circle, rgba(255, 196, 87, 0.18), transparent 68%)', pointerEvents: 'none' },
  cardTopline: { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  pip: { width: 6, height: 6, borderRadius: 999, background: 'rgba(255, 231, 184, 0.36)', boxShadow: '0 0 12px rgba(255, 231, 184, 0.16)' },
  favoritePip: { width: 7, height: 7, borderRadius: 999, background: '#ffd76d', boxShadow: '0 0 18px rgba(255, 213, 112, 0.7)' },
  chevron: { color: 'rgba(255, 226, 168, 0.72)', fontSize: 20, lineHeight: 0.8 },
  favoriteIconWell: { position: 'relative', display: 'grid', placeItems: 'center', alignSelf: 'center', width: 46, height: 46, borderRadius: 16, background: 'radial-gradient(circle, rgba(255,238,174,0.32), rgba(244,151,55,0.14) 54%, rgba(255,255,255,0.06))', fontSize: 27, boxShadow: 'inset 0 0 0 1px rgba(255, 231, 164, 0.34), 0 0 24px rgba(255, 186, 65, 0.24)' },
  cardText: { position: 'relative', display: 'grid', gap: 3 },
  tileTitle: { fontFamily: 'Georgia, Times New Roman, serif', fontSize: 14.5, fontWeight: 700, lineHeight: 1.02, textWrap: 'balance' },
  support: { color: 'rgba(255, 244, 218, 0.66)', fontSize: 10.5, lineHeight: 1.1, fontWeight: 700, letterSpacing: '0.02em' },
};

const treatmentStyles: Record<CardTreatment, CSSProperties> = {
  artifact: { border: '1px solid rgba(226, 177, 88, 0.36)', background: 'linear-gradient(145deg, rgba(17, 24, 43, 0.94), rgba(6, 8, 17, 0.96))' },
  atmospheric: { border: '1px solid rgba(244, 157, 88, 0.32)', background: 'radial-gradient(circle at 76% 18%, rgba(253, 160, 83, 0.32), transparent 34%), radial-gradient(circle at 12% 78%, rgba(91, 117, 185, 0.22), transparent 34%), linear-gradient(145deg, rgba(8, 17, 35, 0.96), rgba(6, 7, 15, 0.98))' },
  ticket: { border: '1px dashed rgba(255, 217, 142, 0.44)', background: 'linear-gradient(90deg, rgba(255, 222, 150, 0.13) 0 8px, transparent 8px), linear-gradient(145deg, rgba(29, 21, 25, 0.96), rgba(8, 10, 18, 0.98))' },
};

const iconWellStyles: Record<CardTreatment, CSSProperties> = {
  artifact: { position: 'relative', display: 'grid', placeItems: 'center', alignSelf: 'center', width: 42, height: 42, borderRadius: 15, background: 'rgba(255, 220, 146, 0.10)', fontSize: 24, boxShadow: 'inset 0 0 0 1px rgba(255, 230, 170, 0.18)' },
  atmospheric: { position: 'relative', display: 'grid', placeItems: 'center', alignSelf: 'center', width: 42, height: 42, borderRadius: 999, background: 'rgba(255, 170, 96, 0.13)', fontSize: 26, boxShadow: '0 0 22px rgba(255, 158, 85, 0.14)' },
  ticket: { position: 'relative', display: 'grid', placeItems: 'center', alignSelf: 'center', width: 42, height: 42, borderRadius: 13, background: 'linear-gradient(135deg, rgba(255, 234, 183, 0.15), rgba(255,255,255,0.04))', fontSize: 24, boxShadow: 'inset 0 0 0 1px rgba(255, 228, 169, 0.2)' },
};
