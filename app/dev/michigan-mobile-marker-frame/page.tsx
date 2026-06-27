import type { Metadata } from 'next';
import MichiganMobileMarkerFrameLab from './MichiganMobileMarkerFrameLab';

export const metadata: Metadata = {
  title: 'Michigan Mobile Marker Frame Lab | Celebration Atlas Dev',
  description:
    'Developer-only calibration lab for exporting final production mobile marker left/top percentages.',
};

export default function MichiganMobileMarkerFramePage() {
  return <MichiganMobileMarkerFrameLab />;
}
