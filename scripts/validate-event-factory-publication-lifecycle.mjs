import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migration005 = await readFile(
  path.join(root, 'supabase/migrations/005_event_page_publishing.sql'),
  'utf8',
);
const migration021 = await readFile(
  path.join(root, 'supabase/migrations/021_atomic_event_factory_publication.sql'),
  'utf8',
);

const db = new PGlite();
let hashSequence = 1;

function manifest(eventKey, heroUrl, marker = 'current') {
  return {
    eventId: eventKey,
    slug: eventKey,
    marker,
    hero: { imageSrc: heroUrl },
  };
}

function contentHash() {
  return (hashSequence++).toString(16).padStart(64, '0');
}

async function one(sql, params = []) {
  const result = await db.query(sql, params);
  assert.equal(result.rows.length, 1, `Expected one row from: ${sql}`);
  return result.rows[0];
}

async function scalar(sql, params = []) {
  return Object.values(await one(sql, params))[0];
}

async function createEvent(slug) {
  return scalar(
    'insert into public.events (slug) values ($1) returning id',
    [slug],
  );
}

async function createPage(eventId, eventKey) {
  return scalar(`
    insert into public.event_pages (event_id, event_key, slug)
    values ($1::uuid, $2::text, $2::text)
    returning id
  `, [eventId, eventKey]);
}

async function createVersion(pageId, pageManifest, status = 'approved') {
  return scalar(`
    insert into public.event_page_versions (
      event_page_id,
      version_number,
      schema_version,
      status,
      manifest,
      content_hash,
      is_valid,
      created_by,
      reviewed_by,
      reviewed_at
    )
    values (
      $1::uuid,
      (
        select coalesce(max(version_number), 0) + 1
        from public.event_page_versions
        where event_page_id = $1::uuid
      ),
      1,
      $2::text,
      $3::jsonb,
      $4::text,
      true,
      'lifecycle-test',
      'lifecycle-test',
      now()
    )
    returning id
  `, [pageId, status, JSON.stringify(pageManifest), contentHash()]);
}

async function createPackage({
  eventId,
  eventKey,
  pageManifest,
  status = 'publishing',
  supersedesPackageId = null,
  publishedAt = null,
  candidateId = null,
}) {
  return scalar(`
    insert into public.event_factory_packages (
      candidate_id,
      event_id,
      target_year,
      event_key,
      slug,
      status,
      page_manifest,
      art_asset,
      readiness_score,
      reviewed_by,
      published_by,
      published_at,
      supersedes_package_id
    )
    values (
      coalesce($8::uuid, gen_random_uuid()),
      $1::uuid,
      2026,
      $2::text,
      $2::text,
      $3::text,
      $4::jsonb,
      jsonb_build_object(
        'src', $5::text,
        'publicUrl', $5::text
      ),
      1,
      'lifecycle-test',
      case when $3::text = 'published' then 'lifecycle-test' else null end,
      $6::timestamptz,
      $7::uuid
    )
    returning id
  `, [
    eventId,
    eventKey,
    status,
    JSON.stringify(pageManifest),
    pageManifest.hero.imageSrc,
    publishedAt,
    supersedesPackageId,
    candidateId,
  ]);
}

async function createMedia(eventId, heroUrl, status = 'approved') {
  return scalar(`
    insert into public.event_media (
      event_id,
      media_role,
      source,
      status,
      public_url,
      alt_text
    )
    values ($1::uuid, 'hero', 'supabase', $2::text, $3::text, 'Lifecycle fixture')
    returning id
  `, [eventId, status, heroUrl]);
}

async function activate(packageId, versionId, mediaId, notes = 'Focused lifecycle fixture') {
  return one(`
    select *
    from public.atlas_activate_event_factory_publication(
      $1::uuid,
      $2::uuid,
      $3::uuid,
      'lifecycle-test'::text,
      $4::text
    )
  `, [packageId, versionId, mediaId, notes]);
}

async function packageStatus(packageId) {
  return scalar(
    'select status from public.event_factory_packages where id = $1::uuid',
    [packageId],
  );
}

async function versionStatus(versionId) {
  return scalar(
    'select status from public.event_page_versions where id = $1::uuid',
    [versionId],
  );
}

async function publishedPointer(pageId) {
  return scalar(
    'select published_version_id from public.event_pages where id = $1::uuid',
    [pageId],
  );
}

async function markFailed(packageId, notes) {
  return one(`
    select *
    from public.atlas_finish_event_factory_publication(
      $1::uuid,
      false,
      'lifecycle-test',
      $2::text
    )
  `, [packageId, notes]);
}

