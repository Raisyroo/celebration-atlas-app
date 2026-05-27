'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { getGoodellsMockConversation, type ConversationCard } from '../data/goodellsConversation';

type InteractiveArtworkPageProps = {
  eventId: string;
  eventName: string;
  artworkSrc: string;
  heroVideoSrc: string;
  backHref: string;
};

type ConversationLayer = {
  id: string;
  question: string;
  answer: string;
  title: string;
  highlights: readonly string[];
};

const FAIR_GUIDE_CARDS = {
  default: {
    title: 'Trail Start · Evening Fair Loop',
    text: 'Begin at the midway near sunset, then drift toward the 4-H barns when showcase energy builds.',
    highlights: ['Golden-hour midway photos', '4-H barn walk-through', 'Grandstand-ready by dusk'],
  },
  parking: {
    title: 'Field Note · Parking & Arrival',
    text: 'Arrive before 5:30 PM for easier east-lot parking. After that window, overflow lots plus shuttle signs are the smoothest route.',
    highlights: ['Best window: before 5:30 PM', 'Use east lots first', 'Overflow + shuttle after peak'],
  },
  family: {
    title: 'Family Route · Youth-First Plan',
    text: 'Start with youth exhibits and hands-on barns, then move to kid rides before late-evening ride lines build.',
    highlights: ['Hands-on 4-H exhibits', 'Kid rides before peak', 'Snack reset between zones'],
  },
  food: {
    title: 'Fair Fuel · Classic + Local Pairing',
    text: 'Pick one classic fair treat early, then save room for a local savory plate later when crowds shift to the grandstand.',
    highlights: ['Classic sweet first', 'Local savory second', 'Shorter lines during showtime'],
  },
} as const;

function getDefaultMockResponse(question: string): ConversationCard {
  const normalized = question.toLowerCase();
  if (normalized.includes('park')) return FAIR_GUIDE_CARDS.parking;
  if (normalized.includes('family') || normalized.includes('kids')) return FAIR_GUIDE_CARDS.family;
  if (normalized.includes('food') || normalized.includes('eat')) return FAIR_GUIDE_CARDS.food;
  return FAIR_GUIDE_CARDS.default;
}

function getMockResponse(eventId: string, question: string): ConversationCard {
  if (eventId === 'goodells-fair') {
    return getGoodellsMockConversation(question);
  }

  return getDefaultMockResponse(question);
}

