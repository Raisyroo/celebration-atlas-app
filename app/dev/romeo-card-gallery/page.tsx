import type { CSSProperties } from 'react';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import './romeo-card-gallery.css';
import { getEventFlyer } from '../../../data/eventFlyers';

const romeoFlyer = getEventFlyer('romeo-peach');

type CardTreatment = 'artifact' | 'atmospheric' | 'ticket';

type RomeoCardSample = {
  label: string;
  subtitle: string;
  line: string;
  icon: string;
  treatment: CardTreatment;
  favorite?: boolean;
};

const cardSamples: RomeoCardSample[] = [
  {
    label: 'Event Card',
    subtitle: 'Collect & Save',
    line: 'Your festival schedule & itinerary',
    icon: '🍑',
    treatment: 'artifact',
    favorite: true,
  },
  {
    label: 'Festival Schedule',
    subtitle: 'View Full Schedule',
    line: 'See events by day and time',
    icon: '📅',
    treatment: 'artifact',
  },
  {
    label: 'Music Schedule',
    subtitle: 'Lineup & Times',
    line: 'Explore music, stages, and set times',
    icon: '♪',
    treatment: 'atmospheric',
  },
  {
    label: 'Tickets & Info',
    subtitle: 'Hours, parking & details',
    line: 'Official event information',
    icon: '🎟',
    treatment: 'ticket',
  },
  {
    label: 'Watch Live',
    subtitle: 'Live stream events',
    line: 'Watch select moments from anywhere',
    icon: '▶',
    treatment: 'atmospheric',
  },
  {
    label: 'Participate',
    subtitle: 'Contests & more',
    line: 'Join in, enter, or volunteer',
    icon: '🏆',
    treatment: 'ticket',
  },
];

