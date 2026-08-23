'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { EventFactoryCombinedReview } from '@/lib/event-factory/packages';
import styles from './EventReviewDesk.module.css';

type ReviewDecision = 'approve' | 'reject' | 'reopen';

const EVENT_REVIEW_SCROLL_CLASS = 'event-review-scroll';

async function postJson(path: string, payload: Record<string, unknown>) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? 'The review action failed.');
  return body;
}

function statusLabel(value: string) {
  return value.replaceAll('_', ' ');
}

export default function EventReviewDesk({ review }: { review: EventFactoryCombinedReview }) {
  const router = useRouter();
  const [pending, setPending] = useState('');
  const [message, setMessage] = useState('');
  const [pageNotes, setPageNotes] = useState(review.package.pageReviewNotes ?? '');
  const [heroNotes, setHeroNotes] = useState(review.visualWorkflow?.reviewNotes ?? '');
  const workflow = review.visualWorkflow;

  useEffect(() => {
    document.documentElement.classList.add(EVENT_REVIEW_SCROLL_CLASS);
    document.body.classList.add(EVENT_REVIEW_SCROLL_CLASS);

    return () => {
      document.documentElement.classList.remove(EVENT_REVIEW_SCROLL_CLASS);
      document.body.classList.remove(EVENT_REVIEW_SCROLL_CLASS);
    };
  }, []);

  async function reviewPage(decision: ReviewDecision) {
    setPending(`page:${decision}`);
    setMessage('Recording the Event Hub decision…');
    try {
      await postJson('/api/atlas-control/event-factory', {
        action: 'review_page',
        packageId: review.package.id,
        decision,
        notes: pageNotes,
      });
      setMessage(
        decision === 'approve'
          ? 'Page content and layout approved. Hero review and publication remain separate.'
          : decision === 'reject'
            ? 'Page returned for focused content or layout changes. Nothing was published.'
            : 'Page review reopened. Nothing was published.',
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The page review action failed.');
    } finally {
      setPending('');
    }
  }

  async function reviewHero(decision: ReviewDecision) {
    if (!workflow) return;
    setPending(`hero:${decision}`);
    setMessage('Recording the hero decision…');
    try {
      await postJson('/api/atlas-control/event-visuals', {
        action: decision,
        workflowId: workflow.id,
        notes: heroNotes,
      });
      if (decision === 'approve') {
        try {
          await postJson('/api/atlas-control/event-factory', {
            action: 'prepare',
            candidateId: review.package.candidateId,
            verificationCaseId: review.package.verificationCaseId,
          });
          setMessage('Hero approved and attached to the private package. Page approval was retained; nothing was published.');
        } catch (error) {
          setMessage(`Hero approved, but the private package still needs to be refreshed: ${error instanceof Error ? error.message : 'package refresh failed.'}`);
        }
      } else {
        setMessage(
          decision === 'reject'
            ? 'Hero rejected for a focused alternative. The page decision is unchanged and nothing was published.'
            : 'Hero review reopened. The page decision is unchanged and nothing was published.',
        );
      }
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The hero review action failed.');
    } finally {
      setPending('');
    }
  }

  const previewUrl = `/atlas-control/event-preview/${review.package.id}/phone?packageVersion=${review.package.packageVersion}&visualRevision=${workflow?.revisionNumber ?? 0}`;

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <a href="/atlas-control" className={styles.backLink}>Atlas Control</a>
          <p className={styles.eyebrow}>Combined private review</p>
          <h1>{review.package.eventName}</h1>
          <p>Review the exact mobile Event Hub and its hero in one session. Each decision is independent.</p>
        </div>
        <div className={styles.packageMeta}>
          <span>Package v{review.package.packageVersion}</span>
          <span>{statusLabel(review.package.status)}</span>
          <strong>No publication on this screen</strong>
        </div>
      </header>

      {message && <p className={styles.message} role="status">{message}</p>}

      <div className={styles.reviewGrid}>
        <section className={styles.previewPanel} aria-labelledby="page-preview-heading">
          <div className={styles.panelHeading}>
            <div>
              <p className={styles.eyebrow}>Page content + layout</p>
              <h2 id="page-preview-heading">Exact proposed phone preview</h2>
            </div>
            <span className={`${styles.status} ${styles[review.package.pageReviewStatus]}`}>
              {statusLabel(review.package.pageReviewStatus)}
            </span>
          </div>
          <div className={styles.phoneFrame}>
            <iframe
              key={`${review.package.packageVersion}:${review.artPending}`}
              src={previewUrl}
              title={`${review.package.eventName} private Event Hub preview`}
            />
          </div>
          <a className={styles.openPreview} href={previewUrl} target="_blank" rel="noreferrer">
            Open full-size preview
          </a>
          <label className={styles.notes}>
            Page review notes
            <textarea value={pageNotes} onChange={(event) => setPageNotes(event.target.value)} maxLength={2000} />
          </label>
          <div className={styles.actions}>
            {review.package.pageReviewStatus === 'pending' && (
              <>
                <button disabled={Boolean(pending)} onClick={() => reviewPage('approve')}>
                  {pending === 'page:approve' ? 'Approving…' : 'Approve content + layout'}
                </button>
                <button className={styles.reject} disabled={Boolean(pending)} onClick={() => reviewPage('reject')}>
                  {pending === 'page:reject' ? 'Recording…' : 'Needs page changes'}
                </button>
              </>
            )}
            {review.package.pageReviewStatus !== 'pending' && (
              <button className={styles.secondary} disabled={Boolean(pending)} onClick={() => reviewPage('reopen')}>
                {pending === 'page:reopen' ? 'Reopening…' : 'Reopen page decision'}
              </button>
            )}
          </div>
        </section>

        <aside className={styles.heroPanel} aria-labelledby="hero-review-heading">
          <div className={styles.panelHeading}>
            <div>
              <p className={styles.eyebrow}>Hero image</p>
              <h2 id="hero-review-heading">Independent visual decision</h2>
            </div>
            <span className={`${styles.status} ${workflow ? styles[workflow.status] : styles.pending}`}>
              {workflow ? statusLabel(workflow.status) : 'not ready'}
            </span>
          </div>

          {workflow?.asset ? (
            <figure className={styles.heroFigure}>
              <img src={workflow.asset.publicUrl} alt={workflow.asset.altText} />
              <figcaption>{workflow.asset.altText}</figcaption>
            </figure>
          ) : (
            <div className={styles.heroMissing}>Hero work has not reached review yet.</div>
          )}

          {workflow && (
            <>
              <dl className={styles.heroFacts}>
                <div><dt>Location</dt><dd>{workflow.locationLabel}</dd></div>
                <div><dt>Defining moment</dt><dd>{workflow.visualSignature.heroMoment}</dd></div>
                <div><dt>Motifs</dt><dd>{workflow.visualSignature.motifs.join(' · ')}</dd></div>
              </dl>
              <label className={styles.notes}>
                Hero review notes
                <textarea value={heroNotes} onChange={(event) => setHeroNotes(event.target.value)} maxLength={2000} />
              </label>
              <div className={styles.actions}>
                {workflow.status === 'ready_for_review' && (
                  <>
                    <button disabled={Boolean(pending)} onClick={() => reviewHero('approve')}>
                      {pending === 'hero:approve' ? 'Approving…' : 'Approve hero'}
                    </button>
                    <button className={styles.reject} disabled={Boolean(pending)} onClick={() => reviewHero('reject')}>
                      {pending === 'hero:reject' ? 'Recording…' : 'Request focused alternative'}
                    </button>
                  </>
                )}
                {workflow.status === 'rejected' && (
                  <button className={styles.secondary} disabled={Boolean(pending)} onClick={() => reviewHero('reopen')}>
                    {pending === 'hero:reopen' ? 'Reopening…' : 'Reopen for alternative'}
                  </button>
                )}
                {workflow.status === 'approved' && <strong className={styles.approvedCopy}>Approved for this event</strong>}
              </div>
            </>
          )}

          <div className={styles.boundary}>
            <strong>Decisions do not block each other.</strong>
            <p>You can approve the page now and leave the hero pending or rejected. Publishing is a later, separate explicit action.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
