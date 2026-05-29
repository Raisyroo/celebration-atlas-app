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
    caption:
      "Parade glow slipping between brick storefronts and peach banners.",
    tone: "radial-gradient(circle at 46% 24%, rgba(255,194,125,0.48), rgba(126,70,39,0.48) 38%, rgba(13,13,18,0.94) 100%)",
  },
  {
    id: "sugar-stand",
    caption: "Peach desserts cooling under tent lights as families drift by.",
    tone: "radial-gradient(circle at 35% 30%, rgba(255,173,112,0.46), rgba(101,56,39,0.5) 42%, rgba(12,12,17,0.94) 100%)",
  },
  {
    id: "downtown-bluehour",
    caption:
      "Downtown Romeo at blue hour, warm windows and festival foot traffic.",
    tone: "radial-gradient(circle at 54% 28%, rgba(239,179,103,0.38), rgba(61,57,76,0.45) 42%, rgba(9,12,20,0.95) 100%)",
  },
  {
    id: "family-route",
    caption:
      "A family route marked by music, lemonade cups, and one more peach stop.",
    tone: "radial-gradient(circle at 44% 26%, rgba(250,202,141,0.42), rgba(85,55,39,0.48) 43%, rgba(12,10,15,0.94) 100%)",
  },
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
  const commonProps = {
    width: 32,
    height: 32,
    viewBox: "0 0 32 32",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.45,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
  };

  if (mode === "highlights") {
    return (
      <svg {...commonProps}>
        <path d="M16 3.8l2.6 8.4 8.4 3.8-8.4 3.8L16 28.2l-2.6-8.4L5 16l8.4-3.8L16 3.8z" />
        <path d="M16 8.8v14.4M8.8 16h14.4" opacity="0.54" />
        <path d="M4.2 7.4h2.3M25.5 24.6h2.3" opacity="0.45" />
      </svg>
    );
  }

  if (mode === "schedule") {
    return (
      <svg {...commonProps}>
        <rect x="7" y="8.4" width="18" height="17.2" rx="2.8" />
        <path d="M11 5.8v5M21 5.8v5M7 13.2h18" />
        <path
          d="M11.2 17.2h2.5M18.3 17.2h2.5M11.2 21h2.5M18.3 21h2.5"
          opacity="0.62"
        />
      </svg>
    );
  }

  if (mode === "maps") {
    return (
      <svg {...commonProps}>
        <circle cx="16" cy="16" r="10.2" />
        <circle cx="16" cy="16" r="3.1" />
        <path d="M16 3.9v5.2M16 22.9v5.2M3.9 16h5.2M22.9 16h5.2" />
        <path d="M20.8 11.2l-3.1 6.5-6.5 3.1 3.1-6.5 6.5-3.1z" />
      </svg>
    );
  }

  if (mode === "gallery") {
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
    const schedule = [
      {
        time: "11:00 AM",
        text: "Downtown opens softly: storefronts, first sweets, and parade chairs appearing along Main.",
      },
      {
        time: "1:30 PM",
        text: "Peach food window: pies, cobbler, cold drinks, and shaded family pauses.",
      },
      {
        time: "4:00 PM",
        text: "Parade atmosphere builds with bands, banners, and neighborhood arrivals.",
      },
      {
        time: "7:45 PM",
        text: "Blue-hour drift: lights, music corners, and one last pass through vendor rows.",
      },
    ];

    return (
      <section
        className="romeo-memory-scroll"
        style={styles.memoryContent}
        aria-label="Schedule lens"
      >
        <p style={styles.windowEyebrow}>Schedule</p>
        <h2 style={styles.windowTitle}>A day unfolding like a town memory.</h2>
        <MemorySeparator />
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

  if (activeMode === "maps") {
    return (
      <section
        className="romeo-memory-scroll"
        style={styles.memoryContent}
        aria-label="Maps lens"
      >
        <p style={styles.windowEyebrow}>Orientation</p>
        <h2 style={styles.windowTitle}>
          Use Main Street as your compass line.
        </h2>
        <MemorySeparator />
        <div style={styles.mapPlate} aria-hidden="true">
          <span style={{ ...styles.mapNode, left: "18%", top: "42%" }} />
          <span style={{ ...styles.mapNode, left: "48%", top: "28%" }} />
          <span style={{ ...styles.mapNode, left: "74%", top: "57%" }} />
          <span style={styles.mapRoute} />
          <span style={styles.mapCompass}>✦</span>
        </div>
        <p style={styles.windowBody}>
          Mock/demo orientation: parade corridor through downtown, food row one
          block off the main glow, and quieter family regroup points near the
          edges.
        </p>
        <p style={styles.windowTip}>
          Field note: park outside the core and walk inward before evening
          traffic thickens.
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
        <h2 style={styles.windowTitle}>
          Festival fragments in loose scrapbook light.
        </h2>
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
        <h2 style={styles.windowTitle}>A slow, golden route through Romeo.</h2>
        <MemorySeparator />
        <ol style={styles.planList}>
          <li style={styles.planItem}>
            Arrive before the center gets loud; let the first stop be peach food
            and a quiet storefront pass.
          </li>
          <li style={styles.planItem}>
            Hold your parade position early, then drift toward music rather than
            fighting the thickest crowd.
          </li>
          <li style={styles.planItem}>
            Save ten blue-hour minutes for photos, lights, and one last dessert
            before walking back out.
          </li>
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
      <h2 style={styles.windowTitle}>
        Peach parade, downtown lights, and sugar in the dusk air.
      </h2>
      <MemorySeparator />
      <div style={styles.highlightGrid}>
        {[
          [
            "Parade Atmosphere",
            "Bands, banners, and peach-color motion along a small-town corridor.",
          ],
          [
            "Downtown Lights",
            "Storefront windows and streetlamps turning the festival cinematic after sunset.",
          ],
          [
            "Festival Food",
            "Peach pie, cobbler, cold drinks, and summer vendor smoke in the same breath.",
          ],
          [
            "Family Moments",
            "Low-stakes wandering, shared treats, and familiar faces under late-summer skies.",
          ],
        ].map(([title, text]) => (
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
      <style>{`.romeo-memory-scroll::-webkit-scrollbar { display: none; }`}</style>
      <section
        style={styles.stage}
        aria-label={`${eventName} Atlas floating memory prototype`}
      >
        <div style={styles.stars} aria-hidden="true" />
        <Link href={backHref} style={styles.backLink}>
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
    color: "rgba(247,219,169,0.94)",
    textDecoration: "none",
    fontSize: "0.64rem",
    fontWeight: 700,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    border: "1px solid rgba(232,178,96,0.52)",
    borderRadius: "999px",
    padding: "0.38rem 0.76rem",
    background:
      "linear-gradient(160deg, rgba(7,10,17,0.78), rgba(19,15,13,0.58))",
    boxShadow:
      "0 0 18px rgba(226,150,72,0.22), inset 0 1px 0 rgba(255,235,195,0.12)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
  },
  festivalMemory: {
    position: "absolute",
    inset: "-4% -8%",
    zIndex: 0,
    opacity: 0.34,
    backgroundSize: "cover",
    backgroundPosition: "50% 46%",
    backgroundRepeat: "no-repeat",
    filter: "brightness(0.58) saturate(1.08) contrast(1.06)",
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
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: "0.28rem",
    alignItems: "end",
  },
  modeButton: {
    all: "unset",
    cursor: "pointer",
    display: "grid",
    justifyItems: "center",
    gap: "0.2rem",
    color: "rgba(225,173,96,0.8)",
    textAlign: "center",
    filter: "drop-shadow(0 0 6px rgba(226,152,75,0.12))",
  },
  modeButtonActive: {
    color: "rgba(255,220,156,0.98)",
    filter: "drop-shadow(0 0 12px rgba(237,169,88,0.48))",
  },
  modeIcon: {
    width: "2.66rem",
    height: "2.66rem",
    display: "grid",
    placeItems: "center",
    borderRadius: "999px",
    border: "1px solid rgba(226,172,92,0.24)",
    background:
      "radial-gradient(circle at 50% 35%, rgba(58,39,22,0.42), rgba(7,11,18,0.28) 72%)",
  },
  modeLabel: {
    fontSize: "0.56rem",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
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