export default function RomeoCardGalleryPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <main style={styles.shell}>
      <div style={styles.atmosphere} aria-hidden="true" />
      <section style={styles.content} aria-label="Romeo Peach Festival card explorations">
        <header style={styles.header}>
          <p style={styles.kicker}>Private development gallery</p>
          <h1 style={styles.title}>Romeo Peach Festival — Card Explorations</h1>
          <p style={styles.intro}>
            Comparing compact, tap-worthy Celebration Atlas action cards before any live Romeo event-detail work.
          </p>
        </header>

        <aside style={styles.flyerReference} aria-label="Romeo flyer contextual reference">
          {romeoFlyer ? (
            <Image
              src={romeoFlyer.src}
              alt="Romeo Peach Festival flyer reference"
              width={72}
              height={92}
              sizes="72px"
              style={styles.flyerImage}
            />
          ) : (
            <div style={styles.flyerFallback}>Romeo flyer reference</div>
          )}
          <div style={styles.flyerCopy}>
            <span style={styles.flyerEyebrow}>context reference</span>
            <strong style={styles.flyerTitle}>Flyer mood, not a detail sheet</strong>
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
              aria-label={`${sample.label}: ${sample.subtitle}. ${sample.line}`}
            >
              <span style={styles.cardGlow} aria-hidden="true" />
              <span style={styles.cardTopline}>
                <span style={sample.favorite ? styles.favoriteBadge : styles.badge}>{sample.label}</span>
                <span style={styles.chevron} aria-hidden="true">›</span>
              </span>
              <span style={sample.favorite ? styles.favoriteIconWell : iconWellStyles[sample.treatment]} aria-hidden="true">
                {sample.icon}
              </span>
              <span style={styles.cardText}>
                <span style={styles.subtitle}>{sample.subtitle}</span>
                <span style={styles.line}>{sample.line}</span>
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
  content: { position: 'relative', zIndex: 1, width: 'min(100%, 760px)', margin: '0 auto', padding: '22px 14px 36px' },
  header: { padding: '10px 2px 12px' },
  kicker: { margin: 0, color: 'rgba(255, 226, 168, 0.68)', fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' },
  title: { margin: '8px 0 8px', fontFamily: 'Georgia, Times New Roman, serif', fontSize: 'clamp(1.45rem, 7vw, 2.8rem)', lineHeight: 1.04, letterSpacing: '-0.035em' },
  intro: { margin: 0, maxWidth: 560, color: 'rgba(255, 242, 201, 0.74)', fontSize: 14, lineHeight: 1.5 },
  flyerReference: { display: 'grid', gridTemplateColumns: '72px 1fr', gap: 12, alignItems: 'center', margin: '8px 0 16px', padding: 10, border: '1px solid rgba(245, 183, 75, 0.28)', borderRadius: 22, background: 'linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.035))', boxShadow: '0 18px 54px rgba(0,0,0,0.36)' },
  flyerImage: { width: 72, height: 92, objectFit: 'cover', borderRadius: 14, border: '1px solid rgba(255, 222, 152, 0.36)', boxShadow: '0 0 28px rgba(239, 164, 57, 0.18)' },
  flyerFallback: { width: 72, height: 92, display: 'grid', placeItems: 'center', borderRadius: 14, fontSize: 11, textAlign: 'center', background: 'rgba(255,255,255,0.08)' },
  flyerCopy: { display: 'grid', gap: 4 },
  flyerEyebrow: { color: 'rgba(255, 226, 168, 0.62)', fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' },
  flyerTitle: { fontFamily: 'Georgia, Times New Roman, serif', fontSize: 18, color: '#fff4d4' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(158px, 1fr))', gap: 12, alignItems: 'stretch' },
  card: { position: 'relative', minHeight: 178, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14, padding: 14, borderRadius: 24, color: '#fff5dc', textAlign: 'left', cursor: 'pointer', WebkitTapHighlightColor: 'transparent', boxShadow: '0 18px 50px rgba(0,0,0,0.36)', transition: 'transform 160ms ease, filter 160ms ease, box-shadow 160ms ease' },
  favoriteCard: { minHeight: 208, border: '1px solid rgba(255, 213, 112, 0.78)', background: 'radial-gradient(circle at 50% 22%, rgba(255, 207, 89, 0.34), transparent 34%), linear-gradient(145deg, rgba(62, 34, 12, 0.92), rgba(8, 11, 20, 0.95))', boxShadow: '0 22px 70px rgba(226, 149, 45, 0.28), inset 0 0 0 1px rgba(255,255,255,0.08)' },
  cardGlow: { position: 'absolute', inset: 'auto -30% -38% -30%', height: '70%', background: 'radial-gradient(circle, rgba(255, 196, 87, 0.22), transparent 68%)', pointerEvents: 'none' },
  cardTopline: { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  badge: { border: '1px solid rgba(255, 231, 184, 0.22)', borderRadius: 999, padding: '5px 8px', color: 'rgba(255, 242, 211, 0.78)', fontSize: 11, fontWeight: 700 },
  favoriteBadge: { border: '1px solid rgba(255, 218, 126, 0.66)', borderRadius: 999, padding: '5px 9px', color: '#ffe08b', fontSize: 11, fontWeight: 800, boxShadow: '0 0 24px rgba(255, 202, 83, 0.22)' },
  chevron: { color: 'rgba(255, 226, 168, 0.7)', fontSize: 28, lineHeight: 0.8 },
  favoriteIconWell: { position: 'relative', display: 'grid', placeItems: 'center', alignSelf: 'center', width: 86, height: 86, borderRadius: 28, background: 'radial-gradient(circle, rgba(255,238,174,0.32), rgba(244,151,55,0.14) 54%, rgba(255,255,255,0.06))', fontSize: 46, boxShadow: 'inset 0 0 0 1px rgba(255, 231, 164, 0.32), 0 0 34px rgba(255, 186, 65, 0.26)' },
  cardText: { position: 'relative', display: 'grid', gap: 5 },
  subtitle: { fontFamily: 'Georgia, Times New Roman, serif', fontSize: 20, fontWeight: 700, lineHeight: 1.05, textWrap: 'balance' },
  line: { color: 'rgba(255, 244, 218, 0.72)', fontSize: 12.5, lineHeight: 1.35 },
};

const treatmentStyles: Record<CardTreatment, CSSProperties> = {
  artifact: { border: '1px solid rgba(226, 177, 88, 0.36)', background: 'linear-gradient(145deg, rgba(17, 24, 43, 0.94), rgba(6, 8, 17, 0.96))' },
  atmospheric: { border: '1px solid rgba(244, 157, 88, 0.32)', background: 'radial-gradient(circle at 76% 18%, rgba(253, 160, 83, 0.32), transparent 34%), radial-gradient(circle at 12% 78%, rgba(91, 117, 185, 0.22), transparent 34%), linear-gradient(145deg, rgba(8, 17, 35, 0.96), rgba(6, 7, 15, 0.98))' },
  ticket: { border: '1px dashed rgba(255, 217, 142, 0.44)', background: 'linear-gradient(90deg, rgba(255, 222, 150, 0.13) 0 8px, transparent 8px), linear-gradient(145deg, rgba(29, 21, 25, 0.96), rgba(8, 10, 18, 0.98))' },
};

const iconWellStyles: Record<CardTreatment, CSSProperties> = {
  artifact: { position: 'relative', display: 'grid', placeItems: 'center', width: 62, height: 62, borderRadius: 22, background: 'rgba(255, 220, 146, 0.10)', fontSize: 32, boxShadow: 'inset 0 0 0 1px rgba(255, 230, 170, 0.18)' },
  atmospheric: { position: 'relative', display: 'grid', placeItems: 'center', width: 62, height: 62, borderRadius: 999, background: 'rgba(255, 170, 96, 0.13)', fontSize: 34, boxShadow: '0 0 26px rgba(255, 158, 85, 0.16)' },
  ticket: { position: 'relative', display: 'grid', placeItems: 'center', width: 62, height: 62, borderRadius: 16, background: 'linear-gradient(135deg, rgba(255, 234, 183, 0.15), rgba(255,255,255,0.04))', fontSize: 32, boxShadow: 'inset 0 0 0 1px rgba(255, 228, 169, 0.2)' },
};
