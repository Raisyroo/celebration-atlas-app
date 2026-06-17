import type { CSSProperties, ReactNode } from "react";

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
      <figure
        style={styles.mapStage}
        aria-label="Interactive preview for the future U.S. Atlas map"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- Dev investor preview must expose the raw public map asset, not Next image optimization. */}
        <img
          src="/maps/us-atlas-preview.webp"
          alt="Celebration Atlas U.S. map"
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
      </figure>

      {children ? <div style={styles.searchSlot}>{children}</div> : null}
    </section>
  );
}

export { NationalAtlasShell };
export type { NationalAtlasShellProps };

const styles: Record<string, CSSProperties> = {
  shell: {
    background: "#050812",
    color: "#f8ead2",
    minHeight: "100vh",
    overflow: "hidden",
    padding: 0,
    position: "relative",
    width: "100vw",
  },
  mapStage: {
    inset: 0,
    margin: 0,
    overflow: "hidden",
    position: "absolute",
  },
  nationalMapImage: {
    display: "block",
    height: "100%",
    inset: 0,
    objectFit: "cover",
    objectPosition: "center",
    position: "absolute",
    width: "100%",
  },
  michiganPortal: {
    alignItems: "center",
    display: "flex",
    gap: "0.45rem",
    left: "66%",
    position: "absolute",
    top: "31%",
    transform: "translate(-50%, -50%)",
    zIndex: 2,
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
