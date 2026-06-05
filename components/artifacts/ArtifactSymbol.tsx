import type { CSSProperties } from "react";

export type ArtifactType =
  | "origin"
  | "memory"
  | "gold"
  | "witness"
  | "lost"
  | "legend";

export type ArtifactSymbolVariant = "portal" | "navigation" | "featured";

const artifactSymbolSrc: Record<ArtifactType, string> = {
  origin: "/artifact-symbols/origin.svg",
  memory: "/artifact-symbols/memory.svg",
  gold: "/artifact-symbols/gold.svg",
  witness: "/artifact-symbols/witness.svg",
  lost: "/artifact-symbols/lost.svg",
  legend: "/artifact-symbols/legend.svg",
};

const variantStyles: Record<ArtifactSymbolVariant, CSSProperties> = {
  portal: {
    "--artifact-symbol-size": "clamp(1.65rem, 8vw, 2.35rem)",
    "--artifact-symbol-color": "rgba(226, 172, 92, 0.74)",
    "--artifact-symbol-opacity": "0.38",
    "--artifact-symbol-filter":
      "drop-shadow(0 0 18px rgba(226, 172, 92, 0.24))",
  } as CSSProperties,
  navigation: {
    "--artifact-symbol-size": "clamp(1.18rem, 5.2vw, 1.5rem)",
    "--artifact-symbol-color": "rgba(239, 190, 116, 0.92)",
    "--artifact-symbol-opacity": "0.72",
    "--artifact-symbol-filter":
      "drop-shadow(0 1px 0 rgba(0, 0, 0, 0.62)) drop-shadow(0 0 8px rgba(226, 150, 72, 0.16))",
  } as CSSProperties,
  featured: {
    "--artifact-symbol-size": "clamp(2.65rem, 14vw, 4.6rem)",
    "--artifact-symbol-color": "rgba(246, 202, 127, 0.92)",
    "--artifact-symbol-opacity": "0.82",
    "--artifact-symbol-filter":
      "drop-shadow(0 0 26px rgba(226, 150, 72, 0.3)) drop-shadow(0 0 54px rgba(246, 202, 127, 0.12))",
  } as CSSProperties,
};

type ArtifactSymbolProps = {
  type: ArtifactType;
  variant?: ArtifactSymbolVariant;
  className?: string;
  ariaLabel?: string;
};

export default function ArtifactSymbol({
  type,
  variant = "navigation",
  className,
  ariaLabel,
}: ArtifactSymbolProps) {
  const symbolSrc = artifactSymbolSrc[type];
  const classes = ["artifact-symbol", `artifact-symbol--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      className={classes}
      data-artifact-type={type}
      data-artifact-variant={variant}
      role={ariaLabel ? "img" : undefined}
      style={{
        ...styles.symbol,
        ...variantStyles[variant],
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
    filter:
      "var(--artifact-symbol-filter, drop-shadow(0 0 14px rgba(226, 172, 92, 0.34)))",
    flex: "0 0 auto",
    transform: "translateZ(0)",
  },
};
