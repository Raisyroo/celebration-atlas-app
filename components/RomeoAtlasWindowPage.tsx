"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type RefObject,
  type ReactNode,
} from "react";
import Link from "next/link";
import ArtifactTrail, {
  type ArtifactTrailData,
} from "./artifacts/ArtifactTrail";
import { type ArtifactType } from "./artifacts/ArtifactSymbol";
import RomeoDormantSchedule from "./RomeoDormantSchedule";

type RomeoContentMode = "highlights" | "schedule" | "maps" | "gallery" | "plan";
type RomeoAtlasMode = RomeoContentMode | "ask";

type RomeoAtlasModeOption = {
  id: RomeoContentMode;
  label: string;
  iconSrc: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
};

type PortalArtifactProps = {
  ariaLabel: string;
  artifactType: ArtifactType;
  artifactLabel?: string;
  title?: string;
  question: string;
  revealAriaLabel: string;
  portalBackground?: string;
  imageSrc?: string;
  revealVideo?: string;
  fact?: string;
  secondaryNote?: string;
  revealedContent?: ReactNode;
};

type GalleryPortalArtifact = {
  id: string;
  ariaLabel: string;
  artifactType: ArtifactType;
  artifactLabel?: string;
  title?: string;
  question: string;
  revealAriaLabel: string;
  portalBackground?: string;
  revealVideo?: string;
  fact?: string;
  secondaryNote?: string;
  usesMemoryMedia?: boolean;
};

type RomeoAtlasWindowPageProps = {
  eventId: string;
  eventName: string;
  backHref: string;
  memoryImageSrc: string;
  introVideoSrc: string;
};

const MEMORY_PORTAL_BACKGROUND_SRC = "/portal-backgrounds/memory-portal.png";
const LEGEND_PORTAL_BACKGROUND_SRC = "/portal-backgrounds/legend-portal.png";
const ARTIFACT_PORTAL_BACKGROUND_SRC =
  "/portal-backgrounds/artifact-portal.png";
const ORIGIN_ARTIFACT_BACKGROUND_SRC =
  "/portal-backgrounds/origin-artifact.png";
const DEFAULT_PORTAL_BACKGROUND_BY_ARTIFACT_TYPE: Partial<
  Record<ArtifactType, string>
> = {
  memory: MEMORY_PORTAL_BACKGROUND_SRC,
  origin: ORIGIN_ARTIFACT_BACKGROUND_SRC,
  legend: LEGEND_PORTAL_BACKGROUND_SRC,
  gold: ARTIFACT_PORTAL_BACKGROUND_SRC,
};
const ROMEO_PEACH_REVEAL_VIDEO_PATHS = {
  firstPeachQueen1931:
    "/artifact-reveals/romeo-peach/first-peach-queen-1931.mp4",
  lucillePlassey1933: "/artifact-reveals/romeo-peach/lucille-plassey-1933.mp4",
  romeoGrowersAssociation1950:
    "/artifact-reveals/romeo-peach/romeo-growers-association-1950.mp4",
  loisBealDeliversPeaches1937:
    "/artifact-reveals/romeo-peach/peaches-for-president-hoover.mp4",
  queenCourtDetroitAthleticClub1950:
    "/artifact-reveals/romeo-peach/queen-court-detroit-athletic-club-1950.mp4",
  realRomneyGeorgeRomney1968:
    "/artifact-reveals/romeo-peach/real-romney-george-romney-1968.mp4",
} as const;

const GALLERY_PORTAL_ARTIFACTS: readonly GalleryPortalArtifact[] = [
  {
    id: "peach-queen-origins",
    ariaLabel: "First Peach Queen origin portal artifact",
    artifactType: "origin",
    artifactLabel: "ORIGIN PORTAL",
    title: "Origins",
    question: "Want to see the first Peach Queen from 1931?",
    revealAriaLabel: "Reveal the first Peach Queen origin artifact",
    portalBackground: ORIGIN_ARTIFACT_BACKGROUND_SRC,
    revealVideo: ROMEO_PEACH_REVEAL_VIDEO_PATHS.firstPeachQueen1931,
  },
  {
    id: "memories",
    ariaLabel: "Romeo Peach Festival memories portal artifact",
    artifactType: "memory",
    artifactLabel: "MEMORY PORTAL",
    title: "Memories",
    question: "Remember your first Peach Festival?",
    revealAriaLabel: "Reveal the Romeo Peach Festival memories portal",
    portalBackground: MEMORY_PORTAL_BACKGROUND_SRC,
  },
  {
    id: "legends",
    ariaLabel: "Romeo Peach Festival legends portal artifact",
    artifactType: "legend",
    artifactLabel: "LEGEND PORTAL",
    title: "Legends",
    question: "Which Peach Festival stories became legend?",
    revealAriaLabel: "Reveal the Romeo Peach Festival legends portal",
    portalBackground: LEGEND_PORTAL_BACKGROUND_SRC,
  },
  {
    id: "artifacts",
    ariaLabel: "Romeo Peach Festival artifact archive portal artifact",
    artifactType: "gold",
    artifactLabel: "ARTIFACT PORTAL",
    title: "Artifacts",
    question: "What treasures survived the festival?",
    revealAriaLabel: "Reveal the Romeo Peach Festival artifact archive portal",
    portalBackground: ARTIFACT_PORTAL_BACKGROUND_SRC,
  },
] as const;

const GALLERY_ARTIFACT_TRAILS: readonly ArtifactTrailData[] = [
  {
    id: "peach-queen-origins",
    name: "Peach Queen Origins",
    parentArtifactId: "peach-queen-origins",
    artifacts: [
      {
        id: "lucille-plassey-1933",
        title: "Lucille Plassey, 1933",
        caption:
          "Lucille Plassey of Rochester was crowned Peach Queen in September 1933 before a crowd gathered outside the old Romeo High School.",
        videoSrc: ROMEO_PEACH_REVEAL_VIDEO_PATHS.lucillePlassey1933,
      },
      {
        id: "romeo-growers-association-1950",
        title: "Romeo Peach Growers Association, 1950",
        caption:
          "Peach Queen Rosemary Murray appears with Jerome Schoff, president of the Romeo Peach Growers Association, in 1950.",
        videoSrc: ROMEO_PEACH_REVEAL_VIDEO_PATHS.romeoGrowersAssociation1950,
      },
      {
        id: "lois-beal-delivers-peaches-1937",
        title: "Lois Beal Delivers Peaches, 1937",
        caption:
          "In 1937, Peach Queen Lois Beal delivered Romeo peaches to President Franklin D. Roosevelt in Washington, D.C.",
        videoSrc: ROMEO_PEACH_REVEAL_VIDEO_PATHS.loisBealDeliversPeaches1937,
      },
      {
        id: "queen-court-detroit-athletic-club-1950",
        title: "Queen and Court at Detroit Athletic Club, 1950",
        caption:
          "In 1950, the Romeo Peach Queen and her court appeared at the Detroit Athletic Club in Detroit, Michigan.",
        videoSrc:
          ROMEO_PEACH_REVEAL_VIDEO_PATHS.queenCourtDetroitAthleticClub1950,
      },
      {
        id: "real-romney-george-romney-1968",
        title: "The “Real” Romney, 1968",
        caption:
          "In 1968, Michigan Governor George W. Romney received a peach from Peach Queen Donna Jean Christenson of Flint in Lansing.",
        videoSrc: ROMEO_PEACH_REVEAL_VIDEO_PATHS.realRomneyGeorgeRomney1968,
      },
    ],
  },
] as const;

const MODE_OPTIONS: readonly RomeoAtlasModeOption[] = [
  { id: "highlights", label: "Highlights", iconSrc: "/ui/highlights-icon.svg" },
  { id: "schedule", label: "Schedule", iconSrc: "/ui/schedule-icon.svg" },
  { id: "maps", label: "Maps", iconSrc: "/ui/maps-icon.svg" },
  { id: "gallery", label: "Gallery", iconSrc: "/ui/gallery-icon.svg" },
  { id: "plan", label: "Plan", iconSrc: "/ui/plan-icon.svg" },
] as const;

const MAP_GUIDANCE = [
  ["Main Street", "Primary parade corridor and easiest orientation line."],
  ["Side streets", "Use for food lines, shade, and crowd breaks."],
  ["Outer lots", "Best parking target; walk into the downtown core."],
] as const;

const PLAN_ITEMS = [
  ["Parking", "Park outside the core before afternoon traffic increases."],
  ["Families", "Choose a side-street meeting point before the parade."],
  ["Food", "Buy peach items before peak dinner lines."],
  [
    "Photography",
    "Use Main Street for parade photos and storefront light after sunset.",
  ],
  [
    "Accessibility",
    "Expect crowds and curb changes; arrive early for easier positioning.",
  ],
] as const;

