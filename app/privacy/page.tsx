import type { Metadata } from 'next';
import PublicInfoPage from '../../components/PublicInfoPage';

export const metadata: Metadata = {
  title: 'Privacy | Celebration Atlas',
  description: 'Privacy information for the public Celebration Atlas experience.',
};

export default function PrivacyPage() {
  return (
    <PublicInfoPage
      title="Privacy"
      summary="The current public Michigan experience does not offer public user accounts or collect an account profile."
    >
      <section>
        <h2>Search and navigation</h2>
        <p>
          A submitted homepage search is placed in the page URL so the result can be
          restored, revisited, or shared. As with most hosted websites, infrastructure
          providers may process standard request information such as the requested URL,
          time, browser or device details, and IP address.
        </p>
      </section>

      <section>
        <h2>Information kept on this device</h2>
        <p>
          Celebration Atlas may use browser storage for presentation choices, session-only
          interface state, and local favorite toggles. Those favorite toggles are not tied
          to an account and do not create a synchronized favorites collection.
        </p>
      </section>

      <section>
        <h2>External event sources</h2>
        <p>
          Event Hubs link to official organizer and planning websites. When you follow an
          external link, that site&apos;s privacy practices apply.
        </p>
      </section>

      <section>
        <h2>Private operator access</h2>
        <p>
          Atlas Control is a separate, private publishing system for authorized operators.
          Its sign-in is not a public Celebration Atlas account and is not offered from the
          public menu.
        </p>
      </section>
    </PublicInfoPage>
  );
}
