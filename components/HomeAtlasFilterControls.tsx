import type { CSSProperties } from 'react';
import type {
  HomeAtlasDiscoveryDateFilter,
  HomeAtlasDiscoveryFacets,
  ResolvedHomeAtlasDiscoveryFilters,
} from '../data/homeAtlasDiscovery';
import type { HomeAtlasMonth } from '../data/homeAtlasSearch';

type HomeAtlasFilterControlsProps = {
  idPrefix: string;
  stateName: string;
  facets: HomeAtlasDiscoveryFacets;
  filters: ResolvedHomeAtlasDiscoveryFilters;
  activeFilterCount: number;
  onCategoryChange: (value: string | null) => void;
  onRegionChange: (value: string | null) => void;
  onCityChange: (value: string | null) => void;
  onDateChange: (value: HomeAtlasDiscoveryDateFilter) => void;
  onClear: () => void;
};

const dateFilterToValue = (filter: HomeAtlasDiscoveryDateFilter) =>
  filter.kind === 'month' ? `month:${filter.month}` : filter.kind;

const valueToDateFilter = (value: string): HomeAtlasDiscoveryDateFilter => {
  if (value === 'live-upcoming') return { kind: 'live-upcoming' };
  const monthMatch = /^month:(\d{1,2})$/.exec(value);
  if (monthMatch) {
    const month = Number(monthMatch[1]);
    if (month >= 1 && month <= 12) {
      return { kind: 'month', month: month as HomeAtlasMonth };
    }
  }
  return { kind: 'any' };
};

const styles = {
  shell: {
    display: 'grid',
    gap: 12,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 10,
  },
  field: {
    display: 'grid',
    gap: 5,
    minWidth: 0,
  },
  label: {
    color: 'rgba(255, 225, 170, 0.76)',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  select: {
    width: '100%',
    minHeight: 44,
    padding: '0 34px 0 11px',
    border: '1px solid rgba(255, 226, 170, 0.24)',
    borderRadius: 12,
    background: 'rgba(5, 9, 15, 0.9)',
    color: 'rgba(255, 244, 220, 0.96)',
    fontSize: 13,
    fontWeight: 650,
    colorScheme: 'dark',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  summary: {
    margin: 0,
    color: 'rgba(255, 226, 174, 0.62)',
    fontSize: 11,
    lineHeight: 1.3,
  },
  clear: {
    minHeight: 44,
    padding: '0 14px',
    border: '1px solid rgba(255, 226, 170, 0.28)',
    borderRadius: 999,
    background: 'rgba(255, 226, 170, 0.06)',
    color: 'rgba(255, 238, 206, 0.9)',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    cursor: 'pointer',
  },
} satisfies Record<string, CSSProperties>;

export function HomeAtlasFilterControls({
  idPrefix,
  stateName,
  facets,
  filters,
  activeFilterCount,
  onCategoryChange,
  onRegionChange,
  onCityChange,
  onDateChange,
  onClear,
}: HomeAtlasFilterControlsProps) {
  return (
    <div style={styles.shell}>
      <div style={styles.grid}>
        <label style={styles.field} htmlFor={`${idPrefix}-date`}>
          <span style={styles.label}>Date</span>
          <select
            id={`${idPrefix}-date`}
            style={styles.select}
            value={dateFilterToValue(filters.date)}
            onChange={(event) => onDateChange(valueToDateFilter(event.target.value))}
          >
            {facets.dates.map((option) => (
              <option
                key={option.id}
                value={dateFilterToValue(option.value)}
                disabled={option.isDisabled}
              >
                {option.label} ({option.count})
              </option>
            ))}
          </select>
        </label>

        <label style={styles.field} htmlFor={`${idPrefix}-category`}>
          <span style={styles.label}>Category</span>
          <select
            id={`${idPrefix}-category`}
            style={styles.select}
            value={filters.category ?? ''}
            onChange={(event) => onCategoryChange(event.target.value || null)}
          >
            <option value="">Any category</option>
            {facets.categories.map((option) => (
              <option key={option.id} value={option.value} disabled={option.isDisabled}>
                {option.label} ({option.count})
              </option>
            ))}
          </select>
        </label>

        <label style={styles.field} htmlFor={`${idPrefix}-region`}>
          <span style={styles.label}>Region</span>
          <select
            id={`${idPrefix}-region`}
            style={styles.select}
            value={filters.regionRuleId ?? ''}
            onChange={(event) => onRegionChange(event.target.value || null)}
          >
            <option value="">Any reviewed region</option>
            {facets.regions.map((option) => (
              <option key={option.id} value={option.value} disabled={option.isDisabled}>
                {option.label} ({option.count})
              </option>
            ))}
          </select>
        </label>

        <label style={styles.field} htmlFor={`${idPrefix}-city`}>
          <span style={styles.label}>City</span>
          <select
            id={`${idPrefix}-city`}
            style={styles.select}
            value={filters.city ?? ''}
            onChange={(event) => onCityChange(event.target.value || null)}
          >
            <option value="">Any city</option>
            {facets.cities.map((option) => (
              <option key={option.id} value={option.value} disabled={option.isDisabled}>
                {option.label} ({option.count})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={styles.footer}>
        <p style={styles.summary}>
          {activeFilterCount === 0
            ? `Showing all reviewed ${stateName} facts.`
            : `${activeFilterCount} active ${activeFilterCount === 1 ? 'filter' : 'filters'}.`}
        </p>
        {activeFilterCount > 0 ? (
          <button type="button" style={styles.clear} onClick={onClear}>
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  );
}
