import type { CSSProperties } from 'react';
import { filterEventProfiles, getDiscoveryCategories, getDiscoveryRegions } from '../data/eventDiscovery';
import { ATLAS_CONSTELLATIONS } from '../data/atlasConstellations';
import { EVENT_PROFILES } from '../data/eventProfiles';
import type { EventProfile } from '../data/eventProfileTypes';

const REPRESENTATIVE_DISCOVERY_LIMIT = 4;

const relationshipLabels: Record<string, string> = {
  category: 'Category trail',
  seasonal: 'Seasonal trail',
  geographic: 'Regional trail',
  historical: 'Historic trail',
  practicalTravel: 'Travel trail',
  cultural: 'Cultural trail',
  editorial: 'Curated trail',
  aiSuggested: 'Suggested trail',
};

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

function getLocationLabel(profile: EventProfile) {
  return profile.locationName ?? [profile.city, profile.state].filter(Boolean).join(', ');
}

function getRelationshipLabel(relationshipType: string) {
  return relationshipLabels[relationshipType] ?? toTitleCase(relationshipType);
}

function getConstellationMeta(constellation: (typeof ATLAS_CONSTELLATIONS)[number]) {
  return [constellation.season, constellation.category].filter(Boolean).map(toTitleCase).join(' · ');
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
  sectionBlock: {
    marginTop: 0,
  },
  sectionBlockSpaced: {
    marginTop: 'clamp(3rem, 7vw, 5.25rem)',
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

  constellationPanel: {
    display: 'grid',
    gap: 0,
    marginTop: 'clamp(1.65rem, 4vw, 2.6rem)',
    borderTop: '1px solid rgba(245, 232, 199, 0.12)',
    borderBottom: '1px solid rgba(245, 232, 199, 0.1)',
    background:
      'radial-gradient(circle at 8% 0%, rgba(245, 191, 92, 0.09), transparent 28%), linear-gradient(180deg, rgba(255, 244, 217, 0.035), rgba(255, 244, 217, 0.015))',
  },
  constellationRow: {
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: '0.8rem',
    padding: 'clamp(1.05rem, 3vw, 1.45rem) clamp(0.15rem, 1.5vw, 0.65rem) clamp(1.1rem, 3vw, 1.5rem) clamp(1.3rem, 3.5vw, 2rem)',
    borderTop: '1px solid rgba(245, 232, 199, 0.085)',
  },
  constellationFirstRow: {
    borderTop: 0,
  },
  constellationStar: {
    position: 'absolute',
    top: 'clamp(1.25rem, 3vw, 1.6rem)',
    left: '0.15rem',
    width: '0.48rem',
    height: '0.48rem',
    borderRadius: '999px',
    background: 'rgba(245, 191, 92, 0.78)',
    boxShadow: '0 0 18px rgba(245, 191, 92, 0.28)',
  },
  constellationKicker: {
    margin: '0 0 0.4rem',
    color: 'rgba(245, 232, 199, 0.52)',
    fontSize: '0.68rem',
    fontWeight: 700,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
  },
  constellationTitle: {
    margin: 0,
    color: 'rgba(255, 244, 217, 0.93)',
    fontFamily: 'Georgia, Times New Roman, serif',
    fontSize: 'clamp(1.12rem, 3vw, 1.45rem)',
    fontWeight: 500,
    letterSpacing: '0.012em',
  },
  constellationDescription: {
    maxWidth: '52rem',
    margin: '0.45rem 0 0',
    color: 'rgba(226, 211, 178, 0.66)',
    fontSize: '0.9rem',
    lineHeight: 1.65,
  },
  constellationFacts: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.45rem',
    margin: 0,
    padding: 0,
    listStyle: 'none',
  },
  constellationFact: {
    border: '1px solid rgba(245, 232, 199, 0.09)',
    borderRadius: '999px',
    padding: '0.34rem 0.62rem',
    color: 'rgba(226, 211, 178, 0.62)',
    background: 'rgba(5, 8, 18, 0.24)',
    fontSize: '0.72rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
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
  const regions = getDiscoveryRegions();
  const regionGroups = regions
    .map((region) => {
      const discoveries = filterEventProfiles({ region });

      return {
        region,
        discoveries,
        representativeDiscoveries: discoveries.slice(0, REPRESENTATIVE_DISCOVERY_LIMIT),
      };
    })
    .filter(({ discoveries }) => discoveries.length > 0);

  return (
    <section style={styles.shell}>
      <div style={styles.inner}>
        <section aria-labelledby="browse-by-category-heading" style={styles.sectionBlock}>
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
        </section>

        <section aria-labelledby="browse-by-region-heading" style={styles.sectionBlockSpaced}>
          <p style={styles.eyebrow}>Regional paths</p>
          <h2 id="browse-by-region-heading" style={styles.heading}>
            Browse by Region
          </h2>
          <p style={styles.intro}>
            A read-only regional view of the same discovery profiles, showing only regions with at least one matching Michigan event.
          </p>

          <div style={styles.grid}>
            {regionGroups.map(({ region, discoveries, representativeDiscoveries }) => (
              <article key={region} style={styles.card} aria-label={`${region}: ${discoveries.length} discoveries`}>
                <div style={styles.cardHeader}>
                  <h3 style={styles.categoryName}>{region}</h3>
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
        </section>

        <section aria-labelledby="atlas-constellations-heading" style={styles.sectionBlockSpaced}>
          <p style={styles.eyebrow}>Curated trails</p>
          <h2 id="atlas-constellations-heading" style={styles.heading}>
            Atlas Constellations
          </h2>
          <p style={styles.intro}>Guided trails through related Michigan celebrations.</p>

          <div style={styles.constellationPanel} aria-label="Read-only Atlas Constellations">
            {ATLAS_CONSTELLATIONS.map((constellation, index) => {
              const meta = getConstellationMeta(constellation);

              return (
                <article
                  key={constellation.id}
                  style={{
                    ...styles.constellationRow,
                    ...(index === 0 ? styles.constellationFirstRow : {}),
                  }}
                  aria-label={`${constellation.title}: ${constellation.eventIds.length} events`}
                >
                  <span aria-hidden="true" style={styles.constellationStar} />
                  <div>
                    <p style={styles.constellationKicker}>{getRelationshipLabel(constellation.relationshipType)}</p>
                    <h3 style={styles.constellationTitle}>{constellation.title}</h3>
                    <p style={styles.constellationDescription}>{constellation.description}</p>
                  </div>

                  <ul style={styles.constellationFacts} aria-label={`${constellation.title} details`}>
                    <li style={styles.constellationFact}>{getRelationshipLabel(constellation.relationshipType)}</li>
                    <li style={styles.constellationFact}>
                      {constellation.eventIds.length} {constellation.eventIds.length === 1 ? 'event' : 'events'}
                    </li>
                    {meta ? <li style={styles.constellationFact}>{meta}</li> : null}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </section>
  );
}

