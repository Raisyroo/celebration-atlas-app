"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";

export type ArtifactTrailItem = {
  id: string;
  title: string;
  caption: string;
  videoSrc: string;
};

export type ArtifactTrailData = {
  id: string;
  name: string;
  parentArtifactId: string;
  artifacts: readonly ArtifactTrailItem[];
};

type ArtifactTrailProps = {
  trail: ArtifactTrailData;
};

type OpenArtifactCardProps = {
  artifact: ArtifactTrailItem;
};

type ArtifactVideoCardProps = {
  artifact: ArtifactTrailItem;
};

export default function ArtifactTrail({ trail }: ArtifactTrailProps) {
  return (
    <section
      className="artifact-trail"
      style={styles.trail}
      aria-label={trail.name}
    >
      <div style={styles.trailHeader}>
        <h3 style={styles.trailTitle}>{trail.name}</h3>
      </div>
      <div style={styles.trailLine} aria-hidden="true" />
      <div style={styles.cardStack}>
        {trail.artifacts.map((artifact) => (
          <OpenArtifactCard key={artifact.id} artifact={artifact} />
        ))}
      </div>
    </section>
  );
}

export function OpenArtifactCard({ artifact }: OpenArtifactCardProps) {
  return (
    <article style={styles.openCard} aria-label={artifact.title}>
      <div style={styles.cardGlow} aria-hidden="true" />
      <ArtifactVideoCard artifact={artifact} />
      <div style={styles.captionStack}>
        <h4 style={styles.cardTitle}>{artifact.title}</h4>
        <p style={styles.cardCaption}>{artifact.caption}</p>
      </div>
    </article>
  );
}

export function ArtifactVideoCard({ artifact }: ArtifactVideoCardProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoLoadFailed, setVideoLoadFailed] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);

  useTrailVideoAutoplay(videoRef, artifact.videoSrc, videoLoadFailed);

  return (
    <div style={styles.videoFrame}>
      <video
        ref={videoRef}
        style={{ ...styles.video, opacity: isVideoReady ? 1 : 0 }}
        src={artifact.videoSrc}
        muted
        playsInline
        controls={false}
        preload="metadata"
        onLoadedData={() => {
          setIsVideoReady(true);
          setVideoLoadFailed(false);
        }}
        onCanPlay={() => {
          setIsVideoReady(true);
          setVideoLoadFailed(false);
        }}
        onError={() => {
          setVideoLoadFailed(true);
          setIsVideoReady(false);
        }}
        aria-label={`${artifact.title} historic video`}
      />
      {!isVideoReady && !videoLoadFailed ? (
        <p style={styles.videoStatus}>Historic video loading</p>
      ) : null}
      {videoLoadFailed ? (
        <p style={styles.videoStatus}>
          Historic video placeholder — add the file when this artifact is ready.
        </p>
      ) : null}
    </div>
  );
}

function useTrailVideoAutoplay(
  videoRef: RefObject<HTMLVideoElement | null>,
  videoSrc: string,
  videoLoadFailed: boolean,
) {
  useEffect(() => {
    const video = videoRef.current;

    if (!video || videoLoadFailed) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;

        if (entry.isIntersecting) {
          video.muted = true;
          const playPromise = video.play();

          if (playPromise) {
            void playPromise.catch(() => {
              video.pause();
            });
          }
          return;
        }

        video.pause();
      },
      { threshold: 0.42, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(video);

    return () => {
      observer.disconnect();
      video.pause();
    };
  }, [videoLoadFailed, videoRef, videoSrc]);
}

