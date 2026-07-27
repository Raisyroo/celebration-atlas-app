'use client';

import Image from 'next/image';
import { useLayoutEffect, useRef, useState } from 'react';
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
  const [hideOptionalMetadata, setHideOptionalMetadata] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const locationRef = useRef<HTMLParagraphElement | null>(null);
  const dateRef = useRef<HTMLParagraphElement | null>(null);
  const categoryRef = useRef<HTMLParagraphElement | null>(null);
  const showImage = Boolean(
    item.imageUrl && item.imageUrl !== failedImageUrl,
  );
  const tone = item.badge?.tone ?? 'neutral';

  useLayoutEffect(() => {
    if (!state.active) return;

    const content = contentRef.current;
    const title = titleRef.current;
    const location = locationRef.current;
    const date = dateRef.current;
    if (!content || !title || !location || !date) return;

    const measure = () => {
      const contentStyle = window.getComputedStyle(content);
      const titleStyle = window.getComputedStyle(title);
      const lineHeight = Number.parseFloat(titleStyle.lineHeight);
      const titleLines =
        Number.isFinite(lineHeight) && lineHeight > 0
          ? Math.round(title.scrollHeight / lineHeight)
          : 1;
      const availableHeight =
        content.clientHeight -
        Number.parseFloat(contentStyle.paddingTop) -
        Number.parseFloat(contentStyle.paddingBottom);
      const requiredCoreHeight =
        title.scrollHeight +
        location.scrollHeight +
        date.scrollHeight +
        5;
      const categoryHeight = categoryRef.current
        ? Math.max(12, categoryRef.current.scrollHeight) + 5
        : 0;
      const shouldHideCategory =
        Boolean(categoryRef.current) &&
        (titleLines >= 3 ||
          requiredCoreHeight + categoryHeight > availableHeight + 0.5);

      setHideOptionalMetadata((current) =>
        current === shouldHideCategory ? current : shouldHideCategory,
      );
    };

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(content);
    resizeObserver.observe(title);
    return () => resizeObserver.disconnect();
  }, [
    item.categoryLabel,
    item.dateLabel,
    item.location,
    item.title,
    state.active,
  ]);

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

      <div ref={contentRef} className={styles.content}>
        <h2 ref={titleRef} className={styles.eventTitle}>{item.title}</h2>
        <p ref={locationRef} className={styles.location}>{item.location}</p>
        <p ref={dateRef} className={styles.date}>{item.dateLabel}</p>
        {item.categoryLabel ? (
          <p
            ref={categoryRef}
            className={`${styles.category} ${
              hideOptionalMetadata ? styles.categoryHidden : ''
            }`}
            aria-hidden={hideOptionalMetadata || undefined}
            data-category-visible={hideOptionalMetadata ? 'false' : 'true'}
          >
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
