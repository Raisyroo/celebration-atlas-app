import { type CSSProperties } from "react";

export type RomeoScheduleEventState = "UPCOMING" | "LIVE" | "ENDED" | "ARCHIVED";

type RomeoDormantScheduleProps = {
  eventName: string;
  eventState?: RomeoScheduleEventState;
};

const recurringEvents = [
  "St John Men’s Club Parking",
  "Westview Orchards Market and Peach-y Treats Tent",
  "Thumb Area Artists’ Exhibition",
  "Peachy Keen Craft Show",
  "Frontier Town’s Annual Labor Day Craft Show",
  "Food at the Masonic Lodge",
  "Westview Winery at Schoolhouse",
  "Mid America Carnival Rides",
  "Romeo Lions Gourmet Food Pavilion",
  "Romeo Lions Refreshment Fieldhouse",
] as const;

const scheduleAnchors = [
  {
    day: "Thursday",
    events: ["Peach Festival 5K/10K Run", "Carnival rides", "Live music"],
  },
  {
    day: "Friday",
    events: ["Carnival rides", "Fireworks", "Concert series", "Masonic Lodge music"],
  },
  {
    day: "Saturday",
    events: ["KidsFest", "Golf Classic", "Carnival rides", "Concert series"],
  },
  {
    day: "Sunday",
    events: [
      "Classic Car Show",
      "Pancake Breakfast",
      "Kids Pie Eating Contest",
      "Bed Races",
      "Charity Car Cruise",
    ],
  },
  {
    day: "Labor Day Monday",
    events: ["Children’s Parade", "Carnival rides", "Romeo Peach Festival Hometown Parade"],
  },
] as const;

export default function RomeoDormantSchedule({
  eventName,
  eventState = "UPCOMING",
}: RomeoDormantScheduleProps) {
  return (
    <div style={styles.shell} data-event-state={eventState}>
      <header style={styles.hero} aria-label="Romeo Peach Festival schedule summary">
        <p style={styles.eyebrow}>Schedule</p>
        <h2 style={styles.title}>{eventName}</h2>
        <p style={styles.anniversary}>95th Anniversary</p>
        <div style={styles.dateStack}>
          <p style={styles.festivalDate}>September 3–7, 2026</p>
          <p style={styles.weekend}>Labor Day Weekend</p>
        </div>
        <p style={styles.status}>2026 daily schedule has not yet been released.</p>
      </header>

      <Divider />

      <section style={styles.guideSection} aria-labelledby="known-recurring-events">
        <h3 id="known-recurring-events" style={styles.sectionTitle}>
          Known Recurring Events
        </h3>
        <ul style={styles.eventList}>
          {recurringEvents.map((event) => (
            <li key={event} style={styles.eventItem}>
              {event}
            </li>
          ))}
        </ul>
      </section>

      <Divider />

      <section style={styles.guideSection} aria-labelledby="major-2025-schedule-anchors">
        <h3 id="major-2025-schedule-anchors" style={styles.sectionTitle}>
          Major 2025 Schedule Anchors
        </h3>
        <div style={styles.anchorStack}>
          {scheduleAnchors.map((day) => (
            <section key={day.day} style={styles.daySection} aria-label={`${day.day} 2025 anchors`}>
              <h4 style={styles.dayTitle}>{day.day}</h4>
              <ul style={styles.anchorList}>
                {day.events.map((event) => (
                  <li key={event} style={styles.anchorItem}>
                    {event}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>

      <Divider />

      <section style={styles.guideSection} aria-labelledby="hometown-parade">
        <h3 id="hometown-parade" style={styles.sectionTitle}>
          Romeo Peach Festival Hometown Parade
        </h3>
        <p style={styles.paradeTime}>Labor Day Monday at 1:30 PM</p>
        <p style={styles.sectionBody}>Main Street from Gates Street to Durham Street</p>
      </section>

      <Divider />

      <p style={styles.scheduleNote}>
        <span>
          Official 2026 daily schedule is pending: “WE’RE WORKING ON THE 2026 SCHEDULE / CHECK BACK SOON.”
        </span>{" "}
        <span>The event list shown is based on the latest published 2025 schedule.</span>
      </p>
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
    gap: "clamp(1.25rem, 3svh, 2rem)",
    width: "100%",
    maxWidth: "43rem",
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
  anniversary: {
    margin: "-0.22rem 0 0",
    color: "rgba(246,202,127,0.88)",
    fontSize: "0.7rem",
    letterSpacing: "0.16em",
    textTransform: "uppercase",
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
  status: {
    width: "min(100%, 31rem)",
    margin: "clamp(0.15rem, 0.8svh, 0.42rem) 0 0",
    color: "rgba(255,238,207,0.94)",
    fontSize: "clamp(0.98rem, 2.8vw, 1.16rem)",
    lineHeight: 1.5,
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
    gap: "clamp(0.78rem, 1.9svh, 1.05rem)",
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
  sectionBody: {
    margin: 0,
    color: softText,
    fontSize: "clamp(0.92rem, 2.5vw, 1.02rem)",
    lineHeight: 1.58,
  },
  eventList: {
    display: "grid",
    gap: "0.5rem",
    width: "min(100%, 32rem)",
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  eventItem: {
    margin: 0,
    color: "rgba(245,226,194,0.9)",
    fontSize: "0.94rem",
    lineHeight: 1.45,
  },
  anchorStack: {
    display: "grid",
    gap: "clamp(0.86rem, 2svh, 1.15rem)",
    width: "min(100%, 34rem)",
  },
  daySection: {
    display: "grid",
    gap: "0.36rem",
  },
  dayTitle: {
    margin: 0,
    color: "rgba(246,202,127,0.92)",
    fontSize: "0.68rem",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
  },
  anchorList: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: "0.38rem 0.68rem",
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  anchorItem: {
    margin: 0,
    color: "rgba(245,226,194,0.9)",
    fontSize: "0.91rem",
    lineHeight: 1.45,
  },
  paradeTime: {
    margin: 0,
    color: "rgba(255,238,207,0.96)",
    fontFamily: "Georgia, Times New Roman, serif",
    fontSize: "clamp(1.12rem, 3.6vw, 1.48rem)",
    lineHeight: 1.15,
    letterSpacing: "-0.018em",
  },
  scheduleNote: {
    width: "min(100%, 32rem)",
    justifySelf: "center",
    margin: 0,
    color: "rgba(237,224,200,0.78)",
    fontSize: "0.84rem",
    lineHeight: 1.55,
    textAlign: "center",
  },
};
