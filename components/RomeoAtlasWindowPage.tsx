"use client";

import { useMemo, useState, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";

type RomeoAtlasMode = "highlights" | "schedule" | "maps" | "gallery" | "plan";

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
  { id: "highlights", label: "Highlights" },
  { id: "schedule", label: "Schedule" },
  { id: "maps", label: "Maps" },
  { id: "gallery", label: "Gallery" },
  { id: "plan", label: "Plan" },
] as const;

const GALLERY_MOMENTS: readonly GalleryMoment[] = [
  {
    id: "parade-light",
    caption: "Main Street parade route.",
    tone: "radial-gradient(circle at 46% 24%, rgba(255,194,125,0.48), rgba(126,70,39,0.48) 38%, rgba(13,13,18,0.94) 100%)",
  },
  {
    id: "sugar-stand",
    caption: "Peach dessert stand.",
    tone: "radial-gradient(circle at 35% 30%, rgba(255,173,112,0.46), rgba(101,56,39,0.5) 42%, rgba(12,12,17,0.94) 100%)",
  },
  {
    id: "downtown-bluehour",
    caption: "Downtown after sunset.",
    tone: "radial-gradient(circle at 54% 28%, rgba(239,179,103,0.38), rgba(61,57,76,0.45) 42%, rgba(9,12,20,0.95) 100%)",
  },
  {
    id: "family-route",
    caption: "Family walking route.",
    tone: "radial-gradient(circle at 44% 26%, rgba(250,202,141,0.42), rgba(85,55,39,0.48) 43%, rgba(12,10,15,0.94) 100%)",
  },
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

function ModeIcon({ mode }: { mode: RomeoAtlasMode }) {
  const sharedProps = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.55,
    vectorEffect: "non-scaling-stroke" as const,
  };

  return (
    <svg
      viewBox="0 0 32 32"
      style={styles.modeIconGlyph}
      aria-hidden="true"
      focusable="false"
    >
      {mode === "highlights" ? (
        <>
          <path
            {...sharedProps}
            d="M16 4.5l2.4 7.1 7.1 2.4-7.1 2.4L16 23.5l-2.4-7.1L6.5 14l7.1-2.4L16 4.5z"
          />
          <path
            {...sharedProps}
            d="M23.6 21.4l.9 2.4 2.5.9-2.5.8-.9 2.5-.8-2.5-2.5-.8 2.5-.9.8-2.4z"
          />
        </>
      ) : null}
      {mode === "schedule" ? (
        <>
          <rect
            {...sharedProps}
            x="6.8"
            y="8.3"
            width="18.4"
            height="16.7"
            rx="2.1"
          />
          <path {...sharedProps} d="M10.8 5.8v4.6M21.2 5.8v4.6M7.2 13.1h17.6" />
          <path
            {...sharedProps}
            d="M11.2 17.2h2.2M15 17.2h2.2M18.8 17.2H21M11.2 21h2.2M15 21h2.2M18.8 21H21"
          />
        </>
      ) : null}
      {mode === "maps" ? (
        <>
          <circle {...sharedProps} cx="16" cy="16" r="10.1" />
          <circle {...sharedProps} cx="16" cy="16" r="2.1" />
          <path
            {...sharedProps}
            d="M16 4.3v4.1M16 23.6v4.1M4.3 16h4.1M23.6 16h4.1"
          />
          <path
            {...sharedProps}
            d="M19.9 12.1l-2.2 5.6-5.6 2.2 2.2-5.6 5.6-2.2z"
          />
          <path
            {...sharedProps}
            d="M9.2 9.2l2.1 2.1M20.7 20.7l2.1 2.1M22.8 9.2l-2.1 2.1M11.3 20.7l-2.1 2.1"
          />
        </>
      ) : null}
      {mode === "gallery" ? (
        <>
          <rect
            {...sharedProps}
            x="6.4"
            y="8"
            width="19.2"
            height="15.8"
            rx="1.8"
          />
          <circle {...sharedProps} cx="20.8" cy="12.8" r="1.8" />
          <path
            {...sharedProps}
            d="M8.6 21.2l5.4-5.5 4.2 4.1 2.3-2.3 3.2 3.7"
          />
        </>
      ) : null}
      {mode === "plan" ? (
        <>
          <path {...sharedProps} d="M10.2 5.8h9.5l4.1 4.2v16.2H10.2V5.8z" />
          <path {...sharedProps} d="M19.7 5.8v4.4h4.1" />
          <path
            {...sharedProps}
            d="M13.6 14.8h6.8M13.6 18.8h6.8M13.6 22.8h4.4"
          />
          <path {...sharedProps} d="M7.2 10.2v19h12.2" />
        </>
      ) : null}
    </svg>
  );
}

