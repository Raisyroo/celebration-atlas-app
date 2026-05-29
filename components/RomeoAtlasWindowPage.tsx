'use client';

import { useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import Link from 'next/link';

type RomeoAtlasMode = 'highlights' | 'schedule' | 'maps' | 'gallery' | 'plan';

type RomeoAtlasModeOption = {
  id: RomeoAtlasMode;
  label: string;
};

type GalleryMoment = {
  id: string;
  caption: string;
  tone: string;
};

type RomeoAtlasWindowPageProps = {
  eventName: string;
  backHref: string;
  memoryImageSrc: string;
};

const MODE_OPTIONS: readonly RomeoAtlasModeOption[] = [
  { id: 'highlights', label: 'Highlights' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'maps', label: 'Maps' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'plan', label: 'Plan' },
] as const;

const GALLERY_MOMENTS: readonly GalleryMoment[] = [
  {
    id: 'parade-light',
    caption: 'Parade glow slipping between brick storefronts and peach banners.',
    tone: 'radial-gradient(circle at 46% 24%, rgba(255,194,125,0.48), rgba(126,70,39,0.48) 38%, rgba(13,13,18,0.94) 100%)',
  },
  {
    id: 'sugar-stand',
    caption: 'Peach desserts cooling under tent lights as families drift by.',
    tone: 'radial-gradient(circle at 35% 30%, rgba(255,173,112,0.46), rgba(101,56,39,0.5) 42%, rgba(12,12,17,0.94) 100%)',
  },
  {
    id: 'downtown-bluehour',
    caption: 'Downtown Romeo at blue hour, warm windows and festival foot traffic.',
    tone: 'radial-gradient(circle at 54% 28%, rgba(239,179,103,0.38), rgba(61,57,76,0.45) 42%, rgba(9,12,20,0.95) 100%)',
  },
  {
    id: 'family-route',
    caption: 'A family route marked by music, lemonade cups, and one more peach stop.',
    tone: 'radial-gradient(circle at 44% 26%, rgba(250,202,141,0.42), rgba(85,55,39,0.48) 43%, rgba(12,10,15,0.94) 100%)',
  },
] as const;

function ModeIcon({ mode }: { mode: RomeoAtlasMode }) {
  const commonProps = {
    width: 32,
    height: 32,
    viewBox: '0 0 32 32',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.45,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
  };

  if (mode === 'highlights') {
    return (
      <svg {...commonProps}>
        <path d="M16 3.8l2.6 8.4 8.4 3.8-8.4 3.8L16 28.2l-2.6-8.4L5 16l8.4-3.8L16 3.8z" />
        <path d="M16 8.8v14.4M8.8 16h14.4" opacity="0.54" />
        <path d="M4.2 7.4h2.3M25.5 24.6h2.3" opacity="0.45" />
      </svg>
    );
  }

  if (mode === 'schedule') {
    return (
      <svg {...commonProps}>
        <rect x="7" y="8.4" width="18" height="17.2" rx="2.8" />
        <path d="M11 5.8v5M21 5.8v5M7 13.2h18" />
        <path d="M11.2 17.2h2.5M18.3 17.2h2.5M11.2 21h2.5M18.3 21h2.5" opacity="0.62" />
      </svg>
    );
  }

  if (mode === 'maps') {
    return (
      <svg {...commonProps}>
        <circle cx="16" cy="16" r="10.2" />
        <circle cx="16" cy="16" r="3.1" />
        <path d="M16 3.9v5.2M16 22.9v5.2M3.9 16h5.2M22.9 16h5.2" />
        <path d="M20.8 11.2l-3.1 6.5-6.5 3.1 3.1-6.5 6.5-3.1z" />
      </svg>
    );
  }

  if (mode === 'gallery') {
    return (
      <svg {...commonProps}>
        <rect x="6.5" y="8.2" width="19" height="16.6" rx="2.8" />
        <path d="M9.6 20.8l4.2-4.7 3.3 3.4 2.1-2.2 3.2 3.5" />
        <circle cx="20.4" cy="12.8" r="1.6" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <rect x="8" y="5.5" width="16" height="21" rx="2.6" />
      <path d="M12 10.4h8M12 15h8M12 19.6h5.5" />
      <path d="M16 23.4l1.1-2.2 2.3-.9-2.3-.9L16 17.2l-1.1 2.2-2.3.9 2.3.9 1.1 2.2z" />
    </svg>
  );
}

function RomeoWindowContent({ activeMode, activeGallery, setActiveGallery }: { activeMode: RomeoAtlasMode; activeGallery: GalleryMoment; setActiveGallery: (id: string) => void }) {
  if (activeMode === 'schedule') {
    const schedule = [
      { time: '11:00 AM', text: 'Downtown opens softly: storefronts, first sweets, and parade chairs appearing along Main.' },
      { time: '1:30 PM', text: 'Peach food window: pies, cobbler, cold drinks, and shaded family pauses.' },
      { time: '4:00 PM', text: 'Parade atmosphere builds with bands, banners, and neighborhood arrivals.' },
      { time: '7:45 PM', text: 'Blue-hour drift: lights, music corners, and one last pass through vendor rows.' },
    ];

    return (
      <section className="romeo-atlas-window-scroll" style={styles.windowContent} aria-label="Schedule lens">
        <p style={styles.windowEyebrow}>Schedule Lens</p>
        <h2 style={styles.windowTitle}>A day unfolding like a town memory.</h2>
        <div style={styles.timelineStack}>
          {schedule.map((item) => (
            <article key={item.time} style={styles.timelineItem}>
              <span style={styles.timelineTime}>{item.time}</span>
              <p style={styles.timelineText}>{item.text}</p>
            </article>
          ))}
        </div>
      </section>
    );
  }

  if (activeMode === 'maps') {
    return (
      <section className="romeo-atlas-window-scroll" style={styles.windowContent} aria-label="Maps lens">
        <p style={styles.windowEyebrow}>Orientation Lens</p>
        <h2 style={styles.windowTitle}>Use Main Street as your compass line.</h2>
        <div style={styles.mapPlate} aria-hidden="true">
          <span style={{ ...styles.mapNode, left: '18%', top: '42%' }} />
          <span style={{ ...styles.mapNode, left: '48%', top: '28%' }} />
          <span style={{ ...styles.mapNode, left: '74%', top: '57%' }} />
          <span style={styles.mapRoute} />
          <span style={styles.mapCompass}>✦</span>
        </div>
        <p style={styles.windowBody}>Mock/demo orientation: parade corridor through downtown, food row one block off the main glow, and quieter family regroup points near the edges.</p>
        <p style={styles.windowTip}>Field note: park outside the core and walk inward before evening traffic thickens.</p>
      </section>
    );
  }

  if (activeMode === 'gallery') {
    return (
      <section className="romeo-atlas-window-scroll" style={styles.windowContent} aria-label="Gallery lens">
        <p style={styles.windowEyebrow}>Gallery Lens</p>
        <h2 style={styles.windowTitle}>Festival fragments in warm glass.</h2>
        <article style={styles.galleryFeature}>
          <div style={{ ...styles.galleryImage, background: activeGallery.tone }} aria-hidden="true" />
        </article>
        <div style={styles.galleryRail} aria-label="Gallery thumbnails">
          {GALLERY_MOMENTS.map((item) => {
            const isSelected = item.id === activeGallery.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveGallery(item.id)}
                style={{ ...styles.galleryThumbButton, ...(isSelected ? styles.galleryThumbButtonActive : null) }}
                aria-pressed={isSelected}
                aria-label={item.caption}
              >
                <span style={{ ...styles.galleryThumbTone, background: item.tone }} />
              </button>
            );
          })}
        </div>
        <p style={styles.galleryCaption}>{activeGallery.caption}</p>
      </section>
    );
  }

  if (activeMode === 'plan') {
    return (
      <section className="romeo-atlas-window-scroll" style={styles.windowContent} aria-label="Plan lens">
        <p style={styles.windowEyebrow}>Plan Lens</p>
        <h2 style={styles.windowTitle}>A slow, golden route through Romeo.</h2>
        <ol style={styles.planList}>
          <li style={styles.planItem}>Arrive before the center gets loud; let the first stop be peach food and a quiet storefront pass.</li>
          <li style={styles.planItem}>Hold your parade position early, then drift toward music rather than fighting the thickest crowd.</li>
          <li style={styles.planItem}>Save ten blue-hour minutes for photos, lights, and one last dessert before walking back out.</li>
        </ol>
      </section>
    );
  }

  return (
    <section className="romeo-atlas-window-scroll" style={styles.windowContent} aria-label="Highlights lens">
      <p style={styles.windowEyebrow}>Highlights Lens</p>
      <h2 style={styles.windowTitle}>Peach parade, downtown lights, and sugar in the dusk air.</h2>
      <div style={styles.highlightGrid}>
        {[
          ['Parade Atmosphere', 'Bands, banners, and peach-color motion along a small-town corridor.'],
          ['Downtown Lights', 'Storefront windows and streetlamps turning the festival cinematic after sunset.'],
          ['Festival Food', 'Peach pie, cobbler, cold drinks, and summer vendor smoke in the same breath.'],
          ['Family Moments', 'Low-stakes wandering, shared treats, and familiar faces under late-summer skies.'],
        ].map(([title, text]) => (
          <article key={title} style={styles.highlightCard}>
            <span style={styles.highlightSigil}>✦</span>
            <h3 style={styles.highlightTitle}>{title}</h3>
            <p style={styles.highlightText}>{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function RomeoAtlasWindowPage({ eventName, backHref, memoryImageSrc }: RomeoAtlasWindowPageProps) {
  const [activeMode, setActiveMode] = useState<RomeoAtlasMode>('highlights');
  const [activeGalleryId, setActiveGalleryId] = useState(GALLERY_MOMENTS[0].id);
  const activeGallery = useMemo(() => GALLERY_MOMENTS.find((item) => item.id === activeGalleryId) ?? GALLERY_MOMENTS[0], [activeGalleryId]);

  const handleAskSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  return (
    <main style={styles.page} className="atlas-event-shell">
      <style>{`.romeo-atlas-window-scroll::-webkit-scrollbar { display: none; }`}</style>
      <section style={styles.stage} aria-label={`${eventName} Atlas Window prototype`}>
        <div style={styles.stars} aria-hidden="true" />
        <Link href={backHref} style={styles.backLink}>← ATLAS</Link>

        <section style={styles.atlasWindow} aria-live="polite" aria-label="Atlas Window content">
          <div style={{ ...styles.festivalMemory, backgroundImage: `url(${memoryImageSrc})` }} aria-hidden="true" />
          <div style={styles.memorySmoke} aria-hidden="true" />
          <div style={styles.atmosphericVeil} aria-hidden="true" />
          <div style={styles.edgeDissolve} aria-hidden="true" />
          <div style={styles.windowReflection} aria-hidden="true" />
          <div style={styles.windowGlow} aria-hidden="true" />
          <RomeoWindowContent key={activeMode} activeMode={activeMode} activeGallery={activeGallery} setActiveGallery={setActiveGalleryId} />
        </section>

        <section style={styles.bottomZone} aria-label="Atlas Window lenses and Ask Anything">
          <nav style={styles.modeRail} aria-label="Atlas Window lenses">
            {MODE_OPTIONS.map((mode) => {
              const isActive = mode.id === activeMode;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setActiveMode(mode.id)}
                  style={{ ...styles.modeButton, ...(isActive ? styles.modeButtonActive : null) }}
                  aria-label={`${mode.label} lens`}
                  aria-pressed={isActive}
                  title={mode.label}
                >
                  <span style={styles.modeIcon}><ModeIcon mode={mode.id} /></span>
                  <span style={styles.modeLabel}>{mode.label}</span>
                </button>
              );
            })}
          </nav>

          <form style={styles.askDock} onSubmit={handleAskSubmit}>
            <span style={styles.askSigil} aria-hidden="true">✦</span>
            <input style={styles.askInput} className="atlas-ask-input" placeholder="Ask Anything" aria-label="Ask Anything" />
            <button type="submit" style={styles.askButton} aria-label="Submit Ask Anything demo prompt">↗</button>
          </form>
        </section>
      </section>
    </main>
  );
}

const gold = 'rgba(226, 172, 92, 0.88)';

const styles: Record<string, CSSProperties> = {
  page: { width: '100vw', height: '100svh', minHeight: '100svh', overflow: 'hidden', color: 'rgba(246,232,205,0.94)' },
  stage: { position: 'relative', width: 'min(100vw, 760px)', height: '100svh', margin: '0 auto', overflow: 'hidden', padding: 'max(0.62rem, env(safe-area-inset-top, 0px)) 0.72rem max(0.56rem, env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box', display: 'grid', gridTemplateRows: 'minmax(0, 1fr) auto', gap: '0.52rem' },
  stars: { position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle at 18% 22%, rgba(241,186,102,0.2) 0 1px, transparent 2px), radial-gradient(circle at 78% 18%, rgba(241,186,102,0.18) 0 1px, transparent 2px), radial-gradient(circle at 65% 72%, rgba(241,186,102,0.16) 0 1px, transparent 2px), linear-gradient(180deg, rgba(4,7,15,0.08), rgba(3,5,11,0.34))' },
  backLink: { position: 'absolute', right: 'max(0.72rem, env(safe-area-inset-right, 0px))', top: 'max(0.62rem, env(safe-area-inset-top, 0px))', zIndex: 4, minHeight: '2.35rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(247,219,169,0.94)', textDecoration: 'none', fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', border: '1px solid rgba(232,178,96,0.52)', borderRadius: '999px', padding: '0.38rem 0.76rem', background: 'linear-gradient(160deg, rgba(7,10,17,0.78), rgba(19,15,13,0.58))', boxShadow: '0 0 18px rgba(226,150,72,0.22), inset 0 1px 0 rgba(255,235,195,0.12)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' },
  atlasWindow: { alignSelf: 'stretch', position: 'relative', zIndex: 2, minHeight: 0, marginTop: 'clamp(2.45rem, 7svh, 4rem)', borderRadius: '46% 54% 50% 50% / 8% 9% 10% 8%', overflow: 'hidden', border: 'none', outline: 'none', background: 'radial-gradient(ellipse at 50% 46%, rgba(12,18,29,0.5) 0%, rgba(7,11,18,0.34) 52%, rgba(5,7,13,0.08) 78%, transparent 100%)', filter: 'drop-shadow(0 26px 54px rgba(0,0,0,.5)) drop-shadow(0 0 36px rgba(226,150,72,.11))', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', maskImage: 'radial-gradient(ellipse 88% 76% at 50% 49%, #000 46%, rgba(0,0,0,0.72) 64%, rgba(0,0,0,0.22) 82%, transparent 100%)', WebkitMaskImage: 'radial-gradient(ellipse 88% 76% at 50% 49%, #000 46%, rgba(0,0,0,0.72) 64%, rgba(0,0,0,0.22) 82%, transparent 100%)' },
  festivalMemory: { position: 'absolute', inset: '-7% -10%', zIndex: 0, opacity: 0.42, backgroundSize: 'cover', backgroundPosition: '50% 46%', backgroundRepeat: 'no-repeat', filter: 'brightness(0.7) saturate(1.04) contrast(1.08) blur(0.25px)', mixBlendMode: 'screen', pointerEvents: 'none', transform: 'translateZ(0) scale(1.02)', maskImage: 'radial-gradient(ellipse 72% 66% at 50% 48%, #000 38%, rgba(0,0,0,0.7) 60%, transparent 96%)', WebkitMaskImage: 'radial-gradient(ellipse 72% 66% at 50% 48%, #000 38%, rgba(0,0,0,0.7) 60%, transparent 96%)' },
  memorySmoke: { position: 'absolute', inset: '-10%', zIndex: 1, pointerEvents: 'none', background: 'radial-gradient(ellipse at 46% 39%, rgba(255,190,112,0.12), rgba(9,12,20,0.24) 44%, rgba(2,4,9,0.6) 100%), radial-gradient(ellipse at 17% 20%, rgba(217,223,230,0.08), transparent 42%), radial-gradient(ellipse at 86% 74%, rgba(221,158,91,0.1), transparent 46%), linear-gradient(180deg, rgba(3,6,13,0.18), rgba(8,10,16,0.5))', boxShadow: 'inset 0 0 84px rgba(0,0,0,0.42), inset 0 0 150px rgba(1,3,8,0.42)', filter: 'blur(0.2px)' },
  atmosphericVeil: { position: 'absolute', inset: '-18% -16%', zIndex: 1, pointerEvents: 'none', background: 'radial-gradient(ellipse at 28% 34%, rgba(238,232,216,0.09), transparent 34%), radial-gradient(ellipse at 66% 28%, rgba(255,204,134,0.07), transparent 31%), radial-gradient(ellipse at 42% 74%, rgba(194,205,219,0.07), transparent 36%), repeating-radial-gradient(ellipse at 52% 48%, rgba(255,255,255,0.035) 0 1px, transparent 1px 18px)', opacity: 0.82, filter: 'blur(18px)', mixBlendMode: 'screen', transform: 'rotate(-4deg)' },
  edgeDissolve: { position: 'absolute', inset: '-1px', zIndex: 1, pointerEvents: 'none', background: 'linear-gradient(90deg, rgba(3,5,11,0.78), transparent 18%, transparent 82%, rgba(3,5,11,0.78)), linear-gradient(180deg, rgba(3,5,11,0.72), transparent 17%, transparent 80%, rgba(3,5,11,0.82)), radial-gradient(ellipse at 50% 49%, transparent 38%, rgba(4,7,14,0.25) 65%, rgba(4,7,14,0.76) 100%)' },
  windowReflection: { position: 'absolute', inset: '-25% -35% auto -20%', zIndex: 1, height: '48%', transform: 'rotate(-10deg)', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.11), rgba(243,196,126,0.07), transparent)', filter: 'blur(13px)', opacity: 0.62, pointerEvents: 'none' },
  windowGlow: { position: 'absolute', inset: '-8%', zIndex: 1, pointerEvents: 'none', background: 'radial-gradient(ellipse at 52% 6%, rgba(255,229,184,0.15), transparent 30%), radial-gradient(ellipse at 52% 50%, rgba(238,177,96,0.12), transparent 54%), radial-gradient(ellipse at 78% 82%, rgba(225,126,63,0.13), transparent 38%)', mixBlendMode: 'screen' },
  windowContent: { position: 'absolute', inset: 0, zIndex: 2, display: 'grid', alignContent: 'safe center', gap: 'clamp(0.86rem, 2.6svh, 1.18rem)', padding: 'clamp(1.08rem, 4.6vw, 1.72rem)', boxSizing: 'border-box', overflowX: 'hidden', overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' },
  windowEyebrow: { margin: 0, color: gold, fontSize: '0.62rem', letterSpacing: '0.18em', textTransform: 'uppercase' },
  windowTitle: { margin: 0, color: 'rgba(250,232,202,0.97)', fontFamily: 'Georgia, Times New Roman, serif', fontWeight: 400, fontSize: 'clamp(1.52rem, 6.5vw, 2.72rem)', lineHeight: 1, textShadow: '0 0 18px rgba(227,146,76,0.22)' },
  windowBody: { margin: 0, color: 'rgba(237,221,193,0.9)', fontSize: '0.86rem', lineHeight: 1.5 },
  windowTip: { margin: 0, color: 'rgba(244,197,126,0.88)', fontSize: '0.78rem', lineHeight: 1.42, fontStyle: 'italic' },
  highlightGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.58rem' },
  highlightCard: { border: '1px solid rgba(226,172,92,0.22)', borderRadius: '0.92rem', background: 'linear-gradient(150deg, rgba(11,17,27,0.7), rgba(9,11,17,0.46))', padding: '0.72rem', boxShadow: 'inset 0 1px 0 rgba(255,235,195,0.08)' },
  highlightSigil: { color: gold, fontSize: '0.74rem' },
  highlightTitle: { margin: '0.24rem 0 0', color: 'rgba(250,224,183,0.94)', fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase' },
  highlightText: { margin: '0.28rem 0 0', color: 'rgba(228,214,190,0.82)', fontSize: '0.72rem', lineHeight: 1.35 },
  timelineStack: { display: 'grid', gap: '0.5rem' },
  timelineItem: { display: 'grid', gridTemplateColumns: '4.8rem 1fr', gap: '0.62rem', alignItems: 'start', borderLeft: '1px solid rgba(226,172,92,0.36)', paddingLeft: '0.68rem' },
  timelineTime: { color: gold, fontSize: '0.66rem', letterSpacing: '0.11em', textTransform: 'uppercase' },
  timelineText: { margin: 0, color: 'rgba(237,224,200,0.9)', fontSize: '0.76rem', lineHeight: 1.38 },
  mapPlate: { position: 'relative', minHeight: '10.8rem', borderRadius: '1rem', border: '1px solid rgba(226,172,92,0.28)', overflow: 'hidden', background: 'radial-gradient(circle at 48% 40%, rgba(224,151,80,0.24), transparent 30%), linear-gradient(135deg, rgba(13,20,31,0.74), rgba(5,8,14,0.76)), repeating-linear-gradient(118deg, rgba(235,190,123,0.12) 0 1px, transparent 1px 28px)', boxShadow: 'inset 0 0 34px rgba(236,172,91,0.12)' },
  mapRoute: { position: 'absolute', left: '16%', right: '18%', top: '49%', borderTop: '1px dashed rgba(238,189,112,0.68)', transform: 'rotate(8deg)', boxShadow: '0 0 12px rgba(238,172,91,0.22)' },
  mapNode: { position: 'absolute', width: '0.62rem', height: '0.62rem', borderRadius: '999px', background: 'rgba(246,202,127,0.96)', boxShadow: '0 0 16px rgba(236,160,77,0.6)' },
  mapCompass: { position: 'absolute', right: '1rem', top: '0.8rem', color: 'rgba(246,207,142,0.84)', fontSize: '1.8rem', textShadow: '0 0 18px rgba(226,150,72,0.28)' },
  galleryFeature: { overflow: 'hidden', borderRadius: '1rem', border: '1px solid rgba(226,172,92,0.28)', boxShadow: '0 18px 34px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,235,195,0.09)' },
  galleryImage: { minHeight: '12rem', aspectRatio: '16 / 10' },
  galleryRail: { display: 'flex', gap: '0.48rem', overflowX: 'auto', padding: '0.04rem 0 0.1rem', scrollbarWidth: 'none' },
  galleryThumbButton: { all: 'unset', flex: '0 0 auto', cursor: 'pointer', width: '3.4rem', height: '2.5rem', padding: '0.14rem', borderRadius: '0.52rem', border: '1px solid rgba(226,172,92,0.25)', background: 'rgba(6,10,17,0.68)' },
  galleryThumbButtonActive: { border: '1px solid rgba(246,202,127,0.86)', boxShadow: '0 0 16px rgba(226,150,72,0.26)' },
  galleryThumbTone: { display: 'block', width: '100%', height: '100%', borderRadius: '0.4rem' },
  galleryCaption: { margin: 0, color: 'rgba(232,217,190,0.82)', fontSize: '0.74rem', lineHeight: 1.35 },
  planList: { margin: 0, paddingLeft: '1.25rem', display: 'grid', gap: '0.72rem' },
  planItem: { color: 'rgba(238,224,200,0.9)', fontSize: '0.84rem', lineHeight: 1.48, paddingLeft: '0.2rem' },
  bottomZone: { position: 'relative', zIndex: 3, display: 'grid', gap: '0.62rem' },
  modeRail: { display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '0.28rem', alignItems: 'end' },
  modeButton: { all: 'unset', cursor: 'pointer', display: 'grid', justifyItems: 'center', gap: '0.2rem', color: 'rgba(225,173,96,0.8)', textAlign: 'center', filter: 'drop-shadow(0 0 6px rgba(226,152,75,0.12))' },
  modeButtonActive: { color: 'rgba(255,220,156,0.98)', filter: 'drop-shadow(0 0 12px rgba(237,169,88,0.48))' },
  modeIcon: { width: '2.66rem', height: '2.66rem', display: 'grid', placeItems: 'center', borderRadius: '999px', border: '1px solid rgba(226,172,92,0.24)', background: 'radial-gradient(circle at 50% 35%, rgba(58,39,22,0.42), rgba(7,11,18,0.28) 72%)' },
  modeLabel: { fontSize: '0.56rem', letterSpacing: '0.12em', textTransform: 'uppercase' },
  askDock: { display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: '0.58rem', padding: '0.5rem 0.58rem', borderRadius: '999px', border: '1px solid rgba(226,172,92,0.38)', background: 'linear-gradient(160deg, rgba(9,14,22,0.88), rgba(6,9,15,0.78))', boxShadow: '0 20px 38px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,235,195,0.14)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' },
  askSigil: { width: '2rem', height: '2rem', borderRadius: '999px', border: '1px solid rgba(226,172,92,0.36)', color: 'rgba(245,207,145,0.9)', display: 'grid', placeItems: 'center', boxShadow: '0 0 14px rgba(226,150,72,0.18), inset 0 1px 0 rgba(255,235,195,0.12)' },
  askInput: { minWidth: 0, border: 0, outline: 'none', background: 'transparent', color: 'rgba(246,232,205,0.94)', fontSize: '1rem', letterSpacing: '0.01em' },
  askButton: { width: '2.12rem', height: '2.12rem', borderRadius: '999px', border: '1px solid rgba(226,172,92,0.46)', background: 'radial-gradient(circle at 35% 25%, rgba(122,93,58,0.86), rgba(20,25,32,0.86))', color: 'rgba(246,232,205,0.94)', fontSize: '1rem', boxShadow: '0 0 16px rgba(226,150,72,0.22)' },
};
