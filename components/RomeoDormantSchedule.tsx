import { type CSSProperties, type ReactNode } from "react";

export type RomeoScheduleEventState = "UPCOMING" | "LIVE" | "ENDED" | "ARCHIVED";

type TimelineItem = {
  label: string;
  status: string;
};

type VisitWindow = {
  label: string;
  text: string;
};

type RomeoDormantScheduleProps = {
  eventName: string;
  eventState?: RomeoScheduleEventState;
};

const traditionalEvents = [
  "Peach Queen Pageant",
  "Peach Parade",
  "Carnival Midway",
  "Craft Show",
  "Live Entertainment",
  "Peach Dessert Booths",
  "Classic Car Show",
] as const;

const festivalTimeline: readonly TimelineItem[] = [
  { label: "2025 Festival", status: "Completed" },
  { label: "2026 Schedule", status: "Pending" },
  { label: "2026 Festival", status: "Upcoming" },
  { label: "2027 Festival", status: "Projected" },
] as const;

const bestVisitWindows: readonly VisitWindow[] = [
  { label: "Morning", text: "Lighter crowds" },
  { label: "Afternoon", text: "Food and shopping peak" },
  { label: "Evening", text: "Entertainment and rides" },
  { label: "Night", text: "Lights and atmosphere" },
] as const;

function DormantScheduleCard({
  children,
  style,
  ariaLabel,
}: {
  children: ReactNode;
  style?: CSSProperties;
  ariaLabel: string;
}) {
  return (
    <article style={{ ...styles.card, ...style }} aria-label={ariaLabel}>
      {children}
    </article>
  );
}