const ANSWER_MATCHERS: readonly {
  keywords: readonly string[];
  answer: string;
}[] = [
  {
    keywords: ["parking", "park", "lot"],
    answer:
      "Aim for outer lots and side-street parking before afternoon traffic builds, then walk into the downtown core for the easiest Romeo Peach Festival arrival.",
  },
  {
    keywords: ["food", "eat", "dessert", "peach", "vendor", "vendors"],
    answer:
      "The best food move is to grab peach desserts, cold drinks, and vendor specials before the dinner rush, when lines around Main Street get longer.",
  },
  {
    keywords: ["parade", "route", "main street"],
    answer:
      "For the parade, use Main Street as your anchor and claim a viewing spot early because the route starts filling well before the late-afternoon crowd peak.",
  },
  {
    keywords: ["schedule", "time", "when", "times", "events"],
    answer:
      "Plan around a midday opening window, busier food lines in the afternoon, parade crowds near 4:00 PM, and a softer evening walk-through after sunset.",
  },
  {
    keywords: ["map", "maps", "where", "directions", "downtown"],
    answer:
      "Use Main Street as the orientation line, side streets for crowd breaks, and outer lots as the calmer parking targets before walking downtown.",
  },
  {
    keywords: ["photos", "photo", "picture", "pictures", "gallery", "camera"],
    answer:
      "For photos, try the parade corridor on Main Street, peach stands in warm afternoon light, and storefronts after sunset when the downtown glow is strongest.",
  },
  {
    keywords: ["family", "families", "kids", "children", "parents"],
    answer:
      "For families, choose a side-street meeting point, take breaks away from Main Street, and arrive early if you want an easier parade-viewing spot.",
  },
  {
    keywords: [
      "accessibility",
      "accessible",
      "wheelchair",
      "stroller",
      "mobility",
      "ada",
    ],
    answer:
      "For accessibility, arrive early for calmer movement, expect curb changes and crowded sidewalks, and use side streets when Main Street gets tight.",
  },
] as const;

const GENERAL_ATLAS_ANSWER =
  "Romeo Peach Festival is easiest when you treat Main Street as your anchor: arrive early, park outside the busiest core, sample peach food before peak lines, and save time for the parade, photos, and an evening stroll.";

const INTRO_VISIBLE_MS = 6000;
const INTRO_FADE_MS = 420;

type IntroStatus = "playing" | "dissolving" | "complete";

function getAtlasAnswer(question: string) {
  const normalizedQuestion = question.toLowerCase();
  return (
    ANSWER_MATCHERS.find(({ keywords }) =>
      keywords.some((keyword) => normalizedQuestion.includes(keyword)),
    )?.answer ?? GENERAL_ATLAS_ANSWER
  );
}

const HIGHLIGHT_STATEMENTS = [
  "🍑 Peach Queen Tradition",
  "🎡 Midway & Carnival",
  "🎺 Peach Parade",
] as const;

function MemorySeparator() {
  return (
    <div style={styles.memorySeparator} aria-hidden="true">
      <span style={styles.memorySeparatorStar}>✦</span>
      <span style={styles.memorySeparatorGlyph}>atlas / memory</span>
      <span style={styles.memorySeparatorStar}>✧</span>
    </div>
  );
}