const styles: Record<string, CSSProperties> = {
  trail: {
    position: "relative",
    display: "grid",
    gap: "clamp(0.82rem, 2.2svh, 1.18rem)",
    width: "100%",
    maxWidth: "36rem",
    justifySelf: "center",
    marginTop: "clamp(0.7rem, 2svh, 1.05rem)",
    paddingBottom: "clamp(0.6rem, 2svh, 1rem)",
  },
  trailHeader: {
    display: "grid",
    gap: "0.18rem",
    padding: "0 clamp(0.52rem, 2.4vw, 0.82rem)",
    textAlign: "center",
    justifyItems: "center",
  },
  trailTitle: {
    margin: 0,
    color: "rgba(255,239,213,0.96)",
    fontFamily: "Georgia, Times New Roman, serif",
    fontSize: "clamp(1.18rem, 5.2vw, 1.72rem)",
    fontWeight: 400,
    lineHeight: 1.08,
    textShadow: "0 3px 22px rgba(0,0,0,0.58)",
  },
  trailLine: {
    position: "absolute",
    left: "clamp(1.14rem, 5vw, 1.78rem)",
    top: "clamp(3.08rem, 7.2svh, 3.92rem)",
    bottom: "0.8rem",
    width: "1px",
    background:
      "linear-gradient(180deg, rgba(246,202,127,0.34), rgba(246,202,127,0.08), transparent)",
    boxShadow: "0 0 18px rgba(226,150,72,0.2)",
  },
  cardStack: {
    display: "grid",
    gap: "clamp(0.78rem, 2svh, 1rem)",
  },
  openCard: {
    position: "relative",
    display: "grid",
    gap: "clamp(0.52rem, 1.5svh, 0.78rem)",
    margin: 0,
    padding: "clamp(0.58rem, 2.4vw, 0.82rem)",
    borderRadius: "1.25rem",
    overflow: "hidden",
    background:
      "linear-gradient(160deg, rgba(17,23,34,0.76), rgba(5,8,15,0.66)), radial-gradient(circle at 52% 6%, rgba(246,202,127,0.15), transparent 42%)",
    boxShadow:
      "0 20px 54px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,238,207,0.1)",
    isolation: "isolate",
  },
  cardGlow: {
    position: "absolute",
    inset: "8% 9% 38%",
    zIndex: 0,
    borderRadius: "999px",
    background:
      "radial-gradient(ellipse at center, rgba(246,202,127,0.16), rgba(226,150,72,0.06) 42%, transparent 72%)",
    filter: "blur(10px)",
    pointerEvents: "none",
  },
  videoFrame: {
    position: "relative",
    zIndex: 1,
    display: "block",
    width: "100%",
    overflow: "hidden",
    borderRadius: "0.92rem",
    background:
      "radial-gradient(ellipse at 50% 28%, rgba(246,202,127,0.12), transparent 44%), linear-gradient(180deg, rgba(3,6,13,0.64), rgba(4,7,14,0.86))",
    boxShadow:
      "inset 0 0 0 1px rgba(255,238,207,0.06), inset 0 0 84px rgba(1,3,8,0.48)",
  },
  video: {
    display: "block",
    width: "100%",
    height: "auto",
    objectFit: "contain",
    objectPosition: "center",
    transition: "opacity 240ms ease",
  },
  videoStatus: {
    position: "absolute",
    top: "50%",
    left: "50%",
    zIndex: 2,
    transform: "translate(-50%, -50%)",
    width: "min(78%, 15rem)",
    margin: 0,
    padding: "0.66rem 0.78rem",
    borderRadius: "0.86rem",
    background: "rgba(6,9,16,0.58)",
    color: "rgba(255,239,213,0.72)",
    fontSize: "0.72rem",
    lineHeight: 1.35,
    textAlign: "center",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07)",
  },
  captionStack: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gap: "0.34rem",
    padding: "0 clamp(0.2rem, 1.6vw, 0.45rem) clamp(0.16rem, 1svh, 0.32rem)",
  },
  cardTitle: {
    margin: 0,
    color: "rgba(255,239,213,0.94)",
    fontFamily: "Georgia, Times New Roman, serif",
    fontSize: "clamp(0.98rem, 4.1vw, 1.2rem)",
    fontWeight: 400,
    lineHeight: 1.12,
    textShadow: "0 2px 18px rgba(0,0,0,0.48)",
  },
  cardCaption: {
    margin: 0,
    color: "rgba(255,238,207,0.82)",
    fontSize: "clamp(0.78rem, 3.2vw, 0.92rem)",
    lineHeight: 1.5,
    textShadow: "0 2px 16px rgba(0,0,0,0.42)",
  },
};
