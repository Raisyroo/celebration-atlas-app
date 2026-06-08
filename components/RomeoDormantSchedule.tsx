import { type CSSProperties } from "react";

export type RomeoScheduleEventState = "UPCOMING" | "LIVE" | "ENDED" | "ARCHIVED";

type RomeoDormantScheduleProps = {
  eventName: string;
  eventState?: RomeoScheduleEventState;
};

const planningNotes = [
  "Use the 2025 archive as a guide to the festival rhythm, not as confirmed 2026 timing.",
  "Daily event times are expected closer to the official summer schedule release.",
  "Plan around the downtown core first; parade, carnival, food, and entertainment details may shift by day.",
] as const;

export default function RomeoDormantSchedule({
  eventName,
  eventState = "UPCOMING",
}: RomeoDormantScheduleProps) {
  return (
    <div style={styles.shell} data-event-state={eventState}>
      <header style={styles.hero} aria-label="Next festival schedule summary">
        <p style={styles.eyebrow}>Schedule</p>
        <h2 style={styles.title}>{eventName}</h2>
        <div style={styles.dateStack}>
          <p style={styles.festivalDate}>September 3–7, 2026</p>
          <p style={styles.weekend}>Labor Day Weekend</p>
        </div>
        <p style={styles.countdown}>87 Days Away</p>
      </header>

      <Divider />

      <section style={styles.guideSection} aria-labelledby="latest-schedule-update">
        <h3 id="latest-schedule-update" style={styles.sectionTitle}>
          Latest Schedule Update
        </h3>
        <div style={styles.copyStack}>
          <p style={styles.sectionBody}>2026 daily schedule has not yet been released.</p>
          <p style={styles.sectionBody}>Expected Summer 2026.</p>
        </div>
      </section>

      <Divider />

      <section style={styles.guideSection} aria-labelledby="most-recent-schedule">
        <h3 id="most-recent-schedule" style={styles.sectionTitle}>
          Most Recent Schedule
        </h3>
        <p style={styles.archiveDate}>August 28 – September 1, 2025</p>
        <button type="button" style={styles.archiveButton}>
          View Archived Schedule
        </button>
      </section>

      {planningNotes.length > 0 ? (
        <>
          <Divider />

          <section style={styles.guideSection} aria-labelledby="planning-notes">
            <h3 id="planning-notes" style={styles.sectionTitle}>
              Planning Notes
            </h3>
            <ul style={styles.noteList}>
              {planningNotes.map((note) => (
                <li key={note} style={styles.noteItem}>
                  {note}
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}

function Divider() {
  return <div style={styles.divider} aria-hidden="true" />;
}

const gold = "rgba(226, 172, 92, 0.9)";
const softText = "rgba(237,224,200,0.9)";

const styles: Record<string, CSSProperties> = {
  shell: {
    display: "grid",
    gap: "clamp(1.35rem, 3.4svh, 2.25rem)",
    width: "100%",
    maxWidth: "42rem",
    justifySelf: "center",
    padding: "clamp(4.15rem, 10svh, 6.1rem) 0 clamp(1.4rem, 4svh, 2.5rem)",
  },
  hero: {
    display: "grid",
    justifyItems: "center",
    gap: "clamp(0.82rem, 2.35svh, 1.24rem)",
    textAlign: "center",
  },
  eyebrow: {
    margin: 0,
    color: gold,
    fontSize: "0.62rem",
    letterSpacing: "0.28em",
    textTransform: "uppercase",
  },
  title: {
    maxWidth: "11ch",
    margin: 0,
    color: "rgba(255,238,207,0.98)",
    fontFamily: "Georgia, Times New Roman, serif",
    fontWeight: 400,
    fontSize: "clamp(2.45rem, 9.4vw, 4.9rem)",
    lineHeight: 0.88,
    letterSpacing: "-0.055em",
    textWrap: "balance",
    textShadow: "0 4px 30px rgba(0,0,0,0.78), 0 0 24px rgba(227,146,76,0.2)",
  },
  dateStack: {
    display: "grid",
    gap: "0.46rem",
    marginTop: "clamp(0.42rem, 1.2svh, 0.72rem)",
  },
  festivalDate: {
    margin: 0,
    color: "rgba(255,238,207,0.99)",
    fontFamily: "Georgia, Times New Roman, serif",
    fontSize: "clamp(1.34rem, 5.7vw, 2.55rem)",
    lineHeight: 1.02,
    letterSpacing: "-0.038em",
    textWrap: "balance",
  },
  weekend: {
    margin: 0,
    color: "rgba(246,202,127,0.88)",
    fontSize: "0.72rem",
    letterSpacing: "0.17em",
    textTransform: "uppercase",
  },
  countdown: {
    margin: "clamp(0.25rem, 1svh, 0.5rem) 0 0",
    color: "rgba(255,238,207,0.94)",
    fontFamily: "Georgia, Times New Roman, serif",
    fontSize: "clamp(1.22rem, 4.8vw, 2rem)",
    lineHeight: 1,
    letterSpacing: "-0.02em",
  },
  divider: {
    width: "min(100%, 32rem)",
    height: "1px",
    justifySelf: "center",
    background:
      "linear-gradient(90deg, transparent, rgba(246,202,127,0.18), rgba(246,202,127,0.58), rgba(246,202,127,0.18), transparent)",
  },
  guideSection: {
    display: "grid",
    justifyItems: "center",
    gap: "clamp(0.68rem, 1.8svh, 0.95rem)",
    textAlign: "center",
  },
  sectionTitle: {
    margin: 0,
    color: "rgba(255,238,207,0.96)",
    fontFamily: "Georgia, Times New Roman, serif",
    fontWeight: 400,
    fontSize: "clamp(1.34rem, 4.8vw, 2.08rem)",
    lineHeight: 1.06,
    letterSpacing: "-0.03em",
    textShadow: "0 2px 18px rgba(0,0,0,0.58)",
  },
  copyStack: {
    display: "grid",
    gap: "0.28rem",
  },
  sectionBody: {
    margin: 0,
    color: softText,
    fontSize: "clamp(0.92rem, 2.5vw, 1.02rem)",
    lineHeight: 1.58,
  },
  archiveDate: {
    margin: 0,
    color: softText,
    fontFamily: "Georgia, Times New Roman, serif",
    fontSize: "clamp(1.08rem, 3.8vw, 1.44rem)",
    lineHeight: 1.18,
    letterSpacing: "-0.018em",
  },
  archiveButton: {
    appearance: "none",
    border: "1px solid rgba(246,202,127,0.34)",
    borderRadius: "999px",
    padding: "0.54rem 0.82rem 0.5rem",
    background: "rgba(5,8,15,0.12)",
    color: "rgba(250,224,183,0.94)",
    fontSize: "0.64rem",
    letterSpacing: "0.16em",
    textTransform: "uppercase",
  },
  noteList: {
    display: "grid",
    gap: "0.52rem",
    width: "min(100%, 31rem)",
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  noteItem: {
    margin: 0,
    color: "rgba(245,226,194,0.88)",
    fontSize: "0.91rem",
    lineHeight: 1.55,
  },
};