function RomeoMemoryContent({
  activeMode,
  activeGallery,
  setActiveGallery,
}: {
  activeMode: RomeoAtlasMode;
  activeGallery: GalleryMoment;
  setActiveGallery: (id: string) => void;
}) {
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
        style={styles.memoryContent}
        aria-label="Gallery lens"
      >
        <p style={styles.windowEyebrow}>Gallery</p>
        <h2 style={styles.windowTitle}>Image notes</h2>
        <MemorySeparator />
        <article style={styles.galleryFeature}>
          <div
            style={{ ...styles.galleryImage, background: activeGallery.tone }}
            aria-hidden="true"
          />
        </article>
        <div style={styles.galleryRail} aria-label="Gallery thumbnails">
          {GALLERY_MOMENTS.map((item) => {
            const isSelected = item.id === activeGallery.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveGallery(item.id)}
                style={{
                  ...styles.galleryThumbButton,
                  ...(isSelected ? styles.galleryThumbButtonActive : null),
                }}
                aria-pressed={isSelected}
                aria-label={item.caption}
              >
                <span
                  style={{ ...styles.galleryThumbTone, background: item.tone }}
                />
              </button>
            );
          })}
        </div>
        <p style={styles.galleryCaption}>{activeGallery.caption}</p>
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
      className="romeo-memory-scroll"
      style={styles.memoryContent}
      aria-label="Highlights lens"
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
    </section>
  );
}

