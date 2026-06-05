import type { CSSProperties } from "react";

export type ArtifactType =
  | "origin"
  | "memory"
  | "gold"
  | "witness"
  | "lost"
  | "legend";

const artifactSymbolSrc: Record<ArtifactType, string> = {
  origin: "/artifact-symbols/origin.svg",
  memory: "/artifact-symbols/memory.svg",
  gold: "/artifact-symbols/gold.svg",
  witness: "/artifact-symbols/witness.svg",
  lost: "/artifact-symbols/lost.svg",
  legend: "/artifact-symbols/legend.svg",
};

type ArtifactSymbolProps = {
  type: ArtifactType;
  className?: string;
  ariaLabel?: string;
};

export default function ArtifactSymbol({
  type,
  className,
  ariaLabel,
}: ArtifactSymbolProps) {
  const symbolSrc = artifactSymbolSrc[type];

  return (
    <span
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      className={className}
      data-artifact-type={type}
      data-symbol-src={symbolSrc}
      role={ariaLabel ? "img" : undefined}
      style={{
        ...styles.symbol,
        WebkitMask: `url(${symbolSrc}) center / contain no-repeat`,
        mask: `url(${symbolSrc}) center / contain no-repeat`,
      }}
    />
  );
}

const styles: Record<string, CSSProperties> = {
  symbol: {
    display: "inline-block",
    justifySelf: "center",
    width: "var(--artifact-symbol-size, 1.35rem)",
    height: "var(--artifact-symbol-size, 1.35rem)",
    color: "var(--artifact-symbol-color, rgba(226, 172, 92, 0.88))",
    backgroundColor: "currentColor",
    opacity: "var(--artifact-symbol-opacity, 0.58)",
    filter: "var(--artifact-symbol-filter, drop-shadow(0 0 14px rgba(226, 172, 92, 0.34)))",
    transform: "translateZ(0)",
  },
};