function RomeoAtlasConversation({
  messages,
  historyRef,
}: {
  messages: ChatMessage[];
  historyRef: RefObject<HTMLElement | null>;
}) {
  const conversationPairs = messages.reduce<
    { id: string; question?: ChatMessage; answer?: ChatMessage }[]
  >((pairs, message) => {
    if (message.role === "user" || pairs.length === 0) {
      pairs.push({ id: message.id, question: message });
      return pairs;
    }

    const latestPair = pairs[pairs.length - 1];
    if (!latestPair.answer) {
      latestPair.answer = message;
      latestPair.id = `${latestPair.id}-${message.id}`;
      return pairs;
    }

    pairs.push({ id: message.id, answer: message });
    return pairs;
  }, []);

  return (
    <section
      ref={historyRef}
      className="romeo-memory-scroll romeo-mode-content-reveal"
      style={{ ...styles.memoryContent, ...styles.askAnythingMemoryContent }}
      aria-label="Atlas conversation history"
      aria-live="polite"
    >
      <div style={styles.askAnythingInner}>
        <header style={styles.askAnythingHeader}>
          <p style={styles.windowEyebrow}>ASK ANYTHING</p>
          <p style={styles.askAnythingSecondaryLabel}>CONVERSATION</p>
        </header>

        <div style={styles.askAnythingStack}>
          {conversationPairs.map((pair) => (
            <article key={pair.id} style={styles.askAnythingEntry}>
              {pair.question ? (
                <p style={styles.askAnythingQuestion}>
                  {pair.question.content}
                </p>
              ) : null}
              {pair.answer ? (
                <p style={styles.askAnythingAnswer}>{pair.answer.content}</p>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PortalArtifact({
  ariaLabel,
  artifactType,
  artifactLabel,
  title,
  question,
  revealAriaLabel,
  portalBackground,
  imageSrc,
  revealVideo,
  fact,
  secondaryNote,
  revealedContent,
}: PortalArtifactProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [hasVideoEnded, setHasVideoEnded] = useState(false);
  const [showFact, setShowFact] = useState(false);
  const [videoLoadFailed, setVideoLoadFailed] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const isMemoryPortal = artifactType === "memory";
  const portalLabel =
    artifactLabel ??
    (isMemoryPortal ? "MEMORY PORTAL" : `${artifactType.toUpperCase()} PORTAL`);
  const hasRevealContent = Boolean(
    revealVideo || fact || secondaryNote || revealedContent,
  );
  const closedPortalBackground =
    portalBackground ??
    DEFAULT_PORTAL_BACKGROUND_BY_ARTIFACT_TYPE[artifactType] ??
    null;
  const shouldShowPortalBackground =
    Boolean(closedPortalBackground) && (!isRevealed || !revealVideo);
  const portalBackgroundStyle: CSSProperties | null =
    shouldShowPortalBackground && closedPortalBackground
      ? {
          backgroundImage: `url(${closedPortalBackground})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }
      : null;
  const portalApertureStyle: CSSProperties = {
    ...styles.portalAperture,
    ...(portalBackgroundStyle ?? null),
    ...(isRevealed && revealVideo
      ? {
          backgroundImage: "none",
        }
      : null),
  };

  const portalArtifactStyle: CSSProperties = {
    ...styles.portalArtifact,
    ...(isRevealed && revealVideo ? styles.revealedPortalArtifact : null),
  };

  const portalFrameStyle: CSSProperties = {
    ...styles.portalFrame,
    ...(isRevealed && revealVideo ? styles.revealedPortalFrame : null),
  };

  const portalHaloStyle: CSSProperties = {
    ...styles.portalHalo,
    ...(isRevealed && revealVideo ? styles.revealedPortalHalo : null),
  };

  const portalVideoStyle: CSSProperties = {
    ...styles.portalVideo,
    opacity: isVideoReady ? 1 : 0,
  };

  const playRevealVideo = useCallback(() => {
    const video = videoRef.current;

    if (!video) return;

    video.currentTime = 0;
    video.muted = true;
    setHasVideoEnded(false);
    setShowFact(false);
    setVideoLoadFailed(false);
    setIsVideoReady(false);

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      setIsVideoReady(true);
    }

    const playPromise = video.play();

    if (playPromise) {
      void playPromise.catch(() => {
        setVideoLoadFailed(true);
      });
    }
  }, []);

  useEffect(() => {
    if (!isRevealed || !revealVideo) return;

    playRevealVideo();
  }, [isRevealed, playRevealVideo, revealVideo]);

  const handleReveal = () => {
    setIsRevealed(true);
    setHasVideoEnded(false);
    setShowFact(false);
    setVideoLoadFailed(false);
    setIsVideoReady(false);

    if (!hasRevealContent) return;

    if (!revealVideo) {
      window.setTimeout(() => setShowFact(true), 420);
    }
  };

  const handleRevealButtonClick = () => {
    if (!hasRevealContent) return;

    handleReveal();
  };

  const handleVideoReady = () => {
    setIsVideoReady(true);
    setVideoLoadFailed(false);
  };

  const handleVideoEnded = () => {
    setHasVideoEnded(true);
    setShowFact(true);
  };

  const handleVideoError = () => {
    setVideoLoadFailed(true);
    setIsVideoReady(false);
  };

  const handlePortalReplay = () => {
    if (!isRevealed || !hasVideoEnded || !revealVideo) return;

    playRevealVideo();
  };

  return (
    <>
      <article style={portalArtifactStyle} aria-label={ariaLabel}>
        {title ? <h3 style={styles.portalTitle}>{title}</h3> : null}
        {!isMemoryPortal ? (
          <div
            style={{
              ...styles.portalMemoryBackdrop,
              ...((imageSrc ?? closedPortalBackground)
                ? {
                    backgroundImage: `url(${imageSrc ?? closedPortalBackground})`,
                  }
                : null),
            }}
            aria-hidden="true"
          />
        ) : null}
        <div style={portalHaloStyle} aria-hidden="true" />
        <div style={portalFrameStyle}>
          <div
            style={portalApertureStyle}
            onClick={handlePortalReplay}
            role={
              isRevealed && hasVideoEnded && revealVideo ? "button" : undefined
            }
            tabIndex={
              isRevealed && hasVideoEnded && revealVideo ? 0 : undefined
            }
            onKeyDown={(event) => {
              if (
                (event.key === "Enter" || event.key === " ") &&
                isRevealed &&
                hasVideoEnded &&
                revealVideo
              ) {
                event.preventDefault();
                playRevealVideo();
              }
            }}
            aria-label={
              isRevealed && hasVideoEnded && revealVideo
                ? `${ariaLabel}. Replay reveal video.`
                : undefined
            }
          >
            {!isRevealed ? (
              <div
                className="romeo-portal-question"
                style={styles.portalQuestionLayer}
              >
                <p style={styles.portalArtifactLabel}>{portalLabel}</p>
                <h3 style={styles.portalQuestion}>{question}</h3>
                <button
                  type="button"
                  className="romeo-portal-reveal"
                  style={styles.portalRevealButton}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleRevealButtonClick();
                  }}
                  aria-disabled={!hasRevealContent}
                  aria-label={revealAriaLabel}
                >
                  Reveal
                </button>
              </div>
            ) : null}

            {isRevealed && revealVideo ? (
              <>
                <video
                  ref={videoRef}
                  className="romeo-portal-video"
                  style={portalVideoStyle}
                  src={revealVideo}
                  autoPlay
                  muted
                  playsInline
                  controls={false}
                  preload="auto"
                  onLoadedData={handleVideoReady}
                  onCanPlay={handleVideoReady}
                  onEnded={handleVideoEnded}
                  onError={handleVideoError}
                  aria-label={ariaLabel}
                />
                {videoLoadFailed ? (
                  <p style={styles.portalVideoFallback}>
                    This memory video could not be loaded.
                  </p>
                ) : null}
                {hasVideoEnded ? (
                  <button
                    type="button"
                    className="romeo-portal-replay"
                    style={styles.portalReplayButton}
                    onClick={(event) => {
                      event.stopPropagation();
                      playRevealVideo();
                    }}
                    aria-label={`Replay ${ariaLabel}`}
                  >
                    Replay
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
        {showFact && (fact || secondaryNote) ? (
          <div
            className="romeo-portal-fact is-visible"
            style={styles.portalFactStack}
          >
            {fact ? <p style={styles.portalFactNote}>{fact}</p> : null}
            {secondaryNote ? (
              <p style={styles.portalSecondaryNote}>{secondaryNote}</p>
            ) : null}
          </div>
        ) : null}
      </article>
      {isRevealed && revealedContent ? revealedContent : null}
    </>
  );
}

function getHighlightsHeroTitleStyle(eventName: string): CSSProperties {
  const isLongTitle = eventName.trim().length > 40;

  return {
    ...styles.highlightsHeroTitle,
    ...(isLongTitle ? styles.highlightsHeroTitleLong : null),
  };
}

function RomeoMemoryContent({
  activeMode,
  eventName,
  introVideoSrc,
  memoryImageSrc,
  shouldAutoplayIntroVideo,
  onIntroVideoPlayback,
}: {
  activeMode: RomeoContentMode;
  eventName: string;
  introVideoSrc: string;
  memoryImageSrc: string;
  shouldAutoplayIntroVideo: boolean;
  onIntroVideoPlayback: () => void;
}) {
  const [introVideoReady, setIntroVideoReady] = useState(
    !shouldAutoplayIntroVideo,
  );
  const [introStatus, setIntroStatus] = useState<IntroStatus>(
    shouldAutoplayIntroVideo ? "playing" : "complete",
  );
  const highlightsScrollRef = useRef<HTMLElement | null>(null);
  const introVisibleTimerRef = useRef<number | null>(null);
  const introFadeTimerRef = useRef<number | null>(null);

  const finishIntroVideo = useCallback(() => {
    if (introVisibleTimerRef.current !== null) {
      window.clearTimeout(introVisibleTimerRef.current);
      introVisibleTimerRef.current = null;
    }

    if (introFadeTimerRef.current !== null) {
      return;
    }

    setIntroStatus("dissolving");
    introFadeTimerRef.current = window.setTimeout(() => {
      introFadeTimerRef.current = null;
      onIntroVideoPlayback();
      setIntroStatus("complete");
    }, INTRO_FADE_MS);
  }, [onIntroVideoPlayback]);

  const startIntroVisibleTimer = useCallback(() => {
    if (
      introStatus !== "playing" ||
      introVisibleTimerRef.current !== null ||
      introFadeTimerRef.current !== null
    ) {
      return;
    }

    introVisibleTimerRef.current = window.setTimeout(() => {
      introVisibleTimerRef.current = null;
      finishIntroVideo();
    }, INTRO_VISIBLE_MS);
  }, [finishIntroVideo, introStatus]);

  useEffect(() => {
    return () => {
      if (introVisibleTimerRef.current !== null) {
        window.clearTimeout(introVisibleTimerRef.current);
      }

      if (introFadeTimerRef.current !== null) {
        window.clearTimeout(introFadeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (activeMode === "highlights" || introStatus === "complete") {
      return;
    }

    finishIntroVideo();
  }, [activeMode, finishIntroVideo, introStatus]);

  const handleIntroCanPlay = useCallback(() => {
    setIntroVideoReady(true);
  }, []);

  const handleIntroVideoPlay = useCallback(() => {
    onIntroVideoPlayback();
  }, [onIntroVideoPlayback]);

  useEffect(() => {
    startIntroVisibleTimer();
  }, [startIntroVisibleTimer]);

  const handleIntroVideoError = useCallback(() => {
    if (introVisibleTimerRef.current !== null) {
      window.clearTimeout(introVisibleTimerRef.current);
      introVisibleTimerRef.current = null;
    }

    if (introFadeTimerRef.current !== null) {
      window.clearTimeout(introFadeTimerRef.current);
      introFadeTimerRef.current = null;
    }

    onIntroVideoPlayback();
    setIntroStatus("complete");
  }, [onIntroVideoPlayback]);

  if (activeMode === "schedule") {
    return (
      <section
        className="romeo-memory-scroll romeo-mode-content-reveal"
        style={{ ...styles.memoryContent, ...styles.scheduleMemoryContent }}
        aria-label="Schedule lens"
      >
        <RomeoDormantSchedule eventName={eventName} eventState="UPCOMING" />
      </section>
    );
  }

  if (activeMode === "maps") {
    return (
      <section
        className="romeo-memory-scroll romeo-mode-content-reveal"
        style={styles.memoryContent}
        aria-label="Maps lens"
      >
        <p style={styles.windowEyebrow}>Maps</p>
        <h2 style={styles.windowTitle}>Downtown Romeo orientation</h2>
        <MemorySeparator />
        <div style={styles.mapPlate} aria-hidden="true">
          <span style={{ ...styles.mapNode, left: "18%", top: "42%" }} />
          <span style={{ ...styles.mapNode, left: "48%", top: "28%" }} />
          <span style={{ ...styles.mapNode, left: "74%", top: "57%" }} />
          <span style={styles.mapRoute} />
          <span style={styles.mapCompass}>✦</span>
        </div>
        <div style={styles.highlightGrid}>
          {MAP_GUIDANCE.map(([title, text]) => (
            <article key={title} style={styles.highlightCard}>
              <h3 style={styles.highlightTitle}>{title}</h3>
              <p style={styles.highlightText}>{text}</p>
            </article>
          ))}
        </div>
        <p style={styles.windowTip}>
          Field note: park outside the core and walk inward.
        </p>
      </section>
    );
  }

  if (activeMode === "gallery") {
    return (
      <section
        className="romeo-memory-scroll romeo-mode-content-reveal"
        style={{ ...styles.memoryContent, ...styles.galleryMemoryContent }}
        aria-label="Gallery lens"
      >
        <div style={styles.galleryHeader}>
          <p style={styles.windowEyebrow}>Gallery</p>
        </div>
        {GALLERY_PORTAL_ARTIFACTS.map((artifact) => {
          const trail = GALLERY_ARTIFACT_TRAILS.find(
            (artifactTrail) => artifactTrail.parentArtifactId === artifact.id,
          );

          return (
            <div key={artifact.id} style={styles.galleryArtifactGroup}>
              <PortalArtifact
                ariaLabel={artifact.ariaLabel}
                artifactType={artifact.artifactType}
                artifactLabel={artifact.artifactLabel}
                title={artifact.title}
                question={artifact.question}
                revealAriaLabel={artifact.revealAriaLabel}
                portalBackground={artifact.portalBackground}
                imageSrc={artifact.usesMemoryMedia ? memoryImageSrc : undefined}
                revealVideo={artifact.revealVideo}
                fact={artifact.fact}
                secondaryNote={artifact.secondaryNote}
                revealedContent={
                  trail ? <ArtifactTrail trail={trail} /> : undefined
                }
              />
            </div>
          );
        })}
      </section>
    );
  }

  if (activeMode === "plan") {
    return (
      <section
        className="romeo-memory-scroll romeo-mode-content-reveal"
        style={styles.memoryContent}
        aria-label="Plan lens"
      >
        <p style={styles.windowEyebrow}>Plan</p>
        <h2 style={styles.windowTitle}>Practical notes</h2>
        <MemorySeparator />
        <ol style={styles.planList}>
          {PLAN_ITEMS.map(([title, text]) => (
            <li key={title} style={styles.planItem}>
              <strong>{title}:</strong> {text}
            </li>
          ))}
        </ol>
      </section>
    );
  }

  const shouldShowIntroVideo = introStatus !== "complete";
  const shouldShowHighlightsContent = introStatus !== "playing";

  return (
    <section
      ref={highlightsScrollRef}
      className="romeo-memory-scroll"
      style={{
        ...styles.memoryContent,
        ...styles.highlightsMemoryContent,
        ...styles.highlightsPostIntroMemoryContent,
      }}
      aria-label="Highlights lens"
    >
      {shouldShowIntroVideo ? (
        <figure
          className="romeo-cinematic-video-memory"
          style={{
            ...styles.highlightsIntroVideoLayer,
            ...(introVideoReady
              ? styles.highlightsIntroVideoLayerReady
              : styles.highlightsIntroVideoLayerHidden),
            ...(introStatus === "dissolving"
              ? styles.highlightsIntroVideoLayerHidden
              : null),
          }}
          data-intro-state={introStatus}
          data-ready={introVideoReady ? "true" : "false"}
        >
          <video
            src={introVideoSrc}
            autoPlay
            muted
            playsInline
            preload="metadata"
            aria-label="Romeo Peach Festival intro video"
            className="romeo-cinematic-intro-video"
            style={{
              ...styles.highlightsIntroVideo,
              ...(introVideoReady ? styles.highlightsIntroVideoReady : null),
            }}
            onCanPlay={handleIntroCanPlay}
            onPlay={handleIntroVideoPlay}
            onError={handleIntroVideoError}
          >
            Romeo intro video unavailable
          </video>
          <span style={styles.cinematicVideoOverlay} aria-hidden="true" />
        </figure>
      ) : null}
      {shouldShowHighlightsContent ? (
        <div
          className="romeo-mode-content-reveal romeo-highlights-content"
          style={{
            ...styles.highlightsContentReveal,
            ...(shouldShowIntroVideo
              ? styles.highlightsContentUnderIntro
              : null),
          }}
        >
          <header style={styles.highlightsHeroHeader}>
            <p style={{ ...styles.windowEyebrow, ...styles.highlightsEyebrow }}>
              Highlights
            </p>
          </header>

          <div style={styles.highlightsIntroCopy}>
            <h2 style={getHighlightsHeroTitleStyle(eventName)}>{eventName}</h2>
            <p style={styles.highlightsDescriptor}>
              Michigan&apos;s most famous peach celebration.
            </p>
            <p style={styles.highlightsSupportLine}>
              A Labor Day tradition since 1931.
            </p>
          </div>

          <ul
            style={styles.highlightsShowcase}
            aria-label="Romeo Peach Festival highlights"
          >
            {HIGHLIGHT_STATEMENTS.map((statement) => (
              <li key={statement} style={styles.highlightsStatement}>
                {statement}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export default function RomeoAtlasWindowPage({
  eventId,
  eventName,
  backHref,
  memoryImageSrc,
  introVideoSrc,
}: RomeoAtlasWindowPageProps) {
  const [activeMode, setActiveMode] = useState<RomeoAtlasMode>("highlights");
  const [askQuestion, setAskQuestion] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [introPlaybackEventId, setIntroPlaybackEventId] = useState<
    string | null
  >(null);
  const chatHistoryRef = useRef<HTMLElement | null>(null);
  const hasPlayedIntroVideo = introPlaybackEventId === eventId;

  const handleIntroVideoPlayback = useCallback(() => {
    setIntroPlaybackEventId(eventId);
  }, [eventId]);

  const handleAtlasExit = () => {
    setIntroPlaybackEventId(null);
  };

  useEffect(() => {
    if (activeMode !== "ask") {
      return;
    }

    chatHistoryRef.current?.scrollTo({
      top: chatHistoryRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [activeMode, chatMessages.length]);

  const handleAskSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedQuestion = askQuestion.trim();
    if (!trimmedQuestion) {
      return;
    }

    const submittedAt = new Date();
    const answeredAt = new Date(submittedAt.getTime() + 1);
    const answer = getAtlasAnswer(trimmedQuestion);

    setChatMessages((currentMessages) => [
      ...currentMessages,
      {
        id: `${submittedAt.getTime()}-${currentMessages.length}-user`,
        role: "user",
        content: trimmedQuestion,
        createdAt: submittedAt,
      },
      {
        id: `${answeredAt.getTime()}-${currentMessages.length}-assistant`,
        role: "assistant",
        content: answer,
        createdAt: answeredAt,
      },
    ]);
    setActiveMode("ask");
    setAskQuestion("");
  };

  const handleModeSelect = (mode: RomeoAtlasMode) => {
    setActiveMode(mode);
  };

  return (
    <main
      style={styles.page}
      className="atlas-event-shell"
      data-event-id={eventId}
    >
      <style>{`
          .romeo-memory-scroll::-webkit-scrollbar { display: none; }
          .romeo-atlas-back-link {
            transition:
              color 180ms ease,
              border-color 180ms ease,
              box-shadow 180ms ease,
              text-shadow 180ms ease,
              transform 180ms ease;
          }
          .romeo-atlas-back-link:hover,
          .romeo-atlas-back-link:focus-visible {
            color: rgba(255, 229, 181, 0.98);
            border-color: rgba(244, 194, 112, 0.68);
            box-shadow:
              0 0 13px rgba(226, 150, 72, 0.18),
              inset 0 0 13px rgba(226, 172, 92, 0.07),
              inset 0 1px 0 rgba(255, 235, 195, 0.1);
            text-shadow: 0 0 9px rgba(244, 194, 112, 0.28);
            transform: scale(1.015);
          }
          .romeo-atlas-back-link:active {
            transform: scale(0.995);
          }
          .romeo-mode-lens {
            -webkit-tap-highlight-color: transparent;
            transform: scale(1);
            transform-origin: center;
            transition:
              color 180ms ease,
              text-shadow 180ms ease,
              transform 180ms ease;
          }
          .romeo-mode-lens:hover,
          .romeo-mode-lens:focus-visible {
            color: rgba(211, 156, 78, 0.86);
            outline: none;
            transform: scale(1.015);
          }
          .romeo-mode-lens[data-active="true"] {
            color: rgba(239, 190, 116, 0.96);
            text-shadow: 0 1px 0 rgba(0, 0, 0, 0.62);
          }
          .romeo-mode-lens[data-active="true"] > span {
            opacity: 1 !important;
          }
          .romeo-cinematic-video-memory {
            pointer-events: none;
            transition: opacity 420ms ease-out;
          }
          .romeo-cinematic-video-memory[data-intro-state="dissolving"] {
            transition-duration: 420ms;
            transition-timing-function: ease-out;
          }
          .romeo-cinematic-intro-video {
            animation: romeo-cinematic-ken-burns 24s ease-in-out infinite alternate;
          }
          .romeo-mode-content-reveal,
          .romeo-highlights-content {
            animation: romeo-highlights-fade-in 1050ms ease-out forwards;
            will-change: opacity, transform;
          }
          .romeo-highlights-content {
            animation-duration: 620ms;
          }
          .romeo-portal-question {
            transition: opacity 760ms ease, transform 760ms ease, filter 760ms ease;
          }
          .romeo-portal-question.is-revealed {
            opacity: 0;
            transform: translate3d(0, -0.35rem, 0) scale(0.985);
            filter: blur(6px);
            pointer-events: none;
          }
          .romeo-portal-reveal {
            transition: transform 180ms ease, box-shadow 180ms ease, color 180ms ease, border-color 180ms ease;
          }
          .romeo-portal-symbol {
            align-self: end;
          }
          .romeo-portal-reveal:hover,
          .romeo-portal-reveal:focus-visible {
            color: rgba(255, 240, 213, 0.98);
            border-color: rgba(246, 202, 127, 0.72);
            box-shadow: 0 0 22px rgba(226, 150, 72, 0.18), inset 0 1px 0 rgba(255,255,255,0.16);
            outline: none;
            transform: translateY(-1px);
          }
          .romeo-portal-video {
            transition: opacity 220ms ease-out;
          }
          .romeo-portal-replay {
            animation: romeo-portal-replay-appear 720ms ease-out forwards;
            transition: color 180ms ease, border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
          }
          .romeo-portal-replay:hover,
          .romeo-portal-replay:focus-visible {
            color: rgba(255, 240, 213, 0.96);
            border-color: rgba(246, 202, 127, 0.58);
            box-shadow: 0 0 20px rgba(226, 150, 72, 0.2), inset 0 1px 0 rgba(255,255,255,0.14);
            outline: none;
            transform: translateX(-50%) translateY(-1px);
          }
          .romeo-portal-fact {
            transition: opacity 720ms ease 260ms, transform 720ms ease 260ms;
          }
          .romeo-portal-fact.is-visible {
            opacity: 1 !important;
            transform: translate3d(0, 0, 0) !important;
          }
          @keyframes romeo-portal-replay-appear {
            from {
              opacity: 0;
              transform: translateX(-50%) translateY(0.35rem);
            }
            to {
              opacity: 1;
              transform: translateX(-50%) translateY(0);
            }
          }
          @keyframes romeo-highlights-fade-in {
            from {
              opacity: 0;
              transform: translate3d(0, 12px, 0);
            }
            to {
              opacity: 1;
              transform: translate3d(0, 0, 0);
            }
          }
          @keyframes romeo-cinematic-ken-burns {
            0%, 100% {
              transform: scale(1.08);
            }
            50% {
              transform: scale(1.12);
            }
          }
          @media (prefers-reduced-motion: reduce) {
            .romeo-cinematic-video-memory,
            .romeo-cinematic-video-memory[data-intro-state="dissolving"],
            .romeo-cinematic-intro-video,
            .romeo-mode-content-reveal,
            .romeo-highlights-content,
            .romeo-portal-replay {
              animation-duration: 1ms;
            }
            .romeo-cinematic-intro-video {
              transform: scale(1.08);
            }
          }
        `}</style>
      <section
        style={styles.stage}
        aria-label={`${eventName} Atlas floating memory`}
      >
        <div style={styles.stars} aria-hidden="true" />
        <Link
          href={backHref}
          className="romeo-atlas-back-link"
          style={styles.backLink}
          onClick={handleAtlasExit}
        >
          ← ATLAS
        </Link>

        <div
          style={{
            ...styles.festivalMemory,
            backgroundImage: `url(${memoryImageSrc})`,
          }}
          aria-hidden="true"
        />
        <div style={styles.softVerticalVignette} aria-hidden="true" />
        <div style={styles.textReadabilityGlow} aria-hidden="true" />
        <div style={styles.atmosphericVeil} aria-hidden="true" />
        <div style={styles.floatingMemoryStars} aria-hidden="true">
          <span
            style={{ ...styles.floatingMemoryStar, left: "12%", top: "17%" }}
          >
            ✦
          </span>
          <span
            style={{
              ...styles.floatingMemoryStar,
              left: "82%",
              top: "24%",
              opacity: 0.62,
            }}
          >
            ✧
          </span>
          <span
            style={{
              ...styles.floatingMemoryStar,
              left: "73%",
              top: "72%",
              opacity: 0.5,
            }}
          >
            ✦
          </span>
          <span
            style={{ ...styles.floatingMemoryGlyph, left: "16%", top: "78%" }}
          >
            atlas
          </span>
        </div>

        <section
          style={{
            ...styles.floatingMemoryLayout,
            ...(activeMode === "gallery"
              ? styles.galleryFloatingMemoryLayout
              : null),
          }}
          aria-live="polite"
          aria-label="Atlas memory content"
        >
          {activeMode === "ask" ? (
            <RomeoAtlasConversation
              messages={chatMessages}
              historyRef={chatHistoryRef}
            />
          ) : (
            <RomeoMemoryContent
              key={`${eventId}:${activeMode}`}
              activeMode={activeMode}
              eventName={eventName}
              introVideoSrc={introVideoSrc}
              memoryImageSrc={memoryImageSrc}
              shouldAutoplayIntroVideo={!hasPlayedIntroVideo}
              onIntroVideoPlayback={handleIntroVideoPlayback}
            />
          )}
        </section>

        <section
          style={styles.bottomZone}
          aria-label="Atlas controls and Ask Anything"
        >
          <nav style={styles.modeRail} aria-label="Atlas controls">
            <span style={styles.modeRailAtmosphere} aria-hidden="true" />
            {MODE_OPTIONS.map((mode) => {
              const isActive = mode.id === activeMode;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => handleModeSelect(mode.id)}
                  className="romeo-mode-lens"
                  style={{
                    ...styles.modeButton,
                    ...(isActive ? styles.modeButtonActive : null),
                  }}
                  aria-label={`${mode.label} lens`}
                  aria-pressed={isActive}
                  data-active={isActive ? "true" : "false"}
                  title={mode.label}
                >
                  <span style={styles.modeIconStack}>
                    <img
                      src={mode.iconSrc}
                      alt=""
                      style={styles.modeIconImage}
                      aria-hidden="true"
                      draggable={false}
                    />
                  </span>
                  <span style={styles.modeLabel}>{mode.label}</span>
                </button>
              );
            })}
          </nav>

          <form style={styles.askDock} onSubmit={handleAskSubmit}>
            <span style={styles.askSigil} aria-hidden="true">
              ✦
            </span>
            <input
              style={styles.askInput}
              className="atlas-ask-input"
              placeholder="Ask Anything"
              aria-label="Ask Anything"
              value={askQuestion}
              onChange={(event) => setAskQuestion(event.target.value)}
            />
            <button
              type="submit"
              style={styles.askButton}
              aria-label="Submit Ask Anything prompt"
            >
              ↗
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}

const gold = "rgba(226, 172, 92, 0.88)";

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100vw",
    height: "100svh",
    minHeight: "100svh",
    overflow: "hidden",
    color: "rgba(246,232,205,0.94)",
    background: "radial-gradient(circle at 50% 15%, #172233, #05070c 70%)",
  },
  stage: {
    position: "relative",
    width: "min(100vw, 760px)",
    height: "100svh",
    margin: "0 auto",
    overflow: "hidden",
    padding:
      "max(0.62rem, env(safe-area-inset-top, 0px)) 0.72rem max(0.56rem, env(safe-area-inset-bottom, 0px))",
    boxSizing: "border-box",
    display: "grid",
    gridTemplateRows: "minmax(0, 1fr) auto",
    gap: "0.52rem",
  },
  stars: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    background:
      "radial-gradient(circle at 18% 22%, rgba(241,186,102,0.2) 0 1px, transparent 2px), radial-gradient(circle at 78% 18%, rgba(241,186,102,0.18) 0 1px, transparent 2px), radial-gradient(circle at 65% 72%, rgba(241,186,102,0.16) 0 1px, transparent 2px), linear-gradient(180deg, rgba(4,7,15,0.08), rgba(3,5,11,0.34))",
  },
  backLink: {
    position: "absolute",
    right: "max(0.72rem, env(safe-area-inset-right, 0px))",
    top: "max(0.62rem, env(safe-area-inset-top, 0px))",
    zIndex: 5,
    minHeight: "2.35rem",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "rgba(238,196,126,0.86)",
    textDecoration: "none",
    fontSize: "0.61rem",
    fontWeight: 600,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    border: "1px solid rgba(232,178,96,0.46)",
    borderRadius: "999px",
    padding: "0.34rem 0.7rem",
    background: "transparent",
    boxShadow:
      "0 0 10px rgba(226,150,72,0.12), inset 0 0 11px rgba(226,172,92,0.045), inset 0 1px 0 rgba(255,235,195,0.06)",
    textShadow: "0 0 7px rgba(226,172,92,0.16)",
    transformOrigin: "center",
    willChange: "transform",
  },
  festivalMemory: {
    position: "absolute",
    inset: "-4% -8%",
    zIndex: 0,
    opacity: 0.4,
    backgroundSize: "cover",
    backgroundPosition: "50% 46%",
    backgroundRepeat: "no-repeat",
    filter: "brightness(1.08) saturate(1.08) contrast(1.14)",
    mixBlendMode: "screen",
    pointerEvents: "none",
    transform: "translateZ(0) scale(1.03)",
  },
  softVerticalVignette: {
    position: "absolute",
    inset: 0,
    zIndex: 1,
    pointerEvents: "none",
    background:
      "linear-gradient(180deg, rgba(3,6,13,0.8) 0%, rgba(4,7,14,0.28) 22%, rgba(5,8,15,0.18) 48%, rgba(5,7,13,0.42) 76%, rgba(2,4,9,0.86) 100%)",
  },
  textReadabilityGlow: {
    position: "absolute",
    left: "-12%",
    right: "-12%",
    top: "15%",
    bottom: "12%",
    zIndex: 1,
    pointerEvents: "none",
    background:
      "radial-gradient(ellipse 74% 62% at 50% 44%, rgba(3,5,10,0.44), rgba(4,6,12,0.24) 46%, transparent 78%), linear-gradient(90deg, rgba(2,4,9,0.24), transparent 20%, transparent 80%, rgba(2,4,9,0.24))",
  },
  atmosphericVeil: {
    position: "absolute",
    inset: "-18% -16%",
    zIndex: 1,
    pointerEvents: "none",
    background:
      "radial-gradient(ellipse at 28% 34%, rgba(238,232,216,0.08), transparent 34%), radial-gradient(ellipse at 66% 28%, rgba(255,204,134,0.08), transparent 31%), radial-gradient(ellipse at 42% 74%, rgba(194,205,219,0.06), transparent 36%), repeating-radial-gradient(ellipse at 52% 48%, rgba(255,255,255,0.026) 0 1px, transparent 1px 20px)",
    opacity: 0.72,
    filter: "blur(18px)",
    mixBlendMode: "screen",
    transform: "rotate(-4deg)",
  },
  floatingMemoryLayout: {
    alignSelf: "stretch",
    position: "relative",
    zIndex: 3,
    minHeight: 0,
    marginTop: "clamp(2.8rem, 8svh, 4.35rem)",
    overflow: "hidden",
  },
  memoryContent: {
    position: "absolute",
    inset: 0,
    zIndex: 3,
    display: "grid",
    alignContent: "safe center",
    gap: "clamp(1.15rem, 3.3svh, 1.8rem)",
    padding: "clamp(1.15rem, 5.2vw, 2.3rem) clamp(0.82rem, 5.6vw, 2.35rem)",
    boxSizing: "border-box",
    overflowX: "hidden",
    overflowY: "auto",
    overscrollBehavior: "contain",
    WebkitOverflowScrolling: "touch",
    WebkitMaskImage:
      "linear-gradient(to bottom, transparent 0%, black 8%, black 88%, transparent 100%)",
    maskImage:
      "linear-gradient(to bottom, transparent 0%, black 8%, black 88%, transparent 100%)",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
    textShadow: "0 2px 18px rgba(0,0,0,0.58), 0 0 26px rgba(226,150,72,0.12)",
  },
  scheduleMemoryContent: {
    alignContent: "start",
    paddingTop: "0",
    paddingBottom: "clamp(1.25rem, 4svh, 2.2rem)",
    WebkitMaskImage:
      "linear-gradient(to bottom, black 0%, black 94%, transparent 100%)",
    maskImage:
      "linear-gradient(to bottom, black 0%, black 94%, transparent 100%)",
  },
  highlightsMemoryContent: {
    alignContent: "center",
    justifyItems: "center",
    padding:
      "clamp(2.2rem, 7svh, 4.6rem) clamp(0.82rem, 5.6vw, 2.35rem) clamp(1.6rem, 5.5svh, 3.4rem)",
  },
  highlightsPostIntroMemoryContent: {
    alignContent: "center",
    justifyItems: "center",
    overflowX: "hidden",
    overflowY: "auto",
    overscrollBehavior: "contain",
    WebkitOverflowScrolling: "touch",
    touchAction: "pan-y",
    WebkitMaskImage:
      "linear-gradient(to bottom, transparent 0%, black 8%, black 88%, transparent 100%)",
    maskImage:
      "linear-gradient(to bottom, transparent 0%, black 8%, black 88%, transparent 100%)",
    scrollPaddingTop: "clamp(2.2rem, 7svh, 4.6rem)",
  },
  highlightsIntroVideoLayer: {
    position: "absolute",
    inset: 0,
    zIndex: 2,
    display: "block",
    width: "100%",
    height: "100%",
    minHeight: "100%",
    margin: 0,
    overflow: "hidden",
    borderRadius: 0,
    border: 0,
    background: "transparent",
    boxShadow: "none",
    opacity: 0,
    pointerEvents: "none",
    isolation: "isolate",
    transition: `opacity ${INTRO_FADE_MS}ms ease-out`,
  },
  highlightsIntroVideoLayerHidden: {
    opacity: 0,
  },
  highlightsIntroVideoLayerReady: {
    opacity: 1,
  },
  highlightsIntroVideo: {
    position: "absolute",
    inset: 0,
    zIndex: 2,
    display: "block",
    width: "100%",
    height: "100%",
    minWidth: "100%",
    minHeight: "100%",
    maxWidth: "none",
    maxHeight: "none",
    objectFit: "cover",
    objectPosition: "50% 60%",
    transform: "scale(1.08)",
    opacity: 0,
    mixBlendMode: "soft-light",
    filter: "saturate(0.88) contrast(1.04) brightness(0.86)",
    willChange: "opacity, transform",
    transition: `opacity ${INTRO_FADE_MS}ms ease-out`,
  },
  highlightsIntroVideoReady: {
    opacity: 0.52,
  },
  cinematicVideoOverlay: {
    position: "absolute",
    inset: 0,
    zIndex: 3,
    pointerEvents: "none",
    background:
      "radial-gradient(ellipse at center, rgba(246,202,127,0.07) 0%, rgba(126,70,39,0.09) 44%, rgba(1,3,8,0.16) 82%, rgba(1,3,8,0.2) 100%), linear-gradient(180deg, rgba(1,3,8,0.16) 0%, rgba(78,49,34,0.12) 52%, rgba(1,3,8,0.31) 100%)",
    mixBlendMode: "multiply",
    boxShadow:
      "inset 0 48px 88px rgba(1,3,8,0.3), inset 0 -64px 98px rgba(1,3,8,0.34)",
  },
  floatingMemoryStars: {
    position: "absolute",
    inset: 0,
    zIndex: 2,
    pointerEvents: "none",
  },
  floatingMemoryStar: {
    position: "absolute",
    color: "rgba(246,202,127,0.78)",
    fontSize: "0.62rem",
    textShadow: "0 0 16px rgba(226,150,72,0.46)",
  },
  floatingMemoryGlyph: {
    position: "absolute",
    color: "rgba(246,202,127,0.36)",
    fontSize: "0.52rem",
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    transform: "rotate(-10deg)",
  },
  memorySeparator: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.42rem",
    color: "rgba(246,202,127,0.54)",
    fontSize: "0.54rem",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    opacity: 0.72,
    textShadow: "0 0 14px rgba(226,150,72,0.26)",
  },
  memorySeparatorStar: { color: "rgba(246,202,127,0.72)", fontSize: "0.58rem" },
  memorySeparatorGlyph: { color: "rgba(230,210,178,0.34)", fontSize: "0.5rem" },
  windowEyebrow: {
    margin: 0,
    color: gold,
    fontSize: "0.62rem",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
  },
  windowTitle: {
    margin: 0,
    color: "rgba(255,238,207,0.98)",
    fontFamily: "Georgia, Times New Roman, serif",
    fontWeight: 400,
    fontSize: "clamp(1.76rem, 7.2vw, 3.05rem)",
    lineHeight: 0.98,
    textShadow: "0 3px 24px rgba(0,0,0,0.72), 0 0 20px rgba(227,146,76,0.2)",
  },
  windowBody: {
    margin: 0,
    color: "rgba(237,221,193,0.92)",
    fontSize: "0.9rem",
    lineHeight: 1.58,
    maxWidth: "34rem",
  },
  askAnythingMemoryContent: {
    alignContent: "safe center",
    justifyItems: "center",
    paddingTop: "clamp(3.4rem, 10svh, 5.7rem)",
    paddingBottom: "clamp(2.6rem, 8svh, 4.6rem)",
  },
  askAnythingInner: {
    display: "grid",
    gap: "clamp(1.25rem, 3.6svh, 2rem)",
    width: "100%",
    maxWidth: "34rem",
    justifySelf: "center",
  },
  askAnythingHeader: {
    display: "grid",
    gap: "0.32rem",
    justifyItems: "center",
    textAlign: "center",
  },
  askAnythingSecondaryLabel: {
    margin: 0,
    color: "rgba(246,202,127,0.46)",
    fontSize: "0.56rem",
    letterSpacing: "0.16em",
    textTransform: "uppercase",
  },
  askAnythingStack: {
    display: "grid",
    gap: "clamp(1.65rem, 4.5svh, 2.65rem)",
    width: "100%",
  },
  askAnythingEntry: {
    display: "grid",
    gap: "clamp(0.62rem, 1.9svh, 0.95rem)",
    width: "100%",
    margin: 0,
  },
  askAnythingQuestion: {
    margin: 0,
    color: "rgba(255,238,207,0.98)",
    fontFamily: "Georgia, Times New Roman, serif",
    fontWeight: 400,
    fontSize: "clamp(1.58rem, 6.6vw, 2.92rem)",
    lineHeight: 1.02,
    letterSpacing: "-0.035em",
    textWrap: "balance",
    textShadow: "0 4px 28px rgba(0,0,0,0.78), 0 0 24px rgba(227,146,76,0.22)",
  },
  askAnythingAnswer: {
    margin: 0,
    color: "rgba(237,221,193,0.92)",
    fontFamily: "Georgia, Times New Roman, serif",
    fontSize: "clamp(0.98rem, 3.5vw, 1.16rem)",
    lineHeight: 1.62,
    maxWidth: "32rem",
    textShadow: "0 2px 18px rgba(0,0,0,0.58)",
  },
  answerQuestion: {
    margin: 0,
    color: "rgba(255,238,207,0.98)",
    fontFamily: "Georgia, Times New Roman, serif",
    fontWeight: 400,
    fontSize: "clamp(1.34rem, 5.8vw, 2.42rem)",
    lineHeight: 1.08,
    maxWidth: "34rem",
    textShadow: "0 3px 24px rgba(0,0,0,0.72), 0 0 20px rgba(227,146,76,0.2)",
  },
  answerText: {
    margin: 0,
    color: "rgba(237,221,193,0.92)",
    fontSize: "clamp(1rem, 3.7vw, 1.2rem)",
    lineHeight: 1.58,
    maxWidth: "34rem",
  },
  windowTip: {
    margin: 0,
    color: "rgba(244,197,126,0.9)",
    fontSize: "0.8rem",
    lineHeight: 1.48,
    fontStyle: "italic",
    maxWidth: "32rem",
  },
  highlightsContentReveal: {
    gridArea: "1 / 1",
    zIndex: 1,
    display: "grid",
    alignContent: "center",
    justifyItems: "center",
    gap: "clamp(1.1rem, 3.6svh, 2.2rem)",
    width: "100%",
    maxWidth: "100%",
    minHeight: "100%",
    justifySelf: "stretch",
    alignSelf: "center",
    textAlign: "center",
    opacity: 0,
    willChange: "opacity, transform",
  },
  highlightsHeroHeader: {
    display: "grid",
    gap: "clamp(0.8rem, 2.5svh, 1.2rem)",
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    justifyItems: "center",
    justifySelf: "stretch",
  },
  highlightsEyebrow: {
    textAlign: "center",
    letterSpacing: "0.28em",
  },
  highlightsContentUnderIntro: {
    pointerEvents: "none",
  },
  highlightsIntroCopy: {
    display: "grid",
    justifyItems: "center",
    gap: "clamp(0.55rem, 1.6svh, 0.85rem)",
    width: "100%",
    maxWidth: "42rem",
    paddingRight: "clamp(1.05rem, 5.4vw, 2.35rem)",
    paddingLeft: "clamp(1.05rem, 5.4vw, 2.35rem)",
    boxSizing: "border-box",
  },
  highlightsHeroTitle: {
    margin: 0,
    width: "100%",
    maxWidth: "11ch",
    minWidth: 0,
    color: "rgba(255,238,207,0.98)",
    fontFamily: "Georgia, Times New Roman, serif",
    fontWeight: 400,
    fontSize: "clamp(2rem, 7.2vw, 3.35rem)",
    lineHeight: 0.96,
    letterSpacing: "-0.045em",
    overflowWrap: "anywhere",
    wordBreak: "normal",
    hyphens: "auto",
    textAlign: "center",
    textWrap: "balance",
    textShadow: "0 4px 28px rgba(0,0,0,0.78), 0 0 24px rgba(227,146,76,0.22)",
  },
  highlightsHeroTitleLong: {
    fontSize: "clamp(1.86rem, 6.6vw, 3.05rem)",
    lineHeight: 1,
    letterSpacing: "-0.04em",
    textWrap: "pretty",
  },
  highlightsDescriptor: {
    margin: 0,
    maxWidth: "28rem",
    color: "rgba(255,238,207,0.94)",
    fontFamily: "Georgia, Times New Roman, serif",
    fontSize: "clamp(1.05rem, 3.7vw, 1.34rem)",
    lineHeight: 1.45,
    textWrap: "balance",
  },
  highlightsSupportLine: {
    margin: 0,
    color: "rgba(246,202,127,0.84)",
    fontSize: "clamp(0.76rem, 2.55vw, 0.92rem)",
    letterSpacing: "0.12em",
    lineHeight: 1.5,
    textTransform: "uppercase",
  },
  highlightsShowcase: {
    display: "grid",
    justifyItems: "center",
    gap: "clamp(1.12rem, 3.7svh, 2.05rem)",
    width: "100%",
    maxWidth: "34rem",
    margin: 0,
    padding: "0 clamp(1.05rem, 5.4vw, 2.35rem)",
    listStyle: "none",
    boxSizing: "border-box",
  },
  highlightsStatement: {
    margin: 0,
    color: "rgba(250,224,183,0.96)",
    fontFamily: "Georgia, Times New Roman, serif",
    fontSize: "clamp(1.2rem, 4.6vw, 1.72rem)",
    lineHeight: 1.16,
    letterSpacing: "-0.018em",
    textAlign: "center",
    textWrap: "balance",
    textShadow: "0 3px 24px rgba(0,0,0,0.72), 0 0 18px rgba(227,146,76,0.18)",
  },
  highlightsRow: {
    display: "grid",
    alignContent: "center",
    gap: "clamp(0.62rem, 1.9svh, 0.95rem)",
    width: "100%",
    minHeight: "clamp(6.75rem, 17svh, 9.75rem)",
    padding: "clamp(1rem, 4.8vw, 1.85rem) 0",
    borderTop: "1px solid rgba(246,202,127,0.22)",
    background: "transparent",
    boxSizing: "border-box",
  },
  highlightsRowSigil: {
    color: gold,
    fontSize: "0.72rem",
    opacity: 0.9,
    textShadow: "0 0 14px rgba(226,150,72,0.42)",
    marginRight: "0.46rem",
  },
  highlightsRowTitle: {
    margin: 0,
    color: "rgba(250,224,183,0.96)",
    fontSize: "clamp(0.84rem, 3vw, 1.02rem)",
    letterSpacing: "0.13em",
    textTransform: "uppercase",
  },
  highlightsRowText: {
    margin: 0,
    maxWidth: "44rem",
    color: "rgba(238,225,203,0.9)",
    fontFamily: "Georgia, Times New Roman, serif",
    fontSize: "clamp(1.15rem, 4.9vw, 1.65rem)",
    lineHeight: 1.42,
    textWrap: "pretty",
  },
  highlightGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    columnGap: "1.3rem",
    rowGap: "1.5rem",
  },
  highlightCard: {
    position: "relative",
    border: 0,
    outline: "none",
    borderRadius: 0,
    background: "transparent",
    padding: 0,
    boxShadow: "none",
  },
  highlightSigil: {
    color: gold,
    fontSize: "0.66rem",
    opacity: 0.86,
    textShadow: "0 0 12px rgba(226,150,72,0.38)",
    marginRight: "0.34rem",
  },
  highlightTitle: {
    margin: 0,
    color: "rgba(250,224,183,0.95)",
    fontSize: "0.74rem",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  highlightText: {
    margin: "0.42rem 0 0 1rem",
    color: "rgba(234,220,196,0.86)",
    fontSize: "0.77rem",
    lineHeight: 1.48,
  },
  mapPlate: {
    position: "relative",
    minHeight: "10.8rem",
    border: 0,
    outline: "none",
    overflow: "visible",
    background:
      "radial-gradient(circle at 48% 40%, rgba(224,151,80,0.18), transparent 28%), repeating-linear-gradient(118deg, rgba(235,190,123,0.08) 0 1px, transparent 1px 34px)",
  },
  mapRoute: {
    position: "absolute",
    left: "16%",
    right: "18%",
    top: "49%",
    borderTop: "1px dashed rgba(238,189,112,0.68)",
    transform: "rotate(8deg)",
    boxShadow: "0 0 12px rgba(238,172,91,0.22)",
  },
  mapNode: {
    position: "absolute",
    width: "0.62rem",
    height: "0.62rem",
    borderRadius: "999px",
    background: "rgba(246,202,127,0.96)",
    boxShadow: "0 0 16px rgba(236,160,77,0.6)",
  },
  mapCompass: {
    position: "absolute",
    right: "1rem",
    top: "0.8rem",
    color: "rgba(246,207,142,0.84)",
    fontSize: "1.8rem",
    textShadow: "0 0 18px rgba(226,150,72,0.28)",
  },
  galleryFloatingMemoryLayout: {
    overflowX: "hidden",
    overflowY: "auto",
    overscrollBehavior: "contain",
    WebkitOverflowScrolling: "touch",
    touchAction: "pan-y",
  },
  galleryMemoryContent: {
    position: "relative",
    inset: "auto",
    alignContent: "start",
    justifyItems: "center",
    minHeight: "100%",
    gap: "clamp(0.56rem, 1.4svh, 0.82rem)",
    paddingTop: "clamp(2.35rem, 6svh, 3.4rem)",
    paddingBottom: "clamp(0.65rem, 2svh, 1rem)",
    overflowX: "hidden",
    overflowY: "auto",
    WebkitMaskImage:
      "linear-gradient(to bottom, black 0%, black 96%, transparent 100%)",
    maskImage:
      "linear-gradient(to bottom, black 0%, black 96%, transparent 100%)",
    scrollPaddingTop: "clamp(2.35rem, 6svh, 3.4rem)",
    scrollPaddingBottom: "clamp(0.65rem, 2svh, 1rem)",
  },
  galleryArtifactGroup: {
    display: "grid",
    gap: "clamp(0.58rem, 1.5svh, 0.82rem)",
    width: "100%",
    maxWidth: "36rem",
    justifySelf: "center",
  },
  galleryHeader: {
    display: "grid",
    gap: "0.72rem",
    width: "100%",
    maxWidth: "36rem",
    justifySelf: "center",
  },
  portalArtifact: {
    position: "relative",
    display: "grid",
    gap: "clamp(0.52rem, 1.5svh, 0.82rem)",
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    justifySelf: "stretch",
    margin: 0,
    padding: "clamp(0.58rem, 2.4vw, 0.82rem)",
    borderRadius: "1.35rem",
    overflow: "hidden",
    background:
      "linear-gradient(160deg, rgba(17,23,34,0.76), rgba(5,8,15,0.66)), radial-gradient(circle at 52% 6%, rgba(246,202,127,0.18), transparent 42%)",
    boxShadow:
      "0 24px 62px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,238,207,0.1)",
    backdropFilter: "blur(16px)",
    isolation: "isolate",
  },
  revealedPortalArtifact: {
    backdropFilter: "none",
  },
  portalTitle: {
    position: "relative",
    zIndex: 2,
    margin: 0,
    color: "rgba(255,238,207,0.98)",
    fontFamily: "Georgia, Times New Roman, serif",
    fontSize: "clamp(1.34rem, 5.8vw, 2.28rem)",
    fontWeight: 400,
    lineHeight: 1.02,
    textAlign: "center",
    textShadow: "0 3px 24px rgba(0,0,0,0.72), 0 0 20px rgba(227,146,76,0.2)",
  },
  portalMemoryBackdrop: {
    position: "absolute",
    inset: "-10%",
    zIndex: 0,
    backgroundSize: "cover",
    backgroundPosition: "50% 42%",
    opacity: 0.24,
    filter: "blur(18px) saturate(1.05) brightness(0.9)",
    transform: "scale(1.08)",
    pointerEvents: "none",
  },
  revealedPortalFrame: {
    boxShadow: "inset 0 1px 0 rgba(255,238,207,0.13)",
  },
  portalHalo: {
    position: "absolute",
    inset: "8% 9% 17%",
    zIndex: 1,
    borderRadius: "999px",
    background:
      "radial-gradient(ellipse at center, rgba(246,202,127,0.2), rgba(226,150,72,0.08) 38%, transparent 71%)",
    filter: "blur(8px)",
    pointerEvents: "none",
  },
  revealedPortalHalo: {
    opacity: 0,
    filter: "none",
  },
  portalFrame: {
    position: "relative",
    zIndex: 2,
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    padding: "clamp(0.42rem, 2.2vw, 0.72rem)",
    borderRadius: "1.12rem",
    background:
      "linear-gradient(145deg, rgba(255,238,207,0.11), rgba(255,238,207,0.025)), linear-gradient(180deg, rgba(2,5,11,0.34), rgba(2,5,11,0.58))",
    boxShadow:
      "inset 0 1px 0 rgba(255,238,207,0.13), inset 0 -42px 78px rgba(1,3,8,0.24), 0 0 42px rgba(226,150,72,0.1)",
  },
  portalAperture: {
    position: "relative",
    display: "grid",
    placeItems: "center",
    aspectRatio: "3 / 4",
    width: "100%",
    height: "auto",
    minWidth: 0,
    justifySelf: "stretch",
    overflow: "hidden",
    borderRadius: "0.92rem",
    background:
      "radial-gradient(ellipse at 50% 28%, rgba(246,202,127,0.14), transparent 44%), linear-gradient(180deg, rgba(3,6,13,0.64), rgba(4,7,14,0.86))",
    boxShadow:
      "inset 0 0 0 1px rgba(255,238,207,0.06), inset 0 0 84px rgba(1,3,8,0.48)",
  },
  portalQuestionLayer: {
    position: "absolute",
    inset: "clamp(0.72rem, 3.8vw, 1.35rem)",
    zIndex: 3,
    width: "auto",
    minWidth: 0,
    display: "grid",
    gridTemplateRows: "auto clamp(4.85rem, 12svh, 5.8rem) auto",
    alignContent: "start",
    justifyItems: "center",
    gap: "clamp(0.5rem, 1.3svh, 0.78rem)",
    textAlign: "center",
    padding:
      "clamp(0.82rem, 3.8vw, 1.28rem) clamp(0.74rem, 3.2vw, 1.12rem) clamp(0.74rem, 3.2vw, 1.12rem)",
    borderRadius: "1rem",
    background:
      "radial-gradient(ellipse at 50% 38%, rgba(6,9,16,0.72), rgba(6,9,16,0.34) 48%, transparent 78%)",
  },
  portalArtifactLabel: {
    margin: 0,
    color: "rgba(246,202,127,0.62)",
    fontSize: "0.58rem",
    letterSpacing: "0.2em",
    lineHeight: 1,
    textTransform: "uppercase",
    textShadow: "0 2px 14px rgba(0,0,0,0.58)",
  },
  portalQuestion: {
    alignSelf: "start",
    margin: 0,
    maxWidth: "15rem",
    color: "rgba(255,239,213,0.98)",
    fontFamily: "Georgia, Times New Roman, serif",
    fontSize: "clamp(1.18rem, 6.4vw, 2.05rem)",
    lineHeight: 1.02,
    fontWeight: 400,
    textShadow: "0 3px 24px rgba(0,0,0,0.72), 0 0 28px rgba(226,150,72,0.18)",
  },
  portalRevealButton: {
    alignSelf: "start",
    appearance: "none",
    border: "1px solid rgba(246,202,127,0.42)",
    borderRadius: "999px",
    padding: "clamp(0.48rem, 1.6svh, 0.62rem) 1.05rem",
    background:
      "linear-gradient(180deg, rgba(246,202,127,0.14), rgba(226,150,72,0.08))",
    color: "rgba(250,224,183,0.94)",
    fontSize: "0.68rem",
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    cursor: "pointer",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
  },
  portalVideo: {
    position: "absolute",
    inset: 0,
    zIndex: 2,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center",
  },
  portalVideoFallback: {
    position: "absolute",
    left: "50%",
    top: "50%",
    zIndex: 4,
    width: "min(78%, 14rem)",
    margin: 0,
    padding: "0.62rem 0.78rem",
    border: "1px solid rgba(246,202,127,0.32)",
    borderRadius: "0.86rem",
    background: "rgba(6,9,16,0.72)",
    color: "rgba(255,239,213,0.88)",
    fontSize: "0.72rem",
    lineHeight: 1.35,
    textAlign: "center",
    transform: "translate(-50%, -50%)",
  },
  portalReplayButton: {
    appearance: "none",
    position: "absolute",
    left: "50%",
    bottom: "clamp(0.72rem, 3vw, 1.05rem)",
    zIndex: 4,
    border: "1px solid rgba(246,202,127,0.36)",
    borderRadius: "999px",
    padding: "0.42rem 0.82rem",
    background: "linear-gradient(180deg, rgba(7,9,14,0.58), rgba(7,9,14,0.34))",
    color: "rgba(250,224,183,0.82)",
    fontSize: "0.58rem",
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    cursor: "pointer",
    backdropFilter: "blur(10px)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
  },
  portalFactStack: {
    position: "relative",
    zIndex: 2,
    display: "grid",
    gap: "0.42rem",
    opacity: 0,
    transform: "translate3d(0, 0.35rem, 0)",
  },
  portalFactNote: {
    margin: 0,
    padding: "0 clamp(0.2rem, 1.6vw, 0.45rem)",
    color: "rgba(255,238,207,0.86)",
    fontSize: "clamp(0.78rem, 3.2vw, 0.92rem)",
    lineHeight: 1.5,
    textAlign: "center",
    textShadow: "0 2px 18px rgba(0,0,0,0.52)",
  },
  portalSecondaryNote: {
    margin: 0,
    padding: "0 clamp(0.2rem, 1.6vw, 0.45rem)",
    color: "rgba(246,202,127,0.72)",
    fontSize: "clamp(0.72rem, 2.8vw, 0.84rem)",
    lineHeight: 1.48,
    textAlign: "center",
    fontStyle: "italic",
    textShadow: "0 2px 16px rgba(0,0,0,0.48)",
  },
  planList: {
    margin: 0,
    paddingLeft: "1.25rem",
    display: "grid",
    gap: "1.08rem",
  },
  planItem: {
    color: "rgba(238,224,200,0.91)",
    fontSize: "0.88rem",
    lineHeight: 1.58,
    paddingLeft: "0.34rem",
    textShadow: "0 0 12px rgba(226,150,72,0.1)",
  },
  bottomZone: {
    position: "relative",
    zIndex: 4,
    display: "grid",
    gap: "0.62rem",
  },
  modeRail: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    columnGap: "clamp(0.14rem, 1.4vw, 0.52rem)",
    alignItems: "stretch",
    justifyItems: "stretch",
    padding: "0.24rem clamp(0.16rem, 1.2vw, 0.46rem) 0.18rem",
    background: "transparent",
    isolation: "isolate",
    overflow: "visible",
  },
  modeRailAtmosphere: {
    position: "absolute",
    left: "-0.32rem",
    right: "-0.32rem",
    top: "calc(-0.22rem - 30px)",
    bottom: "-0.12rem",
    zIndex: 0,
    pointerEvents: "none",
    background:
      "radial-gradient(ellipse 72% 64% at 50% 58%, rgba(2,4,9,0.22), rgba(2,4,9,0.12) 45%, rgba(2,4,9,0.045) 68%, transparent 86%), linear-gradient(180deg, transparent 0%, rgba(2,4,9,0.11) 36%, rgba(2,4,9,0.18) 62%, transparent 100%)",
    filter: "blur(10px)",
    mixBlendMode: "multiply",
    opacity: 0.9,
  },
  modeButton: {
    all: "unset",
    position: "relative",
    zIndex: 1,
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
    alignContent: "center",
    gap: "0.2rem",
    minHeight: "4.85rem",
    padding: "0.28rem 0.08rem 0.16rem",
    boxSizing: "border-box",
    color: "rgba(201,151,82,0.6)",
    textAlign: "center",
    touchAction: "manipulation",
  },
  modeButtonActive: {
    color: "rgba(239,190,116,0.96)",
  },
  modeIconStack: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    placeItems: "center",
    width: "100%",
    minHeight: "3.15rem",
    borderRadius: "1.25rem",
    color: "currentColor",
    opacity: 0.6,
    filter: "drop-shadow(0 1px 0 rgba(0,0,0,0.62))",
    userSelect: "none",
    pointerEvents: "none",
  },
  modeIconImage: {
    display: "block",
    width: "clamp(2.25rem, 8vw, 3.05rem)",
    height: "clamp(2.25rem, 8vw, 3.05rem)",
    objectFit: "contain",
  },
  modeLabel: {
    display: "block",
    width: "100%",
    maxWidth: "100%",
    overflow: "hidden",
    overflowWrap: "normal",
    color: "currentColor",
    fontFamily: "Forum, Georgia, serif",
    fontSize: "8px",
    fontWeight: 400,
    letterSpacing: "0.06em",
    lineHeight: 1.1,
    textAlign: "center",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    wordBreak: "keep-all",
    opacity: 0.6,
    textShadow: "0 1px 0 rgba(0,0,0,0.62)",
    userSelect: "none",
    pointerEvents: "none",
  },
  askDock: {
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    alignItems: "center",
    gap: "0.58rem",
    padding: "0.5rem 0.58rem",
    borderRadius: "999px",
    border: "1px solid rgba(226,172,92,0.38)",
    background:
      "linear-gradient(160deg, rgba(9,14,22,0.88), rgba(6,9,15,0.78))",
    boxShadow:
      "0 20px 38px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,235,195,0.14)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
  },
  askSigil: {
    width: "2rem",
    height: "2rem",
    borderRadius: "999px",
    border: "1px solid rgba(226,172,92,0.36)",
    color: "rgba(245,207,145,0.9)",
    display: "grid",
    placeItems: "center",
    boxShadow:
      "0 0 14px rgba(226,150,72,0.18), inset 0 1px 0 rgba(255,235,195,0.12)",
  },
  askInput: {
    minWidth: 0,
    border: 0,
    outline: "none",
    background: "transparent",
    color: "rgba(246,232,205,0.94)",
    fontSize: "1rem",
    letterSpacing: "0.01em",
  },
  askButton: {
    width: "2.12rem",
    height: "2.12rem",
    borderRadius: "999px",
    border: "1px solid rgba(226,172,92,0.46)",
    background:
      "radial-gradient(circle at 35% 25%, rgba(122,93,58,0.86), rgba(20,25,32,0.86))",
    color: "rgba(246,232,205,0.94)",
    fontSize: "1rem",
    boxShadow: "0 0 16px rgba(226,150,72,0.22)",
  },
};
