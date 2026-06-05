'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getGoodellsMockConversation, type ConversationCard, type ConversationVisual } from '../data/goodellsConversation';

type PromptResponseCard = {
  title: string;
  text: string;
  highlights?: readonly string[];
  visual?: ConversationVisual;
};

type ModeContent = {
  highlights: readonly string[];
  schedule: readonly { time: string; text: string }[];
  map: { label: string; caption: string; localTip?: string; visual?: ConversationVisual };
  gallery: readonly GalleryItem[];
};

type InteractiveArtworkPageProps = {
  eventId: string;
  eventName: string;
  artworkSrc: string;
  heroVideoSrc: string;
  backHref: string;
  placeholder?: string;
  guideLabel?: string;
  modeContent?: ModeContent;
  mockResponses?: readonly { keywords: readonly string[]; card: PromptResponseCard }[];
};

type ConversationLayer = {
  id: string;
  question: string;
  answer: string;
  title: string;
  highlights: readonly string[];
  visual?: ConversationVisual;
};

type AtlasMode = 'highlights' | 'schedule' | 'map' | 'gallery' | 'plan';

type AtlasModeOption = {
  id: AtlasMode;
  label: string;
};

const ATLAS_MODE_OPTIONS: readonly AtlasModeOption[] = [
  { id: 'highlights', label: 'Highlights' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'map', label: 'Map' },
  { id: 'gallery', label: 'Gallery' },
] as const;


type GalleryItem = { id: string; caption: string; tone: string };

const GALLERY_ITEMS: readonly GalleryItem[] = [
  { id: 'ferris-glow', caption: 'Ferris wheel glow before dusk.', tone: 'radial-gradient(circle at 32% 26%, rgba(239,180,102,0.4), rgba(86,58,34,0.46) 48%, rgba(16,13,14,0.9) 100%)' },
  { id: 'barn-lantern', caption: 'Barn lantern aisle at blue hour.', tone: 'radial-gradient(circle at 25% 32%, rgba(213,159,96,0.38), rgba(74,56,45,0.5) 44%, rgba(15,19,28,0.92) 100%)' },
  { id: 'grandstand-sky', caption: 'Grandstand skyline before fireworks.', tone: 'radial-gradient(circle at 44% 24%, rgba(248,189,117,0.34), rgba(73,52,37,0.5) 40%, rgba(12,16,27,0.92) 100%)' },
  { id: 'midway-neon', caption: 'Midway neon reflections on gravel.', tone: 'radial-gradient(circle at 56% 24%, rgba(248,177,110,0.36), rgba(78,58,45,0.5) 42%, rgba(15,16,24,0.92) 100%)' },
] as const;


const DEFAULT_MODE_CONTENT: ModeContent = {
  highlights: [
    'Fireworks tonight: Grandstand skyburst around 10:15 PM.',
    'Livestock ring windows: youth showcase at 4:30 PM and 7:00 PM.',
    'Midway lights are best for portraits between 8:05 and 8:45 PM.',
    'Local tip: grab cider near Heritage Gate before dinner rush.',
  ],
  schedule: [
    { time: '3:30 PM', text: '4-H barn walkthrough and youth demos.' },
    { time: '5:45 PM', text: 'Food lane reset + short midway ride window.' },
    { time: '7:00 PM', text: 'Livestock show ring spotlight and announcer notes.' },
    { time: '10:15 PM', text: 'Fireworks sequence from grandstand-facing lawns.' },
  ],
  map: {
    label: 'Fairgrounds Orientation',
    caption: 'Guide view centered on Heritage Gate, ring lanes, and the grandstand corridor.',
    localTip: 'Use the ring-to-midway connector at dusk to avoid the busiest crosswalk.',
  },
  gallery: GALLERY_ITEMS,
};
function ModeIcon({ mode }: { mode: AtlasMode }) {
  const commonProps = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
  };

  if (mode === 'highlights') {
    return (
      <svg {...commonProps}>
        <path d="M12 3.5l2.2 5.2 5.3 2.2-5.3 2.2L12 18.5l-2.2-5.4L4.5 10.9l5.3-2.2L12 3.5z" />
      </svg>
    );
  }

  if (mode === 'schedule') {
    return (
      <svg {...commonProps}>
        <circle cx="12" cy="13" r="6.7" />
        <path d="M12 9.7v3.4l2.2 1.4" />
        <path d="M8 3.7v2.2M16 3.7v2.2M6.4 5.9h11.2" />
      </svg>
    );
  }

  if (mode === 'map') {
    return (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="6.4" />
        <circle cx="12" cy="12" r="1.8" />
        <path d="M12 3.2v2.2M12 18.6v2.2M3.2 12h2.2M18.6 12h2.2" />
      </svg>
    );
  }

  if (mode === 'gallery') {
    return (
      <svg {...commonProps}>
        <rect x="3.8" y="6.8" width="16.4" height="12.4" rx="2.4" />
        <path d="M9 6.8l1.2-2h3.6l1.2 2" />
        <circle cx="12" cy="13" r="3.1" />
      </svg>
    );
  }

  return null;
}


