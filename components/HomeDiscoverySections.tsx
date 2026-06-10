import type { CSSProperties } from 'react';
import { filterEventProfiles, getDiscoveryCategories } from '../data/eventDiscovery';
import { EVENT_PROFILES } from '../data/eventProfiles';
import type { EventProfile } from '../data/eventProfileTypes';

const REPRESENTATIVE_DISCOVERY_LIMIT = 4;

function getLocationLabel(profile: EventProfile) {
  return profile.locationName ?? [profile.city, profile.state].filter(Boolean).join(', ');
}

const styles: Record<string, CSSProperties> = {
  shell: {
    position: 'relative',
    zIndex: 1,
    background:
      'linear-gradient(180deg, rgba(5, 8, 18, 0.98) 0%, rgba(8, 13, 27, 0.98) 48%, rgba(5, 8, 18, 1) 100%)',
    borderTop: '1px solid rgba(245, 232, 199, 0.08)',
    padding: 'clamp(2.75rem, 7vw, 5.5rem) max(1.15rem, env(safe-area-inset-right)) clamp(3rem, 8vw, 6rem) max(1.15rem, env(safe-area-inset-left))',
  },
  inner: {
    width: 'min(1120px, 100%)',
    margin: '0 auto',
  },
  eyebrow: {
    margin: '0 0 0.72rem',
    color: 'rgba(245, 232, 199, 0.5)',
    fontSize: '0.68rem',
    fontWeight: 700,
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
  },
  heading: {
    margin: 0,
    color: 'rgba(255, 244, 217, 0.94)',
    fontFamily: 'Georgia, Times New Roman, serif',
    fontSize: 'clamp(1.75rem, 5vw, 3.15rem)',
    fontWeight: 500,
    letterSpacing: '0.015em',
  },
  intro: {
    maxWidth: '38rem',
    margin: '0.85rem 0 0',
    color: 'rgba(226, 211, 178, 0.68)',
    fontSize: 'clamp(0.92rem, 2.4vw, 1rem)',
    lineHeight: 1.7,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 16.5rem), 1fr))',
    gap: 'clamp(0.85rem, 2vw, 1.2rem)',
    marginTop: 'clamp(1.6rem, 4vw, 2.5rem)',
  },
  card: {
    minHeight: '11.5rem',
    border: '1px solid rgba(245, 232, 199, 0.1)',
    borderRadius: '1.35rem',
    background:
      'linear-gradient(180deg, rgba(255, 244, 217, 0.055) 0%, rgba(255, 244, 217, 0.028) 100%)',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.035)',
    padding: '1.05rem',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '1rem',
    marginBottom: '0.85rem',
  },
  categoryName: {
    margin: 0,
    color: 'rgba(255, 244, 217, 0.9)',
    fontSize: '0.98rem',
    fontWeight: 650,
    letterSpacing: '0.045em',
  },
  count: {
    flex: '0 0 auto',
    color: 'rgba(226, 211, 178, 0.56)',
    fontSize: '0.72rem',
    letterSpacing: '0.11em',
    textTransform: 'uppercase',
  },
  list: {
    display: 'grid',
    gap: '0.72rem',
    margin: 0,
    padding: 0,
    listStyle: 'none',
  },
  item: {
    borderTop: '1px solid rgba(245, 232, 199, 0.075)',
    paddingTop: '0.72rem',
  },
  eventName: {
    display: 'block',
    color: 'rgba(255, 244, 217, 0.82)',
    fontSize: '0.88rem',
    lineHeight: 1.35,
  },
  eventLocation: {
    display: 'block',
    marginTop: '0.22rem',
    color: 'rgba(226, 211, 178, 0.52)',
    fontSize: '0.76rem',
    lineHeight: 1.35,
  },
};

export default function HomeDiscoverySections() {
  const categories = getDiscoveryCategories();
  const categoryGroups = categories.map((category) => {
    const discoveries = filterEventProfiles({ category });

    return {
      category,
      discoveries,
      representativeDiscoveries: discoveries.slice(0, REPRESENTATIVE_DISCOVERY_LIMIT),
    };
  });

  return (
    <section aria-labelledby="browse-by-category-heading" style={styles.shell}>
      <div style={styles.inner}>
        <p style={styles.eyebrow}>Discovery paths</p>
        <h2 id="browse-by-category-heading" style={styles.heading}>
          Browse by Category
        </h2>
        <p style={styles.intro}>
          A quiet index of {EVENT_PROFILES.length} Michigan discoveries, grouped from the same Atlas event profile data that powers search and future browsing layers.
        </p>

        <div style={styles.grid}>
          {categoryGroups.map(({ category, discoveries, representativeDiscoveries }) => (
            <article key={category} style={styles.card} aria-label={`${category}: ${discoveries.length} discoveries`}>
              <div style={styles.cardHeader}>
                <h3 style={styles.categoryName}>{category}</h3>
                <span style={styles.count}>
                  {discoveries.length} {discoveries.length === 1 ? 'discovery' : 'discoveries'}
                </span>
              </div>

              <ul style={styles.list}>
                {representativeDiscoveries.map((discovery) => (
                  <li key={discovery.id} style={styles.item}>
                    <span style={styles.eventName}>{discovery.name}</span>
                    <span style={styles.eventLocation}>{getLocationLabel(discovery)}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
