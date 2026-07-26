'use client';

import Image from 'next/image';
import { useState } from 'react';
import styles from './ClusterEventCard.module.css';
import type {
  AtlasDeckCardRenderState,
  EventDeckItem,
} from './types';

type ClusterEventCardProps = {
  item: EventDeckItem;
  state: AtlasDeckCardRenderState;
};

export function ClusterEventCard({ item, state }: ClusterEventCardProps) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const showImage = Boolean(
    item.imageUrl && item.imageUrl !== failedImageUrl,
  );
  const tone = item.badge?.tone ?? 'neutral';

  return (
    <article
      className={`${styles.card} ${
        state.active ? styles.active : styles.compressed
      }`}
      data-event-card-layout={state.active ? 'active' : 'compressed'}
    >
      <div className={styles.media}>
        {showImage ? (
          <Image
            src={item.imageUrl as string}
            alt={item.imageAlt ?? ''}
            fill
            sizes={state.active ? '(max-width: 438px) 100vw, 410px' : '96px'}
            loading={state.active ? 'eager' : 'lazy'}
            unoptimized
            className={styles.image}
            onError={() => setFailedImageUrl(item.imageUrl ?? null)}
          />
        ) : (
          <div className={styles.imageFallback} aria-hidden="true">
            <span>✦</span>
            <small>Celebration Atlas</small>
          </div>
        )}
        <div className={styles.imageVeil} aria-hidden="true" />
        {item.badge ? (
          <span className={styles.badge} data-tone={tone}>
            {item.badge.label}
          </span>
        ) : null}
        {item.distanceLabel ? (
          <span className={styles.distance}>{item.distanceLabel}</span>
        ) : null}
      </div>

      <div className={styles.content}>
        <h2 className={styles.eventTitle}>{item.title}</h2>
        <p className={styles.location}>{item.location}</p>
        <p className={styles.date}>{item.dateLabel}</p>
        {item.categoryLabel ? (
          <p className={styles.category}>
            <span aria-hidden="true">✦</span>
            {item.categoryLabel}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function ClusterEventListItem({
  item,
  index,
}: {
  item: EventDeckItem;
  index: number;
}) {
  return (
    <span className={styles.listItem}>
      <span className={styles.listNumber}>{String(index + 1).padStart(2, '0')}</span>
      <span className={styles.listIdentity}>
        <strong>{item.title}</strong>
        <small>{item.location} · {item.dateLabel}</small>
      </span>
      {item.badge ? (
        <span className={styles.listBadge} data-tone={item.badge.tone ?? 'neutral'}>
          {item.badge.label}
        </span>
      ) : null}
    </span>
  );
}
