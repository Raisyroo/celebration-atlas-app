import EventHub from '../../../components/EventHub';
import LegacyEventDetailPage from '../../../components/LegacyEventDetailPage';
import { resolveEventPage } from '../../../lib/event-pages/publishedManifest';

type EventPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EventPage({ params }: EventPageProps) {
  const { id } = await params;
  const resolvedEventPage = await resolveEventPage(id);

  if (resolvedEventPage) {
    return (
      <EventHub
        manifest={resolvedEventPage.manifest}
        scoutContentReference={resolvedEventPage.scoutContentReference}
      />
    );
  }

  return <LegacyEventDetailPage />;
}
