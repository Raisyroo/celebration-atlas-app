"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import Link from "next/link";

type RomeoAtlasMode = "highlights" | "schedule" | "maps" | "gallery" | "plan";

type RomeoAtlasModeOption = {
  id: RomeoAtlasMode;
  label: string;
  iconSrc: string;
};

type AtlasAnswer = {
  question: string;
  answer: string;
};

type RomeoAtlasWindowPageProps = {
  eventName: string;
  backHref: string;
  memoryImageSrc: string;
  introVideoSrc: string;
};

const MODE_OPTIONS: readonly RomeoAtlasModeOption[] = [
  { id: "highlights", label: "Highlights", iconSrc: "/ui/highlights-icon.svg" },
  { id: "schedule", label: "Schedule", iconSrc: "/ui/schedule-icon.svg" },
  { id: "maps", label: "Maps", iconSrc: "/ui/maps-icon.svg" },
  { id: "gallery", label: "Gallery", iconSrc: "/ui/gallery-icon.svg" },
  { id: "plan", label: "Plan", iconSrc: "/ui/plan-icon.svg" },
] as const;

const SCHEDULE_ITEMS = [
  {
    time: "11:00 AM",
    text: "Downtown opens; vendors and storefronts begin service.",
  },
  {
    time: "1:30 PM",
    text: "Peak food window for peach desserts and cold drinks.",
  },
  { time: "4:00 PM", text: "Parade route begins filling along Main Street." },
  {
    time: "7:45 PM",
    text: "Evening walk-through; lights and food stands remain active.",
  },
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

const INTRO_VISIBLE_MS = 5000;
const INTRO_DISSOLVE_MS = 1300;

type IntroStatus = "playing" | "dissolving" | "complete";

function getAtlasAnswer(question: string) {
  const normalizedQuestion = question.toLowerCase();
  return (
    ANSWER_MATCHERS.find(({ keywords }) =>
      keywords.some((keyword) => normalizedQuestion.includes(keyword)),
    )?.answer ?? GENERAL_ATLAS_ANSWER
  );
}

const HIGHLIGHT_ITEMS = [
  [
    "Parade route",
    "Main Street fills early; claim a viewing spot before 4:00 PM.",
  ],
  [
    "Peach food",
    "Pie, cobbler, drinks, and seasonal vendor specials are the main draw.",
  ],
  [
    "Downtown core",
    "Storefronts, music corners, and food rows are within a short walk.",
  ],
  [
    "Evening window",
    "After sunset, lighting improves for photos and crowds begin to thin.",
  ],
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

function RomeoAtlasAnswerContent({ answer }: { answer: AtlasAnswer }) {
  return (
    <section
      className="romeo-memory-scroll"
      style={styles.memoryContent}
      aria-label="Atlas Answer"
    >
      <p style={styles.windowEyebrow}>ATLAS ANSWER</p>
      <h2 style={styles.answerQuestion}>{answer.question}</h2>
      <MemorySeparator />
      <p style={styles.answerText}>{answer.answer}</p>
    </section>
  );
}

function PortalArtifact({
  imageSrc,
  videoSrc,
}: {
  imageSrc: string;
  videoSrc: string;
}) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [showFact, setShowFact] = useState(false);

  const handleReveal = () => {
    setIsRevealed(true);
  };

  const handleVideoMemory = () => {
    setShowFact(true);
  };

  return (
    <article
      style={styles.portalArtifact}
      aria-label="Romeo Peach Queen portal artifact"
    >
      <div
        style={{
          ...styles.portalMemoryBackdrop,
          backgroundImage: `url(${imageSrc})`,
        }}
        aria-hidden="true"
      />
      <div style={styles.portalHalo} aria-hidden="true" />
      <div style={styles.portalFrame}>
        <div style={styles.portalAperture}>
          <div
            className={
              isRevealed
                ? "romeo-portal-question is-revealed"
                : "romeo-portal-question"
            }
            style={styles.portalQuestionLayer}
          >
            <p style={styles.portalArtifactKicker}>Memory portal</p>
            <h3 style={styles.portalQuestion}>
              Want to see the first Peach Queen from 1931?
            </h3>
            <button
              type="button"
              className="romeo-portal-reveal"
              style={styles.portalRevealButton}
              onClick={handleReveal}
              aria-label="Reveal the first Romeo Peach Festival Queen memory"
            >
              Reveal
            </button>
          </div>

          {isRevealed ? (
            <video
              className="romeo-portal-video"
              style={styles.portalVideo}
              autoPlay
              muted
              playsInline
              preload="metadata"
              poster={imageSrc}
              onPlay={handleVideoMemory}
              onEnded={handleVideoMemory}
              aria-label="Romeo Peach Festival Queen memory video"
            >
              <source src={videoSrc} type="video/mp4" />
            </video>
          ) : null}
        </div>
      </div>
      <p
        className={
          showFact ? "romeo-portal-fact is-visible" : "romeo-portal-fact"
        }
        style={styles.portalFactNote}
      >
        Virginia Allor was crowned the first Romeo Peach Festival Queen in 1931.
      </p>
    </article>
  );
}

function RomeoMemoryContent({
  activeMode,
  introVideoSrc,
  memoryImageSrc,
}: {
  activeMode: RomeoAtlasMode;
  introVideoSrc: string;
  memoryImageSrc: string;
}) {
  const [hasIntroVideoError, setHasIntroVideoError] = useState(false);
  const [introStatus, setIntroStatus] = useState<IntroStatus>("playing");
  const highlightsScrollRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (activeMode !== "highlights") {
      return;
    }

    const dissolveTimer = window.setTimeout(() => {
      setIntroStatus("dissolving");
    }, INTRO_VISIBLE_MS);
    const completeTimer = window.setTimeout(() => {
      setIntroStatus("complete");
    }, INTRO_VISIBLE_MS + INTRO_DISSOLVE_MS);

    return () => {
      window.clearTimeout(dissolveTimer);
      window.clearTimeout(completeTimer);
    };
  }, [activeMode, introVideoSrc]);

  useEffect(() => {
    if (introStatus !== "complete") {
      return;
    }

    const highlightsScroll = highlightsScrollRef.current;
    if (!highlightsScroll) {
      return;
    }

    highlightsScroll.scrollTo({ top: 0, behavior: "instant" });
  }, [introStatus]);

  if (activeMode === "schedule") {
    return (
      <section
        className="romeo-memory-scroll"
        style={styles.memoryContent}
        aria-label="Schedule lens"
      >
        <p style={styles.windowEyebrow}>Schedule</p>
        <h2 style={styles.windowTitle}>Time + event</h2>
        <MemorySeparator />
        <div style={styles.timelineStack}>
          {SCHEDULE_ITEMS.map((item) => (
            <article key={item.time} style={styles.timelineItem}>
              <span style={styles.timelineTime}>{item.time}</span>
              <p style={styles.timelineText}>{item.text}</p>
            </article>
          ))}
        </div>
      </section>
    );
  }

  if (activeMode === "maps") {
    return (
      <section
        className="romeo-memory-scroll"
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
        className="romeo-memory-scroll"
        style={{ ...styles.memoryContent, ...styles.galleryMemoryContent }}
        aria-label="Gallery lens"
      >
        <div style={styles.galleryHeader}>
          <p style={styles.windowEyebrow}>Gallery</p>
          <h2 style={styles.windowTitle}>Atlas memory gallery</h2>
          <MemorySeparator />
          <p style={styles.galleryIntro}>
            A single memory artifact opens inside the Atlas frame, keeping the
            question quiet until the portal is ready to reveal the archive.
          </p>
        </div>
        <PortalArtifact imageSrc={memoryImageSrc} videoSrc={introVideoSrc} />
      </section>
    );
  }

  if (activeMode === "plan") {
    return (
      <section
        className="romeo-memory-scroll"
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

  return (
    <section
      ref={highlightsScrollRef}
      className="romeo-memory-scroll"
      style={{
        ...styles.memoryContent,
        ...styles.highlightsMemoryContent,
        ...(introStatus === "complete"
          ? styles.highlightsPostIntroMemoryContent
          : styles.highlightsIntroMemoryContent),
      }}
      aria-label="Highlights lens"
    >
      {introStatus !== "complete" ? (
        <figure
          className="romeo-cinematic-video-memory"
          style={styles.cinematicVideoFrame}
          data-intro-state={introStatus}
        >
          <video
            src={introVideoSrc}
            autoPlay
            muted
            playsInline
            preload="metadata"
            aria-label="Romeo Peach Festival intro video"
            className="romeo-cinematic-intro-video"
            style={styles.cinematicIntroVideo}
            onError={() => setHasIntroVideoError(true)}
            onLoadedData={() => setHasIntroVideoError(false)}
          >
            Romeo intro video unavailable
          </video>
          <span style={styles.cinematicVideoOverlay} aria-hidden="true" />
          {hasIntroVideoError ? (
            <p style={styles.cinematicVideoFallback}>
              Romeo intro video unavailable
            </p>
          ) : null}
        </figure>
      ) : null}
      {introStatus === "complete" ? (
        <div
          className="romeo-highlights-content"
          style={styles.highlightsContentReveal}
        >
          <p style={styles.windowEyebrow}>Highlights</p>
          <h2 style={styles.windowTitle}>Do not miss</h2>
          <MemorySeparator />
          <div style={styles.highlightGrid}>
            {HIGHLIGHT_ITEMS.map(([title, text]) => (
              <article key={title} style={styles.highlightCard}>
                <h3 style={styles.highlightTitle}>
                  <span style={styles.highlightSigil}>✦</span>
                  {title}
                </h3>
                <p style={styles.highlightText}>{text}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default function RomeoAtlasWindowPage({
  eventName,
  backHref,
  memoryImageSrc,
  introVideoSrc,
}: RomeoAtlasWindowPageProps) {
  const [activeMode, setActiveMode] = useState<RomeoAtlasMode>("highlights");
  const [askQuestion, setAskQuestion] = useState("");
  const [atlasAnswer, setAtlasAnswer] = useState<AtlasAnswer | null>(null);

  const handleAskSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedQuestion = askQuestion.trim();
    if (!trimmedQuestion) {
      return;
    }

    setAtlasAnswer({
      question: trimmedQuestion,
      answer: getAtlasAnswer(trimmedQuestion),
    });
    setAskQuestion("");
  };

  const handleModeSelect = (mode: RomeoAtlasMode) => {
    setAtlasAnswer(null);
    setActiveMode(mode);
  };

  return (
    <main style={styles.page} className="atlas-event-shell">
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
            animation: romeo-video-memory-appear 1300ms ease-out both;
          }
          .romeo-cinematic-video-memory[data-intro-state="dissolving"] {
            animation: romeo-video-memory-dissolve 1300ms ease-in forwards;
          }
          .romeo-cinematic-intro-video {
            animation: romeo-cinematic-ken-burns 24s ease-in-out infinite alternate;
          }
          .romeo-highlights-content {
            animation: romeo-highlights-fade-in 1050ms ease-out forwards;
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
          .romeo-portal-reveal:hover,
          .romeo-portal-reveal:focus-visible {
            color: rgba(255, 240, 213, 0.98);
            border-color: rgba(246, 202, 127, 0.72);
            box-shadow: 0 0 22px rgba(226, 150, 72, 0.18), inset 0 1px 0 rgba(255,255,255,0.16);
            outline: none;
            transform: translateY(-1px);
          }
          .romeo-portal-video {
            animation: romeo-portal-video-reveal 980ms ease-out forwards;
          }
          .romeo-portal-fact {
            transition: opacity 720ms ease 260ms, transform 720ms ease 260ms;
          }
          .romeo-portal-fact.is-visible {
            opacity: 1 !important;
            transform: translate3d(0, 0, 0) !important;
          }
          @keyframes romeo-video-memory-appear {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes romeo-video-memory-dissolve {
            from { opacity: 1; }
            to { opacity: 0; }
          }
          @keyframes romeo-portal-video-reveal {
            from {
              opacity: 0;
              transform: scale(1.018);
              filter: blur(10px) brightness(0.74) saturate(0.82);
            }
            to {
              opacity: 1;
              transform: scale(1);
              filter: brightness(0.88) saturate(0.92) contrast(1.04);
            }
          }
          @keyframes romeo-highlights-fade-in {
            from {
              opacity: 0;
              transform: translate3d(0, 1.15rem, 0);
            }
            to {
              opacity: 1;
              transform: translate3d(0, 0, 0);
            }
          }
          @keyframes romeo-cinematic-ken-burns {
            0%, 100% {
              transform: none;
            }
          }
          @media (prefers-reduced-motion: reduce) {
            .romeo-cinematic-video-memory,
            .romeo-cinematic-video-memory[data-intro-state="dissolving"],
            .romeo-cinematic-intro-video,
            .romeo-highlights-content,
            .romeo-portal-video {
              animation-duration: 1ms;
            }
            .romeo-cinematic-intro-video {
              transform: none;
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
            ...(activeMode === "gallery" && !atlasAnswer
              ? styles.galleryFloatingMemoryLayout
              : null),
          }}
          aria-live="polite"
          aria-label="Atlas memory content"
        >
          {atlasAnswer ? (
            <RomeoAtlasAnswerContent
              key={atlasAnswer.question}
              answer={atlasAnswer}
            />
          ) : (
            <RomeoMemoryContent
              key={`${activeMode}-${introVideoSrc}`}
              activeMode={activeMode}
              introVideoSrc={introVideoSrc}
              memoryImageSrc={memoryImageSrc}
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
    overflow: "visible",
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
  highlightsMemoryContent: {
    alignContent: "center",
    paddingTop: "clamp(2rem, 8svh, 4.6rem)",
    paddingBottom: "clamp(1.1rem, 5svh, 3.2rem)",
  },
  highlightsIntroMemoryContent: {
    paddingRight: 0,
    paddingLeft: 0,
  },
  highlightsPostIntroMemoryContent: {
    alignContent: "start",
    paddingTop: "clamp(4.6rem, 13svh, 7.2rem)",
    paddingBottom: "clamp(2.2rem, 7svh, 4.2rem)",
    WebkitMaskImage:
      "linear-gradient(to bottom, black 0%, black 90%, transparent 100%)",
    maskImage: "linear-gradient(to bottom, black 0%, black 90%, transparent 100%)",
    scrollPaddingTop: "clamp(4.6rem, 13svh, 7.2rem)",
  },
  cinematicVideoFrame: {
    position: "relative",
    width: "100%",
    justifySelf: "stretch",
    margin: "clamp(0.35rem, 1.5svh, 0.9rem) 0 0",
    overflow: "visible",
    borderRadius: 0,
    border: 0,
    background: "transparent",
    boxShadow: "0 24px 68px rgba(0,0,0,0.18), 0 0 76px rgba(226,150,72,0.08)",
    isolation: "isolate",
  },
  cinematicIntroVideo: {
    position: "relative",
    zIndex: 2,
    display: "block",
    width: "100%",
    height: "auto",
    opacity: 0.52,
    mixBlendMode: "soft-light",
    filter: "saturate(0.88) contrast(1.04) brightness(0.86)",
    willChange: "opacity, transform",
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
  cinematicVideoFallback: {
    position: "absolute",
    inset: "clamp(0.9rem, 4vw, 1.35rem)",
    zIndex: 4,
    display: "grid",
    placeItems: "center",
    margin: 0,
    borderRadius: 0,
    background: "rgba(4,7,14,0.68)",
    color: "rgba(255,239,212,0.96)",
    fontSize: "clamp(0.86rem, 3.4vw, 1rem)",
    letterSpacing: "0.02em",
    textAlign: "center",
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
    display: "grid",
    gap: "clamp(1.05rem, 3svh, 1.55rem)",
    width: "100%",
    maxWidth: "34rem",
    justifySelf: "center",
    opacity: 0,
    willChange: "opacity, transform",
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
  timelineStack: { display: "grid", gap: "1.1rem" },
  timelineItem: {
    display: "grid",
    gridTemplateColumns: "4.8rem 1fr",
    gap: "0.78rem",
    alignItems: "start",
    border: 0,
    paddingLeft: 0,
    opacity: 0.94,
    filter: "drop-shadow(0 0 10px rgba(226,150,72,0.08))",
  },
  timelineTime: {
    color: gold,
    fontSize: "0.66rem",
    letterSpacing: "0.11em",
    textTransform: "uppercase",
  },
  timelineText: {
    margin: 0,
    color: "rgba(237,224,200,0.91)",
    fontSize: "0.8rem",
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
    alignContent: "safe center",
    justifyItems: "center",
    minHeight: "100%",
    gap: "clamp(0.72rem, 2svh, 1.05rem)",
    paddingTop: "clamp(3.2rem, 8svh, 4.7rem)",
    paddingBottom: "clamp(0.65rem, 2svh, 1rem)",
    overflowX: "hidden",
    overflowY: "auto",
    WebkitMaskImage:
      "linear-gradient(to bottom, black 0%, black 96%, transparent 100%)",
    maskImage: "linear-gradient(to bottom, black 0%, black 96%, transparent 100%)",
    scrollPaddingTop: "clamp(3.2rem, 8svh, 4.7rem)",
    scrollPaddingBottom: "clamp(0.65rem, 2svh, 1rem)",
  },
  galleryHeader: {
    display: "grid",
    gap: "0.72rem",
    width: "100%",
    maxWidth: "36rem",
    justifySelf: "center",
  },
  galleryIntro: {
    margin: 0,
    color: "rgba(237,221,193,0.82)",
    fontSize: "clamp(0.82rem, 3.2vw, 0.95rem)",
    lineHeight: 1.55,
    maxWidth: "31rem",
  },
  portalArtifact: {
    position: "relative",
    display: "grid",
    gap: "clamp(0.52rem, 1.5svh, 0.82rem)",
    width:
      "min(74vw, calc((100svh - clamp(19.5rem, 45svh, 25rem)) * 0.52), 24rem)",
    maxWidth: "86vw",
    maxHeight: "calc(100svh - clamp(19.5rem, 45svh, 25rem))",
    justifySelf: "center",
    margin: "0 auto",
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
  portalFrame: {
    position: "relative",
    zIndex: 2,
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
    maxHeight: "min(48svh, 25rem)",
    justifySelf: "center",
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
    display: "grid",
    alignContent: "center",
    justifyItems: "center",
    gap: "clamp(0.68rem, 1.8svh, 0.95rem)",
    textAlign: "center",
    padding: "clamp(0.78rem, 3.7vw, 1.35rem)",
    borderRadius: "1rem",
    background:
      "radial-gradient(ellipse at 50% 38%, rgba(6,9,16,0.72), rgba(6,9,16,0.34) 48%, transparent 78%)",
  },
  portalArtifactKicker: {
    margin: 0,
    color: "rgba(246,202,127,0.68)",
    fontSize: "0.58rem",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
  },
  portalQuestion: {
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
    filter: "brightness(0.88) saturate(0.92) contrast(1.04)",
  },
  portalFactNote: {
    position: "relative",
    zIndex: 2,
    margin: 0,
    padding: "0 clamp(0.2rem, 1.6vw, 0.45rem)",
    color: "rgba(255,238,207,0.86)",
    fontSize: "clamp(0.78rem, 3.2vw, 0.92rem)",
    lineHeight: 1.5,
    textAlign: "center",
    textShadow: "0 2px 18px rgba(0,0,0,0.52)",
    opacity: 0,
    transform: "translate3d(0, 0.35rem, 0)",
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
