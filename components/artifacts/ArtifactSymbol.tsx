import type { CSSProperties } from "react";

export type ArtifactType =
  | "origin"
  | "history"
  | "mystery"
  | "witness"
  | "living"
  | "lost"
  | "legend"
  | "gold";

const artifactSymbols: Record<
  ArtifactType,
  {
    emoji: string;
    svgSrc: string;
  }
> = {
  origin: { emoji: "🔑", svgSrc: "/artifact-symbols/origin.svg" },
  history: { emoji: "🕯️", svgSrc: "/artifact-symbols/history.svg" },
  mystery: { emoji: "✦", svgSrc: "/artifact-symbols/mystery.svg" },
  witness: { emoji: "👁", svgSrc: "/artifact-symbols/witness.svg" },
  living: { emoji: "🌿", svgSrc: "/artifact-symbols/living.svg" },
  lost: { emoji: "🧭", svgSrc: "/artifact-symbols/lost.svg" },
  legend: { emoji: "🎭", svgSrc: "/artifact-symbols/legend.svg" },
  gold: { emoji: "★", svgSrc: "/artifact-symbols/gold.svg" },
};

type ArtifactSymbolProps = {
  type: ArtifactType;
};

export default function ArtifactSymbol({ type }: ArtifactSymbolProps) {
  const symbol = artifactSymbols[type];

  return (
    <span
      aria-hidden="true"
      data-artifact-type={type}
      data-symbol-src={symbol.svgSrc}
      style={styles.symbol}
    >
      {symbol.emoji}
    </span>
  );
}

const styles: Record<string, CSSProperties> = {
  symbol: {
    display: "inline-grid",
    placeItems: "center",
    justifySelf: "center",
    width: "1.35rem",
    height: "1.35rem",
    color: "rgba(226, 172, 92, 0.88)",
    fontSize: "clamp(0.82rem, 3vw, 1rem)",
    lineHeight: 1,
    opacity: 0.66,
    filter: "sepia(0.45) saturate(0.78)",
    textShadow:
      "0 0 14px rgba(226, 172, 92, 0.38), 0 2px 14px rgba(0, 0, 0, 0.48)",
    transform: "translateZ(0)",
  },
};
