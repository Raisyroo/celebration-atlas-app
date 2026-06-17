import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";

// Future national atlas boundary.
//
// This component is intentionally not imported by app/page.tsx yet, so it does
// not affect the current Michigan-first homepage runtime.
//
// Future role:
// - host the national U.S. map gateway
// - route Celebration Search commands across national, state, and event scopes
// - transition users from national discovery into state atlases
//
// Coverage rule:
// - this shell must never claim national completeness while Atlas coverage is
//   still partial or uneven.

interface NationalAtlasShellProps {
  children?: ReactNode;
  highlightedStateSlug?: string;
}

export default function NationalAtlasShell({
  children,
  highlightedStateSlug,
}: NationalAtlasShellProps) {
  const isMichiganHighlighted = highlightedStateSlug === "michigan";
  return (
    <section
      aria-label="Future national Celebration Atlas gateway"
      style={styles.shell}
    >
      <div style={styles.ambientGlow} aria-hidden="true" />
      <div style={styles.content}>
        <figure
          style={styles.mapStage}
          aria-label="Interactive preview for the future U.S. Atlas map"
        >
          <div style={styles.mapGlow} aria-hidden="true" />
          <div style={styles.nationalMapFrame}>
            <Image
              src="/maps/us-atlas-preview.webp"
              alt="Illustrated U.S. map preview for the national Celebration Atlas"
              fill
              priority
              sizes="100vw"
              style={styles.nationalMapImage}
            />
            <div
              style={{
                ...styles.michiganPortal,
                ...(isMichiganHighlighted ? styles.michiganPortalActive : null),
              }}
              aria-label={
                isMichiganHighlighted
                  ? "Michigan highlighted on national atlas preview"
                  : "Michigan state portal"
              }
              role="img"
            >
              <span style={styles.michiganPulse} aria-hidden="true" />
              <span style={styles.michiganDot} aria-hidden="true" />
              <span style={styles.michiganLabel}>Michigan</span>
            </div>
          </div>
        </figure>

        {children ? <div style={styles.searchSlot}>{children}</div> : null}
      </div>
    </section>
  );
}

export { NationalAtlasShell };
export type { NationalAtlasShellProps };

const styles: Record<string, CSSProperties> = {
  shell: {
    minHeight: "100svh",
    width: "100%",
    overflow: "hidden",
    background:
      "radial-gradient(circle at 50% 8%, rgba(251, 216, 157, 0.2), transparent 31%), radial-gradient(circle at 18% 34%, rgba(104, 148, 164, 0.15), transparent 30%), linear-gradient(180deg, #151e2b 0%, #101723 50%, #070d16 100%)",
    color: "#f8ead2",
    position: "relative",
  },
  ambientGlow: {
    background:
      "linear-gradient(120deg, transparent 0%, rgba(255, 232, 181, 0.08) 42%, transparent 68%)",
    inset: 0,
    opacity: 0.7,
    pointerEvents: "none",
    position: "absolute",
  },
  content: {
    minHeight: "100svh",
    position: "relative",
    zIndex: 1,
  },
  mapStage: {
    inset: 0,
    margin: 0,
    position: "absolute",
  },
  mapGlow: {
    background:
      "radial-gradient(circle at 50% 45%, rgba(246, 190, 119, 0.27), transparent 54%), radial-gradient(circle at 28% 32%, rgba(123, 173, 189, 0.2), transparent 32%)",
    filter: "blur(28px)",
    inset: "3% 4% 12%",
    opacity: 0.78,
    position: "absolute",
  },
  nationalMapFrame: {
    alignItems: "center",
    display: "flex",
    inset:
      "clamp(0.75rem, 2.5vw, 2rem) clamp(0.75rem, 3vw, 3rem) clamp(6.8rem, 16svh, 9rem)",
    justifyContent: "center",
    overflow: "visible",
    position: "absolute",
    zIndex: 1,
  },
  nationalMapImage: {
    objectFit: "contain",
    padding: "clamp(0.25rem, 1.6vw, 1.1rem)",
  },
  michiganPortal: {
    alignItems: "center",
    display: "flex",
    gap: "0.45rem",
    left: "66%",
    position: "absolute",
    top: "31%",
    transform: "translate(-50%, -50%)",
  },
  michiganPortalActive: {
    filter: "drop-shadow(0 0 22px rgba(251, 216, 157, 0.82))",
  },
  michiganDot: {
    background: "#fbd89d",
    border: "2px solid rgba(255, 244, 219, 0.92)",
    borderRadius: "999px",
    boxShadow: "0 0 24px rgba(251, 216, 157, 0.8)",
    display: "block",
    height: "1rem",
    width: "1rem",
    zIndex: 2,
  },
  michiganPulse: {
    background: "rgba(251, 216, 157, 0.22)",
    border: "1px solid rgba(251, 216, 157, 0.55)",
    borderRadius: "999px",
    height: "3.2rem",
    left: "-1.1rem",
    position: "absolute",
    top: "-1.1rem",
    width: "3.2rem",
  },
  michiganLabel: {
    background: "rgba(8, 13, 22, 0.58)",
    border: "1px solid rgba(251, 216, 157, 0.2)",
    borderRadius: "999px",
    color: "#fff4db",
    fontSize: "0.78rem",
    letterSpacing: "0.08em",
    padding: "0.38rem 0.58rem",
    textTransform: "uppercase",
  },
  searchSlot: {
    bottom: "max(1.1rem, env(safe-area-inset-bottom))",
    left: "50%",
    maxWidth: "min(44rem, calc(100vw - 2rem))",
    position: "fixed",
    transform: "translateX(-50%)",
    width: "100%",
    zIndex: 5,
  },
};
