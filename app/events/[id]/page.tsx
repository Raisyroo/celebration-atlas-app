import EventHub from '../../../components/EventHub';
import LegacyEventDetailPage from '../../../components/LegacyEventDetailPage';
import { resolveEventPageManifest } from '../../../lib/event-pages/publishedManifest';

type EventPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EventPage({ params }: EventPageProps) {
  const { id } = await params;
  const manifest = await resolveEventPageManifest(id);

  if (manifest) {
    return <EventHub manifest={manifest} />;
  }

  return <LegacyEventDetailPage />;
}