export default function RomeoDormantSchedule({
  eventName,
  eventState = "UPCOMING",
}: RomeoDormantScheduleProps) {
  const isDormantSchedule = eventState !== "LIVE";

  return (
    <div style={styles.shell} data-event-state={eventState}>
      <header style={styles.header}>
        <div style={styles.headerLabelRow}>
          <p style={styles.eyebrow}>Schedule</p>
          {isDormantSchedule ? (
            <span style={styles.statusChip}>⚪ Not Currently Active</span>
          ) : null}
        </div>
        <h2 style={styles.title}>{eventName}</h2>
      </header>

      <DormantScheduleCard
        ariaLabel="Next festival"
        style={styles.heroCard}
      >
        <div style={styles.heroTopline}>
          <span style={styles.calendarIcon} aria-hidden="true">
            ◷
          </span>
          <p style={styles.cardKicker}>Next Festival</p>
        </div>
        <p style={styles.heroDate}>September 3–7, 2026</p>
        <p style={styles.heroWeekend}>Labor Day Weekend</p>
        <div style={styles.countdownPlate}>
          <span style={styles.countdownNumber}>87</span>
          <span style={styles.countdownText}>Days Away</span>
        </div>
      </DormantScheduleCard>

      <DormantScheduleCard ariaLabel="Festival status">
        <p style={styles.cardKicker}>Status</p>
        <div style={styles.copyStack}>
          <p style={styles.cardBody}>
            The next Romeo Peach Festival is scheduled for Labor Day Weekend 2026.
          </p>
          <p style={styles.cardBody}>
            The official daily schedule has not yet been released.
          </p>
        </div>
      </DormantScheduleCard>

      <DormantScheduleCard ariaLabel="Traditional events">
        <p style={styles.cardKicker}>Traditional Events</p>
        <div style={styles.eventGrid}>
          {traditionalEvents.map((item) => (
            <div key={item} style={styles.traditionalItem}>
              <span style={styles.itemSigil} aria-hidden="true">✦</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </DormantScheduleCard>

      <DormantScheduleCard ariaLabel="Recently confirmed" style={styles.compactCard}>
        <p style={styles.cardKicker}>Recently Confirmed</p>
        <div style={styles.announcementRow}>
          <div style={styles.announcementDot} aria-hidden="true" />
          <div style={styles.announcementCopy}>
            <h3 style={styles.announcementTitle}>Peach Festival Run</h3>
            <p style={styles.announcementDate}>Thursday Sept. 3, 2026</p>
            <p style={styles.cardBody}>5K and 10K races announced.</p>
          </div>
        </div>
      </DormantScheduleCard>

      <DormantScheduleCard ariaLabel="Festival timeline">
        <p style={styles.cardKicker}>Festival Timeline</p>
        <div style={styles.timelineScroller}>
          <div style={styles.timelineTrack} aria-hidden="true" />
          {festivalTimeline.map((item) => (
            <div key={item.label} style={styles.timelineNode}>
              <span style={styles.timelineBeacon} />
              <strong style={styles.timelineLabel}>{item.label}</strong>
              <span style={styles.timelineStatus}>{item.status}</span>
            </div>
          ))}
        </div>
      </DormantScheduleCard>

      <DormantScheduleCard ariaLabel="Most recent festival" style={styles.recentCard}>
        <p style={styles.cardKicker}>Most Recent Festival</p>
        <p style={styles.recentDate}>Aug 28 – Sept 1, 2025</p>
        <button type="button" style={styles.archiveButton}>
          View Archived Schedule
        </button>
      </DormantScheduleCard>

      <DormantScheduleCard ariaLabel="Best times to visit">
        <p style={styles.cardKicker}>Best Times to Visit</p>
        <div style={styles.visitGrid}>
          {bestVisitWindows.map((window) => (
            <div key={window.label} style={styles.visitWindow}>
              <strong style={styles.visitLabel}>{window.label}</strong>
              <span style={styles.visitText}>{window.text}</span>
            </div>
          ))}
        </div>
      </DormantScheduleCard>

      <DormantScheduleCard ariaLabel="Schedule confidence" style={styles.confidenceCard}>
        <p style={styles.cardKicker}>Schedule Confidence</p>
        <p style={styles.confidenceText}>Official festival dates confirmed.</p>
        <p style={styles.confidenceText}>Daily event schedule pending release.</p>
      </DormantScheduleCard>
    </div>
  );
}

const gold = "rgba(226, 172, 92, 0.9)";
const softText = "rgba(237,224,200,0.9)";
const panelBackground =
  "linear-gradient(155deg, rgba(18,24,35,0.74), rgba(7,10,17,0.64)), radial-gradient(circle at 16% 0%, rgba(246,202,127,0.12), transparent 42%)";

const styles: Record<string, CSSProperties> = {
  shell: {
    display: "grid",
    gap: "clamp(0.82rem, 2.7svh, 1.25rem)",
    width: "100%",
    maxWidth: "38rem",
    justifySelf: "center",
    padding: "clamp(3.1rem, 8.5svh, 4.8rem) 0 clamp(1.1rem, 3svh, 1.8rem)",
  },
  header: {
    display: "grid",
    gap: "0.55rem",
  },
  headerLabelRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.75rem",
    flexWrap: "wrap",
  },
  eyebrow: {
    margin: 0,
    color: gold,
    fontSize: "0.62rem",
    letterSpacing: "0.2em",
    textTransform: "uppercase",
  },
  statusChip: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "1.62rem",
    padding: "0.22rem 0.62rem",
    border: "1px solid rgba(246,202,127,0.24)",
    borderRadius: "999px",
    background: "rgba(5,8,14,0.46)",
    color: "rgba(239,225,202,0.82)",
    fontSize: "0.62rem",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    boxShadow: "inset 0 1px 0 rgba(255,238,207,0.08)",
  },
  title: {
    margin: 0,
    color: "rgba(255,238,207,0.98)",
    fontFamily: "Georgia, Times New Roman, serif",
    fontWeight: 400,
    fontSize: "clamp(2.08rem, 8vw, 3.65rem)",
    lineHeight: 0.94,
    letterSpacing: "-0.04em",
    textWrap: "balance",
    textShadow: "0 4px 28px rgba(0,0,0,0.78), 0 0 24px rgba(227,146,76,0.22)",
  },
  card: {
    position: "relative",
    display: "grid",
    gap: "0.72rem",
    padding: "clamp(0.9rem, 4vw, 1.35rem)",
    border: "1px solid rgba(246,202,127,0.18)",
    borderRadius: "1.32rem",
    background: panelBackground,
    boxShadow: "0 24px 58px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,238,207,0.08)",
    backdropFilter: "blur(15px)",
    overflow: "hidden",
  },
  heroCard: {
    minHeight: "16.5rem",
    alignContent: "space-between",
    padding: "clamp(1.08rem, 5vw, 1.7rem)",
    background:
      "radial-gradient(circle at 84% 12%, rgba(246,202,127,0.27), transparent 28%), radial-gradient(circle at 18% 78%, rgba(226,150,72,0.18), transparent 36%), linear-gradient(155deg, rgba(23,29,40,0.82), rgba(5,8,15,0.72))",
    border: "1px solid rgba(246,202,127,0.28)",
  },
  heroTopline: {
    display: "flex",
    alignItems: "center",
    gap: "0.62rem",
  },
  calendarIcon: {
    display: "grid",
    placeItems: "center",
    width: "2.3rem",
    height: "2.3rem",
    border: "1px solid rgba(246,202,127,0.34)",
    borderRadius: "0.82rem",
    color: "rgba(246,202,127,0.92)",
    background: "rgba(2,5,11,0.34)",
    boxShadow: "0 0 22px rgba(226,150,72,0.16)",
    fontSize: "1.2rem",
  },
  cardKicker: {
    margin: 0,
    color: gold,
    fontSize: "0.62rem",
    letterSpacing: "0.19em",
    textTransform: "uppercase",
  },
  heroDate: {
    margin: "1rem 0 0",
    color: "rgba(255,238,207,0.99)",
    fontFamily: "Georgia, Times New Roman, serif",
    fontSize: "clamp(2rem, 9.2vw, 4rem)",
    lineHeight: 0.96,
    letterSpacing: "-0.055em",
    textWrap: "balance",
  },
  heroWeekend: {
    margin: "0.25rem 0 0",
    color: "rgba(246,202,127,0.88)",
    fontSize: "0.86rem",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  countdownPlate: {
    justifySelf: "start",
    display: "inline-flex",
    alignItems: "baseline",
    gap: "0.45rem",
    marginTop: "1rem",
    padding: "0.5rem 0.72rem",
    border: "1px solid rgba(246,202,127,0.26)",
    borderRadius: "999px",
    background: "rgba(5,8,14,0.54)",
  },
  countdownNumber: {
    color: "rgba(255,238,207,0.98)",
    fontFamily: "Georgia, Times New Roman, serif",
    fontSize: "1.6rem",
    lineHeight: 1,
  },
  countdownText: {
    color: "rgba(246,202,127,0.84)",
    fontSize: "0.66rem",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },
  copyStack: { display: "grid", gap: "0.48rem" },
  cardBody: {
    margin: 0,
    color: softText,
    fontSize: "0.86rem",
    lineHeight: 1.55,
  },
  eventGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))",
    gap: "0.58rem 0.72rem",
  },
  traditionalItem: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    color: "rgba(245,226,194,0.92)",
    fontSize: "0.82rem",
    lineHeight: 1.35,
  },
  itemSigil: {
    color: "rgba(246,202,127,0.72)",
    fontSize: "0.58rem",
  },
  compactCard: { gap: "0.62rem" },
  announcementRow: {
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: "0.72rem",
    alignItems: "start",
  },
  announcementDot: {
    width: "0.72rem",
    height: "0.72rem",
    marginTop: "0.24rem",
    borderRadius: "999px",
    background: "rgba(246,202,127,0.92)",
    boxShadow: "0 0 18px rgba(226,150,72,0.45)",
  },
  announcementCopy: { display: "grid", gap: "0.25rem" },
  announcementTitle: {
    margin: 0,
    color: "rgba(255,238,207,0.96)",
    fontFamily: "Georgia, Times New Roman, serif",
    fontWeight: 400,
    fontSize: "1.2rem",
  },
  announcementDate: {
    margin: 0,
    color: "rgba(246,202,127,0.78)",
    fontSize: "0.72rem",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  timelineScroller: {
    position: "relative",
    display: "grid",
    gridAutoFlow: "column",
    gridAutoColumns: "minmax(8.4rem, 1fr)",
    gap: "0.75rem",
    overflowX: "auto",
    padding: "0.28rem 0 0.2rem",
    scrollbarWidth: "none",
  },
  timelineTrack: {
    position: "absolute",
    left: "0.6rem",
    right: "0.6rem",
    top: "0.68rem",
    borderTop: "1px dashed rgba(246,202,127,0.28)",
  },
  timelineNode: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gap: "0.28rem",
    minWidth: 0,
    paddingTop: "1.15rem",
  },
  timelineBeacon: {
    position: "absolute",
    left: 0,
    top: "0.05rem",
    width: "0.72rem",
    height: "0.72rem",
    borderRadius: "999px",
    background: "rgba(5,8,14,0.95)",
    border: "1px solid rgba(246,202,127,0.56)",
    boxShadow: "0 0 16px rgba(226,150,72,0.25)",
  },
  timelineLabel: {
    color: "rgba(255,238,207,0.92)",
    fontSize: "0.75rem",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  timelineStatus: {
    color: "rgba(238,224,200,0.76)",
    fontSize: "0.76rem",
  },
  recentCard: { alignItems: "start" },
  recentDate: {
    margin: 0,
    color: "rgba(255,238,207,0.94)",
    fontFamily: "Georgia, Times New Roman, serif",
    fontSize: "1.45rem",
  },
  archiveButton: {
    appearance: "none",
    justifySelf: "start",
    border: "1px solid rgba(246,202,127,0.36)",
    borderRadius: "999px",
    padding: "0.58rem 0.88rem",
    background: "linear-gradient(180deg, rgba(246,202,127,0.13), rgba(226,150,72,0.06))",
    color: "rgba(250,224,183,0.92)",
    fontSize: "0.66rem",
    letterSpacing: "0.15em",
    textTransform: "uppercase",
  },
  visitGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "0.75rem",
  },
  visitWindow: {
    display: "grid",
    gap: "0.18rem",
    padding: "0.72rem",
    border: "1px solid rgba(246,202,127,0.12)",
    borderRadius: "0.96rem",
    background: "rgba(2,5,11,0.24)",
  },
  visitLabel: {
    color: "rgba(246,202,127,0.86)",
    fontSize: "0.72rem",
    letterSpacing: "0.11em",
    textTransform: "uppercase",
  },
  visitText: {
    color: softText,
    fontSize: "0.8rem",
    lineHeight: 1.42,
  },
  confidenceCard: {
    gap: "0.36rem",
    opacity: 0.92,
  },
  confidenceText: {
    margin: 0,
    color: "rgba(237,224,200,0.78)",
    fontSize: "0.78rem",
    lineHeight: 1.48,
  },
};
