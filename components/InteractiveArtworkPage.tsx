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
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask Atlas what memory to follow next"
              style={styles.askInput}
              aria-label="Ask Atlas"
            />
            <button type="submit" style={styles.askButton} disabled={!canSend}>
              Ask
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { width: '100vw', height: '100dvh', minHeight: '100dvh', background: '#070b13', padding: 0, margin: 0, overflow: 'hidden' },
  goodellsPage: { width: '100vw', height: '100dvh', minHeight: '100dvh', overflow: 'hidden' },
  artworkStage: { position: 'relative', width: '100%', height: '100%', minHeight: '100dvh', overflow: 'hidden', maxWidth: '760px', margin: '0 auto' },
  goodellsArtworkStage: { width: '100vw', height: '100dvh', minHeight: '100dvh', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0, maxWidth: 'none', padding: 0 },
  artworkFrame: { position: 'relative', width: '100%', height: '100%' },
  goodellsArtworkFrame: { width: '100vw', height: '100dvh', maxWidth: '100%', minHeight: '100dvh', margin: 0, overflow: 'hidden', transition: 'width 320ms ease, height 320ms ease, box-shadow 320ms ease, border-radius 320ms ease' },
  artworkImage: { display: 'block', width: '100%', height: 'auto', objectFit: 'contain' },
  goodellsArtworkImage: { width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' },
  atmosphereVeil: { position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(5,8,15,0.2) 0%, rgba(6,9,17,0.52) 45%, rgba(4,6,12,0.86) 100%)' },
  goodellsAtmosphereVeil: { background: 'linear-gradient(180deg, rgba(8,12,20,0.03) 0%, rgba(8,12,20,0.04) 55%, rgba(8,12,20,0.18) 100%)' },
  videoRegion: { position: 'absolute', left: '8.5%', top: '17.4%', width: '82.8%', height: '20.4%', overflow: 'hidden', borderRadius: '1.2%', zIndex: 2 },
  video: { width: '100%', height: '100%', objectFit: 'cover' },
  topBackLink: { position: 'absolute', top: 'max(env(safe-area-inset-top, 0px), 0.8rem)', left: '0.8rem', zIndex: 5, color: 'rgba(244,227,198,0.92)', textDecoration: 'none', fontSize: '0.72rem', letterSpacing: '0.05em', textTransform: 'uppercase', border: '1px solid rgba(221,178,111,0.42)', borderRadius: '999px', padding: '0.35rem 0.68rem', background: 'rgba(8,14,24,0.55)' },
  askDock: { position: 'fixed', left: '4%', bottom: '3%', width: '92%', zIndex: 7, display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.55rem', padding: '0.55rem', borderRadius: '1.2rem', background: 'linear-gradient(170deg, rgba(11,18,31,0.88), rgba(11,16,26,0.7))', border: '1px solid rgba(224,182,114,0.32)', boxShadow: '0 20px 30px rgba(1,2,6,0.48), inset 0 1px 0 rgba(249,222,178,0.22)' },
  goodellsAskDock: { left: '6%', right: '6%', width: 'auto', maxWidth: '100%', boxSizing: 'border-box', bottom: 'max(5%, calc(env(safe-area-inset-bottom, 0px) + 0.95rem))', position: 'absolute' },
  askInput: { minWidth: 0, width: '100%', maxWidth: '100%', border: '1px solid rgba(218,179,116,0.24)', borderRadius: '0.88rem', background: 'rgba(6,11,20,0.78)', color: 'rgba(241,227,200,0.96)', fontSize: '16px', lineHeight: 1.2, padding: '0.68rem 0.75rem', outline: 'none' },
  askButton: { maxWidth: '100%', border: '1px solid rgba(236,194,123,0.42)', borderRadius: '0.88rem', background: 'linear-gradient(160deg, rgba(137,95,51,0.78), rgba(95,64,35,0.76))', color: 'rgba(255,245,228,0.98)', padding: '0.64rem 0.9rem', fontSize: '0.78rem', letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' },
  conversationLayers: { position: 'fixed', left: '4%', right: '4%', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 6.25rem)', zIndex: 6, height: 'min(62dvh, 33rem)', display: 'grid', gridTemplateRows: 'auto 1fr', gap: '0.35rem', transition: 'transform 560ms cubic-bezier(0.18, 0.76, 0.24, 1), opacity 420ms ease' },
  goodellsConversationLayers: { left: '6%', right: '6%' },
  stackRegion: { display: 'grid', justifyItems: 'stretch' },
  stackedCard: { all: 'unset', cursor: 'pointer', borderRadius: '0.9rem', padding: '0.5rem 0.7rem', border: '1px solid rgba(215,173,109,0.2)', background: 'linear-gradient(180deg, rgba(10,15,23,0.78), rgba(10,14,20,0.66))', boxShadow: '0 8px 14px rgba(2,4,8,0.35), inset 0 1px 0 rgba(236,204,154,0.12)', display: 'grid', gap: '0.2rem' },
  stackedTitle: { color: 'rgba(237,204,151,0.88)', fontSize: '0.58rem', letterSpacing: '0.08em', textTransform: 'uppercase' },
  stackedQuestion: { color: 'rgba(221,215,205,0.9)', fontSize: '0.72rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  activeCard: { borderRadius: '1.35rem', border: '1px solid rgba(226,183,114,0.28)', background: 'linear-gradient(180deg, rgba(12,18,30,0.94), rgba(11,15,25,0.84))', boxShadow: '0 25px 45px rgba(1,2,6,0.64), inset 0 1px 0 rgba(252,225,179,0.2)', display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'hidden', backdropFilter: 'blur(6px)' },
  panelHeader: { padding: '0.72rem 0.85rem 0.62rem', borderBottom: '1px solid rgba(214,170,104,0.24)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  panelTitle: { margin: 0, color: 'rgba(240,206,149,0.95)', fontSize: '0.64rem', letterSpacing: '0.14em', textTransform: 'uppercase' },
  minimizeButton: { border: '1px solid rgba(216,174,109,0.36)', background: 'rgba(15,21,33,0.66)', color: 'rgba(235,213,179,0.92)', borderRadius: '999px', fontSize: '0.62rem', letterSpacing: '0.05em', padding: '0.3rem 0.6rem', textTransform: 'uppercase' },
  activeScrollRegion: { overflowY: 'auto', overscrollBehavior: 'contain', padding: '0.9rem 0.95rem 1rem', display: 'grid', alignContent: 'start', gap: '0.55rem' },
  userPromptLabel: { margin: 0, color: 'rgba(198,176,138,0.8)', fontSize: '0.58rem', letterSpacing: '0.08em', textTransform: 'uppercase' },
  userPrompt: { margin: 0, color: 'rgba(235,226,208,0.96)', fontSize: '0.82rem', lineHeight: 1.3 },
  atlasCardTitle: { margin: '0.25rem 0 0', color: 'rgba(245,209,151,0.95)', fontSize: '0.68rem', letterSpacing: '0.08em', textTransform: 'uppercase' },
  atlasCardText: { margin: 0, color: 'rgba(242,233,218,0.96)', fontSize: '0.86rem', lineHeight: 1.42 },
  atlasHighlights: { margin: '0.25rem 0 0', paddingLeft: '1rem', display: 'grid', gap: '0.28rem' },
  atlasHighlightItem: { color: 'rgba(231,214,188,0.92)', fontSize: '0.77rem', lineHeight: 1.3 },
};
