import type { Metadata } from 'next';
import PublicInfoPage from '../../components/PublicInfoPage';

export const metadata: Metadata = {
  title: 'Terms | Celebration Atlas',
  description: 'Current-use terms for the public Celebration Atlas experience.',
};

export default function TermsPage() {
  return (
    <PublicInfoPage
      title="Terms"
      summary="Use Celebration Atlas as an informational discovery guide. Event organizers and their official sources remain authoritative."
    >
      <section>
        <h2>Confirm event details</h2>
        <p>
          Dates, times, locations, admission, schedules, weather plans, accessibility, and
          event rules can change. Confirm important details through the official source
          linked from the Event Hub before you travel or make plans.
        </p>
      </section>

      <section>
        <h2>Use maps appropriately</h2>
        <p>
          The illustrated Michigan map is approximate and is provided for discovery and
          atmosphere. Do not use it for driving, walking, emergency, boundary, or precise
          location guidance.
        </p>
      </section>

      <section>
        <h2>External websites</h2>
        <p>
          Links to organizers, maps, tickets, and other planning resources lead to
          third-party websites. Celebration Atlas does not control their availability,
          content, transactions, or terms.
        </p>
      </section>

      <section>
        <h2>Current public experience</h2>
        <p>
          Public accounts and synchronized favorites are not part of the current service.
          If those features are introduced, the account experience and these terms will
          need a separate review before launch.
        </p>
      </section>
    </PublicInfoPage>
  );
}