export default function InteractiveArtworkPage({ eventId, eventName, artworkSrc, heroVideoSrc, backHref }: InteractiveArtworkPageProps) {
  const showGoodellsHeroVideo = false;
  const [draft, setDraft] = useState('');
  const [isConversationOpen, setIsConversationOpen] = useState(false);
  const [layers, setLayers] = useState<ConversationLayer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);

  const canSend = useMemo(() => draft.trim().length > 0, [draft]);

  const activeLayer = useMemo(() => layers.find((layer) => layer.id === activeLayerId) ?? layers.at(-1) ?? null, [layers, activeLayerId]);

  const stackedLayers = useMemo(() => {
    if (!activeLayer) return [];
    return layers.filter((layer) => layer.id !== activeLayer.id).slice(-4).reverse();
  }, [activeLayer, layers]);

  const handleSend = () => {
    const question = draft.trim();
    if (!question) return;

    const atlasGuide = getMockResponse(eventId, question);
    const newLayer: ConversationLayer = {
      id: `layer-${Date.now()}`,
      question,
      answer: atlasGuide.text,
      title: atlasGuide.title,
      highlights: atlasGuide.highlights ?? [],
    };

    setLayers((current) => [...current, newLayer]);
    setActiveLayerId(newLayer.id);
    setDraft('');
    setIsConversationOpen(true);
  };

  const isGoodellsEvent = eventId === 'goodells-fair';

  return (
    <main
      className={isGoodellsEvent ? 'event-portrait-root' : undefined}
      style={{ ...styles.page, ...(isGoodellsEvent ? styles.goodellsPage : null) }}
    >
      <section
        className={isGoodellsEvent ? 'event-portrait-shell' : undefined}
        style={{ ...styles.artworkStage, ...(isGoodellsEvent ? styles.goodellsArtworkStage : null) }}
        aria-label={`${eventName} memory collage`}
      >
        <div
          className={isGoodellsEvent ? 'event-portrait-canvas' : undefined}
          style={{ ...styles.artworkFrame, ...(isGoodellsEvent ? styles.goodellsArtworkFrame : null) }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- artworkSrc may be external/dynamic and must render as-is for this composited stage */}
          <img src={artworkSrc} alt={`${eventName} scrapbook artwork`} style={{ ...styles.artworkImage, ...(isGoodellsEvent ? styles.goodellsArtworkImage : null) }} />
          <div style={{ ...styles.atmosphereVeil, ...(isGoodellsEvent ? styles.goodellsAtmosphereVeil : null) }} />

          {/* Temporarily disabled: preserve Goodells hero video overlay for easy restore later. */}
          {showGoodellsHeroVideo ? (
            <div style={styles.videoRegion} aria-label="Hero video region">
              <video src={heroVideoSrc} muted autoPlay loop playsInline controls style={styles.video} />
            </div>
          ) : null}

          <Link href={backHref} style={styles.topBackLink}>
            ← Back to Atlas
          </Link>

          <div
            className={isGoodellsEvent ? 'event-portrait-conversation-layers' : undefined}
            style={{
              ...styles.conversationLayers,
              ...(isGoodellsEvent ? styles.goodellsConversationLayers : null),
              transform: isConversationOpen ? 'translateY(0)' : 'translateY(110%)',
              opacity: isConversationOpen ? 1 : 0,
              pointerEvents: isConversationOpen ? 'auto' : 'none',
            }}
          >
            <div style={styles.stackRegion}>
              {stackedLayers.map((layer, index) => (
                <button key={layer.id} type="button" style={{ ...styles.stackedCard, marginTop: `${index * 0.28}rem` }} onClick={() => setActiveLayerId(layer.id)}>
                  <span style={styles.stackedTitle}>{layer.title}</span>
                  <span style={styles.stackedQuestion}>{layer.question}</span>
                </button>
              ))}
            </div>

            {activeLayer ? (
              <article style={styles.activeCard}>
                <header style={styles.panelHeader}>
                  <p style={styles.panelTitle}>Atlas Memory Layer</p>
                  <button type="button" style={styles.minimizeButton} onClick={() => setIsConversationOpen(false)}>
                    Minimize
                  </button>
                </header>

                <div style={styles.activeScrollRegion}>
                  <p style={styles.userPromptLabel}>You asked</p>
                  <p style={styles.userPrompt}>{activeLayer.question}</p>

                  <p style={styles.atlasCardTitle}>{activeLayer.title}</p>
                  <p style={styles.atlasCardText}>{activeLayer.answer}</p>

                  {activeLayer.highlights.length ? (
                    <ul style={styles.atlasHighlights}>
                      {activeLayer.highlights.map((highlight) => (
                        <li key={highlight} style={styles.atlasHighlightItem}>
                          {highlight}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </article>
            ) : null}
          </div>
          <form className={isGoodellsEvent ? 'event-portrait-ask-dock' : undefined} style={{ ...styles.askDock, ...(isGoodellsEvent ? styles.goodellsAskDock : null) }} onSubmit={(event) => { event.preventDefault(); handleSend(); }}>
            <span aria-hidden style={styles.askSigil}>
              ✦
            </span>
            <input
              className="atlas-ask-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask Atlas what memory to follow next"
              style={styles.askInput}
              aria-label="Ask Atlas"
            />
            <button type="submit" style={styles.askButton} disabled={!canSend} aria-label="Send Ask Atlas prompt">
              ↗
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { width: '100vw', height: '100svh', minHeight: '100svh', background: '#070b13', padding: 0, margin: 0, overflow: 'hidden' },
  goodellsPage: { width: '100vw', height: '100svh', minHeight: '100svh', overflow: 'hidden' },
  artworkStage: { position: 'relative', width: '100%', height: '100%', minHeight: '100svh', overflow: 'hidden', maxWidth: '760px', margin: '0 auto' },
  goodellsArtworkStage: { width: '100vw', height: '100svh', minHeight: '100svh', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0, maxWidth: 'none', padding: 0 },
  artworkFrame: { position: 'relative', width: '100%', height: '100%' },
  goodellsArtworkFrame: { width: '100%', height: '100%', maxWidth: '100%', minHeight: 0, margin: 0, overflow: 'hidden', transition: 'width 320ms ease, height 320ms ease, box-shadow 320ms ease, border-radius 320ms ease' },
  artworkImage: { display: 'block', width: '100%', height: 'auto', objectFit: 'contain' },
  goodellsArtworkImage: { width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' },
  atmosphereVeil: { position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(5,8,15,0.2) 0%, rgba(6,9,17,0.52) 45%, rgba(4,6,12,0.86) 100%)' },
  goodellsAtmosphereVeil: { background: 'linear-gradient(180deg, rgba(8,12,20,0.03) 0%, rgba(8,12,20,0.04) 55%, rgba(8,12,20,0.18) 100%)' },
  videoRegion: { position: 'absolute', left: '8.5%', top: '17.4%', width: '82.8%', height: '20.4%', overflow: 'hidden', borderRadius: '1.2%', zIndex: 2 },
  video: { width: '100%', height: '100%', objectFit: 'cover' },
  topBackLink: { position: 'absolute', top: 'max(env(safe-area-inset-top, 0px), 0.8rem)', left: '0.8rem', zIndex: 5, color: 'rgba(244,227,198,0.92)', textDecoration: 'none', fontSize: '0.68rem', letterSpacing: '0.09em', textTransform: 'uppercase', border: '1px solid rgba(226,188,122,0.38)', borderRadius: '999px', padding: '0.38rem 0.74rem', background: 'linear-gradient(165deg, rgba(10,16,26,0.64), rgba(10,15,23,0.42))', boxShadow: '0 10px 20px rgba(1,3,9,0.38), inset 0 1px 0 rgba(248,226,182,0.16)' },
  askDock: { position: 'fixed', left: '4%', bottom: '3%', width: '92%', zIndex: 7, display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: '0.5rem', padding: '0.44rem 0.54rem', borderRadius: '1.08rem', background: 'linear-gradient(170deg, rgba(9,14,22,0.92), rgba(8,12,19,0.8))', border: '1px solid rgba(222,178,112,0.28)', boxShadow: '0 20px 32px rgba(1,2,6,0.46), 0 0 0 1px rgba(40,31,20,0.2), inset 0 1px 0 rgba(250,224,178,0.16), inset 0 -8px 16px rgba(2,4,8,0.32)', backdropFilter: 'blur(9px)', WebkitBackdropFilter: 'blur(9px)' },
  goodellsAskDock: { left: 'calc(env(safe-area-inset-left, 0px) + 0.78rem)', right: 'calc(env(safe-area-inset-right, 0px) + 0.78rem)', width: 'auto', maxWidth: '100%', boxSizing: 'border-box', bottom: 'max(1.6%, calc(env(safe-area-inset-bottom, 0px) + 0.56rem))', position: 'absolute', padding: '0.54rem 0.62rem', gap: '0.56rem', borderRadius: '1.14rem' },
  askSigil: { width: '1.5rem', height: '1.5rem', borderRadius: '999px', border: '1px solid rgba(223,184,121,0.3)', display: 'grid', placeItems: 'center', color: 'rgba(226,196,146,0.78)', fontSize: '0.62rem', letterSpacing: '0.08em', background: 'linear-gradient(170deg, rgba(20,26,37,0.8), rgba(9,13,21,0.7))', boxShadow: 'inset 0 1px 0 rgba(245,220,177,0.15), 0 0 0 1px rgba(41,32,21,0.26)' },
  askInput: { minWidth: 0, width: '100%', flex: 1, maxWidth: '100%', border: '1px solid rgba(216,178,118,0.2)', borderRadius: '0.84rem', background: 'linear-gradient(180deg, rgba(5,9,15,0.86), rgba(6,10,17,0.76))', color: 'rgba(234,223,205,0.95)', fontSize: '15px', lineHeight: 1.24, padding: '0.62rem 0.76rem', outline: 'none', letterSpacing: '0.014em', boxShadow: 'inset 0 1px 0 rgba(247,225,183,0.08), inset 0 -10px 16px rgba(2,3,8,0.28)' },
  askButton: { width: '2rem', height: '2rem', minWidth: '2rem', border: '1px solid rgba(233,191,120,0.34)', borderRadius: '999px', background: 'radial-gradient(circle at 35% 28%, rgba(165,121,72,0.45), rgba(67,46,27,0.58) 70%)', color: 'rgba(250,236,210,0.92)', padding: 0, fontSize: '0.83rem', letterSpacing: '0.01em', lineHeight: 1, whiteSpace: 'nowrap', display: 'grid', placeItems: 'center', boxShadow: '0 0 18px rgba(186,132,69,0.24), inset 0 1px 0 rgba(255,233,193,0.24)' },
  conversationLayers: { position: 'fixed', left: '4%', right: '4%', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 6.35rem)', zIndex: 6, height: 'min(62dvh, 33rem)', display: 'grid', gridTemplateRows: 'auto 1fr', gap: '0.48rem', transition: 'transform 560ms cubic-bezier(0.18, 0.76, 0.24, 1), opacity 420ms ease' },
  goodellsConversationLayers: { left: 'calc(env(safe-area-inset-left, 0px) + 0.78rem)', right: 'calc(env(safe-area-inset-right, 0px) + 0.78rem)', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.95rem)', height: 'min(64dvh, 34rem)' },
  stackRegion: { display: 'grid', justifyItems: 'stretch' },
  stackedCard: { all: 'unset', cursor: 'pointer', borderRadius: '0.96rem', padding: '0.56rem 0.76rem', border: '1px solid rgba(222,182,118,0.2)', background: 'linear-gradient(180deg, rgba(11,16,25,0.75), rgba(10,14,20,0.6))', boxShadow: '0 10px 18px rgba(2,4,8,0.34), 0 0 0 1px rgba(34,27,19,0.24), inset 0 1px 0 rgba(239,209,162,0.1)', display: 'grid', gap: '0.22rem', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' },
  stackedTitle: { color: 'rgba(236,205,156,0.8)', fontSize: '0.56rem', letterSpacing: '0.13em', textTransform: 'uppercase' },
  stackedQuestion: { color: 'rgba(222,216,206,0.86)', fontSize: '0.71rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  activeCard: { width: '100%', borderRadius: '1.18rem', border: '1px solid rgba(229,187,120,0.3)', background: 'linear-gradient(180deg, rgba(12,18,29,0.93), rgba(10,14,22,0.84))', boxShadow: '0 28px 52px rgba(1,2,6,0.62), 0 0 0 1px rgba(46,35,23,0.28), inset 0 1px 0 rgba(253,227,185,0.2), inset 0 -14px 30px rgba(5,8,14,0.3)', display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'hidden', backdropFilter: 'blur(9px)', WebkitBackdropFilter: 'blur(9px)' },
  panelHeader: { padding: '0.8rem 0.95rem 0.68rem', borderBottom: '1px solid rgba(220,178,111,0.22)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(180deg, rgba(18,25,36,0.46), rgba(15,21,31,0.08))' },
  panelTitle: { margin: 0, color: 'rgba(242,210,157,0.95)', fontSize: '0.6rem', letterSpacing: '0.16em', textTransform: 'uppercase' },
  minimizeButton: { border: '1px solid rgba(220,179,114,0.34)', background: 'rgba(13,20,31,0.6)', color: 'rgba(236,215,183,0.9)', borderRadius: '999px', fontSize: '0.58rem', letterSpacing: '0.09em', padding: '0.33rem 0.62rem', textTransform: 'uppercase' },
  activeScrollRegion: { overflowY: 'auto', overscrollBehavior: 'contain', padding: '1rem 1.04rem 1.14rem', display: 'grid', alignContent: 'start', gap: '0.62rem' },
  userPromptLabel: { margin: 0, color: 'rgba(203,182,147,0.78)', fontSize: '0.55rem', letterSpacing: '0.12em', textTransform: 'uppercase' },
  userPrompt: { margin: 0, color: 'rgba(236,228,212,0.94)', fontSize: '0.83rem', lineHeight: 1.4, fontStyle: 'italic' },
  atlasCardTitle: { margin: '0.28rem 0 0', color: 'rgba(246,211,154,0.94)', fontSize: '0.64rem', letterSpacing: '0.14em', textTransform: 'uppercase' },
  atlasCardText: { margin: 0, color: 'rgba(243,234,220,0.96)', fontSize: '0.87rem', lineHeight: 1.5 },
  atlasHighlights: { margin: '0.25rem 0 0', paddingLeft: '1.05rem', display: 'grid', gap: '0.3rem' },
  atlasHighlightItem: { color: 'rgba(234,217,191,0.92)', fontSize: '0.77rem', lineHeight: 1.34 },
};