export default function RomeoAtlasWindowPage({
  eventName,
  backHref,
  memoryImageSrc,
}: RomeoAtlasWindowPageProps) {
  const [activeMode, setActiveMode] = useState<RomeoAtlasMode>("highlights");
  const [activeGalleryId, setActiveGalleryId] = useState(GALLERY_MOMENTS[0].id);
  const activeGallery = useMemo(
    () =>
      GALLERY_MOMENTS.find((item) => item.id === activeGalleryId) ??
      GALLERY_MOMENTS[0],
    [activeGalleryId],
  );

  const handleAskSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
        `}</style>
      <section
        style={styles.stage}
        aria-label={`${eventName} Atlas floating memory prototype`}
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
          style={styles.floatingMemoryLayout}
          aria-live="polite"
          aria-label="Atlas memory content"
        >
          <RomeoMemoryContent
            key={activeMode}
            activeMode={activeMode}
            activeGallery={activeGallery}
            setActiveGallery={setActiveGalleryId}
          />
        </section>

        <section
          style={styles.bottomZone}
          aria-label="Atlas controls and Ask Anything"
        >
          <nav style={styles.modeRail} aria-label="Atlas controls">
            <div style={styles.constellationLayer} aria-hidden="true">
              <span
                style={{
                  ...styles.constellationLine,
                  left: "16%",
                  width: "18%",
                  top: "44%",
                  transform: "rotate(-5deg)",
                }}
              />
              <span
                style={{
                  ...styles.constellationLine,
                  left: "33%",
                  width: "18%",
                  top: "42%",
                  transform: "rotate(6deg)",
                }}
              />
              <span
                style={{
                  ...styles.constellationLine,
                  left: "50%",
                  width: "18%",
                  top: "44%",
                  transform: "rotate(-4deg)",
                }}
              />
              <span
                style={{
                  ...styles.constellationLine,
                  left: "67%",
                  width: "18%",
                  top: "43%",
                  transform: "rotate(5deg)",
                }}
              />
              <span
                style={{ ...styles.constellationDot, left: "18%", top: "37%" }}
              />
              <span
                style={{
                  ...styles.constellationDot,
                  left: "28%",
                  top: "49%",
                  opacity: 0.3,
                }}
              />
              <span
                style={{ ...styles.constellationDot, left: "38%", top: "34%" }}
              />
              <span
                style={{
                  ...styles.constellationDot,
                  left: "48%",
                  top: "50%",
                  opacity: 0.34,
                }}
              />
              <span
                style={{ ...styles.constellationDot, left: "58%", top: "36%" }}
              />
              <span
                style={{
                  ...styles.constellationDot,
                  left: "68%",
                  top: "50%",
                  opacity: 0.32,
                }}
              />
              <span
                style={{ ...styles.constellationDot, left: "78%", top: "35%" }}
              />
              <span style={{ ...styles.constellationDrop, left: "22%" }} />
              <span
                style={{
                  ...styles.constellationDrop,
                  left: "50%",
                  height: "1.25rem",
                  opacity: 0.2,
                }}
              />
              <span style={{ ...styles.constellationDrop, left: "74%" }} />
            </div>
            {MODE_OPTIONS.map((mode) => {
              const isActive = mode.id === activeMode;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setActiveMode(mode.id)}
                  style={{
                    ...styles.modeButton,
                    ...(isActive ? styles.modeButtonActive : null),
                  }}
                  aria-label={`${mode.label} lens`}
                  aria-pressed={isActive}
                  title={mode.label}
                >
                  <span style={styles.modeIcon}>
                    <ModeIcon mode={mode.id} />
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
            />
            <button
              type="submit"
              style={styles.askButton}
              aria-label="Submit Ask Anything demo prompt"
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
    scrollbarWidth: "none",
    msOverflowStyle: "none",
    textShadow: "0 2px 18px rgba(0,0,0,0.58), 0 0 26px rgba(226,150,72,0.12)",
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
  windowTip: {
    margin: 0,
    color: "rgba(244,197,126,0.9)",
    fontSize: "0.8rem",
    lineHeight: 1.48,
    fontStyle: "italic",
    maxWidth: "32rem",
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
  galleryFeature: {
    overflow: "visible",
    border: 0,
    outline: "none",
    transform: "rotate(-2.2deg)",
    boxShadow: "0 24px 42px rgba(0,0,0,0.36)",
  },
  galleryImage: {
    minHeight: "12rem",
    aspectRatio: "16 / 10",
    borderRadius: "0.18rem",
    boxShadow:
      "0 3px 0 rgba(255,238,207,0.38) inset, 0 -3px 0 rgba(54,31,18,0.32) inset",
  },
  galleryRail: {
    display: "flex",
    gap: "0.62rem",
    overflowX: "auto",
    padding: "0.1rem 0 0.3rem",
    scrollbarWidth: "none",
  },
  galleryThumbButton: {
    all: "unset",
    flex: "0 0 auto",
    cursor: "pointer",
    width: "3.7rem",
    height: "2.68rem",
    padding: 0,
    border: 0,
    outline: "none",
    background: "transparent",
    opacity: 0.54,
    transform: "rotate(2deg)",
    filter: "drop-shadow(0 12px 14px rgba(0,0,0,0.24))",
  },
  galleryThumbButtonActive: {
    opacity: 1,
    transform: "rotate(-2deg)",
    filter:
      "drop-shadow(0 0 16px rgba(226,150,72,0.34)) drop-shadow(0 14px 18px rgba(0,0,0,0.28))",
  },
  galleryThumbTone: {
    display: "block",
    width: "100%",
    height: "100%",
    borderRadius: "0.12rem",
    boxShadow:
      "0 2px 0 rgba(255,238,207,0.35) inset, 0 -2px 0 rgba(54,31,18,0.28) inset",
  },
  galleryCaption: {
    margin: 0,
    color: "rgba(232,217,190,0.86)",
    fontSize: "0.76rem",
    lineHeight: 1.42,
    transform: "rotate(-0.6deg)",
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
    gap: 0,
    alignItems: "stretch",
    padding: "0.72rem clamp(0.32rem, 1.8vw, 0.7rem) 0.64rem",
    borderRadius: "clamp(1rem, 4.4vw, 1.55rem)",
    border: "1px solid rgba(232, 183, 104, 0.34)",
    background:
      "linear-gradient(180deg, rgba(13, 19, 28, 0.76), rgba(6, 10, 17, 0.68)), radial-gradient(ellipse at 50% 0%, rgba(255, 215, 151, 0.1), transparent 58%)",
    boxShadow:
      "0 18px 36px rgba(0,0,0,0.38), 0 0 22px rgba(226,150,72,0.12), inset 0 1px 0 rgba(255,235,195,0.16), inset 0 -1px 0 rgba(232,178,96,0.14)",
    backdropFilter: "blur(14px) saturate(1.12)",
    WebkitBackdropFilter: "blur(14px) saturate(1.12)",
    overflow: "hidden",
  },
  constellationLayer: {
    position: "absolute",
    inset: "0.42rem 0.62rem 1.35rem",
    zIndex: 0,
    pointerEvents: "none",
    opacity: 0.88,
  },
  constellationLine: {
    position: "absolute",
    height: 1,
    transformOrigin: "left center",
    background:
      "linear-gradient(90deg, transparent, rgba(245, 196, 119, 0.24), transparent)",
    boxShadow: "0 0 8px rgba(226, 150, 72, 0.14)",
  },
  constellationDot: {
    position: "absolute",
    width: "0.19rem",
    height: "0.19rem",
    borderRadius: "999px",
    background: "rgba(249, 207, 137, 0.66)",
    boxShadow: "0 0 8px rgba(238, 168, 84, 0.34)",
  },
  constellationDrop: {
    position: "absolute",
    top: "48%",
    width: 1,
    height: "1.45rem",
    background:
      "linear-gradient(180deg, rgba(245,196,119,0.26), rgba(245,196,119,0.04), transparent)",
    boxShadow: "0 0 8px rgba(226,150,72,0.12)",
    opacity: 0.24,
  },
  modeButton: {
    all: "unset",
    position: "relative",
    zIndex: 1,
    cursor: "pointer",
    display: "grid",
    justifyItems: "center",
    alignContent: "center",
    gap: "0.34rem",
    minHeight: "4.62rem",
    padding: "0.26rem 0.08rem 0.14rem",
    color: "rgba(224,177,100,0.62)",
    textAlign: "center",
    filter:
      "drop-shadow(0 0 5px rgba(226,152,75,0.1)) drop-shadow(0 0 14px rgba(226,150,72,0.06))",
    opacity: 0.78,
    touchAction: "manipulation",
  },
  modeButtonActive: {
    color: "rgba(255,229,168,0.98)",
    filter:
      "drop-shadow(0 0 9px rgba(247,184,95,0.62)) drop-shadow(0 0 24px rgba(226,150,72,0.36))",
    opacity: 1,
  },
  modeIcon: {
    width: "3.16rem",
    height: "2.88rem",
    display: "grid",
    placeItems: "center",
    border: 0,
    outline: "none",
    background: "transparent",
    boxShadow: "none",
  },
  modeIconGlyph: {
    display: "block",
    width: "2.58rem",
    height: "2.58rem",
    color: "currentColor",
    filter:
      "drop-shadow(0 0 5px rgba(245,191,110,0.46)) drop-shadow(0 0 15px rgba(226,150,72,0.2))",
  },
  modeLabel: {
    color: "currentColor",
    fontSize: "clamp(0.49rem, 1.65vw, 0.58rem)",
    fontWeight: 600,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    textShadow: "0 0 9px rgba(226,150,72,0.28)",
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
