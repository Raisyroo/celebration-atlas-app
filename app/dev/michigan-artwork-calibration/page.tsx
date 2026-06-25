import type { Metadata } from 'next';
import MichiganArtworkCalibration from './MichiganArtworkCalibration';

export const metadata: Metadata = {
  title: 'Development Preview — Michigan Artwork Calibration',
  description:
    'Isolated Michigan artwork calibration workbench for comparing geographic coordinates, illustrated artwork, and event marker projection.',
};

export default function DevMichiganArtworkCalibrationPage() {
  return (
    <main aria-label="Development Preview — Michigan Artwork Calibration">
      <MichiganArtworkCalibration />
    </main>
  );
}