const PREVIEW_QUESTION_BY_MODE: Record<AtlasMode, string> = {
  highlights: 'Show me the top Goodells highlights right now.',
  schedule: 'What does a strong evening schedule look like at Goodells?',
  map: 'Show me a quick map view for Goodells.',
  gallery: 'Give me a quick gallery-style memory moodboard.',
  plan: 'Build a simple family plan for Goodells.',
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

function getMockResponse(eventId: string, question: string, mockResponses?: readonly { keywords: readonly string[]; card: PromptResponseCard }[]): ConversationCard {
  if (mockResponses?.length) {
    const normalized = question.toLowerCase();
    for (const route of mockResponses) {
      if (route.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))) return { ...route.card, highlights: route.card.highlights ?? [] };
    }
  }

  if (eventId === 'goodells-fair') return getGoodellsMockConversation(question);

  return getDefaultMockResponse(question);
}

export default function InteractiveArtworkPage({ eventId, eventName, artworkSrc, heroVideoSrc, backHref, placeholder, guideLabel, modeContent, mockResponses }: InteractiveArtworkPageProps) {
  const showGoodellsHeroVideo = false;
  const [draft, setDraft] = useState('');
  const [isConversationOpen, setIsConversationOpen] = useState(false);
  const [layers, setLayers] = useState<ConversationLayer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<AtlasMode>('highlights');
  const [activeGalleryId, setActiveGalleryId] = useState<string>(GALLERY_ITEMS[0].id);
  const conversationScrollRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => draft.trim().length > 0, [draft]);
  const isGoodellsEvent = eventId === 'goodells-fair';

  const activeLayer = useMemo(() => layers.find((layer) => layer.id === activeLayerId) ?? layers.at(-1) ?? null, [layers, activeLayerId]);
  const previewLayer = useMemo<ConversationLayer | null>(() => {
    if (activeLayer || !isConversationOpen || !isGoodellsEvent) return null;

    const question = PREVIEW_QUESTION_BY_MODE[activeMode];
    const atlasGuide = getMockResponse(eventId, question, mockResponses);

    return {
      id: `preview-${activeMode}`,
      question,
      answer: atlasGuide.text,
      title: atlasGuide.title,
      highlights: atlasGuide.highlights ?? [],
      visual: atlasGuide.visual,
    };
  }, [activeLayer, activeMode, eventId, isConversationOpen, isGoodellsEvent, mockResponses]);

  const displayedLayer = activeLayer ?? previewLayer;
  const conversationTurns = layers.length > 0 ? layers : previewLayer ? [previewLayer] : [];
  const isMapMode = activeMode === 'map';
  const showIdleModeRail = !isConversationOpen;
  const activeModeContent = modeContent ?? DEFAULT_MODE_CONTENT;

  useEffect(() => {
    const scrollRegion = conversationScrollRef.current;
    if (!scrollRegion || !isConversationOpen) return;

    scrollRegion.scrollTo({ top: scrollRegion.scrollHeight, behavior: 'smooth' });
  }, [conversationTurns.length, isConversationOpen]);
  const galleryItems = activeModeContent.gallery?.length ? activeModeContent.gallery : GALLERY_ITEMS;
  const activeGalleryItem = useMemo(() => galleryItems.find((item) => item.id === activeGalleryId) ?? galleryItems[0], [activeGalleryId, galleryItems]);

  const handleSend = () => {
    const question = draft.trim();
    if (!question) return;

    const atlasGuide = getMockResponse(eventId, question, mockResponses);
    const newLayer: ConversationLayer = {
      id: `layer-${Date.now()}`,
      question,
      answer: atlasGuide.text,
      title: atlasGuide.title,
      highlights: atlasGuide.highlights ?? [],
      visual: atlasGuide.visual,
    };

    setLayers((current) => [...current, newLayer]);
    setActiveLayerId(newLayer.id);
    setDraft('');
    setIsConversationOpen(true);
  };

  const handleModeSelect = (mode: AtlasMode, shouldOpenMemoryLayer: boolean) => {
    setActiveMode(mode);

    if (!shouldOpenMemoryLayer) return;

    if (layers.length > 0 && !activeLayerId) {
      setActiveLayerId(layers[layers.length - 1].id);
    }

    setIsConversationOpen(true);
  };

  const renderModeRail = (shouldOpenMemoryLayer: boolean) => (
    <nav style={styles.modeRail} aria-label="Atlas exploration modes">
      {ATLAS_MODE_OPTIONS.map((mode) => {
        const isActive = activeMode === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => handleModeSelect(mode.id, shouldOpenMemoryLayer)}
            style={{ ...styles.modePill, ...(isActive ? styles.modePillActive : null) }}
            aria-pressed={isActive}
            aria-label={mode.label}
            title={mode.label}
          >
            <span style={styles.modeGlyph}><ModeIcon mode={mode.id} /></span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <main
      className={isGoodellsEvent ? 'event-portrait-root atlas-event-shell' : 'atlas-event-shell'}
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
            <div style={styles.openModeRailWrap}>{renderModeRail(false)}</div>

            {displayedLayer ? (
              <div style={styles.memoryLayerWrap}>
                <article style={styles.activeCard}>
                  <header style={styles.panelHeader}>
                    <div style={styles.panelMetadata}>
                      <p style={styles.panelKicker}>Ask Anything</p>
                      <p style={styles.panelTitle}>Conversation</p>
                    </div>
                    <button type="button" style={styles.minimizeButton} onClick={() => setIsConversationOpen(false)}>
                      Minimize
                    </button>
                  </header>
                  <div ref={conversationScrollRef} style={styles.activeScrollRegion}>
                    {conversationTurns.map((layer) => {
                      const isCurrentLayer = layer.id === displayedLayer.id;

                      return (
                        <section key={layer.id} style={styles.conversationTurn} aria-label={`Conversation turn for ${layer.question}`}>
                          <div style={styles.questionFieldNote}>
                            <p style={styles.userPromptLabel}>You asked</p>
                            <p style={styles.userPrompt}>{layer.question}</p>
                          </div>

                          <div style={styles.answerFieldNote}>
                            <p style={styles.userPromptLabel}>Atlas answered</p>
                            {activeMode === 'highlights' || !isCurrentLayer ? (
                              <section style={styles.modeSection}>
                                <p style={styles.atlasCardTitle}>{layer.title}</p>
                                <p style={styles.atlasCardText}>{layer.answer}</p>
                                <ul style={styles.atlasHighlights}>
                                  {layer.highlights.map((item) => (<li key={item} style={styles.atlasHighlightItem}>{item}</li>))}
                                </ul>
                              </section>
                            ) : null}

                            {isCurrentLayer && activeMode === 'schedule' ? (
                              <section style={styles.modeSection}>
                                <p style={styles.atlasCardTitle}>Evening Schedule Lens</p>
                                <div style={styles.timelineStack}>
                                  {activeModeContent.schedule.map((entry) => (<div key={entry.time + entry.text} style={styles.timelineBlock}><span style={styles.timelineTime}>{entry.time}</span><p style={styles.timelineText}>{entry.text}</p></div>))}
                                </div>
                              </section>
                            ) : null}

                            {isCurrentLayer && isMapMode ? (
                              <section style={styles.modeSection}>
                                <section style={styles.atlasVisualWrap} aria-label={layer.visual?.label}>
                                  <p style={styles.atlasVisualLabel}>{layer.visual?.label ?? activeModeContent.map.label}</p>
                                  <div style={styles.atlasMapInsert}>
                                    {(layer.visual?.src ?? activeModeContent.map.visual?.src) ? (
                                      <Image src={layer.visual?.src ?? activeModeContent.map.visual?.src ?? ''} alt="Goodells fairgrounds map field-note insert" fill sizes="(max-width: 720px) 100vw, 620px" style={styles.atlasMapImage} priority={false} />
                                    ) : null}
                                    <div style={styles.atlasMapOverlay} aria-hidden />
                                    <div style={styles.atlasMapFrameGlow} aria-hidden />
                                  </div>
                                  <p style={styles.atlasVisualCaption}>{layer.visual?.caption ?? activeModeContent.map.caption}</p>
                                  {(layer.visual?.localTip ?? activeModeContent.map.localTip) ? <p style={styles.atlasVisualTip}>{layer.visual?.localTip ?? activeModeContent.map.localTip}</p> : null}
                                </section>
                              </section>
                            ) : null}

                            {isCurrentLayer && activeMode === 'gallery' ? (
                              <section style={{ ...styles.modeSection, ...styles.galleryModeSection }}>
                                <article style={styles.galleryFocusCard} aria-label="Gallery feature image">
                                  <div style={{ ...styles.galleryImageTone, ...styles.galleryFocusImageTone, background: activeGalleryItem.tone }} aria-hidden />
                                </article>
                                <div style={styles.galleryThumbRail} aria-label="Gallery thumbnails">
                                  {galleryItems.map((item) => {
                                    const isSelected = item.id === activeGalleryItem.id;
                                    return (
                                      <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => setActiveGalleryId(item.id)}
                                        style={{ ...styles.galleryThumbButton, ...(isSelected ? styles.galleryThumbButtonActive : null) }}
                                        aria-pressed={isSelected}
                                        aria-label={item.caption}
                                      >
                                        <span style={{ ...styles.galleryThumbTone, background: item.tone }} aria-hidden />
                                      </button>
                                    );
                                  })}
                                </div>
                                <p style={styles.galleryCaption}>{activeGalleryItem.caption}</p>
                              </section>
                            ) : null}

                            {isCurrentLayer && activeMode === 'plan' ? (
                              <section style={styles.modeSection}>
                                <p style={styles.atlasCardTitle}>Family Day Plan</p>
                                <p style={styles.atlasCardText}>Start early for low-stress parking, build around barn showcases, then flow toward rides and fireworks with short walking loops.</p>
                                <ul style={styles.atlasHighlights}>
                                  <li style={styles.atlasHighlightItem}>Parking: east lots before 5:30 PM, overflow + shuttle after.</li>
                                  <li style={styles.atlasHighlightItem}>Best visit window: 4:00 PM – 9:30 PM for mixed family pacing.</li>
                                  <li style={styles.atlasHighlightItem}>Route: Heritage Gate → 4-H barns → food lane → midway → fireworks lawn.</li>
                                </ul>
                              </section>
                            ) : null}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </article>
              </div>
            ) : null}
          </div>
          {showIdleModeRail ? (
            <div style={{ ...styles.idleModeRailWrap, ...(isGoodellsEvent ? styles.goodellsIdleModeRailWrap : null) }}>
              {renderModeRail(true)}
            </div>
          ) : null}
          <form className={isGoodellsEvent ? 'event-portrait-ask-dock' : undefined} style={{ ...styles.askDock, ...(isGoodellsEvent ? styles.goodellsAskDock : null) }} onSubmit={(event) => { event.preventDefault(); handleSend(); }}>
            <span aria-hidden style={styles.askSigil}>{guideLabel ?? '✦'}</span>
            <input
              className="atlas-ask-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={placeholder ?? 'Ask Atlas what memory to follow next'}
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
  page: { width: '100vw', height: '100svh', minHeight: '100svh', padding: 0, margin: 0, overflow: 'hidden' },
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
  idleModeRailWrap: { position: 'fixed', left: '4%', right: '4%', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 4.78rem)', zIndex: 7, padding: '0.1rem 0.06rem' },
  goodellsIdleModeRailWrap: { left: 'calc(env(safe-area-inset-left, 0px) + 0.78rem)', right: 'calc(env(safe-area-inset-right, 0px) + 0.78rem)', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 4.56rem)' },
  askSigil: { width: '1.5rem', height: '1.5rem', borderRadius: '999px', border: '1px solid rgba(223,184,121,0.3)', display: 'grid', placeItems: 'center', color: 'rgba(226,196,146,0.78)', fontSize: '0.62rem', letterSpacing: '0.08em', background: 'linear-gradient(170deg, rgba(20,26,37,0.8), rgba(9,13,21,0.7))', boxShadow: 'inset 0 1px 0 rgba(245,220,177,0.15), 0 0 0 1px rgba(41,32,21,0.26)' },
  askInput: { minWidth: 0, width: '100%', flex: 1, maxWidth: '100%', border: '1px solid rgba(216,178,118,0.2)', borderRadius: '0.84rem', background: 'linear-gradient(180deg, rgba(5,9,15,0.86), rgba(6,10,17,0.76))', color: 'rgba(234,223,205,0.95)', fontSize: '15px', lineHeight: 1.24, padding: '0.62rem 0.76rem', outline: 'none', letterSpacing: '0.014em', boxShadow: 'inset 0 1px 0 rgba(247,225,183,0.08), inset 0 -10px 16px rgba(2,3,8,0.28)' },
  askButton: { width: '2rem', height: '2rem', minWidth: '2rem', border: '1px solid rgba(233,191,120,0.34)', borderRadius: '999px', background: 'radial-gradient(circle at 35% 28%, rgba(165,121,72,0.45), rgba(67,46,27,0.58) 70%)', color: 'rgba(250,236,210,0.92)', padding: 0, fontSize: '0.83rem', letterSpacing: '0.01em', lineHeight: 1, whiteSpace: 'nowrap', display: 'grid', placeItems: 'center', boxShadow: '0 0 18px rgba(186,132,69,0.24), inset 0 1px 0 rgba(255,233,193,0.24)' },
  conversationLayers: { position: 'fixed', left: '4%', right: '4%', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.62rem)', zIndex: 6, height: 'min(68dvh, 37rem)', display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', gap: '0.34rem', transition: 'transform 560ms cubic-bezier(0.18, 0.76, 0.24, 1), opacity 420ms ease' },
  goodellsConversationLayers: { left: 'calc(env(safe-area-inset-left, 0px) + 0.78rem)', right: 'calc(env(safe-area-inset-right, 0px) + 0.78rem)', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.18rem)', height: 'min(70dvh, 38rem)' },
  activeCard: { width: '100%', maxWidth: '100%', minHeight: 0, display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', overflow: 'visible', border: 'none', background: 'transparent', boxShadow: 'none' },
  panelHeader: { padding: '0 0.15rem 0.2rem', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'transparent' },
  panelMetadata: { display: 'grid', gap: '0.12rem' },
  panelKicker: { margin: 0, color: 'rgba(218,190,142,0.58)', fontSize: '0.52rem', letterSpacing: '0.18em', textTransform: 'uppercase' },
  panelTitle: { margin: 0, color: 'rgba(242,210,157,0.78)', fontSize: '0.58rem', letterSpacing: '0.18em', textTransform: 'uppercase' },
  minimizeButton: { border: 'none', background: 'transparent', color: 'rgba(236,215,183,0.68)', borderRadius: 0, fontSize: '0.56rem', letterSpacing: '0.12em', padding: '0.08rem 0', textTransform: 'uppercase' },
  memoryLayerWrap: { display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', gap: '0.45rem', minHeight: 0, width: '100%', maxWidth: '100%' },
  activeScrollRegion: { width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflowY: 'auto', overscrollBehavior: 'contain', padding: '0.85rem 0.15rem 1.2rem', display: 'grid', alignContent: 'start', gap: '1.35rem' },
  conversationTurn: { width: '100%', maxWidth: '100%', display: 'grid', gap: '0.86rem', padding: '0 0 1.18rem' },
  questionFieldNote: { width: '100%', maxWidth: '100%', display: 'grid', gap: '0.26rem' },
  answerFieldNote: { width: '100%', maxWidth: '100%', display: 'grid', gap: '0.42rem' },
  userPromptLabel: { margin: 0, color: 'rgba(214,183,128,0.76)', fontSize: '0.56rem', letterSpacing: '0.16em', textTransform: 'uppercase' },
  userPrompt: { margin: 0, color: 'rgba(240,232,216,0.96)', fontSize: 'clamp(0.98rem, 2.7vw, 1.18rem)', lineHeight: 1.48, fontStyle: 'italic' },
  atlasCardTitle: { margin: 0, color: 'rgba(246,211,154,0.95)', fontSize: '0.68rem', letterSpacing: '0.15em', textTransform: 'uppercase' },
  atlasCardText: { margin: 0, color: 'rgba(246,237,221,0.97)', fontSize: 'clamp(1rem, 2.55vw, 1.16rem)', lineHeight: 1.56 },
  atlasHighlights: { margin: '0.2rem 0 0', paddingLeft: '1.05rem', display: 'grid', gap: '0.34rem' },
  atlasHighlightItem: { color: 'rgba(236,220,194,0.9)', fontSize: '0.86rem', lineHeight: 1.42 },

  openModeRailWrap: { padding: '0.02rem 0.03rem 0.06rem', pointerEvents: 'auto' },
  modeRail: { display: 'flex', gap: '0.34rem', overflowX: 'auto', overscrollBehaviorX: 'contain', padding: '0.04rem 0.01rem 0.1rem', scrollbarWidth: 'thin', justifyContent: 'center' },
  modePill: { all: 'unset', cursor: 'pointer', flex: '0 0 auto', width: '2.28rem', height: '2.28rem', display: 'grid', placeItems: 'center', borderRadius: '999px', border: '1px solid rgba(225,179,114,0.26)', background: 'linear-gradient(180deg, rgba(13,19,30,0.8), rgba(9,14,22,0.72))', boxShadow: '0 12px 20px rgba(2,4,8,0.34), inset 0 1px 0 rgba(245,214,167,0.11)' },
  modePillActive: { border: '1px solid rgba(244,197,122,0.76)', background: 'linear-gradient(180deg, rgba(49,37,20,0.93), rgba(25,20,13,0.84))', boxShadow: '0 0 0 1px rgba(116,82,38,0.34), 0 0 12px rgba(220,164,89,0.28), inset 0 1px 0 rgba(255,230,184,0.26)' },
  modeGlyph: { width: '1.34rem', height: '1.34rem', borderRadius: '999px', display: 'grid', placeItems: 'center', color: 'rgba(243,211,156,0.95)', background: 'rgba(30,22,14,0.58)', border: '1px solid rgba(229,186,118,0.3)', lineHeight: 1 },
  modeSection: { display: 'grid', gap: '0.5rem' },
  galleryModeSection: { marginTop: '-0.12rem', gap: '0.38rem' },
  timelineStack: { display: 'grid', gap: '0.44rem' },
  timelineBlock: { borderRadius: '0.76rem', border: '1px solid rgba(214,177,117,0.24)', padding: '0.5rem 0.62rem', background: 'linear-gradient(160deg, rgba(15,21,33,0.82), rgba(11,16,25,0.64))' },
  timelineTime: { color: 'rgba(248,211,151,0.92)', fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: '0.22rem' },
  timelineText: { margin: 0, color: 'rgba(236,226,206,0.92)', fontSize: '0.76rem', lineHeight: 1.35 },
  galleryFocusCard: { borderRadius: '0.96rem', overflow: 'hidden', border: '1px solid rgba(224,186,123,0.2)', background: 'linear-gradient(165deg, rgba(16,22,34,0.78), rgba(10,15,24,0.64))', boxShadow: '0 12px 24px rgba(1,3,7,0.34), inset 0 1px 0 rgba(247,222,184,0.1)' },
  galleryImageTone: { aspectRatio: '4 / 5', minHeight: '12.6rem', background: 'radial-gradient(circle at 30% 26%, rgba(239,180,102,0.36), rgba(93,65,38,0.42) 45%, rgba(18,14,15,0.88) 100%)' },
  galleryFocusImageTone: { width: '100%' },
  galleryThumbRail: { display: 'flex', gap: '0.46rem', overflowX: 'auto', overscrollBehaviorX: 'contain', padding: '0.06rem 0.02rem', scrollbarWidth: 'thin' },
  galleryThumbButton: { all: 'unset', cursor: 'pointer', flex: '0 0 auto', width: '3rem', height: '3.7rem', borderRadius: '0.56rem', padding: '0.14rem', border: '1px solid rgba(224,186,123,0.28)', background: 'linear-gradient(175deg, rgba(18,24,36,0.72), rgba(9,14,23,0.7))', boxShadow: 'inset 0 1px 0 rgba(247,222,184,0.1)' },
  galleryThumbButtonActive: { border: '1px solid rgba(245,196,123,0.82)', boxShadow: '0 0 0 1px rgba(141,103,56,0.42), inset 0 1px 0 rgba(255,228,187,0.2)' },
  galleryThumbTone: { display: 'block', width: '100%', height: '100%', borderRadius: '0.46rem' },
  galleryCaption: { margin: 0, color: 'rgba(236,225,205,0.82)', fontSize: '0.66rem', lineHeight: 1.28 },

  atlasVisualWrap: { marginTop: '0.24rem', display: 'grid', gap: '0.5rem' },
  atlasVisualLabel: { margin: 0, color: 'rgba(242,209,150,0.92)', fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase' },
  atlasMapInsert: { position: 'relative', width: '100%', aspectRatio: '16 / 9', minHeight: '11rem', borderRadius: '0.92rem', overflow: 'hidden', border: '1px solid rgba(224,185,119,0.34)', background: 'radial-gradient(circle at 20% 18%, rgba(128,95,62,0.36), rgba(43,31,21,0.72) 55%, rgba(19,14,10,0.9) 100%)', boxShadow: '0 18px 30px rgba(3,4,7,0.44), inset 0 1px 0 rgba(248,223,183,0.22), inset 0 -20px 30px rgba(10,8,7,0.38)' },
  atlasMapImage: { objectFit: 'cover', objectPosition: 'center', transform: 'scale(1.01)', filter: 'saturate(1.03) contrast(1.03)' },
  atlasMapOverlay: { position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(16,12,8,0.1) 0%, rgba(16,12,8,0.02) 38%, rgba(14,10,8,0.28) 100%), repeating-linear-gradient(150deg, rgba(235,205,156,0.06) 0 2px, rgba(118,84,53,0.05) 2px 5px)', mixBlendMode: 'soft-light' },
  atlasMapFrameGlow: { position: 'absolute', inset: 0, borderRadius: 'inherit', boxShadow: 'inset 0 0 0 1px rgba(248,219,172,0.14), inset 0 16px 26px rgba(255,224,172,0.08), inset 0 -20px 30px rgba(6,5,4,0.34)' },
  atlasVisualCaption: { margin: 0, color: 'rgba(236,224,203,0.92)', fontSize: '0.76rem', lineHeight: 1.4 },
  atlasVisualTip: { margin: 0, color: 'rgba(245,212,163,0.9)', fontSize: '0.72rem', lineHeight: 1.35, fontStyle: 'italic' },
  atlasVisualGuideList: { margin: 0, paddingLeft: '1rem', display: 'grid', gap: '0.26rem' },
  atlasVisualGuideItem: { color: 'rgba(232,216,189,0.88)', fontSize: '0.71rem', lineHeight: 1.34 },
};
