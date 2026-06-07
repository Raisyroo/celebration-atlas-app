import { type CSSProperties } from "react";

export type RomeoScheduleEventState = "UPCOMING" | "LIVE" | "ENDED" | "ARCHIVED";

type RomeoDormantScheduleProps = {
  eventName: string;
  eventState?: RomeoScheduleEventState;
};

const knownEvents = [
  "Peach Queen Pageant",
  "Peach Parade",
  "Carnival Midway",
  "Craft Show",
  "Live Entertainment",
  "Peach Festival Run",
] as const;

export default function RomeoDormantSchedule({
  eventName,
  eventState = "UPCOMING",
}: RomeoDormantScheduleProps) {
  return (
    <div style={styles.shell} data-event-state={eventState}>
      <section style={styles.heroPanel} aria-label="Next festival">
        <p style={styles.eyebrow}>Schedule</p>
        <h2 style={styles.title}>{eventName}</h2>
        <div style={styles.heroDateBlock}>
          <p style={styles.cardKicker}>Next Festival</p>
          <p style={styles.heroDate}>September 3–7, 2026</p>
          <p style={styles.heroWeekend}>Labor Day Weekend</p>
        </div>
        <p style={styles.countdown}>87 Days Away</p>
      </section>

      <section style={styles.guideSection} aria-labelledby="latest-schedule-update">
        <h3 id="latest-schedule-update" style={styles.sectionTitle}>
          Latest Schedule Update
        </h3>
        <div style={styles.copyStack}>
          <p style={styles.sectionBody}>
            The official 2026 schedule has not yet been released.
          </p>
          <p style={styles.sectionBody}>
            The most recent published schedule was from 2025.
          </p>
        </div>
        <button type="button" style={styles.archiveButton}>
          View 2025 Schedule →
        </button>
      </section>

      <section style={styles.guideSection} aria-labelledby="known-events">
        <h3 id="known-events" style={styles.sectionTitle}>
          Known Events
        </h3>
        <ul style={styles.eventList}>
          {knownEvents.map((item) => (
            <li key={item} style={styles.eventListItem}>
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section style={styles.guideSection} aria-labelledby="recently-confirmed">
        <h3 id="recently-confirmed" style={styles.sectionTitle}>
          Recently Confirmed
        </h3>
        <div style={styles.confirmedCallout}>
          <h4 style={styles.announcementTitle}>Peach Festival Run</h4>
          <p style={styles.announcementDate}>Thursday Sept. 3, 2026</p>
          <p style={styles.sectionBody}>5K and 10K races announced.</p>
        </div>
      </section>
    </div>
  );
}

const gold = "rgba(226, 172, 92, 0.9)";
const softText = "rgba(237,224,200,0.9)";

const styles: Record<string, CSSProperties> = {
  shell: {
    display: "grid",
    gap: "clamp(1.05rem, 3svh, 1.65rem)",
    width: "100%",
    maxWidth: "38rem",
    justifySelf: "center",
    padding: "clamp(3.1rem, 8.5svh, 4.8rem) 0 clamp(1.1rem, 3svh, 1.8rem)",
  },
  heroPanel: {
    position: "relative",
    display: "grid",
    gap: "clamp(0.78rem, 2.4svh, 1.15rem)",
    minHeight: "16.5rem",
    alignContent: "space-between",
    padding: "clamp(1.08rem, 5vw, 1.7rem)",
    border: "1px solid rgba(246,202,127,0.28)",
    borderRadius: "1.32rem",
    background:
      "radial-gradient(circle at 84% 12%, rgba(246,202,127,0.24), transparent 28%), radial-gradient(circle at 18% 78%, rgba(226,150,72,0.16), transparent 36%), linear-gradient(155deg, rgba(23,29,40,0.78), rgba(5,8,15,0.68))",
    boxShadow: "0 24px 58px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,238,207,0.08)",
    backdropFilter: "blur(14px)",
    overflow: "hidden",
  },
  eyebrow: {
    margin: 0,
    color: gold,
    fontSize: "0.62rem",
    letterSpacing: "0.2em",
    textTransform: "uppercase",
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
  heroDateBlock: {
    display: "grid",
    gap: "0.32rem",
  },
  cardKicker: {
    margin: 0,
    color: gold,
    fontSize: "0.62rem",
    letterSpacing: "0.19em",
    textTransform: "uppercase",
  },
  heroDate: {
    margin: 0,
    color: "rgba(255,238,207,0.99)",
    fontFamily: "Georgia, Times New Roman, serif",
    fontSize: "clamp(2rem, 9.2vw, 4rem)",
    lineHeight: 0.96,
    letterSpacing: "-0.055em",
    textWrap: "balance",
  },
  heroWeekend: {
    margin: 0,
    color: "rgba(246,202,127,0.88)",
    fontSize: "0.86rem",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  countdown: {
    justifySelf: "start",
    margin: 0,
    color: "rgba(255,238,207,0.96)",
    fontFamily: "Georgia, Times New Roman, serif",
    fontSize: "clamp(1.38rem, 5vw, 2rem)",
    lineHeight: 1,
    letterSpacing: "-0.02em",
  },
  guideSection: {
    display: "grid",
    gap: "0.78rem",
    padding: "clamp(1rem, 3.2vw, 1.3rem) 0 0",
    borderTop: "1px solid rgba(246,202,127,0.22)",
  },
  sectionTitle: {
    margin: 0,
    color: "rgba(255,238,207,0.96)",
    fontFamily: "Georgia, Times New Roman, serif",
    fontWeight: 400,
    fontSize: "clamp(1.32rem, 4.6vw, 1.8rem)",
    lineHeight: 1.08,
    letterSpacing: "-0.025em",
    textShadow: "0 2px 18px rgba(0,0,0,0.58)",
  },
  copyStack: { display: "grid", gap: "0.34rem" },
  sectionBody: {
    margin: 0,
    color: softText,
    fontSize: "0.91rem",
    lineHeight: 1.58,
  },
  archiveButton: {
    appearance: "none",
    justifySelf: "start",
    border: "0",
    borderBottom: "1px solid rgba(246,202,127,0.42)",
    padding: "0 0 0.18rem",
    background: "transparent",
    color: "rgba(250,224,183,0.94)",
    fontSize: "0.72rem",
    letterSpacing: "0.15em",
    textTransform: "uppercase",
  },
  eventList: {
    display: "grid",
    gap: "0.52rem",
    margin: 0,
    padding: "0 0 0 1.05rem",
    color: "rgba(245,226,194,0.92)",
    fontSize: "0.94rem",
    lineHeight: 1.45,
  },
  eventListItem: {
    paddingLeft: "0.12rem",
  },
  confirmedCallout: {
    display: "grid",
    gap: "0.28rem",
    maxWidth: "28rem",
    padding: "0.78rem 0 0.78rem 1rem",
    borderLeft: "1px solid rgba(246,202,127,0.36)",
    background:
      "linear-gradient(90deg, rgba(246,202,127,0.08), rgba(246,202,127,0))",
  },
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
};
