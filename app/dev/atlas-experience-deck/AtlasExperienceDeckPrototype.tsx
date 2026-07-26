'use client';

import { useMemo, useRef, useState } from 'react';
import AtlasExperienceDeck from '../../../components/atlas-experience-deck/AtlasExperienceDeck';
import { ClusterEventCard } from '../../../components/atlas-experience-deck/ClusterEventCard';
import type { EventDeckItem } from '../../../components/atlas-experience-deck/types';
import {
  mockDatasets,
  type MockDatasetKey,
} from './mockEvents';
import styles from './AtlasExperienceDeckPrototype.module.css';

type PrototypeScenario = MockDatasetKey | 'loading' | 'error';

const DATASET_CONTROLS: readonly {
  value: PrototypeScenario;
  label: string;
}[] = [
  { value: '0', label: '0 items' },
  { value: '1', label: '1 item' },
  { value: '2', label: '2 items' },
  { value: '3', label: '3 items' },
  { value: '38', label: '38 items' },
  { value: '500', label: '500 items' },
  { value: 'loading', label: 'Loading' },
  { value: 'error', label: 'Error' },
];

export default function AtlasExperienceDeckPrototype() {
  const [scenario, setScenario] = useState<PrototypeScenario>('38');
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [startAtMiddle, setStartAtMiddle] = useState(false);
  const [lastOpened, setLastOpened] = useState<{
    item: EventDeckItem;
    index: number;
    callCount: number;
  } | null>(null);
  const callCountRef = useRef(0);

  const items = useMemo(
    () =>
      scenario === 'loading' || scenario === 'error'
        ? []
        : mockDatasets[scenario],
    [scenario],
  );
  const loading = scenario === 'loading';
  const error =
    scenario === 'error'
      ? 'The development fixture simulated a cluster request failure.'
      : null;

  const chooseScenario = (nextScenario: PrototypeScenario) => {
    setScenario(nextScenario);
    setSelectedIndex(0);
    setOpen(false);
  };

  const openDeck = () => {
    const initialIndex =
      startAtMiddle && items.length > 1 ? Math.floor(items.length / 2) : 0;
    setSelectedIndex(initialIndex);
    setOpen(true);
  };

  const handleOpenItem = (item: EventDeckItem, index: number) => {
    callCountRef.current += 1;
    setLastOpened({ item, index, callCount: callCountRef.current });
    setOpen(false);
  };

  return (
    <div className={styles.page} data-deck-open={open ? 'true' : 'false'}>
      <main className={styles.lab} inert={open ? true : undefined}>
        <header className={styles.hero}>
          <p className={styles.kicker}>Development preview · Phase B</p>
          <h1>Atlas Experience Deck</h1>
          <p>
            An isolated, mock-data laboratory for the reusable event deck. No
            production map, event page, or navigation state is connected.
          </p>
        </header>

        <section className={styles.mapStage} aria-label="Mock atlas backdrop">
          <div className={styles.mockMap} aria-hidden="true">
            {['north', 'west', 'center', 'east', 'south'].map((position) => (
              <span
                key={position}
                className={styles.mapGlow}
                data-position={position}
              />
            ))}
            <span className={styles.mapLabel}>MICHIGAN</span>
            <span className={styles.lakeLabel}>LAKE MICHIGAN</span>
          </div>
          <button
            type="button"
            className={styles.clusterButton}
            onClick={openDeck}
            aria-label={`Open mock cluster with ${items.length} ${
              items.length === 1 ? 'event' : 'events'
            }`}
          >
            <strong>{loading ? '…' : error ? '!' : items.length}</strong>
            <span>Open event deck</span>
          </button>
        </section>

        <section className={styles.controls} aria-label="Prototype controls">
          <div className={styles.controlHeading}>
            <div>
              <p className={styles.controlKicker}>Test fixtures</p>
              <h2>Choose a deck state</h2>
            </div>
            <button type="button" className={styles.primaryButton} onClick={openDeck}>
              Open selected state
            </button>
          </div>

          <div className={styles.scenarioGrid}>
            {DATASET_CONTROLS.map((control) => (
              <button
                key={control.value}
                type="button"
                className={styles.scenarioButton}
                data-selected={scenario === control.value ? 'true' : 'false'}
                aria-pressed={scenario === control.value}
                onClick={() => chooseScenario(control.value)}
              >
                {control.label}
              </button>
            ))}
          </div>

          <div className={styles.options}>
            <label>
              <input
                type="checkbox"
                checked={reducedMotion}
                onChange={(event) => setReducedMotion(event.target.checked)}
              />
              Reduced motion
            </label>
            <label>
              <input
                type="checkbox"
                checked={startAtMiddle}
                onChange={(event) => setStartAtMiddle(event.target.checked)}
                disabled={items.length < 2}
              />
              Start at middle
            </label>
          </div>
        </section>

        <output className={styles.callbackReadout} aria-live="polite">
          <span>Development-only onOpenItem readout</span>
          {lastOpened ? (
            <strong>
              Call {lastOpened.callCount}: {lastOpened.item.title} · index{' '}
              {lastOpened.index}
            </strong>
          ) : (
            <strong>No active card has been opened.</strong>
          )}
        </output>
      </main>

      <AtlasExperienceDeck<EventDeckItem>
        open={open}
        items={items}
        selectedIndex={selectedIndex}
        title={`Events in this area · ${items.length} ${
          items.length === 1 ? 'event' : 'events'
        }`}
        loading={loading}
        error={error}
        reducedMotion={reducedMotion}
        onDismiss={() => setOpen(false)}
        onRetry={() => chooseScenario('38')}
        onOpenItem={handleOpenItem}
        onSelectedIndexChange={(index) => setSelectedIndex(index)}
        renderCard={(item, state) => (
          <ClusterEventCard item={item} state={state} />
        )}
      />
    </div>
  );
}
