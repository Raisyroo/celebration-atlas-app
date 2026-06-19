import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { ATLAS_EVENTS } from '../../../data/events';
import { resolveEventThumbnail } from '../../../data/eventThumbnail';
import { getManifestEventThumbnail, MANIFEST_EVENT_THUMBNAILS, MANIFEST_EVENT_THUMBNAIL_TOTAL_BYTES } from '../../../data/eventThumbnailManifest';

export const dynamic = 'force-dynamic';

type GalleryItem = {
  filename: string;
  eventSlug: string;
  imageSrc: string;
  source: string;
  status: string;
  bytes: number;
  manifestBytes?: number;
};

const generatedDir = path.join(process.cwd(), 'public', 'event-media', 'generated');

function slugFromFilename(filename: string): string {
  return filename.replace(/-thumb\.webp$/, '');
}

async function getGeneratedGalleryItems(): Promise<GalleryItem[]> {
  let filenames: string[] = [];

  try {
    filenames = (await readdir(generatedDir)).filter((filename) => filename.endsWith('.webp')).sort();
  } catch {
    filenames = [];
  }

  return Promise.all(
    filenames.map(async (filename) => {
      const eventSlug = slugFromFilename(filename);
      const event = ATLAS_EVENTS.find((entry) => entry.id === eventSlug);
      const thumbnail = event ? resolveEventThumbnail(event) : undefined;
      const manifestThumbnail = getManifestEventThumbnail(eventSlug);
      const filePath = path.join(generatedDir, filename);
      const [fileBuffer, fileStat] = await Promise.all([readFile(filePath), stat(filePath)]);

      return {
        filename,
        eventSlug,
        imageSrc: `data:image/webp;base64,${fileBuffer.toString('base64')}`,
        source: manifestThumbnail?.source ?? thumbnail?.mediaSourceType ?? 'generated-file',
        status: manifestThumbnail?.status ?? thumbnail?.generationStatus ?? 'present-on-disk',
        bytes: fileStat.size,
        manifestBytes: manifestThumbnail?.byteLength,
      };
    }),
  );
}

export default async function ThumbnailGalleryPage() {
  const items = await getGeneratedGalleryItems();

  return (
    <main style={styles.pageShell}>
      <header style={styles.header}>
        <p style={styles.kicker}>Internal review route</p>
        <h1 style={styles.title}>Generated Thumbnail Gallery</h1>
        <p style={styles.copy}>
          Reads local generated WebP thumbnails from <code>public/event-media/generated/</code>. The committed
          compact-card manifest currently embeds {Object.keys(MANIFEST_EVENT_THUMBNAILS).length} selected small WebP data URIs
          totaling about {(MANIFEST_EVENT_THUMBNAIL_TOTAL_BYTES / 1024).toFixed(1)} KB before base64.
        </p>
      </header>

      {items.length > 0 ? (
        <section style={styles.grid} aria-label="Generated thumbnails">
          {items.map((item) => (
            <article key={item.filename} style={styles.card}>
              <img src={item.imageSrc} alt={`${item.eventSlug} generated thumbnail`} style={styles.image} />
              <div style={styles.cardBody}>
                <h2 style={styles.eventSlug}>{item.eventSlug}</h2>
                <dl style={styles.metaList}>
                  <div style={styles.metaRow}>
                    <dt>Filename</dt>
                    <dd>{item.filename}</dd>
                  </div>
                  <div style={styles.metaRow}>
                    <dt>Source</dt>
                    <dd>{item.source}</dd>
                  </div>
                  <div style={styles.metaRow}>
                    <dt>Status</dt>
                    <dd>{item.status}</dd>
                  </div>
                  <div style={styles.metaRow}>
                    <dt>File size</dt>
                    <dd>{(item.bytes / 1024).toFixed(1)} KB</dd>
                  </div>
                  {item.manifestBytes ? (
                    <div style={styles.metaRow}>
                      <dt>Manifest size</dt>
                      <dd>{(item.manifestBytes / 1024).toFixed(1)} KB</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <p style={styles.empty}>No generated thumbnails were found on disk.</p>
      )}
    </main>
  );
}


const styles = {
  pageShell: {
    minHeight: '100vh',
    padding: '40px clamp(18px, 4vw, 56px)',
    background: 'radial-gradient(circle at top, rgba(142, 94, 38, 0.32), #07090f 48%, #020307)',
    color: '#f9e7bd',
    fontFamily: 'Inter, Arial, sans-serif',
  },
  header: { maxWidth: 920, marginBottom: 28 },
  kicker: { margin: 0, textTransform: 'uppercase' as const, letterSpacing: '0.18em', fontSize: 12, color: 'rgba(249, 231, 189, 0.68)' },
  title: { margin: '10px 0 12px', fontFamily: 'Georgia, serif', fontSize: 'clamp(2rem, 5vw, 4rem)', lineHeight: 1 },
  copy: { margin: 0, color: 'rgba(249, 231, 189, 0.76)', lineHeight: 1.65 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 18 },
  card: { overflow: 'hidden', borderRadius: 24, border: '1px solid rgba(249, 231, 189, 0.18)', background: 'rgba(8, 12, 18, 0.72)', boxShadow: '0 24px 80px rgba(0,0,0,0.34)' },
  image: { display: 'block', width: '100%', aspectRatio: '16 / 9', objectFit: 'cover' as const },
  cardBody: { padding: 16 },
  eventSlug: { margin: '0 0 12px', fontSize: 18 },
  metaList: { display: 'grid', gap: 8, margin: 0, fontSize: 13 },
  metaRow: { display: 'grid', gridTemplateColumns: '84px minmax(0, 1fr)', gap: 10, color: 'rgba(249, 231, 189, 0.72)' },
  empty: { padding: 24, border: '1px solid rgba(249, 231, 189, 0.18)', borderRadius: 18 },
};