try {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;

    create table public.events (
      id uuid primary key default gen_random_uuid(),
      slug text not null unique
    );

    create or replace function public.atlas_assert_service_role()
    returns void
    language plpgsql
    stable
    security definer
    set search_path = ''
    as $$
    begin
      if session_user in ('postgres', 'service_role') then
        return;
      end if;
      raise exception 'service role required' using errcode = '42501';
    end;
    $$;

    revoke execute on function public.atlas_assert_service_role()
      from public, anon, authenticated;
  `);

  await db.exec(migration005);

  await db.exec(`
    create table public.event_media (
      id uuid primary key default gen_random_uuid(),
      event_id uuid not null references public.events(id) on delete cascade,
      media_role text not null,
      source text not null,
      status text not null,
      public_url text,
      alt_text text,
      updated_at timestamptz not null default now()
    );

    create table public.event_factory_packages (
      id uuid primary key default gen_random_uuid(),
      candidate_id uuid not null,
      event_id uuid references public.events(id) on delete set null,
      target_year integer not null,
      event_key text not null,
      slug text not null,
      status text not null check (
        status in ('approved', 'publishing', 'published', 'failed')
      ),
      package_version integer not null default 1,
      page_manifest jsonb not null,
      art_asset jsonb not null,
      readiness_score numeric(4,3) not null default 1,
      reviewed_by text,
      review_notes text,
      published_by text,
      published_at timestamptz,
      updated_at timestamptz not null default now(),
      supersedes_package_id uuid references public.event_factory_packages(id)
    );

    create table public.event_factory_package_actions (
      id uuid primary key default gen_random_uuid(),
      package_id uuid not null references public.event_factory_packages(id) on delete cascade,
      action_type text not null,
      actor_identity text not null,
      from_status text,
      to_status text not null,
      notes text,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
  `);

  await db.exec(migration021);

  await db.exec(`
    create or replace function public.test_reject_atomic_publication()
    returns trigger
    language plpgsql
    set search_path = ''
    as $$
    begin
      if new.action_type = 'published'
         and new.notes = 'force activation rollback' then
        raise exception 'forced final activation failure';
      end if;
      return new;
    end;
    $$;

    create trigger test_reject_atomic_publication
    before insert on public.event_factory_package_actions
    for each row
    execute function public.test_reject_atomic_publication();
  `);

  // A. New event successful publication.
  const successKey = 'atomic-success';
  const successHero = 'https://example.test/atomic-success.png';
  const successManifest = manifest(successKey, successHero);
  const successEventId = await createEvent(successKey);
  const successPageId = await createPage(successEventId, successKey);
  const successVersionId = await createVersion(successPageId, successManifest);
  const successPackageId = await createPackage({
    eventId: successEventId,
    eventKey: successKey,
    pageManifest: successManifest,
  });
  const successMediaId = await createMedia(successEventId, successHero);

  const success = await activate(
    successPackageId,
    successVersionId,
    successMediaId,
  );
  assert.equal(success.status, 'published');
  assert.equal(success.activated, true);
  assert.equal(await packageStatus(successPackageId), 'published');
  assert.equal(await versionStatus(successVersionId), 'published');
  assert.equal(await publishedPointer(successPageId), successVersionId);
  assert.equal(
    Number(await scalar(`
      select count(*)
      from public.atlas_get_published_event_page($1::text)
    `, [successKey])),
    1,
    'a fully activated Event Factory page must resolve publicly',
  );

  // B. Media registration failure leaves the approved page private.
  const mediaFailureKey = 'atomic-media-failure';
  const mediaFailureHero = 'https://example.test/media-failure.png';
  const mediaFailureManifest = manifest(mediaFailureKey, mediaFailureHero);
  const mediaFailureEventId = await createEvent(mediaFailureKey);
  const mediaFailurePageId = await createPage(mediaFailureEventId, mediaFailureKey);
  const mediaFailureVersionId = await createVersion(
    mediaFailurePageId,
    mediaFailureManifest,
  );
  const mediaFailurePackageId = await createPackage({
    eventId: mediaFailureEventId,
    eventKey: mediaFailureKey,
    pageManifest: mediaFailureManifest,
  });

  await assert.rejects(
    activate(
      mediaFailurePackageId,
      mediaFailureVersionId,
      '00000000-0000-0000-0000-000000000001',
    ),
    /Approved package media was not found/,
  );
  await markFailed(mediaFailurePackageId, 'media registration failed');
  assert.equal(await packageStatus(mediaFailurePackageId), 'failed');
  assert.equal(await versionStatus(mediaFailureVersionId), 'approved');
  assert.equal(await publishedPointer(mediaFailurePageId), null);
  assert.equal(
    Number(await scalar(
      'select count(*) from public.atlas_get_published_event_page($1::text)',
      [mediaFailureKey],
    )),
    0,
  );

  // C. A failure at the final audit insert rolls back every public change.
  const rollbackKey = 'atomic-final-failure';
  const rollbackHero = 'https://example.test/final-failure.png';
  const rollbackManifest = manifest(rollbackKey, rollbackHero);
  const rollbackEventId = await createEvent(rollbackKey);
  const rollbackPageId = await createPage(rollbackEventId, rollbackKey);
  const rollbackVersionId = await createVersion(rollbackPageId, rollbackManifest);
  const rollbackPackageId = await createPackage({
    eventId: rollbackEventId,
    eventKey: rollbackKey,
    pageManifest: rollbackManifest,
  });
  const rollbackMediaId = await createMedia(rollbackEventId, rollbackHero);

  await assert.rejects(
    activate(
      rollbackPackageId,
      rollbackVersionId,
      rollbackMediaId,
      'force activation rollback',
    ),
    /forced final activation failure/,
  );
  assert.equal(await packageStatus(rollbackPackageId), 'publishing');
  assert.equal(await versionStatus(rollbackVersionId), 'approved');
  assert.equal(await publishedPointer(rollbackPageId), null);
  assert.equal(
    Number(await scalar(`
      select count(*)
      from public.event_page_version_transitions
      where version_id = $1::uuid and to_status = 'published'
    `, [rollbackVersionId])),
    0,
  );
  await markFailed(rollbackPackageId, 'final activation failed');

  // D. Revision success keeps the old page public until the same transaction
  // archives it, activates the replacement, and publishes the new package.
  const revisionKey = 'atomic-revision';
  const oldRevisionHero = 'https://example.test/revision-old.png';
  const newRevisionHero = 'https://example.test/revision-new.png';
  const oldRevisionManifest = manifest(revisionKey, oldRevisionHero, 'old');
  const newRevisionManifest = manifest(revisionKey, newRevisionHero, 'new');
  const revisionEventId = await createEvent(revisionKey);
  const revisionPageId = await createPage(revisionEventId, revisionKey);
  const oldRevisionVersionId = await createVersion(
    revisionPageId,
    oldRevisionManifest,
    'published',
  );
  await db.query(`
    update public.event_pages
    set published_version_id = $1::uuid
    where id = $2::uuid
  `, [oldRevisionVersionId, revisionPageId]);
  const oldRevisionPackageId = await createPackage({
    eventId: revisionEventId,
    eventKey: revisionKey,
    pageManifest: oldRevisionManifest,
    status: 'published',
    publishedAt: '2026-07-01T12:00:00Z',
  });
  const revisionCandidateId = await scalar(`
    select candidate_id
    from public.event_factory_packages
    where id = $1::uuid
  `, [oldRevisionPackageId]);
  const newRevisionVersionId = await createVersion(
    revisionPageId,
    newRevisionManifest,
  );
  const newRevisionPackageId = await createPackage({
    eventId: revisionEventId,
    eventKey: revisionKey,
    pageManifest: newRevisionManifest,
    supersedesPackageId: oldRevisionPackageId,
    candidateId: revisionCandidateId,
  });
  const newRevisionMediaId = await createMedia(
    revisionEventId,
    newRevisionHero,
  );

  assert.equal(await publishedPointer(revisionPageId), oldRevisionVersionId);
  const revision = await activate(
    newRevisionPackageId,
    newRevisionVersionId,
    newRevisionMediaId,
  );
  assert.equal(revision.previous_version_id, oldRevisionVersionId);
  assert.equal(await versionStatus(oldRevisionVersionId), 'archived');
  assert.equal(await versionStatus(newRevisionVersionId), 'published');
  assert.equal(await publishedPointer(revisionPageId), newRevisionVersionId);
  assert.equal(await packageStatus(oldRevisionPackageId), 'published');
  assert.equal(await packageStatus(newRevisionPackageId), 'published');

  // E. Revision activation failure restores the old pointer and all statuses.
  const revisionFailureKey = 'atomic-revision-failure';
  const revisionFailureOldHero = 'https://example.test/revision-failure-old.png';
  const revisionFailureNewHero = 'https://example.test/revision-failure-new.png';
  const revisionFailureOldManifest = manifest(
    revisionFailureKey,
    revisionFailureOldHero,
    'old',
  );
  const revisionFailureNewManifest = manifest(
    revisionFailureKey,
    revisionFailureNewHero,
    'new',
  );
  const revisionFailureEventId = await createEvent(revisionFailureKey);
  const revisionFailurePageId = await createPage(
    revisionFailureEventId,
    revisionFailureKey,
  );
  const revisionFailureOldVersionId = await createVersion(
    revisionFailurePageId,
    revisionFailureOldManifest,
    'published',
  );
  await db.query(`
    update public.event_pages
    set published_version_id = $1::uuid
    where id = $2::uuid
  `, [revisionFailureOldVersionId, revisionFailurePageId]);
  const revisionFailureOldPackageId = await createPackage({
    eventId: revisionFailureEventId,
    eventKey: revisionFailureKey,
    pageManifest: revisionFailureOldManifest,
    status: 'published',
    publishedAt: '2026-07-02T12:00:00Z',
  });
  const revisionFailureCandidateId = await scalar(`
    select candidate_id
    from public.event_factory_packages
    where id = $1::uuid
  `, [revisionFailureOldPackageId]);
  const revisionFailureNewVersionId = await createVersion(
    revisionFailurePageId,
    revisionFailureNewManifest,
  );
  const revisionFailureNewPackageId = await createPackage({
    eventId: revisionFailureEventId,
    eventKey: revisionFailureKey,
    pageManifest: revisionFailureNewManifest,
    supersedesPackageId: revisionFailureOldPackageId,
    candidateId: revisionFailureCandidateId,
  });
  const revisionFailureMediaId = await createMedia(
    revisionFailureEventId,
    revisionFailureNewHero,
  );

  await assert.rejects(
    activate(
      revisionFailureNewPackageId,
      revisionFailureNewVersionId,
      revisionFailureMediaId,
      'force activation rollback',
    ),
    /forced final activation failure/,
  );
  assert.equal(
    await publishedPointer(revisionFailurePageId),
    revisionFailureOldVersionId,
  );
  assert.equal(
    await versionStatus(revisionFailureOldVersionId),
    'published',
  );
  assert.equal(
    await versionStatus(revisionFailureNewVersionId),
    'approved',
  );
  assert.equal(
    await packageStatus(revisionFailureNewPackageId),
    'publishing',
  );
  await markFailed(
    revisionFailureNewPackageId,
    'revision activation failed',
  );

  // F. Exact replay is a no-op and creates no duplicate outputs or audits.
  const replay = await activate(
    successPackageId,
    successVersionId,
    successMediaId,
    'uncertain response replay',
  );
  assert.equal(replay.activated, false);
  assert.equal(
    Number(await scalar(`
      select count(*)
      from public.event_factory_package_actions
      where package_id = $1::uuid and action_type = 'published'
    `, [successPackageId])),
    1,
  );
  assert.equal(
    Number(await scalar(`
      select count(*)
      from public.event_page_version_transitions
      where version_id = $1::uuid and to_status = 'published'
    `, [successVersionId])),
    1,
  );
  assert.equal(
    Number(await scalar(`
      select count(*)
      from public.event_page_versions
      where event_page_id = $1::uuid
    `, [successPageId])),
    1,
  );
  assert.equal(
    Number(await scalar(`
      select count(*)
      from public.event_media
      where event_id = $1::uuid and public_url = $2::text
    `, [successEventId, successHero])),
    1,
  );

  // G. Page, media, manifest, and canonical identities cannot be crossed.
  await assert.rejects(
    activate(successPackageId, newRevisionVersionId, successMediaId),
    /Event Hub page and package identities do not match/,
  );
  await assert.rejects(
    activate(successPackageId, successVersionId, newRevisionMediaId),
    /Approved media does not match the frozen package art/,
  );

  const manifestMismatchKey = 'atomic-manifest-mismatch';
  const manifestMismatchHero = 'https://example.test/manifest-mismatch.png';
  const manifestMismatchPackageManifest = manifest(
    manifestMismatchKey,
    manifestMismatchHero,
    'package',
  );
  const manifestMismatchVersionManifest = manifest(
    manifestMismatchKey,
    manifestMismatchHero,
    'version',
  );
  const manifestMismatchEventId = await createEvent(manifestMismatchKey);
  const manifestMismatchPageId = await createPage(
    manifestMismatchEventId,
    manifestMismatchKey,
  );
  const manifestMismatchVersionId = await createVersion(
    manifestMismatchPageId,
    manifestMismatchVersionManifest,
  );
  const manifestMismatchPackageId = await createPackage({
    eventId: manifestMismatchEventId,
    eventKey: manifestMismatchKey,
    pageManifest: manifestMismatchPackageManifest,
  });
  const manifestMismatchMediaId = await createMedia(
    manifestMismatchEventId,
    manifestMismatchHero,
  );
  await assert.rejects(
    activate(
      manifestMismatchPackageId,
      manifestMismatchVersionId,
      manifestMismatchMediaId,
    ),
    /Event Hub version does not contain the frozen package manifest/,
  );

  // The independent Event Page RPC cannot activate a prepared factory version.
  await assert.rejects(
    db.query(`
      select *
      from public.atlas_publish_event_page_version(
        $1::uuid,
        'lifecycle-test'
      )
    `, [mediaFailureVersionId]),
    /must be activated with their published package/,
  );
  assert.equal(await publishedPointer(mediaFailurePageId), null);

  // A pre-migration leaked pointer is hidden when its exact package failed.
  const leakedKey = 'atomic-leaked-pointer';
  const leakedHero = 'https://example.test/leaked.png';
  const leakedManifest = manifest(leakedKey, leakedHero);
  const leakedEventId = await createEvent(leakedKey);
  const leakedPageId = await createPage(leakedEventId, leakedKey);
  const leakedVersionId = await createVersion(
    leakedPageId,
    leakedManifest,
    'published',
  );
  await db.query(`
    update public.event_pages
    set published_version_id = $1::uuid
    where id = $2::uuid
  `, [leakedVersionId, leakedPageId]);
  await createPackage({
    eventId: leakedEventId,
    eventKey: leakedKey,
    pageManifest: leakedManifest,
    status: 'failed',
  });
  assert.equal(
    Number(await scalar(
      'select count(*) from public.atlas_get_published_event_page($1::text)',
      [leakedKey],
    )),
    0,
    'a failed factory package must not make an independently published pointer public',
  );

  // Standalone versioning remains available when no package owns the manifest.
  const standaloneKey = 'atomic-standalone-page';
  const standaloneEventId = await createEvent(standaloneKey);
  const standalonePageId = await createPage(standaloneEventId, standaloneKey);
  const standaloneVersionId = await createVersion(
    standalonePageId,
    manifest(standaloneKey, 'https://example.test/standalone.png'),
    'published',
  );
  await db.query(`
    update public.event_pages
    set published_version_id = $1::uuid
    where id = $2::uuid
  `, [standaloneVersionId, standalonePageId]);
  assert.equal(
    Number(await scalar(
      'select count(*) from public.atlas_get_published_event_page($1::text)',
      [standaloneKey],
    )),
    1,
  );

  // H. Only service_role may execute the activation boundary.
  const activationSignature =
    'public.atlas_activate_event_factory_publication(uuid,uuid,uuid,text,text)';
  for (const role of ['public', 'anon', 'authenticated']) {
    assert.equal(
      await scalar(
        'select has_function_privilege($1::name, $2::regprocedure, $3::text)',
        [role, activationSignature, 'EXECUTE'],
      ),
      false,
      `${role} must not execute the final activation RPC`,
    );
  }
  assert.equal(
    await scalar(
      'select has_function_privilege($1::name, $2::regprocedure, $3::text)',
      ['service_role', activationSignature, 'EXECUTE'],
    ),
    true,
  );
  const activationProtection = await one(`
    select prosecdef, proconfig
    from pg_catalog.pg_proc
    where oid = $1::regprocedure
  `, [activationSignature]);
  assert.equal(activationProtection.prosecdef, true);
  assert(
    Array.isArray(activationProtection.proconfig)
      && activationProtection.proconfig.length === 1
      && /^search_path=(?:"")?$/.test(activationProtection.proconfig[0]),
    'final activation must retain an empty search path',
  );

  await assert.rejects(
    db.query(`
      select *
      from public.atlas_finish_event_factory_publication(
        $1::uuid,
        true,
        'lifecycle-test',
        'legacy success path'
      )
    `, [manifestMismatchPackageId]),
    /Successful publication requires the atomic Event Factory activation RPC/,
  );

  console.log('Event Factory atomic publication lifecycle validations passed.');
} finally {
  await db.close();
}
