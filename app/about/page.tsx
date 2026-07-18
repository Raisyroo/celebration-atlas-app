import type { Metadata } from 'next';
import PublicInfoPage from '../../components/PublicInfoPage';

export const metadata: Metadata = {
  title: 'About | Celebration Atlas',
  description: 'About the public Celebration Atlas Michigan experience.',
};

export default function AboutPage() {
  return (
    <PublicInfoPage
      title="About Celebration Atlas"
      summary="Celebration Atlas is a mobile-first guide to Michigan celebrations, built around a reviewed event catalog and public Event Hubs."
    >
      <section>
        <h2>Discover what is happening</h2>
        <p>
          Search the Michigan catalog, explore the live and upcoming rail, and open an
          Event Hub for the strongest reviewed details available for each celebration.
        </p>
      </section>

      <section>
        <h2>Follow the source</h2>
        <p>
          Event information can change. Each Event Hub keeps an official-source link so
          you can confirm current dates, schedules, rules, admission, and location details
          with the event organizer.
        </p>
      </section>

      <section>
        <h2>An illustrated atlas</h2>
        <p>
          The Michigan map is intentionally atmospheric and approximate. It helps you
          discover celebrations; it is not a literal geographic map or a navigation tool.
        </p>
      </section>
    </PublicInfoPage>
  );
}
